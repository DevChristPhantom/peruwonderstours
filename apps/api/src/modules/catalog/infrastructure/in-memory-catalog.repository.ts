import type { CatalogData, InMemoryDataStore } from '../../../persistence/in-memory/in-memory-data-store.js';
import type { CalendarDate } from '../../../shared/domain/calendar-date.js';
import type {
  CatalogRepository,
  InventoryRepository,
  Page,
  TourListing,
  TourSearchCriteria,
} from '../domain/catalog.repository.js';
import { Departure, type InventoryHold } from '../domain/departure.js';
import { priceFrom, type Rate } from '../domain/pricing.js';
import { localizedName, type Category, type Destination } from '../domain/taxonomy.js';
import { relevanceScore } from '../domain/text-search.js';
import { findTranslation, isTourPublished, type Tour } from '../domain/tour.js';
import { ConcurrencyError } from '../../../shared/domain/domain-error.js';

export class InMemoryCatalogRepository implements CatalogRepository {
  constructor(private readonly data: CatalogData) {}

  searchTours(criteria: TourSearchCriteria): Promise<Page<TourListing>> {
    const destinationsBySlug = new Map(this.data.destinations.map((d) => [d.slug, d]));
    const categoriesBySlug = new Map(this.data.categories.map((c) => [c.slug, c]));
    const destinationsById = new Map(this.data.destinations.map((d) => [d.id, d]));
    const destination = criteria.destinationSlug ? destinationsBySlug.get(criteria.destinationSlug) : undefined;
    const category = criteria.categorySlug ? categoriesBySlug.get(criteria.categorySlug) : undefined;
    if ((criteria.destinationSlug && !destination) || (criteria.categorySlug && !category)) {
      return Promise.resolve({ items: [], total: 0, page: criteria.page, pageSize: criteria.pageSize });
    }

    const scored: Array<TourListing & { score: number }> = [];
    for (const tour of this.data.tours) {
      const translation = findTranslation(tour, criteria.locale);
      if (!isTourPublished(tour) || !translation) continue;
      if (destination && !tour.destinations.some((d) => d.destinationId === destination.id)) continue;
      if (category && tour.categoryId !== category.id) continue;
      if (criteria.type && tour.type !== criteria.type) continue;
      if (criteria.difficulty && tour.difficulty !== criteria.difficulty) continue;
      if (criteria.featured !== undefined && tour.isFeatured !== criteria.featured) continue;
      const days = tour.durationDays ?? 1;
      if (criteria.minDays !== undefined && days < criteria.minDays) continue;
      if (criteria.maxDays !== undefined && days > criteria.maxDays) continue;

      const from = priceFrom(this.ratesOf(tour.id), criteria.currency, criteria.today);
      if (criteria.minPrice !== undefined && (!from || from.amount < criteria.minPrice)) continue;
      if (criteria.maxPrice !== undefined && (!from || from.amount > criteria.maxPrice)) continue;

      let score = 1;
      if (criteria.text) {
        const destinationNames = tour.destinations
          .map((ref) => destinationsById.get(ref.destinationId))
          .filter((d): d is Destination => Boolean(d))
          .map((d) => localizedName(d, criteria.locale).name);
        const documentScore = relevanceScore(criteria.text, [translation.title, translation.summary, ...destinationNames].join(' '));
        if (documentScore === 0) continue;
        // Peso A del título (como setweight 'A' en el FTS de PostgreSQL).
        score = documentScore + 1.5 * relevanceScore(criteria.text, translation.title);
      }
      scored.push({ tour, priceFrom: from, score });
    }

    const byTitle = (a: TourListing, b: TourListing) => a.tour.slug.localeCompare(b.tour.slug);
    const price = (l: TourListing, missing: bigint) => l.priceFrom?.amount ?? missing;
    const HUGE = 10n ** 15n;
    const sorters: Record<TourSearchCriteria['sort'], (a: (typeof scored)[number], b: (typeof scored)[number]) => number> = {
      relevance: (a, b) => b.score - a.score || Number(b.tour.isFeatured) - Number(a.tour.isFeatured) || byTitle(a, b),
      featured: (a, b) => Number(b.tour.isFeatured) - Number(a.tour.isFeatured) || byTitle(a, b),
      price_asc: (a, b) => cmp(price(a, HUGE), price(b, HUGE)) || byTitle(a, b),
      price_desc: (a, b) => cmp(price(b, -1n), price(a, -1n)) || byTitle(a, b),
      duration_asc: (a, b) => (a.tour.durationDays ?? 1) - (b.tour.durationDays ?? 1) || byTitle(a, b),
      duration_desc: (a, b) => (b.tour.durationDays ?? 1) - (a.tour.durationDays ?? 1) || byTitle(a, b),
    };
    scored.sort(sorters[criteria.sort]);
    const start = (criteria.page - 1) * criteria.pageSize;
    return Promise.resolve({
      items: scored.slice(start, start + criteria.pageSize).map(({ tour, priceFrom: p }) => ({ tour, priceFrom: p })),
      total: scored.length,
      page: criteria.page,
      pageSize: criteria.pageSize,
    });
  }

