import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

/** Formato de `data/seed/*.json` (extracción del sitio anterior, ver _extraction-report.md). */
export interface SeedTour {
  slug: string;
  title: string;
  shortTitle?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  destinationSlugs?: string[] | null;
  categorySlugs?: string[] | null;
  durationDays?: number | null;
  durationNights?: number | null;
  durationHours?: number | null;
  minPax?: number | null;
  difficulty?: string | null;
  featured?: boolean | null;
  cardSummary?: string | null;
  description?: string | null;
  summary?: string | null;
  itinerary?: Array<{ day: number; title: string | null; description: string }> | null;
  includes?: string[] | null;
  notIncludes?: string[] | null;
  recommendations?: string[] | null;
  important?: string[] | null;
  faqs?: Array<{ question: string; answer: string }> | null;
  policies?: string | null;
  heroImage?: string | null;
  images?: string[] | null;
}

export interface SeedTaxonomy {
  slug: string;
  name: string;
  description?: string | null;
  tourSlugs?: string[];
}

export interface SeedRedirectRule {
  from: string;
  to: string;
  status: number;
  type: string;
  note?: string | null;
}

export interface SeedBlogPost {
  slug: string;
  title: string;
  date: string;
  summary?: string | null;
  image?: string | null;
  imageAlt?: string | null;
  body: string;
  tags?: string[];
}

/** Campos comunes de la traducción (data/seed/en/*.json): misma forma que `es` + estado. */
export interface SeedTranslationMeta {
  originalUrl?: string | null;
  translationStatus?: string | null;
}

/** Traducciones `en` (opcionales): mismo orden y `originalUrl` que los JSON `es`. */
export interface SeedTranslations {
  tours: Array<SeedTour & SeedTranslationMeta>;
  destinations: Array<SeedTaxonomy & SeedTranslationMeta>;
  categories: Array<SeedTaxonomy & SeedTranslationMeta>;
  blogPosts: Array<SeedBlogPost & SeedTranslationMeta>;
}

/** data/seed/testimonials.json: testimonios ya públicos en el sitio viejo. */
export interface SeedTestimonial {
  id: string;
  authorName: string;
  title?: string | null;
  text: string;
  countryCode?: string | null;
  date?: string | null;
  rating: number;
  source?: string | null;
  sourceUrl?: string | null;
  sourceProfileUrl?: string | null;
  language?: string | null;
}

export interface SeedBundle {
  tours: Array<SeedTour & SeedTranslationMeta>;
  destinations: Array<SeedTaxonomy & SeedTranslationMeta>;
  categories: Array<SeedTaxonomy & SeedTranslationMeta>;
  redirects: { oldDomain: string; newDomain: string; rules: SeedRedirectRule[] };
  blogPosts: Array<SeedBlogPost & SeedTranslationMeta>;
  /** data/seed/en/*.json si existen (Sprint 3). */
  en?: SeedTranslations;
  testimonials?: SeedTestimonial[];
}

async function readJson<T>(dir: string, file: string): Promise<T> {
  return JSON.parse(await readFile(join(dir, file), 'utf8')) as T;
}

async function readOptionalJson<T>(dir: string, file: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(join(dir, file), 'utf8')) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

/** Lee los JSON de semilla. `dir` relativo se resuelve contra el directorio de trabajo. */
export async function readSeedBundle(dir: string): Promise<SeedBundle> {
  const base = resolve(dir);
  const [tours, destinations, categories, redirects, blogPosts] = await Promise.all([
    readJson<SeedTour[]>(base, 'tours.json'),
    readJson<SeedTaxonomy[]>(base, 'destinations.json'),
    readJson<SeedTaxonomy[]>(base, 'categories.json'),
    readJson<SeedBundle['redirects']>(base, 'redirects.json'),
    readJson<SeedBlogPost[]>(base, 'blog-posts.json'),
  ]);
  const [enTours, enDestinations, enCategories, enBlog, testimonialsFile] = await Promise.all([
    readOptionalJson<SeedTranslations['tours']>(base, 'en/tours.json'),
    readOptionalJson<SeedTranslations['destinations']>(base, 'en/destinations.json'),
    readOptionalJson<SeedTranslations['categories']>(base, 'en/categories.json'),
    readOptionalJson<SeedTranslations['blogPosts']>(base, 'en/blog-posts.json'),
    readOptionalJson<{ testimonials?: SeedTestimonial[] }>(base, 'testimonials.json'),
  ]);
  const en = enTours || enDestinations || enCategories || enBlog
    ? { tours: enTours ?? [], destinations: enDestinations ?? [], categories: enCategories ?? [], blogPosts: enBlog ?? [] }
    : undefined;
  return { tours, destinations, categories, redirects, blogPosts, en, testimonials: testimonialsFile?.testimonials ?? [] };
}

/**
 * Empareja cada registro `es` con su traducción: primero por `originalUrl` (URL del sitio viejo,
 * común a ambos idiomas) y, si falta, por posición en el arreglo (mismo orden por contrato).
 */
export function matchTranslations<E extends { originalUrl?: string | null }, T extends { originalUrl?: string | null }>(es: readonly E[], tr: readonly T[]): Map<E, T> {
  const byUrl = new Map(tr.filter((t) => t.originalUrl).map((t) => [t.originalUrl!, t]));
  const result = new Map<E, T>();
  es.forEach((e, index) => {
    const match = (e.originalUrl ? byUrl.get(e.originalUrl) : undefined) ?? (tr[index] && (!tr[index].originalUrl || !e.originalUrl) ? tr[index] : undefined);
    if (match) result.set(e, match);
  });
  return result;
}
