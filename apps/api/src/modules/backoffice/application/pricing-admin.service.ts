import type { Prisma } from '../../../generated/prisma/client.js';
import type { RequestMeta } from '../../../shared/application/audit.js';
import { auditJson } from '../../../shared/application/audit.js';
import { calendarDateFromUtcDate, calendarDateToUtcDate, type CalendarDate } from '../../../shared/domain/calendar-date.js';
import { ConcurrencyError, ConflictError, NotFoundError, ValidationError } from '../../../shared/domain/domain-error.js';
import { assertCurrencyCode, type CurrencyCode } from '../../../shared/domain/money.js';
import type { IdGenerator } from '../../../shared/domain/ports.js';
import type { PaxType, Residency } from '../../catalog/domain/tour.js';
import type { StaffActor } from '../../identity/application/staff-auth.use-cases.js';
import { assertRateShape, describeRate, ratesOverlap, type RateRange } from '../domain/backoffice-rules.js';
import type { AdminDatabase, AdminTx } from '../infrastructure/admin-database.js';
import { TourNotFoundError } from './tours-admin.service.js';

export interface SeasonInput {
  code: string;
  name: string;
  startDate: CalendarDate;
  endDate: CalendarDate;
  priority?: number;
}

export interface RateInput {
  seasonId?: string | null;
  paxType: PaxType;
  residency: Residency;
  currency: CurrencyCode;
  /** Céntimos. */
  amount: bigint;
  validFrom: CalendarDate;
  validTo: CalendarDate;
  minGroupSize?: number;
  maxGroupSize?: number | null;
  isActive?: boolean;
}

type SeasonRow = Prisma.SeasonGetPayload<object>;
type RateRow = Prisma.RateGetPayload<object>;

function presentSeason(s: SeasonRow) {
  return {
    id: s.id,
    code: s.code,
    name: s.name,
    startDate: calendarDateFromUtcDate(s.startDate),
    endDate: calendarDateFromUtcDate(s.endDate),
    priority: s.priority,
    version: s.version,
    updatedAt: s.updatedAt,
  };
}

function rateRange(r: RateRow): RateRange & { amount: bigint } {
  return {
    id: r.id,
    tourId: r.tourId,
    seasonId: r.seasonId,
    paxType: r.paxType,
    residency: r.residency,
    currency: r.currency,
    validFrom: calendarDateFromUtcDate(r.validFrom),
    validTo: calendarDateFromUtcDate(r.validTo),
    minGroupSize: r.minGroupSize,
    maxGroupSize: r.maxGroupSize,
    isActive: r.isActive,
    amount: r.amount,
  };
}

function presentRate(r: RateRow) {
  const range = rateRange(r);
  return {
    id: r.id,
    tourId: r.tourId,
    seasonId: r.seasonId,
    paxType: r.paxType,
    residency: r.residency,
    price: { amount: r.amount, currency: assertCurrencyCode(r.currency) },
    validFrom: range.validFrom,
    validTo: range.validTo,
    minGroupSize: r.minGroupSize,
    maxGroupSize: r.maxGroupSize,
    isActive: r.isActive,
    version: r.version,
    updatedAt: r.updatedAt,
    description: describeRate(range),
  };
}

export class RateOverlapError extends ConflictError {
  constructor(conflicting: RateRange & { id?: string }) {
    super('rate-overlap', `La tarifa se superpone con otra vigente: ${describeRate(conflicting)}. Ajusta la vigencia, el rango de grupo o desactiva la otra tarifa.`, {
      conflictingRateId: conflicting.id ?? null,
      conflictingRate: describeRate(conflicting),
    });
  }
}

/** Temporadas y tarifas (HU-7.2 / HU-7.3). Los cambios de precio no alteran reservas existentes (precios congelados). */
export class PricingAdminService {
  constructor(
    private readonly db: AdminDatabase,
    private readonly ids: IdGenerator,
  ) {}

  // --- Temporadas ---
  listSeasons() {
    return this.db.read(async (prisma) => (await prisma.season.findMany({ orderBy: [{ startDate: 'asc' }, { priority: 'desc' }] })).map(presentSeason));
  }

  createSeason(actor: StaffActor, meta: RequestMeta, input: SeasonInput) {
    assertSeason(input);
    return this.db.run(actor, meta, async (ctx) => {
      if (await ctx.tx.season.findUnique({ where: { code: input.code } })) throw new ConflictError('season-code-taken', `El código "${input.code}" ya existe.`);
      const row = await ctx.tx.season.create({
        data: {
          id: this.ids.next(),
          code: input.code,
          name: input.name,
          startDate: calendarDateToUtcDate(input.startDate),
          endDate: calendarDateToUtcDate(input.endDate),
          priority: input.priority ?? 0,
        },
      });
      await ctx.audit({ entityType: 'seasons', entityId: row.id, action: 'SEASON_CREATED', after: auditJson(presentSeason(row)) });
      return presentSeason(row);
    });
  }

