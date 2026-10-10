import type { Prisma } from '../../../generated/prisma/client.js';
import type { RequestMeta } from '../../../shared/application/audit.js';
import { auditJson } from '../../../shared/application/audit.js';
import { BusinessRuleError, ConflictError, NotFoundError, ValidationError } from '../../../shared/domain/domain-error.js';
import type { IdGenerator } from '../../../shared/domain/ports.js';
import type { Difficulty, Locale, TourType } from '../../catalog/domain/tour.js';
import type { StaffActor } from '../../identity/application/staff-auth.use-cases.js';
import { checkPublication, tourPublicPath } from '../domain/backoffice-rules.js';
import { pageArgs, type AdminDatabase, type AdminTx, type PageQuery } from '../infrastructure/admin-database.js';

export interface TourFieldsInput {
  code?: string;
  slug?: string;
  type?: TourType;
  categoryId?: string | null;
  durationDays?: number | null;
  durationNights?: number | null;
  durationHours?: number | null;
  minPax?: number;
  maxPax?: number | null;
  difficulty?: Difficulty | null;
  languages?: string[];
  bookingCutoffHours?: number;
  depositPercentOverride?: number | null;
  requiresTravelerDocument?: boolean;
  usesInventory?: boolean;
  isFeatured?: boolean;
  cancellationPolicyCode?: string | null;
  /** Reemplaza los destinos del tour (el primero o `primaryDestinationId` es el principal). */
  destinationIds?: string[];
  primaryDestinationId?: string | null;
}

export interface TranslationInput {
  slug: string;
  title: string;
  summary: string;
  description?: string | null;
  itinerary?: unknown[];
  includes?: string[];
  notIncluded?: string[];
  recommendations?: string[];
  faqs?: Array<{ question: string; answer: string }>;
  importantNotes?: string[];
  policies?: string | null;
  meetingPoint?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  translationStatus?: string | null;
}

export interface MediaInput {
  storageKey: string;
  kind?: 'image' | 'video';
  altEs?: string | null;
  altEn?: string | null;
  width?: number | null;
  height?: number | null;
  isCover?: boolean;
  sortOrder?: number;
}

const TOUR_DETAIL = {
  translations: { orderBy: { locale: 'asc' } },
  media: { orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }] },
  destinations: { orderBy: { sortOrder: 'asc' } },
  updatedBy: { select: { id: true, fullName: true } },
  category: { select: { id: true, slug: true } },
} satisfies Prisma.TourInclude;

type TourDetailRow = Prisma.TourGetPayload<{ include: typeof TOUR_DETAIL }>;

