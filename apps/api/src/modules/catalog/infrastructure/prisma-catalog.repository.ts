import { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../persistence/prisma/prisma-client.js';
import {
  calendarDateFromUtcDate,
  calendarDateToUtcDate,
  type CalendarDate,
} from '../../../shared/domain/calendar-date.js';
import { ConcurrencyError } from '../../../shared/domain/domain-error.js';
import { assertCurrencyCode } from '../../../shared/domain/money.js';
import type {
  CatalogRepository,
  InventoryRepository,
  Page,
  TourListing,
  TourSearchCriteria,
} from '../domain/catalog.repository.js';
import { Departure, type InventoryHold } from '../domain/departure.js';
import { priceFrom, type Rate } from '../domain/pricing.js';
import type { Category, Destination } from '../domain/taxonomy.js';
import { normalizeText } from '../domain/text-search.js';
import type { Faq, ItineraryDay, Locale, Tour } from '../domain/tour.js';

const TOUR_INCLUDE = {
  translations: true,
  media: { orderBy: { sortOrder: 'asc' } },
  destinations: { orderBy: { sortOrder: 'asc' } },
} satisfies Prisma.TourInclude;

type TourRow = Prisma.TourGetPayload<{ include: typeof TOUR_INCLUDE }>;

function asArray(value: Prisma.JsonValue): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toItinerary(value: Prisma.JsonValue): ItineraryDay[] {
  return asArray(value).flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return [];
    const d = raw as Record<string, unknown>;
    if (typeof d['day'] !== 'number' || typeof d['description'] !== 'string') return [];
    return [
      {
        day: d['day'],
        title: typeof d['title'] === 'string' ? d['title'] : null,
        description: d['description'],
        meals: Array.isArray(d['meals']) ? d['meals'].filter((m): m is string => typeof m === 'string') : undefined,
        overnight: typeof d['overnight'] === 'string' ? d['overnight'] : null,
      },
    ];
  });
}

function toFaqs(value: Prisma.JsonValue): Faq[] {
  return asArray(value).flatMap((raw) => {
    const f = raw as Record<string, unknown> | null;
    return f && typeof f['question'] === 'string' && typeof f['answer'] === 'string' ? [{ question: f['question'], answer: f['answer'] }] : [];
  });
}

export function mapTourRow(row: TourRow): Tour {
  return {
    id: row.id,
    slug: row.slug,
    code: row.code,
    type: row.type,
    status: row.status,
    categoryId: row.categoryId,
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
    translations: row.translations.map((t) => ({
      locale: t.locale,
      slug: t.slug,
      title: t.title,
      summary: t.summary,
      description: t.description,
      itinerary: toItinerary(t.itinerary),
      includes: t.includes,
      notIncluded: t.notIncluded,
      recommendations: t.recommendations,
      faqs: toFaqs(t.faqs),
      importantNotes: t.importantNotes,
      policies: t.policies,
      meetingPoint: t.meetingPoint,
      seoTitle: t.seoTitle,
      seoDescription: t.seoDescription,
      translationStatus: t.translationStatus,
    })),
    media: row.media.map((m) => ({
      url: m.storageKey,
      kind: m.kind,
      altEs: m.altEs,
      altEn: m.altEn,
      isCover: m.isCover,
      sortOrder: m.sortOrder,
    })),
    destinations: row.destinations.map((d) => ({ destinationId: d.destinationId, isPrimary: d.isPrimary, sortOrder: d.sortOrder })),
  };
}

function mapRate(row: Prisma.RateGetPayload<{ include: { season: true } }>): Rate {
  return {
    id: row.id,
    tourId: row.tourId,
    paxType: row.paxType,
    residency: row.residency,
    currency: assertCurrencyCode(row.currency),
    amount: row.amount,
    validFrom: calendarDateFromUtcDate(row.validFrom),
    validTo: calendarDateFromUtcDate(row.validTo),
    minGroupSize: row.minGroupSize,
    maxGroupSize: row.maxGroupSize,
    isActive: row.isActive,
    seasonPriority: row.season ? row.season.priority : null,
  };
}