  findTourBySlug(slug: string, locale: string): Promise<Tour | null> {
    const tour =
      this.data.tours.find((t) => t.slug === slug) ??
      this.data.tours.find((t) => t.translations.some((tr) => tr.locale === locale && tr.slug === slug));
    return Promise.resolve(tour ?? null);
  }

  findTourById(id: string): Promise<Tour | null> {
    return Promise.resolve(this.data.tours.find((t) => t.id === id) ?? null);
  }

  findRates(tourId: string): Promise<Rate[]> {
    return Promise.resolve(this.ratesOf(tourId));
  }

  listDestinations(): Promise<Destination[]> {
    return Promise.resolve([...this.data.destinations]);
  }

  listCategories(): Promise<Category[]> {
    return Promise.resolve([...this.data.categories]);
  }

  countPublishedTours(): Promise<{ byDestination: Map<string, number>; byCategory: Map<string, number> }> {
    const byDestination = new Map<string, number>();
    const byCategory = new Map<string, number>();
    for (const tour of this.data.tours.filter(isTourPublished)) {
      for (const ref of tour.destinations) byDestination.set(ref.destinationId, (byDestination.get(ref.destinationId) ?? 0) + 1);
      if (tour.categoryId) byCategory.set(tour.categoryId, (byCategory.get(tour.categoryId) ?? 0) + 1);
    }
    return Promise.resolve({ byDestination, byCategory });
  }

  private ratesOf(tourId: string): Rate[] {
    return this.data.rates.filter((r) => r.tourId === tourId);
  }
}

function cmp(a: bigint, b: bigint): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export class InMemoryInventoryRepository implements InventoryRepository {
  constructor(private readonly store: InMemoryDataStore) {}

  findDeparture(id: string): Promise<Departure | null> {
    const snapshot = this.store.state.departures.get(id);
    return Promise.resolve(snapshot ? Departure.restore(snapshot) : null);
  }

  findDepartures(tourId: string, from: CalendarDate, to: CalendarDate): Promise<Departure[]> {
    const result = [...this.store.state.departures.values()]
      .filter((d) => d.tourId === tourId && d.departureDate >= from && d.departureDate <= to)
      .sort((a, b) => a.departureDate.localeCompare(b.departureDate) || a.startTime.localeCompare(b.startTime))
      .map((d) => Departure.restore(d));
    return Promise.resolve(result);
  }

  saveDeparture(departure: Departure): Promise<void> {
    const current = this.store.state.departures.get(departure.id);
    if (!current || current.version !== departure.persistedVersion) return Promise.reject(new ConcurrencyError());
    this.store.state.departures.set(departure.id, departure.toSnapshot());
    return Promise.resolve();
  }

  saveHold(hold: InventoryHold): Promise<void> {
    this.store.state.holds.set(hold.id, { ...hold });
    return Promise.resolve();
  }

  findHoldsByBookingItems(bookingItemIds: readonly string[]): Promise<InventoryHold[]> {
    const ids = new Set(bookingItemIds);
    return Promise.resolve(
      [...this.store.state.holds.values()].filter((h) => h.bookingItemId !== null && ids.has(h.bookingItemId)).map((h) => ({ ...h })),
    );
  }
}