export class TourNotFoundError extends NotFoundError {
  constructor() {
    super('tour-not-found', 'Tour no encontrado.');
  }
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Reglas de duración del CHECK tours_duration_by_type_ck, con mensaje claro antes de ir a la base. */
export function assertTourDuration(t: { type: TourType; durationDays: number | null; durationNights: number | null; durationHours: number | null }): void {
  if (t.type === 'package') {
    if (!t.durationDays || t.durationDays < 1 || t.durationNights === null || t.durationNights < t.durationDays - 1 || t.durationNights > t.durationDays) {
      throw new ValidationError('validation-failed', 'Un paquete requiere días (>= 1) y noches (días − 1 o igual a días).', {
        errors: [{ field: 'durationNights', messages: ['Días y noches inconsistentes para un paquete.'] }],
      });
    }
  } else if (!((t.durationHours ?? 0) > 0 || (t.durationDays ?? 0) >= 1)) {
    throw new ValidationError('validation-failed', 'Indica la duración en horas o en días.', {
      errors: [{ field: 'durationHours', messages: ['Duración requerida (horas > 0 o días >= 1).'] }],
    });
  }
}

function presentTour(row: TourDetailRow, activeRateCount: number) {
  const publication = checkPublication({
    translations: row.translations.map((t) => ({ locale: t.locale, title: t.title, summary: t.summary, itinerary: t.itinerary, translationStatus: t.translationStatus })),
    media: row.media.map((m) => ({ isCover: m.isCover, kind: m.kind })),
    activeRateCount,
  });
  return {
    id: row.id,
    code: row.code,
    slug: row.slug,
    type: row.type,
    status: row.status,
    category: row.category,
    durationDays: row.durationDays,
    durationNights: row.durationNights,
    durationHours: row.durationHours ? row.durationHours.toNumber() : null,
    minPax: row.minPax,
    maxPax: row.maxPax,
    difficulty: row.difficulty,
    languages: row.languages,
    bookingCutoffHours: row.bookingCutoffHours,
    depositPercentOverride: row.depositPercentOverride,
    requiresTravelerDocument: row.requiresTravelerDocument,
    usesInventory: row.usesInventory,
    isFeatured: row.isFeatured,
    cancellationPolicyCode: row.cancellationPolicyCode,
    publishedAt: row.publishedAt,
    version: row.version,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
    destinations: row.destinations.map((d) => ({ destinationId: d.destinationId, isPrimary: d.isPrimary, sortOrder: d.sortOrder })),
    translations: row.translations.map((t) => ({
      locale: t.locale,
      slug: t.slug,
      title: t.title,
      summary: t.summary,
      description: t.description,
      itinerary: t.itinerary,
      includes: t.includes,
      notIncluded: t.notIncluded,
      recommendations: t.recommendations,
      faqs: t.faqs,
      importantNotes: t.importantNotes,
      policies: t.policies,
      meetingPoint: t.meetingPoint,
      seoTitle: t.seoTitle,
      seoDescription: t.seoDescription,
      /** Estado de la traducción (p. ej. machine_reviewed_pending_client); null = redactada/revisada por el staff. */
      translationStatus: t.translationStatus,
      updatedAt: t.updatedAt,
    })),
    media: row.media.map((m) => ({
      id: m.id,
      kind: m.kind,
      storageKey: m.storageKey,
      altEs: m.altEs,
      altEn: m.altEn,
      width: m.width,
      height: m.height,
      isCover: m.isCover,
      sortOrder: m.sortOrder,
    })),
    activeRateCount,
    publication: { publishable: publication.errors.length === 0, errors: publication.errors, warnings: publication.warnings },
  };
}

export type AdminTourView = ReturnType<typeof presentTour>;

/** Backoffice de tours (HU-7.1): CRUD, publicar/despublicar, traducciones y medios. */
export class ToursAdminService {
  constructor(
    private readonly db: AdminDatabase,
    private readonly ids: IdGenerator,
  ) {}