const PUBLISHED: Prisma.TourWhereInput = { status: 'published', deletedAt: null };

export class PrismaCatalogRepository implements CatalogRepository {
  constructor(private readonly db: PrismaTx) {}

  /**
   * Filtros estructurales en SQL; texto con FTS `es_unaccent` + `word_similarity` (pg_trgm);
   * "precio desde", orden por precio y paginación se resuelven en la aplicación sobre los
   * candidatos (catálogo de cientos de tours). Si crece a miles: LATERAL MIN(rate) en SQL.
   */
  async searchTours(criteria: TourSearchCriteria): Promise<Page<TourListing>> {
    const where: Prisma.TourWhereInput = {
      ...PUBLISHED,
      // I6: en `en` también entran los tours que solo tienen `es` (se sirven con fallback).
      translations: { some: { locale: { in: criteria.locale === 'es' ? ['es'] : [criteria.locale, 'es'] } } },
      ...(criteria.type ? { type: criteria.type } : {}),
      ...(criteria.difficulty ? { difficulty: criteria.difficulty } : {}),
      ...(criteria.featured !== undefined ? { isFeatured: criteria.featured } : {}),
      ...(criteria.categorySlug ? { category: { slug: criteria.categorySlug, deletedAt: null } } : {}),
      ...(criteria.destinationSlug ? { destinations: { some: { destination: { slug: criteria.destinationSlug } } } } : {}),
      ...(criteria.minDays !== undefined || criteria.maxDays !== undefined
        ? { durationDays: { gte: criteria.minDays, lte: criteria.maxDays } }
        : {}),
    };

    let scores: Map<string, number> | null = null;
    if (criteria.text && normalizeText(criteria.text)) {
      scores = await this.textScores(criteria.text, criteria.locale);
      where.id = { in: [...scores.keys()] };
    }

    const candidates = await this.db.tour.findMany({
      where,
      select: { id: true, slug: true, isFeatured: true, durationDays: true },
    });
    const rates = await this.db.rate.findMany({
      where: {
        tourId: { in: candidates.map((c) => c.id) },
        currency: criteria.currency,
        isActive: true,
        deletedAt: null,
        validTo: { gte: calendarDateToUtcDate(criteria.today) },
      },
      include: { season: true },
    });
    const ratesByTour = new Map<string, Rate[]>();
    for (const row of rates) {
      const list = ratesByTour.get(row.tourId) ?? [];
      list.push(mapRate(row));
      ratesByTour.set(row.tourId, list);
    }

    const enriched = candidates
      .map((c) => ({ ...c, priceFrom: priceFrom(ratesByTour.get(c.id) ?? [], criteria.currency, criteria.today), score: scores?.get(c.id) ?? 1 }))
      .filter((c) => criteria.minPrice === undefined || (c.priceFrom !== null && c.priceFrom.amount >= criteria.minPrice))
      .filter((c) => criteria.maxPrice === undefined || (c.priceFrom !== null && c.priceFrom.amount <= criteria.maxPrice));

    const big = 10n ** 15n;
    const cmp = (a: bigint, b: bigint) => (a < b ? -1 : a > b ? 1 : 0);
    const bySlug = (a: { slug: string }, b: { slug: string }) => a.slug.localeCompare(b.slug);
    const sorters: Record<TourSearchCriteria['sort'], (a: (typeof enriched)[number], b: (typeof enriched)[number]) => number> = {
      relevance: (a, b) => b.score - a.score || Number(b.isFeatured) - Number(a.isFeatured) || bySlug(a, b),
      featured: (a, b) => Number(b.isFeatured) - Number(a.isFeatured) || bySlug(a, b),
      price_asc: (a, b) => cmp(a.priceFrom?.amount ?? big, b.priceFrom?.amount ?? big) || bySlug(a, b),
      price_desc: (a, b) => cmp(b.priceFrom?.amount ?? -1n, a.priceFrom?.amount ?? -1n) || bySlug(a, b),
      duration_asc: (a, b) => (a.durationDays ?? 1) - (b.durationDays ?? 1) || bySlug(a, b),
      duration_desc: (a, b) => (b.durationDays ?? 1) - (a.durationDays ?? 1) || bySlug(a, b),
    };
    enriched.sort(sorters[criteria.sort]);
    const start = (criteria.page - 1) * criteria.pageSize;
    const pageRows = enriched.slice(start, start + criteria.pageSize);
    const tours = await this.db.tour.findMany({ where: { id: { in: pageRows.map((r) => r.id) } }, include: TOUR_INCLUDE });
    const byId = new Map(tours.map((t) => [t.id, mapTourRow(t)]));
    return {
      items: pageRows.flatMap((r) => {
        const tour = byId.get(r.id);
        return tour ? [{ tour, priceFrom: r.priceFrom }] : [];
      }),
      total: enriched.length,
      page: criteria.page,
      pageSize: criteria.pageSize,
    };
  }

