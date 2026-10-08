import type { Prisma } from '../../../generated/prisma/client.js';
import type { RequestMeta } from '../../../shared/application/audit.js';
import { addDays, calendarDateFromUtcDate, calendarDateToUtcDate, toLimaCalendarDate, type CalendarDate } from '../../../shared/domain/calendar-date.js';
import { BusinessRuleError, ConcurrencyError, NotFoundError, ValidationError } from '../../../shared/domain/domain-error.js';
import type { IdGenerator } from '../../../shared/domain/ports.js';
import type { StaffActor } from '../../identity/application/staff-auth.use-cases.js';
import { assertCapacityChange, generateDepartureDates } from '../domain/backoffice-rules.js';
import type { AdminDatabase, AdminTx } from '../infrastructure/admin-database.js';
import { TourNotFoundError } from './tours-admin.service.js';

type DepartureRow = Prisma.DepartureGetPayload<object>;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function timeToDate(hhmm: string): Date {
  return new Date(`1970-01-01T${hhmm}:00.000Z`);
}

function presentDeparture(d: DepartureRow) {
  return {
    id: d.id,
    tourId: d.tourId,
    departureDate: calendarDateFromUtcDate(d.departureDate),
    startTime: d.startTime.toISOString().slice(11, 16),
    capacity: d.capacity,
    booked: d.booked,
    held: d.held,
    available: Math.max(0, d.capacity - d.booked - d.held),
    isClosed: d.isClosed,
    version: d.version,
    updatedAt: d.updatedAt,
  };
}

export class DepartureNotFoundError extends NotFoundError {
  constructor() {
    super('departure-not-found', 'Salida no encontrada.');
  }
}

/** Salidas y cupos (HU-7.4): generación en lote, capacidad y cierre de ventas. */
export class DeparturesAdminService {
  constructor(
    private readonly db: AdminDatabase,
    private readonly ids: IdGenerator,
  ) {}

  list(tourId: string, range: { from?: CalendarDate; to?: CalendarDate }) {
    return this.db.read(async (prisma, now) => {
      if (!(await prisma.tour.findUnique({ where: { id: tourId }, select: { id: true } }))) throw new TourNotFoundError();
      const from = range.from ?? toLimaCalendarDate(now);
      const to = range.to ?? addDays(from, 365);
      const rows = await prisma.departure.findMany({
        where: { tourId, departureDate: { gte: calendarDateToUtcDate(from), lte: calendarDateToUtcDate(to) } },
        orderBy: [{ departureDate: 'asc' }, { startTime: 'asc' }],
        take: 500,
      });
      return rows.map(presentDeparture);
    });
  }

  /** Crea salidas por rango de fechas y días de semana; las existentes se omiten (idempotente). */
  bulkCreate(actor: StaffActor, meta: RequestMeta, tourId: string, input: { from: CalendarDate; to: CalendarDate; weekdays: number[]; startTime?: string; capacity: number }) {
    const startTime = input.startTime ?? '00:00';
    if (!TIME.test(startTime)) throw new ValidationError('validation-failed', 'Hora inválida.', { errors: [{ field: 'startTime', messages: ['Formato HH:MM (24 h).'] }] });
    if (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 10_000) {
      throw new ValidationError('validation-failed', 'Capacidad inválida.', { errors: [{ field: 'capacity', messages: ['Entero entre 1 y 10000.'] }] });
    }
    const dates = generateDepartureDates(input);
    return this.db.run(actor, meta, async (ctx) => {
      const tour = await ctx.tx.tour.findFirst({ where: { id: tourId, deletedAt: null }, select: { id: true, usesInventory: true } });
      if (!tour) throw new TourNotFoundError();
      const today = toLimaCalendarDate(ctx.now);
      if (input.from < today) throw new ValidationError('validation-failed', 'No se crean salidas en el pasado.', { errors: [{ field: 'from', messages: [`Debe ser ${today} o posterior.`] }] });
      const existing = await ctx.tx.departure.findMany({
        where: { tourId, startTime: timeToDate(startTime), departureDate: { in: dates.map(calendarDateToUtcDate) } },
        select: { departureDate: true },
      });
      const taken = new Set(existing.map((e) => calendarDateFromUtcDate(e.departureDate)));
      const toCreate = dates.filter((d) => !taken.has(d));
      if (toCreate.length > 0) {
        await ctx.tx.departure.createMany({
          data: toCreate.map((d) => ({ id: this.ids.next(), tourId, departureDate: calendarDateToUtcDate(d), startTime: timeToDate(startTime), capacity: input.capacity })),
          skipDuplicates: true,
        });
      }
      await ctx.audit({
        entityType: 'tours',
        entityId: tourId,
        action: 'DEPARTURES_BULK_CREATED',
        after: { from: input.from, to: input.to, weekdays: input.weekdays, startTime, capacity: input.capacity, created: toCreate.length, skipped: taken.size },
      });
      return { created: toCreate.length, skipped: [...taken].sort(), dates: toCreate, usesInventory: tour.usesInventory };
    });
  }

