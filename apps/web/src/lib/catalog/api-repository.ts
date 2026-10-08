import "server-only";

import { apiJson, ApiError } from "@/lib/api/client";
import { env } from "@/lib/env";

import type { CatalogRepository } from "./repository";
import { derivePaymentPolicy, durationBucketOf, formatDuration } from "./rules";
import { cleanSeedText, seedCatalogRepository } from "./seed-repository";
import type { CatalogImage, Category, Destination, PaymentPolicy, Tour, TourPricing, TourSummary } from "./types";

/**
 * Catálogo desde la API NestJS (`GET /tours`, `/tours/:slug`, `/destinations`, `/categories`).
 *
 * Caché (ISR): cada `fetch` lleva `revalidate: 3600` y el tag `catalog`; el backoffice invalida con
 * `revalidateTag('catalog', 'max')` (Route Handler a crear cuando exista el webhook de publicación).
 *
 * Degradación (decisión Sprint 1): si la API no responde (red, timeout o 5xx) se usa el seed
 * (`data/seed`, el mismo origen con el que se cargó la BD) para esa petición, y se registra un aviso.
 * Así `next build` no falla sin API y el sitio sigue navegable; al vencer la revalidación (1 h) o con
 * `revalidateTag`, las páginas vuelven a leer la API. Un 4xx de la API NO cae al seed (es un error real).
 * Un corto "circuit breaker" evita esperar el timeout en cada página del build cuando la API está caída.
 *
 * Enriquecimiento temporal desde el seed (la API aún no los expone): imágenes de destinos/categorías,
 * título corto, resumen en viñetas y pertenencia a varias categorías (la API guarda una sola).
 */

const REVALIDATE_SECONDS = 3600;
const CATALOG_TAG = "catalog";
const BREAKER_MS = 30_000;
const PAGE_SIZE = 50;

/* ---------- Contrato de la API (apps/api/src/modules/catalog/interface/catalog.controller.ts) ---------- */

interface ApiMoney {
  amount: number;
  currency: "PEN" | "USD";
}

interface ApiTourCard {
  id: string;
  slug: string;
  title: string;
  summary: string;
  type: "tour" | "package" | "transfer";
  durationDays: number | null;
  durationNights: number | null;
  durationHours: number | null;
  difficulty: string | null;
  minPax: number;
  isFeatured: boolean;
  categoryId: string | null;
  destinationIds: string[];
  coverImage: { url: string; alt: string } | null;
  priceFrom: ApiMoney | null;
  bookable: boolean;
}

interface ApiTourDetail extends ApiTourCard {
  code: string;
  description: string | null;
  /** El seed de la API deja pasar `description: null` aunque su tipo diga string. */
  itinerary: { day: number; title: string | null; description: string | null }[];
  includes: string[];
  notIncluded: string[];
  recommendations: string[];
  importantNotes: string[];
  faqs: { question: string; answer: string }[];
  policies: string | null;
  seo: { title: string; description: string };
  maxPax: number | null;
  requiresTravelerDocument: boolean;
  media: { url: string; kind: "image" | "video"; alt: string | null; isCover: boolean }[];
  category: { id: string; slug: string } | null;
  destinations: { id: string; slug: string; isPrimary: boolean }[];
  rates: { paxType: string; residency: string; amount: ApiMoney }[];
}

interface ApiTaxon {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  tourCount: number;
}

interface ListEnvelope<T> {
  data: T[];
  meta?: { page: number; totalPages: number };
}

/* ---------- Transporte con caché y degradación ---------- */

let apiDownUntil = 0;
let warned = false;

async function cached<T>(path: string): Promise<T> {
  return apiJson<T>(path, { next: { revalidate: REVALIDATE_SECONDS, tags: [CATALOG_TAG] } });
}

async function withFallback<T>(label: string, fromApi: () => Promise<T>, fromSeed: () => Promise<T>): Promise<T> {
  if (Date.now() < apiDownUntil) return fromSeed();
  try {
    return await fromApi();
  } catch (error) {
    if (error instanceof ApiError && error.unavailable) {
      apiDownUntil = Date.now() + BREAKER_MS;
      if (!warned) {
        warned = true;
        console.warn(`[catalog] API no disponible (${label}: ${error.message}). Usando data/seed temporalmente.`);
      }
      return fromSeed();
    }
    throw error;
  }
}

