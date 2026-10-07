import type { DepartureSnapshot } from '../../src/modules/catalog/domain/departure.js';
import type { Rate } from '../../src/modules/catalog/domain/pricing.js';
import type { Tour } from '../../src/modules/catalog/domain/tour.js';
import type { CatalogData } from '../../src/persistence/in-memory/in-memory-data-store.js';
import { InMemoryDataStore } from '../../src/persistence/in-memory/in-memory-data-store.js';
import { FixedClock } from '../../src/shared/infrastructure/system.js';
import type { IdGenerator } from '../../src/shared/domain/ports.js';
import { deterministicUuid } from '../../src/modules/catalog/infrastructure/seed/seed-mapper.js';
import { DEFAULT_PAYMENT_PLAN_POLICY } from '../../src/modules/booking/domain/payment-plan.js';
import type { BookingSettings } from '../../src/modules/booking/application/booking.use-cases.js';
import type { CartSettings } from '../../src/modules/cart/application/cart.use-cases.js';

/** 2026-10-07 10:00 en Lima. */
export const NOW = new Date('2026-10-07T15:00:00.000Z');

export const IDS = {
  cusco: deterministicUuid('test', 'destination-cusco'),
  fullDays: deterministicUuid('test', 'category-full-days'),
  valle: deterministicUuid('test', 'tour-valle'),
  machu: deterministicUuid('test', 'tour-machu'),
  titicaca: deterministicUuid('test', 'tour-titicaca'),
  aramu: deterministicUuid('test', 'tour-aramu'),
  draft: deterministicUuid('test', 'tour-draft'),
  depValleNov10: deterministicUuid('test', 'dep-valle-2026-11-10'),
  depValleOct10: deterministicUuid('test', 'dep-valle-2026-10-10'),
  depMachuNov10: deterministicUuid('test', 'dep-machu-2026-11-10'),
  depTiticacaNov12: deterministicUuid('test', 'dep-titicaca-2026-11-12'),
  depAramuNov10: deterministicUuid('test', 'dep-aramu-2026-11-10'),
};

function tour(partial: Partial<Tour> & Pick<Tour, 'id' | 'slug'> & { title: string; summary?: string }): Tour {
  const { title, summary, ...rest } = partial;
  return {
    code: `T-${partial.slug.slice(0, 20).toUpperCase()}`,
    type: 'tour',
    status: 'published',
    categoryId: IDS.fullDays,
    durationDays: 1,
    durationNights: null,
    durationHours: null,
    minPax: 1,
    maxPax: null,
    difficulty: 'easy',
    languages: ['es', 'en'],
    bookingCutoffHours: 24,
    depositPercentOverride: null,
    requiresTravelerDocument: false,
    usesInventory: true,
    isFeatured: false,
    cancellationPolicyCode: null,
    publishedAt: NOW,
    media: [{ url: `https://cdn.example.test/${partial.slug}.jpg`, kind: 'image', altEs: title, altEn: null, isCover: true, sortOrder: 0 }],
    destinations: [{ destinationId: IDS.cusco, isPrimary: true, sortOrder: 0 }],
    translations: [
      {
        locale: 'es',
        slug: partial.slug,
        title,
        summary: summary ?? `Resumen de ${title}`,
        description: null,
        itinerary: [{ day: 1, title: 'Día 1', description: 'Recorrido' }],
        includes: ['Guía'],
        notIncluded: [],
        recommendations: [],
        faqs: [{ question: '¿Incluye almuerzo?', answer: 'Sí' }],
        importantNotes: [],
        policies: null,
        meetingPoint: null,
        seoTitle: null,
        seoDescription: null,
      },
    ],
    ...rest,
  };
}

function rate(tourId: string, paxType: Rate['paxType'], residency: Rate['residency'], currency: Rate['currency'], amount: bigint, extra: Partial<Rate> = {}): Rate {
  return {
    id: deterministicUuid('test-rate', `${tourId}:${paxType}:${residency}:${currency}:${String(extra.seasonPriority ?? 'base')}`),
    tourId,
    paxType,
    residency,
    currency,
    amount,
    validFrom: '2026-01-01',
    validTo: '2027-12-31',
    minGroupSize: 1,
    maxGroupSize: null,
    isActive: true,
    seasonPriority: null,
    ...extra,
  };
}