  updateSeason(actor: StaffActor, meta: RequestMeta, id: string, input: Partial<SeasonInput> & { version: number }) {
    return this.db.run(actor, meta, async (ctx) => {
      const current = await this.loadSeason(ctx, id);
      const merged = {
        code: input.code ?? current.code,
        name: input.name ?? current.name,
        startDate: input.startDate ?? calendarDateFromUtcDate(current.startDate),
        endDate: input.endDate ?? calendarDateFromUtcDate(current.endDate),
        priority: input.priority ?? current.priority,
      };
      assertSeason(merged);
      if (merged.code !== current.code && (await ctx.tx.season.findUnique({ where: { code: merged.code } }))) {
        throw new ConflictError('season-code-taken', `El código "${merged.code}" ya existe.`);
      }
      const updated = await ctx.tx.season.updateMany({
        where: { id, version: input.version },
        data: {
          code: merged.code,
          name: merged.name,
          startDate: calendarDateToUtcDate(merged.startDate),
          endDate: calendarDateToUtcDate(merged.endDate),
          priority: merged.priority,
          version: { increment: 1 },
        },
      });
      if (updated.count === 0) throw new ConcurrencyError('La temporada fue modificada por otra operación. Recarga e intenta de nuevo.');
      const row = await ctx.tx.season.findUniqueOrThrow({ where: { id } });
      await ctx.audit({ entityType: 'seasons', entityId: id, action: 'SEASON_UPDATED', before: auditJson(presentSeason(current)), after: auditJson(presentSeason(row)) });
      return presentSeason(row);
    });
  }

  deleteSeason(actor: StaffActor, meta: RequestMeta, id: string) {
    return this.db.run(actor, meta, async (ctx) => {
      const current = await this.loadSeason(ctx, id);
      const inUse = await ctx.tx.rate.count({ where: { seasonId: id, deletedAt: null } });
      if (inUse > 0) throw new ConflictError('season-in-use', `La temporada tiene ${inUse} tarifa(s) asociada(s). Reasígnalas o elimínalas primero.`, { rates: inUse });
      await ctx.tx.rate.updateMany({ where: { seasonId: id }, data: { seasonId: null } });
      await ctx.tx.season.delete({ where: { id } });
      await ctx.audit({ entityType: 'seasons', entityId: id, action: 'SEASON_DELETED', before: auditJson(presentSeason(current)) });
    });
  }

  // --- Tarifas ---
  listRates(tourId: string, includeInactive: boolean) {
    return this.db.read(async (prisma) => {
      if (!(await prisma.tour.findUnique({ where: { id: tourId }, select: { id: true } }))) throw new TourNotFoundError();
      const rows = await prisma.rate.findMany({
        where: { tourId, deletedAt: null, ...(includeInactive ? {} : { isActive: true }) },
        orderBy: [{ currency: 'asc' }, { residency: 'asc' }, { paxType: 'asc' }, { validFrom: 'asc' }],
      });
      return rows.map(presentRate);
    });
  }

  createRate(actor: StaffActor, meta: RequestMeta, tourId: string, input: RateInput) {
    return this.db.run(actor, meta, async (ctx) => {
      if (!(await ctx.tx.tour.findFirst({ where: { id: tourId, deletedAt: null }, select: { id: true } }))) throw new TourNotFoundError();
      const range = { tourId, ...normalizeRate(input) };
      assertRateShape(range);
      await this.assertSeasonExists(ctx, range.seasonId);
      await this.assertNoOverlap(ctx, range);
      const row = await ctx.tx.rate.create({
        data: {
          id: this.ids.next(),
          tourId,
          seasonId: range.seasonId,
          paxType: input.paxType,
          residency: input.residency,
          currency: range.currency,
          amount: range.amount,
          validFrom: calendarDateToUtcDate(range.validFrom),
          validTo: calendarDateToUtcDate(range.validTo),
          minGroupSize: range.minGroupSize,
          maxGroupSize: range.maxGroupSize,
          isActive: range.isActive,
        },
      });
      await ctx.audit({ entityType: 'rates', entityId: row.id, action: 'RATE_CREATED', after: auditJson(presentRate(row)) });
      return presentRate(row);
    });
  }

