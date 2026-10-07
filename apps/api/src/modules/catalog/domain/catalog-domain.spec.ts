import { buildCatalog, IDS } from '../../../../test/support/fixtures.js';
import { Departure, SoldOutError } from './departure.js';
import { priceFrom, quoteTour, selectRate, type Rate } from './pricing.js';
import { normalizeText, relevanceScore, trigramSimilarity } from './text-search.js';
import { serviceEndDate, type Tour } from './tour.js';

const catalog = buildCatalog();
const tourById = (id: string) => catalog.tours.find((t) => t.id === id)!;
const ratesOf = (id: string) => catalog.rates.filter((r) => r.tourId === id);

describe('Cotización', () => {
  it('calcula líneas y subtotal en céntimos', () => {
    const q = quoteTour({
      tour: tourById(IDS.valle),
      rates: ratesOf(IDS.valle),
      travelDate: '2026-11-10',
      currency: 'USD',
      lines: [
        { paxType: 'adult', residency: 'foreign', quantity: 2 },
        { paxType: 'child', residency: 'foreign', quantity: 1 },
      ],
    });
    expect(q.subtotal.amount).toBe(33_000n); // 2 x 120 + 90 (HU-2.2)
    expect(q.paxCount).toBe(3);
    expect(q.lines[1]?.lineAmount.amount).toBe(9_000n);
  });

  it('menor sin adulto, debajo del mínimo, sobre el máximo y líneas duplicadas', () => {
    const base = { rates: ratesOf(IDS.aramu), travelDate: '2026-11-10', currency: 'USD' as const };
    expect(() => quoteTour({ ...base, tour: tourById(IDS.aramu), lines: [{ paxType: 'child', residency: 'foreign', quantity: 2 }] })).toThrow(/al menos un adulto/);
    expect(() => quoteTour({ ...base, tour: tourById(IDS.aramu), lines: [{ paxType: 'adult', residency: 'foreign', quantity: 1 }] })).toThrow(/mínimo de 2/);
    expect(() => quoteTour({ ...base, tour: tourById(IDS.aramu), lines: [{ paxType: 'adult', residency: 'foreign', quantity: 7 }] })).toThrow(/máximo 6/);
    expect(() =>
      quoteTour({
        ...base,
        tour: tourById(IDS.aramu),
        lines: [
          { paxType: 'adult', residency: 'foreign', quantity: 1 },
          { paxType: 'adult', residency: 'foreign', quantity: 1 },
        ],
      }),
    ).toThrow(/una sola vez/);
    expect(() => quoteTour({ ...base, tour: tourById(IDS.aramu), lines: [] })).toThrow(/al menos un pasajero/);
    expect(() => quoteTour({ ...base, tour: tourById(IDS.aramu), lines: [{ paxType: 'adult', residency: 'foreign', quantity: 2.5 }] })).toThrow(/entero/);
  });

  it('sin tarifa para moneda/residencia/fecha => rate-not-available', () => {
    expect(() =>
      quoteTour({ tour: tourById(IDS.machu), rates: ratesOf(IDS.machu), travelDate: '2026-11-10', currency: 'PEN', lines: [{ paxType: 'adult', residency: 'foreign', quantity: 1 }] }),
    ).toThrow(/No hay tarifa vigente/);
    expect(() =>
      quoteTour({ tour: tourById(IDS.machu), rates: ratesOf(IDS.machu), travelDate: '2028-01-10', currency: 'USD', lines: [{ paxType: 'adult', residency: 'foreign', quantity: 1 }] }),
    ).toThrow(/No hay tarifa vigente/);
  });

  it('la tarifa de temporada con mayor prioridad gana sobre la base', () => {
    const base = ratesOf(IDS.valle).find((r) => r.paxType === 'adult' && r.currency === 'USD')!;
    const high: Rate = { ...base, id: 'season', amount: 15_000n, seasonPriority: 10, validFrom: '2026-12-20', validTo: '2027-01-05' };
    const line = { paxType: 'adult' as const, residency: 'foreign' as const, quantity: 1 };
    expect(selectRate([base, high], line, 'USD', '2026-12-25', 1)?.id).toBe('season');
    expect(selectRate([base, high], line, 'USD', '2026-11-10', 1)?.id).toBe(base.id);
    const grouped: Rate = { ...base, id: 'group', minGroupSize: 5, amount: 10_000n, seasonPriority: 1 };
    expect(selectRate([base, grouped], line, 'USD', '2026-11-10', 2)?.id).toBe(base.id);
  });

  it('precio desde: menor tarifa de adulto vigente; null si no hay', () => {
    expect(priceFrom(ratesOf(IDS.valle), 'USD', '2026-10-07')?.amount).toBe(12_000n);
    expect(priceFrom(ratesOf(IDS.valle), 'PEN', '2026-10-07')?.amount).toBe(30_000n);
    expect(priceFrom(ratesOf(IDS.machu), 'PEN', '2026-10-07')).toBeNull();
    expect(priceFrom(ratesOf(IDS.valle), 'USD', '2028-01-01')).toBeNull();
  });

  it('fecha de fin del servicio según duración', () => {
    expect(serviceEndDate(tourById(IDS.titicaca), '2026-11-12')).toBe('2026-11-13');
    expect(serviceEndDate({ ...tourById(IDS.valle), durationDays: null } as Tour, '2026-11-12')).toBe('2026-11-12');
  });
});