/* ---------- Mapeo a los tipos de la web ---------- */

interface Taxonomy {
  destinations: Map<string, ApiTaxon>;
  categories: Map<string, ApiTaxon>;
}

const q = (params: Record<string, string | number>) =>
  new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();

async function loadTaxonomy(): Promise<Taxonomy> {
  const [destinations, categories] = await Promise.all([
    cached<ListEnvelope<ApiTaxon>>(`/destinations?${q({ locale: "es" })}`),
    cached<ListEnvelope<ApiTaxon>>(`/categories?${q({ locale: "es" })}`),
  ]);
  return {
    destinations: new Map(destinations.data.map((d) => [d.id, d])),
    categories: new Map(categories.data.map((c) => [c.id, c])),
  };
}

function pricingOf(priceFrom: ApiMoney | null, rates: ApiTourDetail["rates"] = []): TourPricing | null {
  if (!priceFrom) return null;
  const childRates = rates.filter((r) => r.paxType === "child" && r.amount.currency === priceFrom.currency).map((r) => r.amount.amount);
  return {
    currency: priceFrom.currency,
    adultCents: priceFrom.amount,
    childCents: childRates.length ? Math.min(...childRates) : null,
    infantCents: null,
  };
}

function policyOf(categorySlugs: string[], requiresTravelerDocument?: boolean): PaymentPolicy {
  if (requiresTravelerDocument) {
    return { depositPercent: 100, fullPaymentReason: "Incluye boletos de terceros (tren o ingreso a Machu Picchu)" };
  }
  return derivePaymentPolicy(categorySlugs);
}

async function toSummary(card: ApiTourCard, taxonomy: Taxonomy): Promise<TourSummary> {
  const seed = await seedCatalogRepository.getTour(card.slug);
  const destinations = card.destinationIds.map((id) => taxonomy.destinations.get(id)).filter((d): d is ApiTaxon => !!d);
  const apiCategory = card.categoryId ? taxonomy.categories.get(card.categoryId)?.slug : undefined;
  const categorySlugs = Array.from(new Set([...(apiCategory ? [apiCategory] : []), ...(seed?.categorySlugs ?? [])]));
  const shortTitle = seed?.shortTitle ?? card.title;
  const image: CatalogImage | null = card.coverImage ? { src: card.coverImage.url, alt: shortTitle } : null;
  return {
    slug: card.slug,
    path: `/es/tours/${card.slug}`,
    title: card.title,
    shortTitle,
    excerpt: cleanSeedText(card.summary) ?? "",
    durationLabel: seed?.durationLabel ?? formatDuration(card.durationDays, card.durationNights),
    durationDays: card.durationDays,
    durationNights: card.durationNights,
    durationBucket: durationBucketOf(card.durationDays),
    destinationNames: destinations.map((d) => d.name),
    destinationSlugs: destinations.map((d) => d.slug),
    categorySlugs,
    minPax: card.minPax,
    difficulty: card.difficulty,
    featured: card.isFeatured,
    image,
    pricing: pricingOf(card.priceFrom),
    paymentPolicy: policyOf(categorySlugs),
  };
}

async function toTour(detail: ApiTourDetail, taxonomy: Taxonomy): Promise<Tour> {
  const summary = await toSummary(detail, taxonomy);
  const seed = await seedCatalogRepository.getTour(detail.slug);
  const images = detail.media.filter((m) => m.kind === "image");
  return {
    ...summary,
    pricing: pricingOf(detail.priceFrom, detail.rates),
    paymentPolicy: policyOf(summary.categorySlugs, detail.requiresTravelerDocument),
    metaTitle: detail.seo.title,
    metaDescription: cleanSeedText(detail.seo.description) ?? summary.excerpt,
    description: cleanSeedText(detail.description) ?? "",
    summaryText: seed?.summaryText ?? null,
    itinerary: detail.itinerary
      .filter((d) => d.title || d.description)
      .map((d) => ({ day: d.day, title: d.title, description: d.description ?? "" })),
    includes: detail.includes ?? [],
    notIncludes: detail.notIncluded ?? [],
    recommendations: detail.recommendations ?? [],
    important: detail.importantNotes ?? [],
    faqs: (detail.faqs ?? []).filter((f) => f.question && f.answer),
    policies: detail.policies,
    // TODO(HU-0.3): alt descriptivo por foto cuando la API tenga metadatos por imagen (hoy repite el título).
    gallery: images.map((m, i) => ({ src: m.url, alt: `${summary.shortTitle}, foto ${i + 1} de ${images.length}` })),
  };
}