  updateRate(actor: StaffActor, meta: RequestMeta, rateId: string, input: Partial<RateInput> & { version: number }) {
    return this.db.run(actor, meta, async (ctx) => {
      const current = await this.loadRate(ctx, rateId);
      const base = rateRange(current);
      const range = {
        ...base,
        ...normalizeRate({
          seasonId: input.seasonId !== undefined ? input.seasonId : base.seasonId,
          paxType: input.paxType ?? (base.paxType as PaxType),
          residency: input.residency ?? (base.residency as Residency),
          currency: input.currency ?? assertCurrencyCode(base.currency),
          amount: input.amount ?? base.amount,
          validFrom: input.validFrom ?? base.validFrom,
          validTo: input.validTo ?? base.validTo,
          minGroupSize: input.minGroupSize ?? base.minGroupSize,
          maxGroupSize: input.maxGroupSize !== undefined ? input.maxGroupSize : base.maxGroupSize,
          isActive: input.isActive ?? base.isActive,
        }),
      };
      assertRateShape(range);
      await this.assertSeasonExists(ctx, range.seasonId);
      await this.assertNoOverlap(ctx, range, rateId);
      const updated = await ctx.tx.rate.updateMany({
        where: { id: rateId, version: input.version, deletedAt: null },
        data: {
          seasonId: range.seasonId,
          paxType: range.paxType as PaxType,
          residency: range.residency as Residency,
          currency: range.currency,
          amount: range.amount,
          validFrom: calendarDateToUtcDate(range.validFrom),
          validTo: calendarDateToUtcDate(range.validTo),
          minGroupSize: range.minGroupSize,
          maxGroupSize: range.maxGroupSize,
          isActive: range.isActive,
          version: { increment: 1 },
        },
      });
      if (updated.count === 0) throw new ConcurrencyError('La tarifa fue modificada por otra operación. Recarga e intenta de nuevo.');
      const row = await ctx.tx.rate.findUniqueOrThrow({ where: { id: rateId } });
      await ctx.audit({ entityType: 'rates', entityId: rateId, action: 'RATE_UPDATED', before: auditJson(presentRate(current)), after: auditJson(presentRate(row)) });
      return presentRate(row);
    });
  }

  /** Borrado lógico: las reservas guardan su `rate_id` y precio congelado. */
  deleteRate(actor: StaffActor, meta: RequestMeta, rateId: string) {
    return this.db.run(actor, meta, async (ctx) => {
      const current = await this.loadRate(ctx, rateId);
      await ctx.tx.rate.update({ where: { id: rateId }, data: { deletedAt: ctx.now, isActive: false, version: { increment: 1 } } });
      await ctx.audit({ entityType: 'rates', entityId: rateId, action: 'RATE_DELETED', before: auditJson(presentRate(current)) });
    });
  }

  private async assertNoOverlap(ctx: AdminTx, range: RateRange, excludeId?: string): Promise<void> {
    if (!range.isActive) return;
    const candidates = await ctx.tx.rate.findMany({
      where: {
        tourId: range.tourId,
        paxType: range.paxType as PaxType,
        residency: range.residency as Residency,
        currency: range.currency,
        seasonId: range.seasonId,
        isActive: true,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    const conflict = candidates.map(rateRange).find((c) => ratesOverlap(range, c));
    if (conflict) throw new RateOverlapError(conflict);
  }

  private async assertSeasonExists(ctx: AdminTx, seasonId: string | null): Promise<void> {
    if (seasonId && !(await ctx.tx.season.findUnique({ where: { id: seasonId }, select: { id: true } }))) {
      throw new ValidationError('validation-failed', 'Temporada inexistente.', { errors: [{ field: 'seasonId', messages: ['La temporada no existe.'] }] });
    }
  }

  private async loadSeason(ctx: AdminTx, id: string): Promise<SeasonRow> {
    const row = /^[0-9a-f-]{36}$/i.test(id) ? await ctx.tx.season.findUnique({ where: { id } }) : null;
    if (!row) throw new NotFoundError('season-not-found', 'Temporada no encontrada.');
    return row;
  }

  private async loadRate(ctx: AdminTx, id: string): Promise<RateRow> {
    const row = /^[0-9a-f-]{36}$/i.test(id) ? await ctx.tx.rate.findFirst({ where: { id, deletedAt: null } }) : null;
    if (!row) throw new NotFoundError('rate-not-found', 'Tarifa no encontrada.');
    return row;
  }
}

function normalizeRate(input: RateInput) {
  return {
    seasonId: input.seasonId ?? null,
    paxType: input.paxType,
    residency: input.residency,
    currency: assertCurrencyCode(input.currency),
    amount: input.amount,
    validFrom: input.validFrom,
    validTo: input.validTo,
    minGroupSize: input.minGroupSize ?? 1,
    maxGroupSize: input.maxGroupSize ?? null,
    isActive: input.isActive ?? true,
  };
}

function assertSeason(s: SeasonInput): void {
  if (s.endDate < s.startDate) {
    throw new ValidationError('validation-failed', 'Fechas de temporada inválidas.', { errors: [{ field: 'endDate', messages: ['Debe ser igual o posterior a startDate.'] }] });
  }
}
