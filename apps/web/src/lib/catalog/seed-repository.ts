import "server-only";

import toursJson from "@seed/tours.json";
import toursEnJson from "@seed/en/tours.json";
import destinationsJson from "@seed/destinations.json";
import destinationsEnJson from "@seed/en/destinations.json";
import categoriesJson from "@seed/categories.json";
import categoriesEnJson from "@seed/en/categories.json";
import slugMapJson from "@seed/en/_slug-map.json";

import type { Locale } from "@/i18n/routing";
import { categoryPath, destinationPath, tourPath } from "@/i18n/paths";

import type { CatalogRepository } from "./repository";
import { derivePaymentPolicy, durationBucketOf } from "./rules";
import { catalogImageSource } from "./image-source";
import type { CatalogImage, Category, Destination, LocalePaths, Tour, TourSummary } from "./types";

/* ---------- Forma de los JSON extraídos (data/seed/_extraction-report.md) ---------- */

interface SeedTour {
  slug: string;
  originalUrl?: string;
  newPath: string;
  title: string;
  shortTitle: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  destinations: string[] | null;
  destinationSlugs: string[];
  categorySlugs: string[];
  durationLabel: string;
  durationDays: number | null;
  durationNights: number | null;
  minPax: number | null;
  difficulty: string | null;
  featured: boolean;
  cardSummary: string | null;
  description: string | null;
  summary: string | null;
  itinerary: { day: number; title: string | null; description: string | null }[] | null;
  includes: string[] | null;
  notIncludes: string[] | null;
  recommendations: string[] | null;
  important: string[] | null;
  faqs: { question: string | null; answer: string | null }[] | null;
  policies: string | null;
  /** Siempre null en el seed: el sitio viejo no publica precios. */
  price: null;
  heroImage: string | null;
  images: string[] | null;
}

interface SeedDestination {
  slug: string;
  newPath: string;
  name: string;
  description: string | null;
  bannerImage: string | null;
  cardImage: string | null;
  tourSlugs: string[];
}

interface SeedCategory {
  slug: string;
  newPath: string;
  name: string;
  description: string | null;
  bannerImage: string | null;
  tourSlugs: string[];
}

const seedTours = toursJson as unknown as SeedTour[];
const seedDestinations = destinationsJson as unknown as SeedDestination[];
const seedCategories = categoriesJson as unknown as SeedCategory[];

/**
 * Traducción al inglés del catálogo (`data/seed/en/`, revisión pendiente del cliente: su campo
 * `translationStatus` NO se muestra). Cada registro en inglés apunta a su original por `originalUrl`
 * (…/es/tours/<slug-es>) y `_slug-map.json` da el slug en inglés de cada clave en español (hreflang y
 * selector de idioma). Lo que falte se muestra en español con `fallback: true`.
 */
type SlugMap = Record<"tours" | "destinations" | "categories" | "blog", Record<string, string>>;
export const SEED_SLUG_MAP = slugMapJson as unknown as SlugMap;

function byOriginalKey<T extends { slug: string; originalUrl?: string }>(list: unknown): Map<string, T> {
  return new Map(
    (Array.isArray(list) ? (list as T[]) : [])
      .filter((x) => x && typeof x.slug === "string")
      .map((x) => [x.originalUrl?.split("/").filter(Boolean).pop() ?? x.slug, x]),
  );
}

const enByKey = byOriginalKey<SeedTour>(toursEnJson);
const enDestinations = byOriginalKey<SeedDestination & { originalUrl?: string }>(destinationsEnJson);
const enCategories = byOriginalKey<SeedCategory & { originalUrl?: string }>(categoriesEnJson);

/* ---------- Mapeo a los tipos de dominio de la web ---------- */

/**
 * Limpieza de presentación de textos pegados del CMS viejo (p. ej. "DescripcióVive la historia…":
 * el rótulo "Descripción" quedó fusionado al texto). TODO(E0): corregir en el backoffice.
 */
