import type { Prisma } from '../../../generated/prisma/client.js';
import { auditJson, type RequestMeta } from '../../../shared/application/audit.js';
import { calendarDateFromUtcDate, calendarDateToUtcDate } from '../../../shared/domain/calendar-date.js';
import { BusinessRuleError, ConflictError, NotFoundError, ValidationError } from '../../../shared/domain/domain-error.js';
import type { ContentLocale } from '../../../shared/domain/i18n.js';
import type { IdGenerator } from '../../../shared/domain/ports.js';
import type { MediaUrlResolver } from '../../media/domain/media.js';
import type { AdminDatabase, AdminTx } from '../../backoffice/infrastructure/admin-database.js';
import type { StaffActor } from '../../identity/application/staff-auth.use-cases.js';
import { assertPromotionRules, isPromotionLive, type PromotionCtaKind } from '../domain/promotion.js';

export interface PromotionTranslationInput {
  title: string;
  eyebrow?: string | null;
  summary: string;
  ctaLabel?: string | null;
  whatsappMessage?: string | null;
  translationStatus?: string | null;
}

export interface PromotionFieldsInput {
  startsAt?: string | null;
  endsAt?: string | null;
  eventStartsOn?: string | null;
  eventEndsOn?: string | null;
  coverStorageKey?: string | null;
  ctaKind?: PromotionCtaKind;
  tourId?: string | null;
  ctaPath?: string | null;
  showPopup?: boolean;
  sortOrder?: number;
}

const INCLUDE = { translations: true, tour: { select: { id: true, slug: true, status: true, deletedAt: true } } } satisfies Prisma.PromotionInclude;
type Row = Prisma.PromotionGetPayload<{ include: typeof INCLUDE }>;

const notFound = () => new NotFoundError('promotion-not-found', 'Evento no encontrado.');
const day = (d: Date | null) => (d ? calendarDateFromUtcDate(d) : null);

function presentAdmin(r: Row) {
  return {
    id: r.id,
    status: r.status,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    eventStartsOn: day(r.eventStartsOn),
    eventEndsOn: day(r.eventEndsOn),
    coverStorageKey: r.coverStorageKey,
    ctaKind: r.ctaKind as PromotionCtaKind,
    tourId: r.tourId,
    tourSlug: r.tour?.slug ?? null,
    ctaPath: r.ctaPath,
    showPopup: r.showPopup,
    sortOrder: r.sortOrder,
    version: r.version,
    updatedAt: r.updatedAt,
    deletedAt: r.deletedAt,
    translations: r.translations.map((t) => ({
      locale: t.locale,
      title: t.title,
      eyebrow: t.eyebrow,
      summary: t.summary,
      ctaLabel: t.ctaLabel,
      whatsappMessage: t.whatsappMessage,
      translationStatus: t.translationStatus,
    })),
  };
}
export type AdminPromotionView = ReturnType<typeof presentAdmin>;

/**
 * Eventos y campañas destacadas (p. ej. la Festividad de la Candelaria): sección «Lo más relevante»
 * y anuncio emergente de la home. Escrituras con actor, auditoría y bloqueo optimista (`version`),
 * igual que el resto del backoffice.
 */
export class PromotionsService {
  constructor(
    private readonly db: AdminDatabase,
    private readonly ids: IdGenerator,
    private readonly urls: MediaUrlResolver,
  ) {}

