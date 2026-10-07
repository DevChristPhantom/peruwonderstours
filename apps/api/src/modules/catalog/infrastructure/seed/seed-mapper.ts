import { createHash } from 'node:crypto';
import { startOfDayInLima } from '../../../../shared/domain/calendar-date.js';
import type { CatalogData } from '../../../../persistence/in-memory/in-memory-data-store.js';
import type { Category, Destination } from '../../domain/taxonomy.js';
import type { Difficulty, Tour, TourMedia } from '../../domain/tour.js';
import type { SeedBlogPost, SeedBundle, SeedRedirectRule, SeedTour } from './seed-files.js';

/** UUID determinista (formato v5 sobre SHA-1) para ids estables entre reinicios del modo demo. */
export function deterministicUuid(namespace: string, name: string): string {
  const hash = createHash('sha1').update(`${namespace}:${name}`).digest();
  hash[6] = (hash[6]! & 0x0f) | 0x50;
  hash[8] = (hash[8]! & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** Código interno estable (UNIQUE, varchar 40) derivado del slug: el sitio viejo no publica códigos. */
export function tourCodeFromSlug(slug: string): string {
  return `PWT-${createHash('sha1').update(slug).digest('hex').slice(0, 8).toUpperCase()}`;
}

const DIFFICULTY_MAP: Record<string, Difficulty> = {
  facil: 'easy',
  medio: 'moderate',
  moderado: 'moderate',
  dificil: 'challenging',
  exigente: 'challenging',
  extremo: 'extreme',
};

export function mapDifficulty(value: string | null | undefined): Difficulty | null {
  if (!value) return null;
  const key = value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  return DIFFICULTY_MAP[key] ?? null;
}

/** Recorta a `max` caracteres en límite de palabra (columnas varchar del schema). */
export function truncate(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * SUPUESTO: los tours de la categoría Machu Picchu llevan boletos nominativos de terceros
 * (ingreso + tren) => requiresTravelerDocument = true (RN-11/RN-14, pendiente del cliente).
 */
const THIRD_PARTY_TICKET_CATEGORIES = new Set(['tours-a-machu-picchu']);

export interface SeedMapOptions {
  /** HU-0.1: la importación deja los tours en borrador. El modo demo los publica. */
  publish: boolean;
  publishedAt: Date;
}

export function mapSeedTour(seed: SeedTour, ids: { destinations: Map<string, string>; categories: Map<string, string> }, options: SeedMapOptions): Tour {
  const days = seed.durationDays && seed.durationDays > 0 ? seed.durationDays : 1;
  const nights = seed.durationNights ?? 0;
  const isPackage = nights > 0;
  const categorySlugs = seed.categorySlugs ?? [];
  const images: TourMedia[] = [];
  const seen = new Set<string>();
  for (const [index, url] of [seed.heroImage, ...(seed.images ?? [])].entries()) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    images.push({ url, kind: 'image', altEs: truncate(seed.title, 250), altEn: null, isCover: index === 0, sortOrder: images.length });
  }
  if (images.length > 0 && !images.some((m) => m.isCover)) images[0]!.isCover = true;

  return {
    id: deterministicUuid('tour', seed.slug),
    slug: seed.slug,
    code: tourCodeFromSlug(seed.slug),
    type: isPackage ? 'package' : 'tour',
    status: options.publish ? 'published' : 'draft',
    categoryId: categorySlugs.map((s) => ids.categories.get(s)).find((id): id is string => Boolean(id)) ?? null,
    durationDays: days,
    // CHECK tours_duration_by_type_ck: paquete => noches entre días-1 y días.
    durationNights: isPackage ? Math.min(Math.max(nights, days - 1), days) : null,
    durationHours: seed.durationHours ?? null,
    minPax: seed.minPax && seed.minPax > 0 ? seed.minPax : 1,
    maxPax: null,
    difficulty: mapDifficulty(seed.difficulty),
    languages: [],
    bookingCutoffHours: 24,
    depositPercentOverride: null,
    requiresTravelerDocument: categorySlugs.some((s) => THIRD_PARTY_TICKET_CATEGORIES.has(s)),
    usesInventory: true,
    isFeatured: Boolean(seed.featured),
    cancellationPolicyCode: null,
    publishedAt: options.publish ? options.publishedAt : null,
    translations: [
      {
        locale: 'es',
        slug: seed.slug,
        title: truncate(seed.title, 200) ?? seed.slug,
        summary: truncate(seed.cardSummary ?? seed.description ?? seed.title, 600) ?? seed.title,
        description: seed.description?.trim() || null,
        itinerary: (seed.itinerary ?? []).map((d) => ({ day: d.day, title: d.title, description: d.description })),
        includes: seed.includes ?? [],
        notIncluded: seed.notIncludes ?? [],
        recommendations: seed.recommendations ?? [],
        faqs: (seed.faqs ?? []).filter((f) => f.question && f.answer),
        importantNotes: seed.important ?? [],
        policies: seed.policies?.trim() || null,
        meetingPoint: null,
        seoTitle: truncate(seed.metaTitle ?? seed.shortTitle ?? seed.title, 70),
        seoDescription: truncate(seed.metaDescription ?? seed.cardSummary, 170),
      },
    ],
    media: images,
    destinations: (seed.destinationSlugs ?? [])
      .map((slug) => ids.destinations.get(slug))
      .filter((id): id is string => Boolean(id))
      .map((destinationId, index) => ({ destinationId, isPrimary: index === 0, sortOrder: index })),
  };
}

export function mapSeedCatalog(bundle: SeedBundle, options: SeedMapOptions): CatalogData {
  const destinations: Destination[] = bundle.destinations.map((d, index) => ({
    id: deterministicUuid('destination', d.slug),
    slug: d.slug,
    parentId: null,
    status: 'published',
    sortOrder: index,
    translations: [{ locale: 'es', name: d.name, description: d.description ?? null }],
  }));
  const categories: Category[] = bundle.categories.map((c, index) => ({
    id: deterministicUuid('category', c.slug),
    slug: c.slug,
    sortOrder: index,
    translations: [{ locale: 'es', name: c.name, description: c.description ?? null }],
  }));
  const ids = {
    destinations: new Map(destinations.map((d) => [d.slug, d.id])),
    categories: new Map(categories.map((c) => [c.slug, c.id])),
  };
  const tours = bundle.tours.map((t) => mapSeedTour(t, ids, options));
  const codes = new Set(tours.map((t) => t.code));
  if (codes.size !== tours.length) throw new Error('Colisión de códigos de tour en la semilla.');
  return { tours, rates: [], destinations, categories };
}

export interface SeedRedirect {
  fromPath: string;
  toPath: string;
  statusCode: number;
}

/** "https://dominio/Es/Tours/x/" -> "/es/tours/x" (CHECK legacy_redirects_from_normalized_ck). */
export function normalizeLegacyPath(url: string): string {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    path = url;
  }
  path = path.toLowerCase().replace(/\/+$/, '');
  return path.startsWith('/') ? path || '/' : `/${path}`;
}

/**
 * Solo se cargan reglas cuyo path cambia: las que conservan el path (dominio viejo ->
 * dominio nuevo) se resuelven con una redirección por host en el borde/DNS y violarían
 * el CHECK legacy_redirects_not_loop_ck.
 */
export function mapSeedRedirects(rules: readonly SeedRedirectRule[]): { redirects: SeedRedirect[]; skippedSamePath: number } {
  const byFrom = new Map<string, SeedRedirect>();
  let skippedSamePath = 0;
  for (const rule of rules) {
    const fromPath = normalizeLegacyPath(rule.from);
    const toPath = rule.to.startsWith('http') ? rule.to : rule.to.replace(/\/+$/, '') || '/';
    if (fromPath === toPath.toLowerCase()) {
      skippedSamePath += 1;
      continue;
    }
    const statusCode = [301, 302, 307, 308].includes(rule.status) ? rule.status : 301;
    byFrom.set(fromPath, { fromPath: fromPath.slice(0, 500), toPath: toPath.slice(0, 500), statusCode });
  }
  return { redirects: [...byFrom.values()], skippedSamePath };
}

export interface SeedBlogPostRow {
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  seoTitle: string | null;
  seoDescription: string | null;
  coverStorageKey: string | null;
  publishedAt: Date | null;
}

export function mapSeedBlogPost(post: SeedBlogPost): SeedBlogPostRow {
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(post.date);
  return {
    slug: post.slug.slice(0, 160),
    title: truncate(post.title, 200) ?? post.slug,
    excerpt: truncate(post.summary, 400),
    body: post.body,
    seoTitle: truncate(post.title, 70),
    seoDescription: truncate(post.summary, 170),
    coverStorageKey: post.image ?? null,
    publishedAt: valid ? startOfDayInLima(post.date) : null,
  };
}
