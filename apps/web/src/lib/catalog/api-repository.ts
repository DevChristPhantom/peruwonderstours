import "server-only";

import type { Locale } from "@/i18n/routing";
import { categoryPath, destinationPath, tourPath } from "@/i18n/paths";
import { apiJson, ApiError } from "@/lib/api/client";
import { env } from "@/lib/env";

import type { CatalogRepository } from "./repository";
import { derivePaymentPolicy, durationBucketOf } from "./rules";
import { cleanSeedText, seedCatalogRepository, seedEnrichment } from "./seed-repository";
import type { CatalogImage, Category, Destination, LocalePaths, PaymentPolicy, Tour, TourPricing, TourSummary } from "./types";

/**
 * Catálogo desde la API NestJS (`GET /tours`, `/tours/:slug`, `/destinations`, `/categories`) con
 * `locale=es|en` (I5). Contrato de idioma (brief del backend, sprint 3): cada recurso trae
 * `{ locale, fallback }`; con `fallback: true` el texto viene en español porque falta la traducción.
 * El detalle trae `alternateLocales: [{ locale, slug }]` para el hreflang y el selector de idioma.
 * Si la API aún devuelve 0 resultados en inglés (comportamiento previo, I6), se usa el español con
 * `fallback: true`. Los registros se unen entre idiomas por `id`: la CLAVE estable de cada tour,
 * destino y categoría es su slug en español.
 *
 * Caché (ISR): cada `fetch` lleva `revalidate: 3600` y el tag `catalog`.
 *
 * Degradación (decisión Sprint 1): si la API no responde (red, timeout o 5xx) se usa el seed para esa
 * petición y se registra un aviso. Un 4xx de la API NO cae al seed. Un corto "circuit breaker" evita
 * esperar el timeout en cada página del build cuando la API está caída.
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

interface ApiLocalized {
  /** Idioma del texto devuelto. */
  locale?: Locale;
  /** true = texto en español por falta de traducción. */
  fallback?: boolean;
}

interface ApiTourCard extends ApiLocalized {
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
  alternateLocales?: { locale: Locale; slug: string }[];
}

interface ApiTaxon extends ApiLocalized {
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

const q = (params: Record<string, string | number>) =>
  new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();

/** ¿El texto viene realmente en el idioma pedido? */
function isFallback(item: ApiLocalized | undefined, locale: Locale): boolean {
  if (locale === "es") return false;
  if (!item) return true;
  if (item.fallback !== undefined) return item.fallback;
  return item.locale !== undefined && item.locale !== locale;
}

/* ---------- Taxonomía (destinos y categorías) por idioma, unida por id ---------- */

interface TaxonEntry {
  es: ApiTaxon;
  /** Registro en el idioma pedido (o el español si falta). */
  text: ApiTaxon;
  key: string;
  alternates: { es: string; en: string };
  fallback: boolean;
}

interface Taxonomy {
  destinations: Map<string, TaxonEntry>;
  categories: Map<string, TaxonEntry>;
}

async function loadTaxonomy(locale: Locale): Promise<Taxonomy> {
  const fetchList = (resource: "destinations" | "categories", lang: Locale) =>
    cached<ListEnvelope<ApiTaxon>>(`/${resource}?${q({ locale: lang })}`).then((r) => r.data);
  const build = async (resource: "destinations" | "categories") => {
    const [es, en] = await Promise.all([fetchList(resource, "es"), fetchList(resource, "en").catch(() => [] as ApiTaxon[])]);
    const enById = new Map(en.map((x) => [x.id, x]));
    return new Map(
      es.map((item) => {
        const translated = enById.get(item.id);
        const enSlug = translated && !isFallback(translated, "en") ? translated.slug : item.slug;
        const text = locale === "en" && translated ? translated : item;
        return [
          item.id,
          {
            es: item,
            text,
            key: item.slug,
            alternates: { es: item.slug, en: enSlug },
            fallback: locale === "en" ? isFallback(translated, "en") : false,
          } satisfies TaxonEntry,
        ];
      }),
    );
  };
  const [destinations, categories] = await Promise.all([build("destinations"), build("categories")]);
  return { destinations, categories };
}

/* ---------- Tours por idioma, unidos por id ---------- */

async function listAllCards(locale: Locale): Promise<ApiTourCard[]> {
  const params = { locale, currency: env.CATALOG_CURRENCY, sort: "featured", pageSize: PAGE_SIZE };
  const first = await cached<ListEnvelope<ApiTourCard>>(`/tours?${q({ ...params, page: 1 })}`);
  const pages = first.meta?.totalPages ?? 1;
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pages - 1) }, (_, i) => cached<ListEnvelope<ApiTourCard>>(`/tours?${q({ ...params, page: i + 2 })}`)),
  );
  return [first, ...rest].flatMap((p) => p.data);
}

