import { createHash } from 'node:crypto';
import { startOfDayInLima } from '../../../../shared/domain/calendar-date.js';
import type { CatalogData } from '../../../../persistence/in-memory/in-memory-data-store.js';
import type { Category, Destination } from '../../domain/taxonomy.js';
import type { Difficulty, Tour, TourMedia } from '../../domain/tour.js';
import type { BlogPost, BlogPostTranslation, Testimonial } from '../../../content/domain/content.js';
import type { TourTranslation } from '../../domain/tour.js';
import { matchTranslations, type SeedBlogPost, type SeedBundle, type SeedRedirectRule, type SeedTestimonial, type SeedTour } from './seed-files.js';

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
    translations: [mapTourTranslation(seed, 'es', null)],
    media: images,
    destinations: (seed.destinationSlugs ?? [])
      .map((slug) => ids.destinations.get(slug))
      .filter((id): id is string => Boolean(id))
      .map((destinationId, index) => ({ destinationId, isPrimary: index === 0, sortOrder: index })),
  };
}

/** Contenido traducible de un tour de la semilla en un idioma (la traducción `en` trae su propio slug). */
export function mapTourTranslation(seed: SeedTour, locale: 'es' | 'en', translationStatus: string | null): TourTranslation {
  return {
    locale,
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
    translationStatus,
  };
}

const slugOk = (slug: string | undefined | null): slug is string => typeof slug === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length <= 160;

export function mapSeedCatalog(bundle: SeedBundle, options: SeedMapOptions): CatalogData {
  const en = bundle.en;
  const enDest = matchTranslations(bundle.destinations, en?.destinations ?? []);
  const enCat = matchTranslations(bundle.categories, en?.categories ?? []);
  const enTour = matchTranslations(bundle.tours, en?.tours ?? []);
  const destinations: Destination[] = bundle.destinations.map((d, index) => {
    const t = enDest.get(d);
    return {
      id: deterministicUuid('destination', d.slug),
      slug: d.slug,
      parentId: null,
      status: 'published',
      sortOrder: index,
      translations: [
        { locale: 'es', name: d.name, description: d.description ?? null, slug: null, translationStatus: null },
        ...(t ? [{ locale: 'en' as const, name: t.name, description: t.description ?? null, slug: slugOk(t.slug) && t.slug !== d.slug ? t.slug : null, translationStatus: t.translationStatus ?? null }] : []),
      ],
    };
  });
  const categories: Category[] = bundle.categories.map((c, index) => {
    const t = enCat.get(c);
    return {
      id: deterministicUuid('category', c.slug),
      slug: c.slug,
      sortOrder: index,
      translations: [
        { locale: 'es', name: c.name, description: c.description ?? null, slug: null, translationStatus: null },
        ...(t ? [{ locale: 'en' as const, name: t.name, description: t.description ?? null, slug: slugOk(t.slug) && t.slug !== c.slug ? t.slug : null, translationStatus: t.translationStatus ?? null }] : []),
      ],
    };
  });
  const ids = {
    destinations: new Map(destinations.map((d) => [d.slug, d.id])),
    categories: new Map(categories.map((c) => [c.slug, c.id])),
  };
  const tours = bundle.tours.map((t) => {
    const tour = mapSeedTour(t, ids, options);
    const tr = enTour.get(t);
    if (tr && slugOk(tr.slug)) {
      tour.translations.push(mapTourTranslation(tr, 'en', tr.translationStatus ?? 'machine_reviewed_pending_client'));
      // Alt en inglés de las fotos (si no venía).
      for (const m of tour.media) m.altEn = m.altEn ?? truncate(tr.title, 250);
    }
    return tour;
  });
  const enSlugs = new Set<string>();
  for (const tour of tours) {
    const s = tour.translations.find((x) => x.locale === 'en')?.slug;
    if (s && enSlugs.has(s)) throw new Error(`Slug en duplicado en la semilla: ${s}`);
    if (s) enSlugs.add(s);
  }
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

/** Blog de la semilla como entidad de dominio (modo seed en memoria): `es` + `en` si existe. */
export function mapSeedBlog(bundle: SeedBundle): BlogPost[] {
  const enBlog = matchTranslations(bundle.blogPosts, bundle.en?.blogPosts ?? []);
  return bundle.blogPosts.map((post) => {
    const es = mapSeedBlogPost(post);
    const tr = enBlog.get(post);
    const translations: BlogPostTranslation[] = [
      { locale: 'es', slug: es.slug, title: es.title, excerpt: es.excerpt, body: es.body, seoTitle: es.seoTitle, seoDescription: es.seoDescription, translationStatus: null },
    ];
    if (tr && slugOk(tr.slug)) {
      const en = mapSeedBlogPost(tr);
      translations.push({ locale: 'en', slug: en.slug, title: en.title, excerpt: en.excerpt, body: en.body, seoTitle: en.seoTitle, seoDescription: en.seoDescription, translationStatus: tr.translationStatus ?? 'machine_reviewed_pending_client' });
    }
    const at = es.publishedAt ?? new Date(0);
    return {
      id: deterministicUuid('blog', es.slug),
      status: es.publishedAt ? 'published' : 'draft',
      coverStorageKey: es.coverStorageKey,
      publishedAt: es.publishedAt,
      tags: normalizeTags(post.tags),
      translations,
      createdAt: at,
      updatedAt: at,
    };
  });
}

export function normalizeTags(tags: readonly string[] | undefined): string[] {
  return [...new Set((tags ?? []).map((t) => t.trim().toLowerCase().slice(0, 60)).filter(Boolean))].slice(0, 20);
}

/**
 * Testimonios heredados del sitio viejo: ya eran públicos, se cargan aprobados con
 * `origin = legacy_site` y su fuente (p. ej. tripadvisor). Nunca se inventan.
 */
export function mapSeedTestimonials(items: readonly SeedTestimonial[], now: Date): Testimonial[] {
  return items
    .filter((t) => t.authorName && t.text && Number.isInteger(t.rating) && t.rating >= 1 && t.rating <= 5)
    .map((t) => ({
      id: deterministicUuid('testimonial', t.id),
      tourId: null,
      authorName: t.authorName.trim().slice(0, 120),
      authorCountry: t.countryCode && /^[A-Za-z]{2}$/.test(t.countryCode) ? t.countryCode.toUpperCase() : null,
      locale: t.language === 'en' ? 'en' : 'es',
      rating: t.rating,
      body: t.text.trim().slice(0, 3000),
      publishConsent: false,
      privacyNoticeVersion: null,
      status: 'approved',
      isFeatured: true,
      travelDate: t.date && /^\d{4}-\d{2}-\d{2}$/.test(t.date) ? t.date : null,
      origin: 'legacy_site',
      source: (t.source ?? 'legacy').trim().toLowerCase().slice(0, 60),
      sourceUrl: (t.sourceUrl ?? t.sourceProfileUrl ?? null)?.replace(/ /g, '%20').slice(0, 500) ?? null,
      createdAt: now,
      approvedAt: now,
    }));
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