  // ---------------------------------------------------------------------------
  // Público
  // ---------------------------------------------------------------------------
  /** Eventos vigentes en el idioma pedido (con respaldo en español). Sin base de datos: lista vacía. */
  async listLive(locale: ContentLocale) {
    if (!this.db.available) return [];
    return this.db.read(async (prisma, now) => {
      const rows = await prisma.promotion.findMany({
        where: { status: 'published', deletedAt: null, OR: [{ startsAt: null }, { startsAt: { lte: now } }], AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }] },
        include: INCLUDE,
        orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
        take: 12,
      });
      return rows
        .filter((r) => isPromotionLive(r, now))
        .map((r) => {
          const own = r.translations.find((t) => t.locale === locale);
          const t = own ?? r.translations.find((x) => x.locale === 'es');
          if (!t) return null;
          // Un paquete despublicado o borrado no puede ser destino del botón: se ofrece WhatsApp.
          const tourOk = r.ctaKind === 'tour' && r.tour && r.tour.status === 'published' && !r.tour.deletedAt;
          const ctaKind: PromotionCtaKind = r.ctaKind === 'tour' && !tourOk ? 'whatsapp' : (r.ctaKind as PromotionCtaKind);
          return {
            id: r.id,
            locale: own ? locale : 'es',
            fallback: !own,
            title: t.title,
            eyebrow: t.eyebrow,
            summary: t.summary,
            ctaLabel: t.ctaLabel,
            whatsappMessage: t.whatsappMessage,
            cta: { kind: ctaKind, tourSlug: tourOk ? r.tour!.slug : null, path: ctaKind === 'page' ? r.ctaPath : null },
            image: r.coverStorageKey ? { url: this.urls.url(r.coverStorageKey), alt: t.title } : null,
            event: { startsOn: day(r.eventStartsOn), endsOn: day(r.eventEndsOn) },
            showPopup: r.showPopup,
            endsAt: r.endsAt,
            updatedAt: r.updatedAt,
          };
        })
        .filter((x) => x !== null);
    });
  }

  // ---------------------------------------------------------------------------
  // Backoffice
  // ---------------------------------------------------------------------------
  list() {
    return this.db.read(async (prisma) => {
      const rows = await prisma.promotion.findMany({ where: { deletedAt: null }, include: INCLUDE, orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }] });
      return rows.map(presentAdmin);
    });
  }

  get(id: string) {
    return this.db.read(async (prisma) => {
      const row = await prisma.promotion.findFirst({ where: { id, deletedAt: null }, include: INCLUDE });
      if (!row) throw notFound();
      return presentAdmin(row);
    });
  }

  create(actor: StaffActor, meta: RequestMeta, input: PromotionFieldsInput & { translation: PromotionTranslationInput }) {
    const fields = this.fields(input);
    assertPromotionRules(this.rules(fields, { ctaKind: 'whatsapp', tourId: null, ctaPath: null, startsAt: null, endsAt: null, eventStartsOn: null, eventEndsOn: null }));
    return this.db
      .run(actor, meta, async (ctx) => {
        if (fields.tourId) await this.assertTour(ctx, fields.tourId);
        const id = this.ids.next();
        await ctx.tx.promotion.create({
          data: { id, status: 'draft', ...fields, translations: { create: { id: this.ids.next(), locale: 'es', ...this.translation(input.translation) } } },
        });
        await ctx.audit({ entityType: 'promotions', entityId: id, action: 'PROMOTION_CREATED', after: auditJson({ title: input.translation.title }) });
        return id;
      })
      .then((id) => this.get(id));
  }

  update(actor: StaffActor, meta: RequestMeta, id: string, input: PromotionFieldsInput & { version: number }) {
    const fields = this.fields(input);
    return this.db
      .run(actor, meta, async (ctx) => {
        const current = await ctx.tx.promotion.findFirst({ where: { id, deletedAt: null } });
        if (!current) throw notFound();
        assertPromotionRules(
          this.rules(fields, {
            ctaKind: current.ctaKind as PromotionCtaKind,
            tourId: current.tourId,
            ctaPath: current.ctaPath,
            startsAt: current.startsAt,
            endsAt: current.endsAt,
            eventStartsOn: day(current.eventStartsOn),
            eventEndsOn: day(current.eventEndsOn),
          }),
        );
        if (fields.tourId) await this.assertTour(ctx, fields.tourId);
        await this.bump(ctx, id, input.version, fields);
        await ctx.audit({ entityType: 'promotions', entityId: id, action: 'PROMOTION_UPDATED', changedFields: Object.keys(fields), after: auditJson(fields) });
      })
      .then(() => this.get(id));
  }

  upsertTranslation(actor: StaffActor, meta: RequestMeta, id: string, locale: ContentLocale, input: PromotionTranslationInput & { version: number }) {
    return this.db
      .run(actor, meta, async (ctx) => {
        await this.bump(ctx, id, input.version);
        const data = this.translation(input);
        await ctx.tx.promotionTranslation.upsert({
          where: { promotionId_locale: { promotionId: id, locale } },
          create: { id: this.ids.next(), promotionId: id, locale, ...data },
          update: data,
        });
        await ctx.audit({ entityType: 'promotions', entityId: id, action: 'PROMOTION_TRANSLATION_SAVED', after: { locale } });
      })
      .then(() => this.get(id));
  }

  deleteTranslation(actor: StaffActor, meta: RequestMeta, id: string, locale: ContentLocale, version: number) {
    if (locale === 'es') throw new BusinessRuleError('canonical-translation-required', 'La versión en español es obligatoria.');
    return this.db
      .run(actor, meta, async (ctx) => {
        await this.bump(ctx, id, version);
        await ctx.tx.promotionTranslation.deleteMany({ where: { promotionId: id, locale } });
        await ctx.audit({ entityType: 'promotions', entityId: id, action: 'PROMOTION_TRANSLATION_DELETED', after: { locale } });
      })
      .then(() => this.get(id));
  }

  publish(actor: StaffActor, meta: RequestMeta, id: string, version: number) {
    return this.db
      .run(actor, meta, async (ctx) => {
        const row = await ctx.tx.promotion.findFirst({ where: { id, deletedAt: null }, include: { translations: { where: { locale: 'es' } }, tour: true } });
        if (!row) throw notFound();
        const errors: Array<{ field: string; messages: string[] }> = [];
        if (!row.translations[0]) errors.push({ field: 'translations.es', messages: ['Falta la versión en español.'] });
        if (row.ctaKind === 'tour' && (!row.tour || row.tour.status !== 'published' || row.tour.deletedAt)) {
          errors.push({ field: 'tourId', messages: ['El paquete del botón no está publicado.'] });
        }
        if (row.endsAt && row.endsAt <= ctx.now) errors.push({ field: 'endsAt', messages: ['La difusión ya terminó: cambia la fecha de fin.'] });
        if (errors.length) throw new BusinessRuleError('promotion-not-publishable', 'El evento no cumple los requisitos para publicarse.', { errors });
        await this.bump(ctx, id, version, { status: 'published' });
        await ctx.audit({ entityType: 'promotions', entityId: id, action: 'PROMOTION_PUBLISHED' });
      })
      .then(() => this.get(id));
  }

  unpublish(actor: StaffActor, meta: RequestMeta, id: string, version: number) {
    return this.db
      .run(actor, meta, async (ctx) => {
        await this.bump(ctx, id, version, { status: 'draft' });
        await ctx.audit({ entityType: 'promotions', entityId: id, action: 'PROMOTION_UNPUBLISHED' });
      })
      .then(() => this.get(id));
  }

  /** Borrado lógico: deja de verse y sale del listado; queda en la auditoría. */
  archive(actor: StaffActor, meta: RequestMeta, id: string, version: number) {
    return this.db.run(actor, meta, async (ctx) => {
      await this.bump(ctx, id, version, { status: 'archived', deletedAt: ctx.now });
      await ctx.audit({ entityType: 'promotions', entityId: id, action: 'PROMOTION_ARCHIVED' });
    });
  }

  // ---------------------------------------------------------------------------
  private async bump(ctx: AdminTx, id: string, version: number, data: Prisma.PromotionUncheckedUpdateManyInput = {}) {
    const r = await ctx.tx.promotion.updateMany({ where: { id, version, deletedAt: null }, data: { ...data, version: { increment: 1 } } });
    if (r.count !== 1) {
      if (!(await ctx.tx.promotion.findFirst({ where: { id, deletedAt: null }, select: { id: true } }))) throw notFound();
      throw new ConflictError('promotion-version-conflict', 'Este evento fue modificado por otra persona. Recarga y vuelve a intentar.');
    }
  }

  private async assertTour(ctx: AdminTx, tourId: string) {
    const tour = await ctx.tx.tour.findFirst({ where: { id: tourId, deletedAt: null }, select: { id: true } });
    if (!tour) throw new ValidationError('validation-failed', 'Paquete inexistente.', { errors: [{ field: 'tourId', messages: ['El paquete elegido no existe.'] }] });
  }

  /** Normaliza solo los campos enviados (undefined = no cambia). Fechas: ISO o día calendario. */
  private fields(input: PromotionFieldsInput): Prisma.PromotionUncheckedUpdateManyInput & Prisma.PromotionUncheckedCreateInput {
    const out: Record<string, unknown> = {};
    const instant = (v: string | null | undefined) => (v === undefined ? undefined : v ? new Date(v) : null);
    const date = (v: string | null | undefined) => (v === undefined ? undefined : v ? calendarDateToUtcDate(v) : null);
    if (input.startsAt !== undefined) out.startsAt = instant(input.startsAt);
    if (input.endsAt !== undefined) out.endsAt = instant(input.endsAt);
    if (input.eventStartsOn !== undefined) out.eventStartsOn = date(input.eventStartsOn);
    if (input.eventEndsOn !== undefined) out.eventEndsOn = date(input.eventEndsOn);
    if (input.coverStorageKey !== undefined) out.coverStorageKey = input.coverStorageKey || null;
    if (input.ctaKind !== undefined) out.ctaKind = input.ctaKind;
    if (input.tourId !== undefined) out.tourId = input.tourId || null;
    if (input.ctaPath !== undefined) out.ctaPath = input.ctaPath?.trim() || null;
    if (input.showPopup !== undefined) out.showPopup = input.showPopup;
    if (input.sortOrder !== undefined) out.sortOrder = input.sortOrder;
    return out as Prisma.PromotionUncheckedUpdateManyInput & Prisma.PromotionUncheckedCreateInput;
  }

  /** Estado resultante (cambios sobre lo actual) para validar reglas cruzadas. */
  private rules(next: Record<string, unknown>, current: Parameters<typeof assertPromotionRules>[0]) {
    const pick = <K extends keyof typeof current>(k: K): (typeof current)[K] => {
      const v = next[k as string];
      if (v === undefined) return current[k];
      if ((k === 'eventStartsOn' || k === 'eventEndsOn') && v instanceof Date) return calendarDateFromUtcDate(v) as (typeof current)[K];
      return v as (typeof current)[K];
    };
    return {
      ctaKind: pick('ctaKind'),
      tourId: pick('tourId'),
      ctaPath: pick('ctaPath'),
      startsAt: pick('startsAt'),
      endsAt: pick('endsAt'),
      eventStartsOn: pick('eventStartsOn'),
      eventEndsOn: pick('eventEndsOn'),
    };
  }

  private translation(t: PromotionTranslationInput) {
    return {
      title: t.title.trim(),
      eyebrow: t.eyebrow?.trim() || null,
      summary: t.summary.trim(),
      ctaLabel: t.ctaLabel?.trim() || null,
      whatsappMessage: t.whatsappMessage?.trim() || null,
      translationStatus: t.translationStatus ?? null,
    };
  }
}
