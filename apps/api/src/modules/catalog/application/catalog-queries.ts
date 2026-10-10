import { addDays, toLimaCalendarDate, type CalendarDate } from '../../../shared/domain/calendar-date.js';
import { ValidationError } from '../../../shared/domain/domain-error.js';
import type { Clock } from '../../../shared/domain/ports.js';
import type { CurrencyCode, Money } from '../../../shared/domain/money.js';
import type { UnitOfWork } from '../../../shared/application/unit-of-work.js';
import type { CatalogRepository, Page, TourListing, TourSearchCriteria } from '../domain/catalog.repository.js';
import { priceFrom, type Rate } from '../domain/pricing.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { resolveLocalizedName, slugFor, type Category, type Destination } from '../domain/taxonomy.js';
import { isTourPublished, resolveTourTranslation, type Locale, type Tour, type TourTranslation } from '../domain/tour.js';
import { TourNotFoundError } from './tour-quote.service.js';

export interface TourDetail {
  tour: Tour;
  translation: TourTranslation;
  /** Idioma servido y si fue fallback a `es` (I6). */
  locale: Locale;
  fallback: boolean;
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
  /** Slug público en el idioma pedido (propio de la traducción o canónico). */
  slug: string;
  locale: Locale;
  fallback: boolean;
}

/** Resultado de buscar por slug: el recurso o un 301 al slug correcto del idioma (I3). */
export type SlugResult<T> = { kind: 'found'; value: T } | { kind: 'redirect'; slug: string; locale: Locale };

export class TaxonomyNotFoundError extends NotFoundError {
  constructor(kind: 'destination' | 'category', slug: string) {
    super(`${kind}-not-found`, kind === 'destination' ? 'Destino no encontrado.' : 'Categoría no encontrada.', { slug });
  }
}

export interface DepartureAvailability {
  id: string;
  date: CalendarDate;
  startTime: string;
  capacity: number;
  available: number;
  isClosed: boolean;
  /** Precio desde (adulto) vigente ESA fecha en la moneda pedida; null = consultar. */
  priceFrom: Money | null;
  /** Hay cupo, la salida está abierta y aún no pasó el cierre de venta del tour. */
  bookable: boolean;
}

/** Ventana máxima del calendario de la ficha (W6/F9). */
export const MAX_DEPARTURE_RANGE_DAYS = 180;

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

  /**
   * Ficha por slug de cualquier idioma. Si el slug pedido no es el del idioma servido (p. ej. slug
   * `es` con `locale=en` y existe traducción `en`), devuelve un 301 al slug correcto.
   */
  async getTourBySlug(slug: string, locale: Locale, currency: CurrencyCode): Promise<SlugResult<TourDetail>> {
    const detail = await this.getTour(slug, locale, currency);
    if (detail.translation.slug !== slug && detail.tour.slug !== slug) return { kind: 'redirect', slug: detail.translation.slug, locale };
    if (detail.translation.slug !== slug && !detail.fallback) return { kind: 'redirect', slug: detail.translation.slug, locale };
    return { kind: 'found', value: detail };
  }

  async getTour(slug: string, locale: Locale, currency: CurrencyCode): Promise<TourDetail> {
    const tour = await this.catalog.findTourBySlug(slug, locale);
    const resolved = tour ? resolveTourTranslation(tour, locale) : undefined;
    if (!tour || !isTourPublished(tour) || !resolved) throw new TourNotFoundError(slug);
    const translation = resolved.translation;
    const [rates, destinations, categories] = await Promise.all([
      this.catalog.findRates(tour.id),
      this.catalog.listDestinations(),
      this.catalog.listCategories(),
    ]);
    const byId = new Map(destinations.map((d) => [d.id, d]));
    return {
      tour,
      translation,
      locale: resolved.locale,
      fallback: resolved.fallback,
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
        const r = resolveLocalizedName(d, locale);
        return { entity: d, name: r.value.name, description: r.value.description, tourCount: counts.byDestination.get(d.id) ?? 0, slug: r.slug, locale: r.locale, fallback: r.fallback };
      });
  }

  /** Destino publicado por slug (canónico o de cualquier idioma); 301 si el slug no es el del idioma. */
  async getDestination(slug: string, locale: Locale): Promise<SlugResult<TaxonomyEntry<Destination>>> {
    const all = await this.listDestinations(locale);
    const entry = all.find((e) => e.slug === slug) ?? all.find((e) => e.entity.slug === slug || e.entity.translations.some((t) => t.slug === slug));
    if (!entry) throw new TaxonomyNotFoundError('destination', slug);
    return entry.slug === slug ? { kind: 'found', value: entry } : { kind: 'redirect', slug: slugFor(entry.entity, locale), locale };
  }

  async getCategory(slug: string, locale: Locale): Promise<SlugResult<TaxonomyEntry<Category>>> {
    const all = await this.listCategories(locale);
    const entry = all.find((e) => e.slug === slug) ?? all.find((e) => e.entity.slug === slug || e.entity.translations.some((t) => t.slug === slug));
    if (!entry) throw new TaxonomyNotFoundError('category', slug);
    return entry.slug === slug ? { kind: 'found', value: entry } : { kind: 'redirect', slug: slugFor(entry.entity, locale), locale };
  }

  async listCategories(locale: Locale): Promise<Array<TaxonomyEntry<Category>>> {
    const [categories, counts] = await Promise.all([this.catalog.listCategories(), this.catalog.countPublishedTours()]);
    return [...categories]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug))
      .map((c) => {
        const r = resolveLocalizedName(c, locale);
        return { entity: c, name: r.value.name, description: r.value.description, tourCount: counts.byCategory.get(c.id) ?? 0, slug: r.slug, locale: r.locale, fallback: r.fallback };
      });
  }

  async listDepartures(slug: string, from: CalendarDate | undefined, to: CalendarDate | undefined, currency: CurrencyCode = 'PEN'): Promise<DepartureAvailability[]> {
    const tour = await this.catalog.findTourBySlug(slug, 'es');
    if (!tour || !isTourPublished(tour)) throw new TourNotFoundError(slug);
    const today = this.today();
    const start = from && from > today ? from : today;
    const end = to ?? addDays(start, MAX_DEPARTURE_RANGE_DAYS);
    if (end < start) throw new ValidationError('invalid-range', '"to" no puede ser anterior a "from".');
    if (end > addDays(start, MAX_DEPARTURE_RANGE_DAYS)) {
      throw new ValidationError('invalid-range', `El rango máximo es de ${MAX_DEPARTURE_RANGE_DAYS} días.`);
    }
    const departures = await this.unitOfWork.run((repos) => repos.inventory.findDepartures(tour.id, start, end));
    const rates = (await this.catalog.findRates(tour.id)).filter((r) => r.isActive && r.currency === currency);
    const cutoff = this.clock.now().getTime() + tour.bookingCutoffHours * 3_600_000;
    return departures.map((d) => {
      const available = d.isClosed ? 0 : d.available;
      // Precio desde ESA fecha: tarifas vigentes el día de la salida (la de mayor prioridad gana en la cotización).
      const sameDay = rates.filter((r) => r.validFrom <= d.departureDate && d.departureDate <= r.validTo);
      const startsAt = Date.parse(`${d.departureDate}T${d.startTime}:00-05:00`);
      return {
        id: d.id,
        date: d.departureDate,
        startTime: d.startTime,
        capacity: d.capacity,
        available,
        isClosed: d.isClosed,
        priceFrom: priceFrom(sameDay, currency, d.departureDate),
        bookable: !d.isClosed && available > 0 && startsAt >= cutoff,
      };
    });
  }
}
