import { readSeedBundle, type SeedBundle } from './seed-files.js';
import { generateDemoPricing } from './demo-pricing.js';
import {
  deterministicUuid,
  mapDifficulty,
  mapSeedBlogPost,
  mapSeedCatalog,
  mapSeedRedirects,
  normalizeLegacyPath,
  truncate,
} from './seed-mapper.js';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
let bundle: SeedBundle;

beforeAll(async () => {
  bundle = await readSeedBundle('../../data/seed');
});

describe('Mapeo de data/seed', () => {
  it('carga los 41 tours, 5 destinos, 5 categorías y 6 posts', () => {
    expect(bundle.tours).toHaveLength(41);
    expect(bundle.destinations).toHaveLength(5);
    expect(bundle.categories).toHaveLength(5);
    expect(bundle.blogPosts).toHaveLength(6);
  });

  it('produce tours que respetan los CHECK y longitudes del schema', () => {
    const catalog = mapSeedCatalog(bundle, { publish: false, publishedAt: new Date() });
    expect(catalog.tours).toHaveLength(41);
    expect(new Set(catalog.tours.map((t) => t.code)).size).toBe(41);
    for (const tour of catalog.tours) {
      expect(tour.status).toBe('draft');
      expect(tour.slug).toMatch(SLUG);
      expect(tour.code.length).toBeLessThanOrEqual(40);
      if (tour.type === 'package') {
        expect(tour.durationNights).toBeGreaterThanOrEqual((tour.durationDays ?? 1) - 1);
        expect(tour.durationNights).toBeLessThanOrEqual(tour.durationDays ?? 1);
      } else {
        expect(tour.durationDays).toBeGreaterThanOrEqual(1);
      }
      const es = tour.translations[0]!;
      expect(es.title.length).toBeLessThanOrEqual(200);
      expect(es.summary.length).toBeLessThanOrEqual(600);
      expect((es.seoTitle ?? '').length).toBeLessThanOrEqual(70);
      expect((es.seoDescription ?? '').length).toBeLessThanOrEqual(170);
      expect(tour.media.filter((m) => m.isCover).length).toBeLessThanOrEqual(1);
      expect(tour.destinations.filter((d) => d.isPrimary).length).toBeLessThanOrEqual(1);
    }
    const withFaqs = catalog.tours.filter((t) => t.translations[0]!.faqs.length > 0);
    expect(withFaqs.length).toBeGreaterThan(0);
    expect(catalog.tours.filter((t) => t.requiresTravelerDocument).length).toBeGreaterThan(0);
  });

  it('ids deterministas y estables', () => {
    expect(deterministicUuid('tour', 'x')).toBe(deterministicUuid('tour', 'x'));
    expect(deterministicUuid('tour', 'x')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('redirecciones: normaliza y omite las que conservan el path (se resuelven por host)', () => {
    const { redirects, skippedSamePath } = mapSeedRedirects(bundle.redirects.rules);
    expect(redirects.length + skippedSamePath).toBeLessThanOrEqual(bundle.redirects.rules.length);
    for (const r of redirects) {
      expect(r.fromPath).toBe(r.fromPath.toLowerCase());
      expect(r.fromPath.startsWith('/')).toBe(true);
      expect(r.fromPath).not.toBe(r.toPath);
    }
    expect(normalizeLegacyPath('https://www.andeanperutours.com/Es/Tours/X/')).toBe('/es/tours/x');
  });

  it('blog: fechas en Lima y textos recortados', () => {
    const row = mapSeedBlogPost(bundle.blogPosts[0]!);
    expect(row.publishedAt?.toISOString().endsWith('T05:00:00.000Z')).toBe(true);
    expect((row.seoDescription ?? '').length).toBeLessThanOrEqual(170);
  });

  it('utilidades', () => {
    expect(mapDifficulty('Fácil')).toBe('easy');
    expect(mapDifficulty('Medio')).toBe('moderate');
    expect(mapDifficulty('??')).toBeNull();
    expect(truncate('uno dos tres cuatro', 10)).toBe('uno dos…');
    expect(truncate(null, 10)).toBeNull();
  });

  it('precios demo: ficticios, deterministas y solo para memoria', () => {
    const catalog = mapSeedCatalog(bundle, { publish: true, publishedAt: new Date() });
    const demo = generateDemoPricing(catalog.tours.slice(0, 2), { today: '2026-10-07', departureDays: 3, capacity: 12 });
    expect(demo.departures).toHaveLength(6);
    expect(demo.rates).toHaveLength(2 * 2 * 2 * 4);
    expect(demo.rates.every((r) => r.amount > 0n)).toBe(true);
  });
});