interface CardEntry {
  es: ApiTourCard;
  text: ApiTourCard;
  fallback: boolean;
  alternates: LocalePaths;
}

async function loadCards(locale: Locale): Promise<CardEntry[]> {
  const [es, en] = await Promise.all([listAllCards("es"), listAllCards("en").catch(() => [] as ApiTourCard[])]);
  const enById = new Map(en.map((c) => [c.id, c]));
  return es.map((card) => {
    const translated = enById.get(card.id);
    const enSlug = translated && !isFallback(translated, "en") ? translated.slug : card.slug;
    return {
      es: card,
      text: locale === "en" && translated ? translated : card,
      fallback: locale === "en" ? isFallback(translated, "en") : false,
      alternates: { es: tourPath("es", card.slug), en: tourPath("en", enSlug) },
    };
  });
}

/* ---------- Mapeo a los tipos de la web ---------- */

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
  if (requiresTravelerDocument) return { depositPercent: 100, fullPaymentReason: "third-party-tickets" };
  return derivePaymentPolicy(categorySlugs);
}

function durationLabelOf(days: number | null, nights: number | null): string {
  if (!days) return "";
  return days === 1 ? "1D" : `${days}D/${nights ?? days - 1}N`;
}

function toSummary(entry: CardEntry, taxonomy: Taxonomy, locale: Locale): TourSummary {
  const { es, text, fallback, alternates } = entry;
  const key = es.slug;
  const seed = seedEnrichment.tour(key);
  const seedText = seedEnrichment.tourText(key, fallback ? "es" : locale);
  const destinations = es.destinationIds.map((id) => taxonomy.destinations.get(id)).filter((d): d is TaxonEntry => !!d);
  const apiCategory = es.categoryId ? taxonomy.categories.get(es.categoryId)?.key : undefined;
  const categorySlugs = Array.from(new Set([...(apiCategory ? [apiCategory] : []), ...(seed?.categorySlugs ?? [])]));
  const shortTitle = (fallback ? null : seedText?.shortTitle?.trim()) || (locale === "es" ? seed?.shortTitle?.trim() : null) || text.title;
  const image: CatalogImage | null = es.coverImage ? { src: es.coverImage.url, alt: text.coverImage?.alt || shortTitle } : null;
  return {
    key,
    slug: locale === "es" ? es.slug : alternates.en.split("/").pop()!,
    path: alternates[locale],
    alternates,
    fallback,
    title: text.title,
    shortTitle,
    excerpt: cleanSeedText(text.summary) ?? "",
    durationLabel: seed?.durationLabel ?? durationLabelOf(es.durationDays, es.durationNights),
    durationDays: es.durationDays,
    durationNights: es.durationNights,
    durationBucket: durationBucketOf(es.durationDays),
    destinationNames: destinations.map((d) => d.text.name),
    destinationSlugs: destinations.map((d) => d.key),
    categorySlugs,
    minPax: es.minPax,
    difficulty: text.difficulty,
    featured: es.isFeatured,
    image,
    pricing: pricingOf(es.priceFrom),
    paymentPolicy: policyOf(categorySlugs),
  };
}

function toTour(detail: ApiTourDetail, entry: CardEntry, taxonomy: Taxonomy, locale: Locale): Tour {
  const fallback = locale === "en" ? isFallback(detail, "en") : false;
  const enSlug = detail.alternateLocales?.find((a) => a.locale === "en")?.slug;
  const alternates: LocalePaths = enSlug && !fallback ? { es: entry.alternates.es, en: tourPath("en", enSlug) } : entry.alternates;
  const summary = toSummary({ ...entry, text: detail, fallback, alternates }, taxonomy, locale);
  const seedText = seedEnrichment.tourText(summary.key, fallback ? "es" : locale);
  const images = detail.media.filter((m) => m.kind === "image");
  return {
    ...summary,
    pricing: pricingOf(detail.priceFrom, detail.rates),
    paymentPolicy: policyOf(summary.categorySlugs, detail.requiresTravelerDocument),
    metaTitle: detail.seo.title,
    metaDescription: cleanSeedText(detail.seo.description) ?? summary.excerpt,
    description: cleanSeedText(detail.description) ?? "",
    summaryText: seedText?.summary ? cleanSeedText(seedText.summary) : null,
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
    gallery: images.map((m) => ({ src: m.url, alt: m.alt || summary.shortTitle })),
  };
}

async function apiTours(locale: Locale): Promise<TourSummary[]> {
  const [cards, taxonomy] = await Promise.all([loadCards(locale), loadTaxonomy(locale)]);
  return cards.map((c) => toSummary(c, taxonomy, locale));
}