function departure(id: string, tourId: string, date: string, capacity: number): DepartureSnapshot {
  return { id, tourId, departureDate: date, startTime: '00:00', capacity, booked: 0, held: 0, isClosed: false, version: 0 };
}

export function buildCatalog(): CatalogData {
  return {
    destinations: [{ id: IDS.cusco, slug: 'cuzco', parentId: null, status: 'published', sortOrder: 0, translations: [{ locale: 'es', name: 'Cusco', description: null }] }],
    categories: [{ id: IDS.fullDays, slug: 'full-days', sortOrder: 0, translations: [{ locale: 'es', name: 'Full Days', description: null }] }],
    tours: [
      tour({ id: IDS.valle, slug: 'valle-sagrado-incas', title: 'Valle Sagrado de los Incas', isFeatured: true }),
      tour({ id: IDS.machu, slug: 'full-day-machu-picchu', title: 'Full Day Machu Picchu', summary: 'Ciudadela inca en Cusco', requiresTravelerDocument: true }),
      tour({ id: IDS.titicaca, slug: 'lago-titicaca-2d', title: 'Lago Titicaca 2D/1N', type: 'package', durationDays: 2, durationNights: 1, depositPercentOverride: 100, categoryId: null, destinations: [] }),
      tour({ id: IDS.aramu, slug: 'aramu-muru', title: 'Aramu Muru privado', minPax: 2, maxPax: 6, categoryId: null, destinations: [] }),
      tour({ id: IDS.draft, slug: 'tour-borrador', title: 'Tour en borrador', status: 'draft' }),
    ],
    rates: [
      rate(IDS.valle, 'adult', 'foreign', 'USD', 12_000n),
      rate(IDS.valle, 'child', 'foreign', 'USD', 9_000n),
      rate(IDS.valle, 'adult', 'national', 'PEN', 30_000n),
      rate(IDS.valle, 'adult', 'foreign', 'PEN', 45_000n),
      rate(IDS.machu, 'adult', 'foreign', 'USD', 35_000n),
      rate(IDS.titicaca, 'adult', 'foreign', 'USD', 25_001n),
      rate(IDS.aramu, 'adult', 'foreign', 'USD', 5_000n),
    ],
  };
}

export function buildDepartures(): DepartureSnapshot[] {
  return [
    departure(IDS.depValleNov10, IDS.valle, '2026-11-10', 3),
    departure(IDS.depValleOct10, IDS.valle, '2026-10-10', 10),
    departure(IDS.depMachuNov10, IDS.machu, '2026-11-10', 10),
    departure(IDS.depTiticacaNov12, IDS.titicaca, '2026-11-12', 10),
    departure(IDS.depAramuNov10, IDS.aramu, '2026-11-10', 10),
  ];
}

export function buildStore(): InMemoryDataStore {
  return new InMemoryDataStore(buildCatalog(), buildDepartures());
}

export function sequentialIds(prefix = '00000000-0000-7000-8000'): IdGenerator {
  let n = 0;
  return { next: () => `${prefix}-${(++n).toString(16).padStart(12, '0')}` };
}

export function fixedClock(): FixedClock {
  return new FixedClock(NOW);
}

export const CART_SETTINGS: CartSettings = { ttlMinutes: 7 * 24 * 60, priceLockMinutes: 30 };

export const BOOKING_SETTINGS: BookingSettings = {
  policy: DEFAULT_PAYMENT_PLAN_POLICY,
  holdTtlMinutes: 15,
  termsVersion: 'test-terms',
  cancellationPolicyVersion: 'test-cancellation',
  idempotencyTtlMinutes: 24 * 60,
};

export const WEBHOOK_SECRET = 'test-only-webhook-secret-0123456789';
