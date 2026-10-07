import { addDays, toLimaCalendarDate, type CalendarDate } from '../../../shared/domain/calendar-date.js';
import { ValidationError } from '../../../shared/domain/domain-error.js';
import type { Clock } from '../../../shared/domain/ports.js';
import type { CurrencyCode, Money } from '../../../shared/domain/money.js';
import type { UnitOfWork } from '../../../shared/application/unit-of-work.js';
import type { CatalogRepository, Page, TourListing, TourSearchCriteria } from '../domain/catalog.repository.js';
import { priceFrom, type Rate } from '../domain/pricing.js';
import { localizedName, type Category, type Destination } from '../domain/taxonomy.js';
import { findTranslation, isTourPublished, type Locale, type Tour, type TourTranslation } from '../domain/tour.js';
import { TourNotFoundError } from './tour-quote.service.js';

export interface TourDetail {
  tour: Tour;
  translation: TourTranslation;
  priceFrom: Money | null;
  rates: Rate[];
  destinations: Array<{ destination: Destination; isPrimary: boolean }>;
  category: Category | null;
}

export interface TaxonomyEntry<T> {
  entity: T;
  name: string;
  description: string | null;
  tourCount: number;
}

export interface DepartureAvailability {
  id: string;
  date: CalendarDate;
  startTime: string;
  capacity: number;
  available: number;
  isClosed: boolean;
}

export const MAX_DEPARTURE_RANGE_DAYS = 366;

/** Casos de uso de lectura del catálogo (sin transacción). */
export class CatalogQueries {
  constructor(
    private readonly catalog: CatalogRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  today(): CalendarDate {
    return toLimaCalendarDate(this.clock.now());
  }

  searchTours(criteria: Omit<TourSearchCriteria, 'today'>): Promise<Page<TourListing>> {
    if (criteria.minDays !== undefined && criteria.maxDays !== undefined && criteria.minDays > criteria.maxDays) {
      throw new ValidationError('invalid-range', 'minDays no puede ser mayor que maxDays.');
    }
    if (criteria.minPrice !== undefined && criteria.maxPrice !== undefined && criteria.minPrice > criteria.maxPrice) {
      throw new ValidationError('invalid-range', 'minPrice no puede ser mayor que maxPrice.');
    }
    return this.catalog.searchTours({ ...criteria, today: this.today() });
  }

  async getTour(slug: string, locale: Locale, currency: CurrencyCode): Promise<TourDetail> {
    const tour = await this.catalog.findTourBySlug(slug, locale);
    const translation = tour ? findTranslation(tour, locale) : undefined;
    if (!tour || !isTourPublished(tour) || !translation) throw new TourNotFoundError(slug);
    const [rates, destinations, categories] = await Promise.all([
      this.catalog.findRates(tour.id),
      this.catalog.listDestinations(),
      this.catalog.listCategories(),
    ]);
    const byId = new Map(destinations.map((d) => [d.id, d]));
    return {
      tour,
      translation,
      rates: rates.filter((r) => r.isActive && r.currency === currency && r.validTo >= this.today()),
      priceFrom: priceFrom(rates, currency, this.today()),
      destinations: [...tour.destinations]
        .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder)
        .flatMap((ref) => {
          const destination = byId.get(ref.destinationId);
          return destination ? [{ destination, isPrimary: ref.isPrimary }] : [];
        }),
      category: categories.find((c) => c.id === tour.categoryId) ?? null,
    };
  }

  async listDestinations(locale: Locale): Promise<Array<TaxonomyEntry<Destination>>> {
    const [destinations, counts] = await Promise.all([this.catalog.listDestinations(), this.catalog.countPublishedTours()]);
    return destinations
      .filter((d) => d.status === 'published')
      .sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug))
      .map((d) => {
        const name = localizedName(d, locale);
        return { entity: d, name: name.name, description: name.description, tourCount: counts.byDestination.get(d.id) ?? 0 };
      });
  }

  async listCategories(locale: Locale): Promise<Array<TaxonomyEntry<Category>>> {
    const [categories, counts] = await Promise.all([this.catalog.listCategories(), this.catalog.countPublishedTours()]);
    return [...categories]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug))
      .map((c) => {
        const name = localizedName(c, locale);
        return { entity: c, name: name.name, description: name.description, tourCount: counts.byCategory.get(c.id) ?? 0 };
      });
  }

  async listDepartures(slug: string, from: CalendarDate | undefined, to: CalendarDate | undefined): Promise<DepartureAvailability[]> {
    const tour = await this.catalog.findTourBySlug(slug, 'es');
    if (!tour || !isTourPublished(tour)) throw new TourNotFoundError(slug);
    const start = from ?? this.today();
    const end = to ?? addDays(start, 60);
    if (end < start) throw new ValidationError('invalid-range', '"to" no puede ser anterior a "from".');
    if (end > addDays(start, MAX_DEPARTURE_RANGE_DAYS)) {
      throw new ValidationError('invalid-range', `El rango máximo es de ${MAX_DEPARTURE_RANGE_DAYS} días.`);
    }
    const departures = await this.unitOfWork.run((repos) => repos.inventory.findDepartures(tour.id, start, end));
    return departures.map((d) => ({
      id: d.id,
      date: d.departureDate,
      startTime: d.startTime,
      capacity: d.capacity,
      available: d.isClosed ? 0 : d.available,
      isClosed: d.isClosed,
    }));
  }
}
