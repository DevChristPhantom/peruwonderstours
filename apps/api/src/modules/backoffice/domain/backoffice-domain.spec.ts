import { DomainError } from '../../../shared/domain/domain-error.js';
import { PERU_NATIONAL_HOLIDAYS } from '../../complaints/infrastructure/peru-national-holidays.js';
import {
  assertCapacityChange,
  assertRateShape,
  checkPublication,
  complaintTrafficLight,
  describeRate,
  dsrDueAt,
  dsrExtendedDueAt,
  generateDepartureDates,
  isLateTranscription,
  isoWeekday,
  ratesOverlap,
  resumedResponseDue,
  settlementExpiry,
  type RateRange,
} from './backoffice-rules.js';
import { parseRefundTiers, parseRefundTiersJson, quoteCancellationRefund } from './cancellation-policy.js';

const HOLIDAYS = new Set(PERU_NATIONAL_HOLIDAYS);
const lima = (local: string) => new Date(`${local}-05:00`);

function code(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    return (e as DomainError).code;
  }
  return 'no-error';
}

describe('Salidas en lote', () => {
  it('genera solo los días de semana pedidos dentro del rango', () => {
    expect(isoWeekday('2026-11-02')).toBe(1); // lunes
    expect(generateDepartureDates({ from: '2026-11-01', to: '2026-11-15', weekdays: [1, 3, 5] })).toEqual([
      '2026-11-02', '2026-11-04', '2026-11-06', '2026-11-09', '2026-11-11', '2026-11-13',
    ]);
    expect(generateDepartureDates({ from: '2026-11-01', to: '2026-11-01', weekdays: [7] })).toEqual(['2026-11-01']);
  });

  it('valida rango, días y límite de 366 días', () => {
    expect(code(() => generateDepartureDates({ from: '2026-11-10', to: '2026-11-01', weekdays: [1] }))).toBe('invalid-date-range');
    expect(code(() => generateDepartureDates({ from: '2026-11-01', to: '2026-11-10', weekdays: [] }))).toBe('invalid-weekdays');
    expect(code(() => generateDepartureDates({ from: '2026-11-01', to: '2026-11-10', weekdays: [8] }))).toBe('invalid-weekdays');
    expect(code(() => generateDepartureDates({ from: '2026-01-01', to: '2027-01-03', weekdays: [1] }))).toBe('date-range-too-long');
  });

  it('no permite bajar la capacidad por debajo de lo vendido (HU-7.4)', () => {
    let message = '';
    try {
      assertCapacityChange(8, 10, 0);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain('Hay 10 cupos vendidos');
    expect(code(() => assertCapacityChange(11, 10, 2))).toBe('capacity-below-sold');
    expect(code(() => assertCapacityChange(12, 10, 2))).toBe('no-error');
  });
});

describe('Publicación de tours', () => {
  it('bloquea sin portada ni itinerario y lista los campos faltantes', () => {
    const check = checkPublication({ translations: [{ locale: 'es', title: 'Tour', summary: 'Resumen', itinerary: [] }], media: [], activeRateCount: 0 });
    expect(check.errors.map((e) => e.field)).toEqual(['translations.es.itinerary', 'media']);
    expect(check.warnings.length).toBe(2);
    const ok = checkPublication({
      translations: [{ locale: 'es', title: 'Tour', summary: 'Resumen', itinerary: [{ day: 1 }] }],
      media: [{ isCover: true, kind: 'image' }],
      activeRateCount: 2,
    });
    expect(ok.errors).toEqual([]);
  });

  it('exige la traducción canónica en español', () => {
    expect(checkPublication({ translations: [], media: [{ isCover: true, kind: 'image' }], activeRateCount: 1 }).errors[0]!.field).toBe('translations.es');
  });
});

describe('Tarifas', () => {
  const base: RateRange = {
    tourId: 't', seasonId: null, paxType: 'adult', residency: 'foreign', currency: 'USD',
    validFrom: '2027-01-01', validTo: '2027-06-30', minGroupSize: 1, maxGroupSize: null, isActive: true,
  };

  it('detecta solapes de vigencia y de rango de grupo de la misma combinación', () => {
    expect(ratesOverlap(base, { ...base, validFrom: '2027-06-30', validTo: '2027-12-31' })).toBe(true);
    expect(ratesOverlap(base, { ...base, validFrom: '2027-07-01', validTo: '2027-12-31' })).toBe(false);
    expect(ratesOverlap({ ...base, maxGroupSize: 4 }, { ...base, minGroupSize: 5 })).toBe(false);
    expect(ratesOverlap(base, { ...base, residency: 'national' })).toBe(false);
    expect(ratesOverlap(base, { ...base, seasonId: 's1' })).toBe(false);
    expect(ratesOverlap(base, { ...base, isActive: false })).toBe(false);
    expect(describeRate(base)).toBe('adulto / extranjero / USD, 2027-01-01 a 2027-06-30, 1+ pax');
  });

  it('valida forma (vigencia, grupo, monto)', () => {
    expect(code(() => assertRateShape({ ...base, validTo: '2026-12-31', amount: 100n }))).toBe('validation-failed');
    expect(code(() => assertRateShape({ ...base, maxGroupSize: 0, amount: 100n }))).toBe('validation-failed');
    expect(code(() => assertRateShape({ ...base, amount: 100n }))).toBe('no-error');
  });
});

describe('Libro de Reclamaciones: semáforo y solución directa', () => {
  // Registro: lun 2026-10-05 10:00 Lima. 15 días hábiles (8-oct feriado) => vence mar 2026-10-27 23:59:59.999 Lima.
  const submitted = lima('2026-10-05T10:00:00');
  const dueAt = new Date('2026-10-28T04:59:59.999Z');
  const light = (nowLocal: string, extra: Partial<Parameters<typeof complaintTrafficLight>[0]> = {}) =>
    complaintTrafficLight({
      status: 'received', responseSentAt: null, responseDueAt: dueAt, settlementOfferedAt: null, settlementExpiresAt: null,
      settlementResolved: false, now: lima(nowLocal), holidays: HOLIDAYS, ...extra,
    });

  it('verde < 10, amarillo desde el día hábil 10, rojo desde el 13, vencido después del 15', () => {
    expect(submitted.getTime()).toBeLessThan(dueAt.getTime());
    expect(light('2026-10-05T12:00:00')).toMatchObject({ light: 'green', businessDaysElapsed: 0 });
    expect(light('2026-10-16T09:00:00').light).toBe('green'); // 8 hábiles transcurridos
    expect(light('2026-10-20T09:00:00')).toMatchObject({ light: 'yellow', businessDaysElapsed: 10 });
    expect(light('2026-10-23T09:00:00')).toMatchObject({ light: 'red', businessDaysElapsed: 13 });
    expect(light('2026-10-27T23:00:00')).toMatchObject({ light: 'red', businessDaysRemaining: 0 });
    expect(light('2026-10-28T00:00:01')).toMatchObject({ light: 'overdue' });
    expect(light('2026-10-28T00:00:01', { status: 'answered' }).light).toBe('done');
  });

  it('oferta de solución directa: suspendido hasta 5 días hábiles; al rechazar se corre el vencimiento', () => {
    const offeredAt = lima('2026-10-14T10:00:00'); // miércoles
    const expires = settlementExpiry(offeredAt, HOLIDAYS);
    expect(expires.toISOString()).toBe('2026-10-22T04:59:59.999Z'); // fin del mié 21-oct (5 hábiles)
    expect(light('2026-10-20T09:00:00', { settlementOfferedAt: offeredAt, settlementExpiresAt: expires }).light).toBe('suspended');
    // Rechazo al 2.º día hábil: el vencimiento se corre 2 días hábiles.
    const resumed = resumedResponseDue({ originalDueAt: dueAt, offeredAt, resolvedAt: lima('2026-10-16T09:00:00'), holidays: HOLIDAYS });
    expect(resumed.toISOString()).toBe('2026-10-30T04:59:59.999Z'); // 28 y 29-oct
    // Silencio: suspensión máxima de 5 días hábiles.
    const silent = resumedResponseDue({ originalDueAt: dueAt, offeredAt, resolvedAt: lima('2026-11-30T09:00:00'), holidays: HOLIDAYS });
    expect(silent.toISOString()).toBe('2026-11-04T04:59:59.999Z'); // 28, 29, 30-oct, 2 y 3-nov (1-nov domingo y feriado)
  });

  it('transcripción del libro de respaldo tardía si pasa más de 1 día calendario', () => {
    expect(isLateTranscription(lima('2026-10-05T10:00:00'), lima('2026-10-06T09:00:00'))).toBe(false);
    expect(isLateTranscription(lima('2026-10-05T10:00:00'), lima('2026-10-06T10:30:00'))).toBe(true);
  });
});

describe('Solicitudes ARCO', () => {
  it('plazos por tipo y ampliación única', () => {
    const received = lima('2026-10-05T10:00:00');
    expect(dsrDueAt('information', received, HOLIDAYS).toISOString()).toBe('2026-10-17T04:59:59.999Z'); // 8 hábiles: vie 16-oct
    expect(dsrDueAt('rectification', received, HOLIDAYS).toISOString()).toBe('2026-10-21T04:59:59.999Z'); // 10 hábiles: mar 20-oct
    const access = dsrDueAt('access', received, HOLIDAYS);
    expect(access.toISOString()).toBe('2026-11-04T04:59:59.999Z'); // 20 hábiles: mar 3-nov
    expect(dsrExtendedDueAt('access', access, HOLIDAYS).getTime()).toBeGreaterThan(access.getTime());
    expect(code(() => dsrExtendedDueAt('information', access, HOLIDAYS))).toBe('dsr-not-extendable');
  });
});

describe('Política de cancelación configurable', () => {
  const tiers = parseRefundTiers([
    { minBusinessDaysBefore: 0, refundPercent: 0 },
    { minBusinessDaysBefore: 20, refundPercent: 100 },
    { minBusinessDaysBefore: 8, refundPercent: 50 },
  ]);

  it('ordena y valida los tramos', () => {
    expect(tiers.map((t) => t.minBusinessDaysBefore)).toEqual([20, 8, 0]);
    expect(() => parseRefundTiersJson('no json')).toThrow(/JSON/);
    expect(() => parseRefundTiers([{ minBusinessDaysBefore: 5, refundPercent: 50 }])).toThrow(/= 0/);
    expect(() => parseRefundTiers([{ minBusinessDaysBefore: 0, refundPercent: 150 }])).toThrow(/0-100/);
    expect(() => parseRefundTiers([{ minBusinessDaysBefore: 0, refundPercent: 10 }, { minBusinessDaysBefore: 0, refundPercent: 20 }])).toThrow(/mismo/);
  });

  it('reembolsa según días hábiles antes del servicio, redondeando hacia abajo y descontando lo ya reembolsado', () => {
    const q = (today: string, service: string, paid = 100_001n, refunded = 0n) =>
      quoteCancellationRefund({ paidAmount: paid, refundedAmount: refunded, today, firstServiceDate: service, holidays: HOLIDAYS, tiers });
    expect(q('2026-10-01', '2026-11-30')).toMatchObject({ refundAmount: 100_001n, tier: { refundPercent: 100 } });
    expect(q('2026-11-10', '2026-11-30')).toMatchObject({ businessDaysBefore: 13, refundAmount: 50_000n, retainedAmount: 50_001n });
    expect(q('2026-11-25', '2026-11-30')).toMatchObject({ refundAmount: 0n, tier: { refundPercent: 0 } });
    expect(q('2026-12-05', '2026-11-30')).toMatchObject({ businessDaysBefore: 0, refundAmount: 0n });
    expect(q('2026-11-10', '2026-11-30', 100_000n, 30_000n).refundAmount).toBe(20_000n);
    expect(q('2026-11-10', '2026-11-30', 100_000n, 60_000n).refundAmount).toBe(0n);
  });
});
