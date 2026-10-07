import type { CalendarDate } from '../../../shared/domain/calendar-date.js';
import type { CurrencyCode, Money } from '../../../shared/domain/money.js';
import type { Departure, InventoryHold } from './departure.js';
import type { Rate } from './pricing.js';
import type { Category, Destination } from './taxonomy.js';
import type { Difficulty, Locale, Tour, TourType } from './tour.js';

export type TourSort = 'relevance' | 'featured' | 'price_asc' | 'price_desc' | 'duration_asc' | 'duration_desc';

export interface TourSearchCriteria {
  locale: Locale;
  currency: CurrencyCode;
  /** Fecha de referencia (Lima) para "precio desde". */
  today: CalendarDate;
  text?: string;
  destinationSlug?: string;
  categorySlug?: string;
  type?: TourType;
  difficulty?: Difficulty;
  minDays?: number;
  maxDays?: number;
  featured?: boolean;
  /** Rango de "precio desde" en céntimos de `currency`. */
  minPrice?: bigint;
  maxPrice?: bigint;
  sort: TourSort;
  page: number;
  pageSize: number;
}

export interface TourListing {
  tour: Tour;
  priceFrom: Money | null;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Puerto de lectura del catálogo publicado. */
export interface CatalogRepository {
  searchTours(criteria: TourSearchCriteria): Promise<Page<TourListing>>;
  /** Busca por slug canónico o por slug de la traducción en `locale`. Incluye borradores. */
  findTourBySlug(slug: string, locale: Locale): Promise<Tour | null>;
  findTourById(id: string): Promise<Tour | null>;
  findRates(tourId: string): Promise<Rate[]>;
  listDestinations(): Promise<Destination[]>;
  listCategories(): Promise<Category[]>;
  /** Cantidad de tours publicados por destino/categoría (para menús y páginas). */
  countPublishedTours(): Promise<{ byDestination: Map<string, number>; byCategory: Map<string, number> }>;
}

/** Puerto de inventario (salidas y retenciones). Se usa dentro de una unidad de trabajo. */
export interface InventoryRepository {
  findDeparture(id: string): Promise<Departure | null>;
  findDepartures(tourId: string, from: CalendarDate, to: CalendarDate): Promise<Departure[]>;
  /**
   * Persiste con bloqueo optimista (`WHERE version = persistedVersion`).
   * Lanza ConcurrencyError si la fila cambió.
   */
  saveDeparture(departure: Departure): Promise<void>;
  saveHold(hold: InventoryHold): Promise<void>;
  findHoldsByBookingItems(bookingItemIds: readonly string[]): Promise<InventoryHold[]>;
}