  list(query: PageQuery & { status?: 'draft' | 'published' | 'archived'; q?: string }) {
    return this.db.read(async (prisma) => {
      const where: Prisma.TourWhereInput = {
        deletedAt: query.status === 'archived' ? undefined : null,
        ...(query.status ? { status: query.status } : {}),
        ...(query.q
          ? {
              OR: [
                { code: { contains: query.q, mode: 'insensitive' } },
                { slug: { contains: query.q.toLowerCase() } },
                { translations: { some: { title: { contains: query.q, mode: 'insensitive' } } } },
              ],
            }
          : {}),
      };
      const [total, rows] = await Promise.all([
        prisma.tour.count({ where }),
        prisma.tour.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          ...pageArgs(query),
          include: { translations: { select: { locale: true, title: true, translationStatus: true } }, media: { where: { isCover: true }, select: { storageKey: true } } },
        }),
      ]);
      return {
        total,
        items: rows.map((t) => ({
          id: t.id,
          code: t.code,
          slug: t.slug,
          type: t.type,
          status: t.status,
          title: t.translations.find((x) => x.locale === 'es')?.title ?? null,
          /** Completitud por idioma para el panel (A2/I9). */
          translations: t.translations.map((x) => ({ locale: x.locale, translationStatus: x.translationStatus })),
          coverUrl: t.media[0]?.storageKey ?? null,
          isFeatured: t.isFeatured,
          publishedAt: t.publishedAt,
          version: t.version,
          updatedAt: t.updatedAt,
        })),
      };
    });
  }

  get(id: string): Promise<AdminTourView> {
    return this.db.read((prisma) => this.load(prisma, id));
  }

  async create(actor: StaffActor, meta: RequestMeta, input: Required<Pick<TourFieldsInput, 'code' | 'slug' | 'type'>> & TourFieldsInput): Promise<AdminTourView> {
    const fields = this.normalizeFields(input);
    assertTourDuration({
      type: input.type,
      durationDays: fields.durationDays ?? null,
      durationNights: fields.durationNights ?? null,
      durationHours: fields.durationHours ?? null,
    });
    const id = await this.db.run(actor, meta, async (ctx) => {
      await this.assertUnique(ctx, { code: input.code, slug: input.slug });
      const tourId = this.ids.next();
      await ctx.tx.tour.create({
        data: {
          id: tourId,
          code: input.code,
          slug: input.slug,
          type: input.type,
          status: 'draft',
          categoryId: fields.categoryId ?? null,
          durationDays: fields.durationDays ?? null,
          durationNights: fields.durationNights ?? null,
          durationHours: fields.durationHours ?? null,
          minPax: fields.minPax ?? 1,
          maxPax: fields.maxPax ?? null,
          difficulty: fields.difficulty ?? null,
          languages: fields.languages ?? ['es'],
          bookingCutoffHours: fields.bookingCutoffHours ?? 24,
          depositPercentOverride: fields.depositPercentOverride ?? null,
          requiresTravelerDocument: fields.requiresTravelerDocument ?? false,
          usesInventory: fields.usesInventory ?? true,
          isFeatured: fields.isFeatured ?? false,
          cancellationPolicyCode: fields.cancellationPolicyCode ?? null,
          updatedByUserId: actor.userId,
        },
      });
      if (input.destinationIds) await this.replaceDestinations(ctx, tourId, input.destinationIds, input.primaryDestinationId ?? null);
      await ctx.audit({ entityType: 'tours', entityId: tourId, action: 'TOUR_CREATED', after: { code: input.code, slug: input.slug, type: input.type } });
      return tourId;
    });
    return this.get(id);
  }

  async update(actor: StaffActor, meta: RequestMeta, id: string, input: TourFieldsInput & { version: number }): Promise<AdminTourView> {
    const fields = this.normalizeFields(input);
    await this.db.run(actor, meta, async (ctx) => {
      const current = await this.bump(ctx, id, input.version);
      assertTourDuration({
        type: input.type ?? current.type,
        durationDays: fields.durationDays !== undefined ? fields.durationDays : current.durationDays,
        durationNights: fields.durationNights !== undefined ? fields.durationNights : current.durationNights,
        durationHours: fields.durationHours !== undefined ? fields.durationHours : current.durationHours ? current.durationHours.toNumber() : null,
      });
      if ((input.code && input.code !== current.code) || (input.slug && input.slug !== current.slug)) {
        await this.assertUnique(ctx, { code: input.code !== current.code ? input.code : undefined, slug: input.slug !== current.slug ? input.slug : undefined });
      }
      const data: Prisma.TourUncheckedUpdateInput = {};
      for (const key of [
        'code', 'slug', 'type', 'categoryId', 'durationDays', 'durationNights', 'durationHours', 'minPax', 'maxPax', 'difficulty', 'languages',
        'bookingCutoffHours', 'depositPercentOverride', 'requiresTravelerDocument', 'usesInventory', 'isFeatured', 'cancellationPolicyCode',
      ] as const) {
        if (fields[key] !== undefined) (data as Record<string, unknown>)[key] = fields[key];
      }
      if (Object.keys(data).length > 0) await ctx.tx.tour.update({ where: { id }, data });
      if (input.destinationIds) await this.replaceDestinations(ctx, id, input.destinationIds, input.primaryDestinationId ?? null);
      await ctx.audit({
        entityType: 'tours',
        entityId: id,
        action: 'TOUR_UPDATED',
        changedFields: Object.keys(input).filter((k) => k !== 'version'),
        before: auditJson({ code: current.code, slug: current.slug, status: current.status }),
        after: auditJson({ ...data, destinationIds: input.destinationIds }),
      });
    });
    return this.get(id);
  }

  async publish(actor: StaffActor, meta: RequestMeta, id: string, version: number): Promise<AdminTourView> {
    await this.db.run(actor, meta, async (ctx) => {
      const current = await this.bump(ctx, id, version);
      if (current.status === 'archived') throw new BusinessRuleError('tour-archived', 'El tour está archivado.');
      const row = await ctx.tx.tour.findUniqueOrThrow({ where: { id }, include: { translations: true, media: true } });
      const activeRateCount = await ctx.tx.rate.count({ where: { tourId: id, isActive: true, deletedAt: null } });
      const check = checkPublication({
        translations: row.translations.map((t) => ({ locale: t.locale, title: t.title, summary: t.summary, itinerary: t.itinerary, translationStatus: t.translationStatus })),
        media: row.media.map((m) => ({ isCover: m.isCover, kind: m.kind })),
        activeRateCount,
      });
      if (check.errors.length > 0) {
        throw new BusinessRuleError('tour-not-publishable', 'El tour no tiene los datos mínimos para publicarse.', { errors: check.errors });
      }
      await ctx.tx.tour.update({ where: { id }, data: { status: 'published', publishedAt: current.publishedAt ?? ctx.now } });
      await ctx.audit({ entityType: 'tours', entityId: id, action: 'TOUR_PUBLISHED', after: { warnings: check.warnings } });
    });
    return this.get(id);
  }

  async unpublish(actor: StaffActor, meta: RequestMeta, id: string, version: number): Promise<AdminTourView> {
    await this.db.run(actor, meta, async (ctx) => {
      const current = await this.bump(ctx, id, version);
      if (current.status !== 'published') throw new BusinessRuleError('tour-not-published', 'El tour no está publicado.');
      await ctx.tx.tour.update({ where: { id }, data: { status: 'draft' } });
      await ctx.audit({ entityType: 'tours', entityId: id, action: 'TOUR_UNPUBLISHED' });
    });
    return this.get(id);
  }

  /** Borrado lógico (archivado). Se rechaza si hay reservas activas con viaje futuro. */
  async archive(actor: StaffActor, meta: RequestMeta, id: string, version: number): Promise<void> {
    await this.db.run(actor, meta, async (ctx) => {
      await this.bump(ctx, id, version);
      const futureItems = await ctx.tx.bookingItem.count({
        where: { tourId: id, status: 'active', travelDate: { gte: new Date(ctx.now.toISOString().slice(0, 10)) }, booking: { status: { in: ['held', 'confirmed', 'partially_paid', 'paid'] } } },
      });
      if (futureItems > 0) throw new BusinessRuleError('tour-has-active-bookings', `El tour tiene ${futureItems} reserva(s) activa(s) con viaje futuro.`, { bookings: futureItems });
      await ctx.tx.tour.update({ where: { id }, data: { status: 'archived', deletedAt: ctx.now } });
      await ctx.audit({ entityType: 'tours', entityId: id, action: 'TOUR_ARCHIVED' });
    });
  }

  // ---------------------------------------------------------------------------
  // Traducciones
  // ---------------------------------------------------------------------------
  async upsertTranslation(actor: StaffActor, meta: RequestMeta, id: string, locale: Locale, input: TranslationInput & { version: number }): Promise<AdminTourView> {
    if (!SLUG.test(input.slug)) throw new ValidationError('validation-failed', 'Slug inválido.', { errors: [{ field: 'slug', messages: ['Solo minúsculas, números y guiones.'] }] });
    await this.db.run(actor, meta, async (ctx) => {
      const tour = await this.bump(ctx, id, input.version);
      const clash = await ctx.tx.tourTranslation.findFirst({ where: { locale, slug: input.slug, tourId: { not: id } }, select: { id: true } });
      if (clash) throw new ConflictError('translation-slug-taken', `El slug "${input.slug}" ya lo usa otro tour en "${locale}".`);
      const existing = await ctx.tx.tourTranslation.findUnique({ where: { tourId_locale: { tourId: id, locale } } });
      const data = {
        slug: input.slug,
        title: input.title,
        summary: input.summary,
        description: input.description ?? null,
        itinerary: (input.itinerary ?? []) as Prisma.InputJsonValue,
        includes: input.includes ?? [],
        notIncluded: input.notIncluded ?? [],
        recommendations: input.recommendations ?? [],
        faqs: (input.faqs ?? []) as Prisma.InputJsonValue,
        importantNotes: input.importantNotes ?? [],
        policies: input.policies ?? null,
        meetingPoint: input.meetingPoint ?? null,
        seoTitle: input.seoTitle ?? null,
        seoDescription: input.seoDescription ?? null,
        // Guardar desde el panel cuenta como revisión del staff salvo que se indique otro estado.
        translationStatus: input.translationStatus ?? null,
      };
      if (existing) await ctx.tx.tourTranslation.update({ where: { id: existing.id }, data });
      else await ctx.tx.tourTranslation.create({ data: { id: this.ids.next(), tourId: id, locale, ...data } });
      if (existing && existing.slug !== input.slug && tour.status === 'published') {
        await this.redirectSlug(ctx, locale, existing.slug, input.slug);
      }
      if (locale === 'es' && tour.slug !== input.slug) {
        if (await ctx.tx.tour.findFirst({ where: { slug: input.slug, id: { not: id } }, select: { id: true } })) {
          throw new ConflictError('tour-slug-taken', `El slug "${input.slug}" ya lo usa otro tour.`);
        }
        await ctx.tx.tour.update({ where: { id }, data: { slug: input.slug } });
      }
      await ctx.audit({
        entityType: 'tours',
        entityId: id,
        action: existing ? 'TOUR_TRANSLATION_UPDATED' : 'TOUR_TRANSLATION_CREATED',
        after: { locale, slug: input.slug, previousSlug: existing?.slug ?? null },
      });
    });
    return this.get(id);
  }

  async deleteTranslation(actor: StaffActor, meta: RequestMeta, id: string, locale: Locale, version: number): Promise<AdminTourView> {
    if (locale === 'es') throw new BusinessRuleError('canonical-translation-required', 'La traducción en español es obligatoria y no se puede eliminar.');
    await this.db.run(actor, meta, async (ctx) => {
      await this.bump(ctx, id, version);
      const deleted = await ctx.tx.tourTranslation.deleteMany({ where: { tourId: id, locale } });
      if (deleted.count === 0) throw new NotFoundError('translation-not-found', 'Traducción no encontrada.');
      await ctx.audit({ entityType: 'tours', entityId: id, action: 'TOUR_TRANSLATION_DELETED', after: { locale } });
    });
    return this.get(id);
  }

  // ---------------------------------------------------------------------------
  // Medios (referencias a CDN/almacenamiento; la subida de archivos está pendiente: S3/R2)
  // ---------------------------------------------------------------------------
  async addMedia(actor: StaffActor, meta: RequestMeta, id: string, input: MediaInput & { version: number }): Promise<AdminTourView> {
    await this.db.run(actor, meta, async (ctx) => {
      await this.bump(ctx, id, input.version);
      const mediaId = this.ids.next();
      if (input.isCover) await ctx.tx.tourMedia.updateMany({ where: { tourId: id, isCover: true }, data: { isCover: false } });
      const count = await ctx.tx.tourMedia.count({ where: { tourId: id } });
      await ctx.tx.tourMedia.create({
        data: {
          id: mediaId,
          tourId: id,
          kind: input.kind ?? 'image',
          storageKey: input.storageKey,
          altEs: input.altEs ?? null,
          altEn: input.altEn ?? null,
          width: input.width ?? null,
          height: input.height ?? null,
          isCover: input.isCover ?? false,
          sortOrder: input.sortOrder ?? count,
        },
      });
      await ctx.audit({ entityType: 'tours', entityId: id, action: 'TOUR_MEDIA_ADDED', after: { mediaId, storageKey: input.storageKey, isCover: input.isCover ?? false } });
    });
    return this.get(id);
  }

  async updateMedia(actor: StaffActor, meta: RequestMeta, id: string, mediaId: string, input: Partial<MediaInput> & { version: number }): Promise<AdminTourView> {
    await this.db.run(actor, meta, async (ctx) => {
      await this.bump(ctx, id, input.version);
      const media = await ctx.tx.tourMedia.findFirst({ where: { id: mediaId, tourId: id } });
      if (!media) throw new NotFoundError('media-not-found', 'Medio no encontrado.');
      if (input.isCover) await ctx.tx.tourMedia.updateMany({ where: { tourId: id, isCover: true, id: { not: mediaId } }, data: { isCover: false } });
      const data: Prisma.TourMediaUpdateInput = {};
      for (const key of ['storageKey', 'kind', 'altEs', 'altEn', 'width', 'height', 'isCover', 'sortOrder'] as const) {
        if (input[key] !== undefined) (data as Record<string, unknown>)[key] = input[key];
      }
      await ctx.tx.tourMedia.update({ where: { id: mediaId }, data });
      await ctx.audit({ entityType: 'tours', entityId: id, action: 'TOUR_MEDIA_UPDATED', after: auditJson({ mediaId, ...data }) });
    });
    return this.get(id);
  }

  async deleteMedia(actor: StaffActor, meta: RequestMeta, id: string, mediaId: string, version: number): Promise<AdminTourView> {
    await this.db.run(actor, meta, async (ctx) => {
      const tour = await this.bump(ctx, id, version);
      const media = await ctx.tx.tourMedia.findFirst({ where: { id: mediaId, tourId: id } });
      if (!media) throw new NotFoundError('media-not-found', 'Medio no encontrado.');
      if (media.isCover && tour.status === 'published') {
        throw new BusinessRuleError('cover-required', 'Un tour publicado necesita portada: marca otra imagen como portada antes de eliminar esta.');
      }
      await ctx.tx.tourMedia.delete({ where: { id: mediaId } });
      await ctx.audit({ entityType: 'tours', entityId: id, action: 'TOUR_MEDIA_DELETED', after: { mediaId, storageKey: media.storageKey } });
    });
    return this.get(id);
  }

  // ---------------------------------------------------------------------------
  // Internos
  // ---------------------------------------------------------------------------
  private async load(prisma: Pick<AdminTx['tx'], 'tour' | 'rate'>, id: string): Promise<AdminTourView> {
    const row = /^[0-9a-f-]{36}$/i.test(id) ? await prisma.tour.findUnique({ where: { id }, include: TOUR_DETAIL }) : null;
    if (!row) throw new TourNotFoundError();
    const activeRateCount = await prisma.rate.count({ where: { tourId: id, isActive: true, deletedAt: null } });
    return presentTour(row, activeRateCount);
  }

  /**
   * Bloqueo optimista del agregado tour: incrementa `version` solo si coincide la leída.
   * Si no coincide: 409 "Este tour fue modificado por <usuario>" (HU-7.1).
   */
  private async bump(ctx: AdminTx, id: string, expectedVersion: number) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new TourNotFoundError();
    const updated = await ctx.tx.tour.updateMany({
      where: { id, version: expectedVersion, deletedAt: null },
      data: { version: { increment: 1 }, updatedByUserId: ctx.actor.userId },
    });
    if (updated.count === 0) {
      const current = await ctx.tx.tour.findUnique({ where: { id }, include: { updatedBy: { select: { fullName: true } } } });
      if (!current || current.deletedAt) throw new TourNotFoundError();
      const who = current.updatedBy?.fullName ?? 'otro usuario';
      throw new ConflictError('tour-version-conflict', `Este tour fue modificado por ${who}. Recarga para ver los cambios antes de guardar.`, {
        currentVersion: current.version,
        updatedBy: current.updatedBy?.fullName ?? null,
        updatedAt: current.updatedAt,
      });
    }
    return ctx.tx.tour.findUniqueOrThrow({ where: { id } });
  }

  private async assertUnique(ctx: AdminTx, params: { code?: string; slug?: string }): Promise<void> {
    if (params.code && (await ctx.tx.tour.findUnique({ where: { code: params.code }, select: { id: true } }))) {
      throw new ConflictError('tour-code-taken', `El código "${params.code}" ya existe.`);
    }
    if (params.slug && (await ctx.tx.tour.findUnique({ where: { slug: params.slug }, select: { id: true } }))) {
      throw new ConflictError('tour-slug-taken', `El slug "${params.slug}" ya existe.`);
    }
  }

  private async replaceDestinations(ctx: AdminTx, tourId: string, destinationIds: string[], primaryId: string | null): Promise<void> {
    const unique = [...new Set(destinationIds)];
    const found = await ctx.tx.destination.count({ where: { id: { in: unique }, deletedAt: null } });
    if (found !== unique.length) throw new ValidationError('validation-failed', 'Destino inexistente.', { errors: [{ field: 'destinationIds', messages: ['Algún destino no existe.'] }] });
    const primary = primaryId ?? unique[0] ?? null;
    if (primary && !unique.includes(primary)) throw new ValidationError('validation-failed', 'El destino principal debe estar en la lista.', { errors: [{ field: 'primaryDestinationId', messages: ['No está en destinationIds.'] }] });
    await ctx.tx.tourDestination.deleteMany({ where: { tourId } });
    if (unique.length > 0) {
      await ctx.tx.tourDestination.createMany({ data: unique.map((destinationId, i) => ({ tourId, destinationId, isPrimary: destinationId === primary, sortOrder: i })) });
    }
  }

  /** Slug cambiado en un tour publicado: 301 desde la URL anterior sin cadenas ni bucles. */
  private async redirectSlug(ctx: AdminTx, locale: string, oldSlug: string, newSlug: string): Promise<void> {
    const from = tourPublicPath(locale, oldSlug);
    const to = tourPublicPath(locale, newSlug);
    await ctx.tx.legacyRedirect.deleteMany({ where: { fromPath: to } });
    await ctx.tx.legacyRedirect.updateMany({ where: { toPath: from }, data: { toPath: to } });
    await ctx.tx.legacyRedirect.upsert({
      where: { fromPath: from },
      create: { id: this.ids.next(), fromPath: from, toPath: to, statusCode: 301 },
      update: { toPath: to, statusCode: 301 },
    });
    await ctx.audit({ entityType: 'legacy_redirects', entityId: null, action: 'REDIRECT_CREATED', after: { from, to } });
  }

  private normalizeFields(input: TourFieldsInput): TourFieldsInput {
    if (input.slug !== undefined && !SLUG.test(input.slug)) {
      throw new ValidationError('validation-failed', 'Slug inválido.', { errors: [{ field: 'slug', messages: ['Solo minúsculas, números y guiones.'] }] });
    }
    if (input.minPax !== undefined && input.maxPax !== undefined && input.maxPax !== null && input.maxPax < input.minPax) {
      throw new ValidationError('validation-failed', 'Pasajeros inconsistentes.', { errors: [{ field: 'maxPax', messages: ['Debe ser mayor o igual a minPax.'] }] });
    }
    return { ...input, languages: input.languages?.map((l) => l.toLowerCase()) };
  }
}