export function cleanSeedText(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.replace(/^\s*Descripci(?:ó|o)n?\s*:?\s*/u, "").trim();
  return text || null;
}

/** Quita emojis decorativos del texto del CMS viejo (MASTER §9: sin emojis en la UI). */
function stripEmoji(value: string): string {
  const joiners = new RegExp(`[${String.fromCharCode(0xfe0f, 0x200d)}]`, "g");
  return value.replace(/\p{Extended_Pictographic}+\s?/gu, "").replace(joiners, "").trim();
}

function image(src: string | null | undefined, alt: string): CatalogImage | null {
  return src ? { src: catalogImageSource(src), alt } : null;
}

/** Texto del tour en el idioma pedido (o el español como respaldo). */
function localized(t: SeedTour, locale: Locale): { text: SeedTour; fallback: boolean } {
  if (locale === "es") return { text: t, fallback: false };
  if (locale === "pt") return { text: t, fallback: true };
  const en = enByKey.get(t.slug);
  return en ? { text: en, fallback: false } : { text: t, fallback: true };
}

function tourAlternates(key: string): LocalePaths {
  return { es: tourPath("es", key), en: tourPath("en", SEED_SLUG_MAP.tours[key] ?? enByKey.get(key)?.slug ?? key), pt: tourPath("pt", key) };
}

function toSummary(t: SeedTour, locale: Locale): TourSummary {
  const { text, fallback } = localized(t, locale);
  const alternates = tourAlternates(t.slug);
  const shortTitle = text.shortTitle?.trim() || text.title;
  return {
    key: t.slug,
    slug: alternates[locale].split("/").pop()!,
    path: alternates[locale],
    alternates,
    fallback,
    title: text.title,
    shortTitle,
    excerpt: cleanSeedText(text.cardSummary) ?? cleanSeedText(text.metaDescription) ?? "",
    durationLabel: text.durationLabel,
    durationDays: t.durationDays,
    durationNights: t.durationNights,
    durationBucket: durationBucketOf(t.durationDays),
    destinationNames: (locale === "en" && !fallback ? text.destinations : t.destinations) ?? [],
    // Claves estables en español (filtros, reglas de altura, carrito).
    destinationSlugs: t.destinationSlugs,
    categorySlugs: t.categorySlugs,
    minPax: t.minPax ?? 1,
    difficulty: text.difficulty,
    featured: t.featured,
    // TODO(HU-0.3): alt descriptivo por foto cuando se re-alojen las imágenes con metadatos.
    image: image(t.heroImage ?? t.images?.[0], shortTitle),
    pricing: null, // Seed sin precios: "Precio a consultar".
    paymentPolicy: derivePaymentPolicy(t.categorySlugs),
  };
}

function toTour(t: SeedTour, locale: Locale): Tour {
  const summary = toSummary(t, locale);
  const { text } = localized(t, locale);
  const urls = Array.from(new Set([t.heroImage, ...(t.images ?? [])].filter((u): u is string => !!u)));
  return {
    ...summary,
    metaTitle: text.metaTitle ?? summary.shortTitle,
    metaDescription: cleanSeedText(text.metaDescription) ?? summary.excerpt,
    description: cleanSeedText(text.description) ?? "",
    summaryText: cleanSeedText(text.summary),
    itinerary: (text.itinerary ?? [])
      .filter((step) => step.title || step.description)
      .map((step) => ({ day: step.day, title: step.title, description: stripEmoji(step.description ?? "") })),
    includes: text.includes ?? [],
    notIncludes: text.notIncludes ?? [],
    recommendations: text.recommendations ?? [],
    important: text.important ?? [],
    // Algunas FAQ del sitio viejo vienen sin pregunta o sin respuesta: se omiten (TODO(E0): completar).
    faqs: (text.faqs ?? []).flatMap((f) => (f.question && f.answer ? [{ question: f.question, answer: f.answer }] : [])),
    policies: text.policies,
    gallery: urls.map((src) => ({ src: catalogImageSource(src), alt: summary.shortTitle })),
  };
}