  update(actor: StaffActor, meta: RequestMeta, id: string, input: { version: number; capacity?: number; isClosed?: boolean }) {
    return this.db.run(actor, meta, async (ctx) => {
      const current = await this.load(ctx, id);
      if (input.capacity !== undefined) assertCapacityChange(input.capacity, current.booked, current.held);
      const data: Prisma.DepartureUpdateManyMutationInput = { version: { increment: 1 } };
      if (input.capacity !== undefined) data.capacity = input.capacity;
      if (input.isClosed !== undefined) data.isClosed = input.isClosed;
      const updated = await ctx.tx.departure.updateMany({ where: { id, version: input.version }, data });
      if (updated.count === 0) throw new ConcurrencyError('La salida cambió (otra edición o una venta en curso). Recarga e intenta de nuevo.');
      const row = await ctx.tx.departure.findUniqueOrThrow({ where: { id } });
      await ctx.audit({
        entityType: 'departures',
        entityId: id,
        action: input.isClosed === true ? 'DEPARTURE_SALES_CLOSED' : input.isClosed === false ? 'DEPARTURE_SALES_REOPENED' : 'DEPARTURE_UPDATED',
        before: { capacity: current.capacity, isClosed: current.isClosed },
        after: { capacity: row.capacity, isClosed: row.isClosed },
      });
      return presentDeparture(row);
    });
  }

  setSalesClosed(actor: StaffActor, meta: RequestMeta, id: string, version: number, closed: boolean) {
    return this.update(actor, meta, id, { version, isClosed: closed });
  }

  /** Elimina una salida sin ventas ni retenciones (p. ej. creada por error). */
  delete(actor: StaffActor, meta: RequestMeta, id: string, version: number) {
    return this.db.run(actor, meta, async (ctx) => {
      const current = await this.load(ctx, id);
      if (current.version !== version) throw new ConcurrencyError();
      if (current.booked + current.held > 0) throw new BusinessRuleError('departure-has-sales', 'La salida tiene cupos vendidos o retenidos: ciérrala en lugar de eliminarla.');
      const refs = (await ctx.tx.bookingItem.count({ where: { departureId: id } })) + (await ctx.tx.cartItem.count({ where: { departureId: id } }));
      if (refs > 0) throw new BusinessRuleError('departure-referenced', 'La salida está referenciada por carritos o reservas: ciérrala en lugar de eliminarla.');
      await ctx.tx.inventoryHold.deleteMany({ where: { departureId: id, status: { in: ['released', 'expired'] } } });
      await ctx.tx.departure.delete({ where: { id } });
      await ctx.audit({ entityType: 'departures', entityId: id, action: 'DEPARTURE_DELETED', before: { date: calendarDateFromUtcDate(current.departureDate) } });
    });
  }

  private async load(ctx: AdminTx, id: string): Promise<DepartureRow> {
    const row = /^[0-9a-f-]{36}$/i.test(id) ? await ctx.tx.departure.findUnique({ where: { id } }) : null;
    if (!row) throw new DepartureNotFoundError();
    return row;
  }
}