describe('Departure (cupo con bloqueo optimista)', () => {
  const snapshot = { id: 'd1', tourId: 't1', departureDate: '2026-11-10', startTime: '00:00', capacity: 3, booked: 0, held: 0, isClosed: false, version: 4 };

  it('retiene, confirma y libera cupo incrementando la versión', () => {
    const d = Departure.restore(snapshot);
    d.hold(2);
    expect(d.available).toBe(1);
    d.confirmHold(2);
    expect(d.toSnapshot()).toMatchObject({ held: 0, booked: 2, version: 6 });
    expect(d.persistedVersion).toBe(4);
    d.releaseBooked(1);
    expect(d.available).toBe(2);
  });

  it('nunca sobrevende: el último cupo lo obtiene uno solo', () => {
    const d = Departure.restore(snapshot);
    d.hold(3);
    expect(() => d.hold(1)).toThrow(SoldOutError);
  });

  it('salida cerrada no vende; no libera más de lo retenido', () => {
    expect(() => Departure.restore({ ...snapshot, isClosed: true }).hold(1)).toThrow(SoldOutError);
    expect(() => Departure.restore(snapshot).releaseHold(1)).toThrow(/retenidos/);
    expect(() => Departure.restore(snapshot).confirmHold(1)).toThrow(/retenidos/);
    expect(() => Departure.restore(snapshot).releaseBooked(1)).toThrow(/vendidos/);
    expect(() => Departure.restore(snapshot).hold(0)).toThrow(/entero positivo/);
  });
});

describe('Búsqueda tolerante', () => {
  it('normaliza tildes y mayúsculas', () => {
    expect(normalizeText('Cañón del COLCA, Perú')).toBe('cañon del colca peru'.normalize('NFD').replace(/[̀-ͯ]/g, ''));
  });

  it.each([
    ['cuzco machupichu', 'Full Day Machu Picchu en Cusco'],
    ['machu picchu', 'Full Day Machú Picchu'],
    ['titikaka', 'Lago Titicaca 2D/1N'],
    ['valle sagrao', 'Valle Sagrado de los Incas'],
    ['vall', 'Valle Sagrado de los Incas'],
  ])('"%s" encuentra "%s"', (query, doc) => {
    expect(relevanceScore(query, doc)).toBeGreaterThan(0);
  });

  it('no encuentra términos ajenos', () => {
    expect(relevanceScore('nazca', 'Valle Sagrado de los Incas')).toBe(0);
    expect(trigramSimilarity('abc', 'xyz')).toBe(0);
  });
});