function taxonAlternates(entry: TaxonEntry, kind: "destination" | "category"): LocalePaths {
  const make = kind === "destination" ? destinationPath : categoryPath;
  return { es: make("es", entry.alternates.es), en: make("en", entry.alternates.en) };
}

async function apiDestinations(locale: Locale): Promise<Destination[]> {
  const [taxonomy, tours] = await Promise.all([loadTaxonomy(locale), apiTours(locale)]);
  return [...taxonomy.destinations.values()].map((d) => {
    const s = seedEnrichment.destination(d.key);
    const tourSlugs = tours.filter((t) => t.destinationSlugs.includes(d.key)).map((t) => t.key);
    const alternates = taxonAlternates(d, "destination");
    const alt = d.text.name;
    return {
      key: d.key,
      slug: d.alternates[locale],
      path: alternates[locale],
      alternates,
      fallback: d.fallback,
      name: d.text.name,
      description: cleanSeedText(d.text.description),
      bannerImage: s?.bannerImage ? { src: s.bannerImage, alt } : null,
      cardImage: s?.bannerImage || s?.cardImage ? { src: (s.bannerImage ?? s.cardImage)!, alt } : null,
      tourSlugs,
      tourCount: tourSlugs.length,
    };
  });
}

async function apiCategories(locale: Locale): Promise<Category[]> {
  const [taxonomy, tours] = await Promise.all([loadTaxonomy(locale), apiTours(locale)]);
  return [...taxonomy.categories.values()].map((c) => {
    const s = seedEnrichment.category(c.key);
    const tourSlugs = tours.filter((t) => t.categorySlugs.includes(c.key)).map((t) => t.key);
    const alternates = taxonAlternates(c, "category");
    return {
      key: c.key,
      slug: c.alternates[locale],
      path: alternates[locale],
      alternates,
      fallback: c.fallback,
      name: c.text.name,
      description: cleanSeedText(c.text.description),
      bannerImage: s?.bannerImage ? { src: s.bannerImage, alt: c.text.name } : null,
      tourSlugs,
      tourCount: tourSlugs.length,
    };
  });
}

async function apiTour(slug: string, locale: Locale): Promise<Tour | null> {
  const cards = await loadCards(locale);
  // El slug puede venir en cualquier idioma (o ser la clave en español).
  const entry = cards.find((c) => c.es.slug === slug || c.alternates.en.endsWith(`/${slug}`) || c.text.slug === slug);
  if (!entry) return null;
  const localSlug = locale === "es" ? entry.es.slug : entry.alternates.en.split("/").pop()!;
  const fetchDetail = async (s: string, lang: Locale) => {
    try {
      return (await cached<{ data: ApiTourDetail }>(`/tours/${encodeURIComponent(s)}?${q({ locale: lang, currency: env.CATALOG_CURRENCY })}`)).data;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  };
  let detail = await fetchDetail(localSlug, locale);
  // Sin traducción y sin fallback en la API: se muestra el español marcado como respaldo.
  if (!detail && locale !== "es") {
    const es = await fetchDetail(entry.es.slug, "es");
    detail = es ? { ...es, locale: "es", fallback: true } : null;
  }
  if (!detail) return null;
  return toTour(detail, entry, await loadTaxonomy(locale), locale);
}

function findTaxon<T extends { key: string; slug: string; alternates: LocalePaths }>(list: T[], slug: string): T | null {
  return list.find((x) => x.key === slug || x.slug === slug || x.alternates.en.endsWith(`/${slug}`) || x.alternates.es.endsWith(`/${slug}`)) ?? null;
}

export function createApiCatalogRepository(): CatalogRepository {
  const seed = seedCatalogRepository;
  return {
    listTours: (locale) => withFallback("tours", () => apiTours(locale), () => seed.listTours(locale)),
    getTour: (slug, locale) => withFallback(`tour ${slug}`, () => apiTour(slug, locale), () => seed.getTour(slug, locale)),
    listDestinations: (locale) => withFallback("destinations", () => apiDestinations(locale), () => seed.listDestinations(locale)),
    getDestination: (slug, locale) =>
      withFallback(
        `destination ${slug}`,
        async () => findTaxon(await apiDestinations(locale), slug),
        () => seed.getDestination(slug, locale),
      ),
    listCategories: (locale) => withFallback("categories", () => apiCategories(locale), () => seed.listCategories(locale)),
    getCategory: (slug, locale) =>
      withFallback(
        `category ${slug}`,
        async () => findTaxon(await apiCategories(locale), slug),
        () => seed.getCategory(slug, locale),
      ),
  };
}