  /** Puntaje por tour; en `en` se buscan ambas traducciones (fallback) y se toma el mejor. */
  private async textScores(text: string, locale: Locale): Promise<Map<string, number>> {
    const locales = locale === 'es' ? ['es'] : [locale, 'es'];
    const rows = await this.db.$queryRaw<Array<{ tour_id: string; score: number }>>`
      SELECT tour_id::text AS tour_id, max(score)::float8 AS score
        FROM (
          SELECT t.tour_id,
                 ts_rank(t.search_vector, websearch_to_tsquery(c.cfg, ${text}))
                   + word_similarity(lower(immutable_unaccent(${text})), t.search_text) AS score,
                 t.search_vector @@ websearch_to_tsquery(c.cfg, ${text}) AS hit,
                 word_similarity(lower(immutable_unaccent(${text})), t.search_text) AS sim
            FROM tour_translations t
           CROSS JOIN LATERAL (SELECT (CASE WHEN t.locale = 'pt' THEN 'pt_unaccent' WHEN t.locale = 'en' THEN 'en_unaccent' ELSE 'es_unaccent' END)::regconfig AS cfg) c
           WHERE t.locale::text = ANY(${locales}::text[])
        ) s
       WHERE hit OR sim >= 0.3
       GROUP BY tour_id`;
    return new Map(rows.map((r) => [r.tour_id, Number(r.score)]));
  }

  async findTourBySlug(slug: string, locale: Locale): Promise<Tour | null> {
    const row =
      (await this.db.tour.findFirst({ where: { slug, deletedAt: null }, include: TOUR_INCLUDE })) ??
      (await this.db.tour.findFirst({ where: { deletedAt: null, translations: { some: { locale, slug } } }, include: TOUR_INCLUDE })) ??
      // Slug de OTRO idioma: el caso de uso responde 301 al slug correcto (I3).
      (await this.db.tour.findFirst({ where: { deletedAt: null, translations: { some: { slug } } }, include: TOUR_INCLUDE }));
    return row ? mapTourRow(row) : null;
  }

  async findTourById(id: string): Promise<Tour | null> {
    const row = await this.db.tour.findFirst({ where: { id, deletedAt: null }, include: TOUR_INCLUDE });
    return row ? mapTourRow(row) : null;
  }

  async findRates(tourId: string): Promise<Rate[]> {
    const rows = await this.db.rate.findMany({ where: { tourId, deletedAt: null }, include: { season: true } });
    return rows.map(mapRate);
  }

  async listDestinations(): Promise<Destination[]> {
    const rows = await this.db.destination.findMany({ where: { deletedAt: null }, include: { translations: true } });
    return rows.map((d) => ({
      id: d.id,
      slug: d.slug,
      parentId: d.parentId,
      status: d.status,
      sortOrder: d.sortOrder,
      coverStorageKey: d.coverStorageKey,
      translations: d.translations.map((t) => ({ locale: t.locale, name: t.name, description: t.description, slug: t.slug, translationStatus: t.translationStatus })),
    }));
  }