function toDestination(d: SeedDestination, locale: Locale): Destination {
  const en = enDestinations.get(d.slug);
  const enSlug = SEED_SLUG_MAP.destinations[d.slug] ?? en?.slug ?? d.slug;
  const alternates = { es: destinationPath("es", d.slug), en: destinationPath("en", enSlug), pt: destinationPath("pt", d.slug) };
  const text = locale === "en" && en ? en : d;
  return {
    key: d.slug,
    slug: locale === "en" ? enSlug : d.slug,
    path: alternates[locale],
    alternates,
    fallback: locale === "pt" || (locale === "en" && !en),
    name: text.name,
    description: text.description,
    bannerImage: image(d.bannerImage, text.name),
    cardImage: image(d.bannerImage ?? d.cardImage, text.name),
    tourSlugs: d.tourSlugs,
    tourCount: d.tourSlugs.length,
  };
}

function toCategory(c: SeedCategory, locale: Locale): Category {
  const en = enCategories.get(c.slug);
  const enSlug = SEED_SLUG_MAP.categories[c.slug] ?? en?.slug ?? c.slug;
  const alternates = { es: categoryPath("es", c.slug), en: categoryPath("en", enSlug), pt: categoryPath("pt", c.slug) };
  const text = locale === "en" && en ? en : c;
  return {
    key: c.slug,
    slug: locale === "en" ? enSlug : c.slug,
    path: alternates[locale],
    alternates,
    fallback: locale === "pt" || (locale === "en" && !en),
    name: text.name,
    description: text.description,
    bannerImage: image(c.bannerImage, text.name),
    tourSlugs: c.tourSlugs,
    tourCount: c.tourSlugs.length,
  };
}

/** Slug de cualquier idioma → clave en español. */
function keyOf(slug: string, keys: readonly string[], map: Record<string, string>): string | null {
  if (keys.includes(slug)) return slug;
  return Object.entries(map).find(([, en]) => en === slug)?.[0] ?? null;
}
const tourKeyOf = (slug: string) =>
  keyOf(slug, seedTours.map((t) => t.slug), SEED_SLUG_MAP.tours) ??
  [...enByKey].find(([, en]) => en.slug === slug)?.[0] ??
  null;
const destinationKeyOf = (slug: string) => keyOf(slug, seedDestinations.map((d) => d.slug), SEED_SLUG_MAP.destinations);
const categoryKeyOf = (slug: string) => keyOf(slug, seedCategories.map((c) => c.slug), SEED_SLUG_MAP.categories);

export const seedCatalogRepository: CatalogRepository = {
  async listTours(locale) {
    return seedTours.map((t) => toSummary(t, locale));
  },
  async getTour(slug, locale) {
    const key = tourKeyOf(slug);
    const t = key ? seedTours.find((x) => x.slug === key) : undefined;
    return t ? toTour(t, locale) : null;
  },
  async listDestinations(locale) {
    return seedDestinations.map((d) => toDestination(d, locale));
  },
  async getDestination(slug, locale) {
    const key = destinationKeyOf(slug);
    const d = seedDestinations.find((x) => x.slug === key);
    return d ? toDestination(d, locale) : null;
  },
  async listCategories(locale) {
    return seedCategories.map((c) => toCategory(c, locale));
  },
  async getCategory(slug, locale) {
    const key = categoryKeyOf(slug);
    const c = seedCategories.find((x) => x.slug === key);
    return c ? toCategory(c, locale) : null;
  },
};

/** Datos del seed que la API aún no expone (imágenes de destinos/categorías, título corto, resumen). */
export const seedEnrichment = {
  tour: (key: string) => seedTours.find((t) => t.slug === key) ?? null,
  tourText: (key: string, locale: Locale) => {
    const t = seedTours.find((x) => x.slug === key);
    return t ? localized(t, locale).text : null;
  },
  destination: (key: string) => seedDestinations.find((d) => d.slug === key) ?? null,
  category: (key: string) => seedCategories.find((c) => c.slug === key) ?? null,
};
