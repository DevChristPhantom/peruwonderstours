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

export interface SeedBundle {
  tours: SeedTour[];
  destinations: SeedTaxonomy[];
  categories: SeedTaxonomy[];
  redirects: { oldDomain: string; newDomain: string; rules: SeedRedirectRule[] };
  blogPosts: SeedBlogPost[];
}

async function readJson<T>(dir: string, file: string): Promise<T> {
  return JSON.parse(await readFile(join(dir, file), 'utf8')) as T;
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
  return { tours, destinations, categories, redirects, blogPosts };
}