  async listCategories(): Promise<Category[]> {
    const rows = await this.db.category.findMany({ where: { deletedAt: null }, include: { translations: true } });
    return rows.map((c) => ({
      id: c.id,
      slug: c.slug,
      sortOrder: c.sortOrder,
      coverStorageKey: c.coverStorageKey,
      translations: c.translations.map((t) => ({ locale: t.locale, name: t.name, description: t.description, slug: t.slug, translationStatus: t.translationStatus })),
    }));
  }

  async countPublishedTours(): Promise<{ byDestination: Map<string, number>; byCategory: Map<string, number> }> {
    // Secuencial: dentro de una transacción interactiva la conexión es única.
    const byDestination = await this.db.tourDestination.groupBy({ by: ['destinationId'], where: { tour: PUBLISHED }, _count: { _all: true } });
    const byCategory = await this.db.tour.groupBy({ by: ['categoryId'], where: PUBLISHED, _count: { _all: true } });
    return {
      byDestination: new Map(byDestination.map((r) => [r.destinationId, r._count._all])),
      byCategory: new Map(byCategory.flatMap((r) => (r.categoryId ? [[r.categoryId, r._count._all] as const] : []))),
    };
  }
}

function timeToString(value: Date | null): string {
  return value ? value.toISOString().slice(11, 16) : '00:00';
}

export class PrismaInventoryRepository implements InventoryRepository {
  constructor(private readonly db: PrismaTx) {}

  private map(row: Prisma.DepartureGetPayload<object>): Departure {
    return Departure.restore({
      id: row.id,
      tourId: row.tourId,
      departureDate: calendarDateFromUtcDate(row.departureDate),
      startTime: timeToString(row.startTime),
      capacity: row.capacity,
      booked: row.booked,
      held: row.held,
      isClosed: row.isClosed,
      version: row.version,
    });
  }

  async findDeparture(id: string): Promise<Departure | null> {
    const row = await this.db.departure.findUnique({ where: { id } });
    return row ? this.map(row) : null;
  }

  async findDepartures(tourId: string, from: CalendarDate, to: CalendarDate): Promise<Departure[]> {
    const rows = await this.db.departure.findMany({
      where: { tourId, departureDate: { gte: calendarDateToUtcDate(from), lte: calendarDateToUtcDate(to) } },
      orderBy: [{ departureDate: 'asc' }, { startTime: 'asc' }],
    });
    return rows.map((r) => this.map(r));
  }

  /** UPDATE ... WHERE id = $1 AND version = $2 (bloqueo optimista); el CHECK evita sobreventa. */
  async saveDeparture(departure: Departure): Promise<void> {
    const s = departure.toSnapshot();
    const result = await this.db.departure.updateMany({
      where: { id: s.id, version: departure.persistedVersion },
      data: { held: s.held, booked: s.booked, version: s.version },
    });
    if (result.count !== 1) throw new ConcurrencyError();
  }

  async saveHold(hold: InventoryHold): Promise<void> {
    const data = {
      departureId: hold.departureId,
      cartItemId: hold.cartItemId,
      bookingItemId: hold.bookingItemId,
      quantity: hold.quantity,
      status: hold.status,
      expiresAt: hold.expiresAt,
      releasedAt: hold.releasedAt,
    };
    await this.db.inventoryHold.upsert({ where: { id: hold.id }, create: { id: hold.id, ...data }, update: data });
  }

  async findHoldsByBookingItems(bookingItemIds: readonly string[]): Promise<InventoryHold[]> {
    if (bookingItemIds.length === 0) return [];
    const rows = await this.db.inventoryHold.findMany({ where: { bookingItemId: { in: [...bookingItemIds] } } });
    return rows.map((r) => ({
      id: r.id,
      departureId: r.departureId,
      cartItemId: r.cartItemId,
      bookingItemId: r.bookingItemId,
      quantity: r.quantity,
      status: r.status,
      expiresAt: r.expiresAt,
      releasedAt: r.releasedAt,
    }));
  }
}
