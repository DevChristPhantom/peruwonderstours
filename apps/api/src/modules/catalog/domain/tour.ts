import { pickTranslation } from '../../../shared/domain/i18n.js';
import { addDays, type CalendarDate } from '../../../shared/domain/calendar-date.js';

export const LOCALES = ['es', 'en', 'pt'] as const;
export type Locale = (typeof LOCALES)[number];

export const TOUR_TYPES = ['tour', 'package', 'transfer'] as const;
export type TourType = (typeof TOUR_TYPES)[number];

export const DIFFICULTIES = ['easy', 'moderate', 'challenging', 'extreme'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export type PublicationStatus = 'draft' | 'published' | 'archived';

export const PAX_TYPES = ['adult', 'child', 'student', 'senior'] as const;
export type PaxType = (typeof PAX_TYPES)[number];

export const RESIDENCIES = ['national', 'foreign'] as const;
export type Residency = (typeof RESIDENCIES)[number];

export interface ItineraryDay {
  day: number;
  title: string | null;
  description: string;
  meals?: string[];
  overnight?: string | null;
}

export interface Faq {
  question: string;
  answer: string;
}

export interface TourTranslation {
  locale: Locale;
  slug: string;
  title: string;
  summary: string;
  description: string | null;
  itinerary: ItineraryDay[];
  includes: string[];
  notIncluded: string[];
  recommendations: string[];
  faqs: Faq[];
  importantNotes: string[];
  policies: string | null;
  meetingPoint: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  /** Metadato del panel (no se publica): p. ej. machine_reviewed_pending_client. */
  translationStatus?: string | null;
}

export interface TourMedia {
  url: string;
  kind: 'image' | 'video';
  altEs: string | null;
  altEn: string | null;
  isCover: boolean;
  sortOrder: number;
}

export interface TourDestinationRef {
  destinationId: string;
  isPrimary: boolean;
  sortOrder: number;
}

/** Producto vendible del catálogo (lectura). Las tarifas y salidas viven aparte. */
export interface Tour {
  id: string;
  slug: string;
  code: string;
  type: TourType;
  status: PublicationStatus;
  categoryId: string | null;
  durationDays: number | null;
  durationNights: number | null;
  durationHours: number | null;
  minPax: number;
  maxPax: number | null;
  difficulty: Difficulty | null;
  languages: string[];
  bookingCutoffHours: number;
  depositPercentOverride: number | null;
  requiresTravelerDocument: boolean;
  usesInventory: boolean;
  isFeatured: boolean;
  cancellationPolicyCode: string | null;
  publishedAt: Date | null;
  translations: TourTranslation[];
  media: TourMedia[];
  destinations: TourDestinationRef[];
}

export function isTourPublished(tour: Tour): boolean {
  return tour.status === 'published';
}

/** Traducción solicitada; sin fallback entre idiomas (HU-10.2: no mezclar idiomas). */
export function findTranslation(tour: Tour, locale: Locale): TourTranslation | undefined {
  return tour.translations.find((t) => t.locale === locale);
}

/**
 * I6 (Sprint 3): traducción pedida o, si falta, la canónica `es` (`fallback: true`).
 * Regla uniforme para todo el contenido público (ver shared/domain/i18n.ts).
 */
export function resolveTourTranslation(tour: Tour, locale: Locale): { translation: TourTranslation; locale: Locale; fallback: boolean } | undefined {
  const picked = pickTranslation(tour.translations, locale);
  return picked ? { translation: picked.value, locale: picked.locale, fallback: picked.fallback } : undefined;
}

/** Título para snapshots (reserva): idioma pedido o, si falta, el canónico `es`. */
export function snapshotTitle(tour: Tour, locale: Locale): string {
  return (findTranslation(tour, locale) ?? findTranslation(tour, 'es') ?? tour.translations[0])?.title ?? tour.slug;
}

export function coverImage(tour: Tour): TourMedia | undefined {
  return tour.media.find((m) => m.isCover) ?? [...tour.media].sort((a, b) => a.sortOrder - b.sortOrder)[0];
}

/**
 * SUPUESTO (pendiente del cliente, RN-11/RN-14): un tour con boletos nominativos de
 * terceros (Machu Picchu, tren) se identifica por `requiresTravelerDocument`.
 * Cuando el cliente confirme, reemplazar por un atributo explícito por componente.
 */
export function includesThirdPartyTickets(tour: Tour): boolean {
  return tour.requiresTravelerDocument;
}

/** Último día de servicio para un ítem que empieza en `travelDate`. */
export function serviceEndDate(tour: Tour, travelDate: CalendarDate): CalendarDate {
  const days = tour.durationDays && tour.durationDays > 1 ? tour.durationDays : 1;
  return addDays(travelDate, days - 1);
}
