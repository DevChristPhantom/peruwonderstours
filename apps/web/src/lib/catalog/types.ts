/**
 * Tipos del catálogo consumidos por los componentes.
 * Son independientes de la fuente (seed JSON hoy, API `/api/v1` después): los componentes
 * solo conocen estos tipos y las funciones de `@/lib/catalog`.
 *
 * Dinero: siempre céntimos enteros + moneda ISO 4217 (CLAUDE.md). Nunca float.
 */

export type Currency = "PEN" | "USD";

export interface Money {
  amountCents: number;
  currency: Currency;
}

/** Tipos de viajero que muestra la UI (la API mapeará a PaxType: adult/child/student/senior). */
export type TravelerType = "adult" | "child" | "infant";

/**
 * Tarifa "desde" de un tour (por persona). `null` en el tour = precio a consultar.
 * childCents/infantCents null = no hay tarifa diferenciada publicada.
 */
export interface TourPricing {
  currency: Currency;
  adultCents: number;
  childCents: number | null;
  infantCents: number | null;
}

/**
 * Política de pago del tour (RN-13/RN-14).
 * depositPercent: 50 por defecto; 100 si el tour exige pago completo (boletos de terceros).
 */
export interface PaymentPolicy {
  depositPercent: number;
  fullPaymentReason: string | null;
}

export interface CatalogImage {
  src: string;
  alt: string;
}

export type DurationBucket = "1" | "2-3" | "4-6" | "7+";

export interface TourSummary {
  slug: string;
  path: string;
  title: string;
  shortTitle: string;
  excerpt: string;
  durationLabel: string;
  durationDays: number | null;
  durationNights: number | null;
  durationBucket: DurationBucket | null;
  destinationNames: string[];
  destinationSlugs: string[];
  categorySlugs: string[];
  minPax: number;
  difficulty: string | null;
  featured: boolean;
  image: CatalogImage | null;
  pricing: TourPricing | null;
  paymentPolicy: PaymentPolicy;
}

export interface ItineraryEntry {
  day: number;
  title: string | null;
  description: string;
}

export interface Faq {
  question: string;
  answer: string;
}

export interface Tour extends TourSummary {
  metaTitle: string;
  metaDescription: string;
  description: string;
  summaryText: string | null;
  itinerary: ItineraryEntry[];
  includes: string[];
  notIncludes: string[];
  recommendations: string[];
  important: string[];
  faqs: Faq[];
  policies: string | null;
  gallery: CatalogImage[];
}

export interface Destination {
  slug: string;
  path: string;
  name: string;
  description: string | null;
  bannerImage: CatalogImage | null;
  cardImage: CatalogImage | null;
  tourSlugs: string[];
  tourCount: number;
}

export interface Category {
  slug: string;
  path: string;
  name: string;
  description: string | null;
  bannerImage: CatalogImage | null;
  tourSlugs: string[];
  tourCount: number;
}

export interface TourFilters {
  destination?: string;
  category?: string;
  duration?: DurationBucket;
  q?: string;
}

export type SearchOptionKind = "destination" | "category" | "tour";

/** Opción del combobox del buscador. */
export interface SearchOption {
  kind: SearchOptionKind;
  value: string;
  label: string;
  hint: string;
  href: string;
}

/** Imágenes que usa el header/hero (paneles del dropdown morph). */
export interface NavMedia {
  heroImage: CatalogImage | null;
  discover: { key: string; title: string; description: string; href: string; image: CatalogImage | null }[];
  journeys: { key: string; title: string; href: string; image: CatalogImage | null }[];
  regions: { key: string; label: string; href: string }[];
}