async function listAllCards(): Promise<ApiTourCard[]> {
  const params = { locale: "es", currency: env.CATALOG_CURRENCY, sort: "featured", pageSize: PAGE_SIZE };
  const first = await cached<ListEnvelope<ApiTourCard>>(`/tours?${q({ ...params, page: 1 })}`);
  const pages = first.meta?.totalPages ?? 1;
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pages - 1) }, (_, i) => cached<ListEnvelope<ApiTourCard>>(`/tours?${q({ ...params, page: i + 2 })}`)),
  );
  return [first, ...rest].flatMap((p) => p.data);
}

async function apiTours(): Promise<TourSummary[]> {
  const [cards, taxonomy] = await Promise.all([listAllCards(), loadTaxonomy()]);
  return Promise.all(cards.map((c) => toSummary(c, taxonomy)));
}

async function apiDestinations(): Promise<Destination[]> {
  const [taxonomy, tours, seed] = await Promise.all([loadTaxonomy(), apiTours(), seedCatalogRepository.listDestinations()]);
  return [...taxonomy.destinations.values()].map((d) => {
    const s = seed.find((x) => x.slug === d.slug);
    const tourSlugs = tours.filter((t) => t.destinationSlugs.includes(d.slug)).map((t) => t.slug);
    return {
      slug: d.slug,
      path: `/es/destinos/${d.slug}`,
      name: d.name,
      description: cleanSeedText(d.description),
      bannerImage: s?.bannerImage ?? null,
      cardImage: s?.cardImage ?? null,
      tourSlugs,
      tourCount: tourSlugs.length,
    };
  });
}

async function apiCategories(): Promise<Category[]> {
  const [taxonomy, tours, seed] = await Promise.all([loadTaxonomy(), apiTours(), seedCatalogRepository.listCategories()]);
  return [...taxonomy.categories.values()].map((c) => {
    const s = seed.find((x) => x.slug === c.slug);
    const tourSlugs = tours.filter((t) => t.categorySlugs.includes(c.slug)).map((t) => t.slug);
    return {
      slug: c.slug,
      path: `/es/categorias/${c.slug}`,
      name: c.name,
      description: cleanSeedText(c.description),
      bannerImage: s?.bannerImage ?? null,
      tourSlugs,
      tourCount: tourSlugs.length,
    };
  });
}

async function apiTour(slug: string): Promise<Tour | null> {
  let detail: ApiTourDetail;
  try {
    detail = (await cached<{ data: ApiTourDetail }>(`/tours/${encodeURIComponent(slug)}?${q({ locale: "es", currency: env.CATALOG_CURRENCY })}`)).data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
  return toTour(detail, await loadTaxonomy());
}

export function createApiCatalogRepository(): CatalogRepository {
  const seed = seedCatalogRepository;
  return {
    listTours: () => withFallback("tours", apiTours, () => seed.listTours()),
    getTour: (slug) => withFallback(`tour ${slug}`, () => apiTour(slug), () => seed.getTour(slug)),
    listDestinations: () => withFallback("destinations", apiDestinations, () => seed.listDestinations()),
    getDestination: (slug) =>
      withFallback(
        `destination ${slug}`,
        async () => (await apiDestinations()).find((d) => d.slug === slug) ?? null,
        () => seed.getDestination(slug),
      ),
    listCategories: () => withFallback("categories", apiCategories, () => seed.listCategories()),
    getCategory: (slug) =>
      withFallback(
        `category ${slug}`,
        async () => (await apiCategories()).find((c) => c.slug === slug) ?? null,
        () => seed.getCategory(slug),
      ),
  };
}
