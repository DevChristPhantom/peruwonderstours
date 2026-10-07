import "server-only";

import toursJson from "@seed/tours.json";
import destinationsJson from "@seed/destinations.json";
import categoriesJson from "@seed/categories.json";

import type { CatalogRepository } from "./repository";
import { derivePaymentPolicy, durationBucketOf } from "./rules";
import type { CatalogImage, Category, Destination, Tour, TourSummary } from "./types";

/* ---------- Forma de los JSON extraídos (data/seed/_extraction-report.md) ---------- */

interface SeedTour {
  slug: string;
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
  return src ? { src, alt } : null;
}

function toSummary(t: SeedTour): TourSummary {
  const shortTitle = t.shortTitle?.trim() || t.title;
  return {
    slug: t.slug,
    path: t.newPath,
    title: t.title,
    shortTitle,
    excerpt: cleanSeedText(t.cardSummary) ?? cleanSeedText(t.metaDescription) ?? "",
    durationLabel: t.durationLabel,
    durationDays: t.durationDays,
    durationNights: t.durationNights,
    durationBucket: durationBucketOf(t.durationDays),
    destinationNames: t.destinations ?? [],
    destinationSlugs: t.destinationSlugs,
    categorySlugs: t.categorySlugs,
    minPax: t.minPax ?? 1,
    difficulty: t.difficulty,
    featured: t.featured,
    // TODO(HU-0.3): alt descriptivo por foto cuando se re-alojen las imágenes con metadatos.
    image: image(t.heroImage ?? t.images?.[0], shortTitle),
    pricing: null, // Seed sin precios: "Precio a consultar".
    paymentPolicy: derivePaymentPolicy(t.categorySlugs),
  };
}

function toTour(t: SeedTour): Tour {
  const summary = toSummary(t);
  const urls = Array.from(new Set([t.heroImage, ...(t.images ?? [])].filter((u): u is string => !!u)));
  return {
    ...summary,
    metaTitle: t.metaTitle ?? summary.shortTitle,
    metaDescription: cleanSeedText(t.metaDescription) ?? summary.excerpt,
    description: cleanSeedText(t.description) ?? "",
    summaryText: cleanSeedText(t.summary),
    itinerary: (t.itinerary ?? [])
      .filter((step) => step.title || step.description)
      .map((step) => ({ day: step.day, title: step.title, description: stripEmoji(step.description ?? "") })),
    includes: t.includes ?? [],
    notIncludes: t.notIncludes ?? [],
    recommendations: t.recommendations ?? [],
    important: t.important ?? [],
    // Algunas FAQ del sitio viejo vienen sin pregunta o sin respuesta: se omiten (TODO(E0): completar).
    faqs: (t.faqs ?? []).flatMap((f) => (f.question && f.answer ? [{ question: f.question, answer: f.answer }] : [])),
    policies: t.policies,
    gallery: urls.map((src, i) => ({
      src,
      alt: `${summary.shortTitle}, foto ${i + 1} de ${urls.length}`,
    })),
  };
}

function toDestination(d: SeedDestination): Destination {
  const alt = `Paisaje de ${d.name}`;
  return {
    slug: d.slug,
    path: d.newPath,
    name: d.name,
    description: d.description,
    bannerImage: image(d.bannerImage, alt),
    cardImage: image(d.bannerImage ?? d.cardImage, alt),
    tourSlugs: d.tourSlugs,
    tourCount: d.tourSlugs.length,
  };
}

function toCategory(c: SeedCategory): Category {
  return {
    slug: c.slug,
    path: c.newPath,
    name: c.name,
    description: c.description,
    bannerImage: image(c.bannerImage, `Imagen de la categoría ${c.name}`),
    tourSlugs: c.tourSlugs,
    tourCount: c.tourSlugs.length,
  };
}

const summaries = seedTours.map(toSummary);
const toursBySlug = new Map(seedTours.map((t) => [t.slug, t]));
const destinations = seedDestinations.map(toDestination);
const categories = seedCategories.map(toCategory);

export const seedCatalogRepository: CatalogRepository = {
  async listTours() {
    return summaries;
  },
  async getTour(slug) {
    const t = toursBySlug.get(slug);
    return t ? toTour(t) : null;
  },
  async listDestinations() {
    return destinations;
  },
  async getDestination(slug) {
    return destinations.find((d) => d.slug === slug) ?? null;
  },
  async listCategories() {
    return categories;
  },
  async getCategory(slug) {
    return categories.find((c) => c.slug === slug) ?? null;
  },
};
