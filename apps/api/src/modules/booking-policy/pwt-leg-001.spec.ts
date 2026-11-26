import { Money } from '../../shared/domain/money.js';
import { evaluatePaymentOptions, type PaymentPlanItem, type PaymentPlanPolicy } from '../booking/domain/payment-plan.js';
import {
  quoteCalendarCancellation,
  usesCalendarCancellationPolicy,
  validateCalendarCancellationDecision,
} from '../backoffice/domain/cancellation-policy.js';
import { BookingPolicyService, validatePolicyTranslations } from './booking-policy.service.js';
import { BOOKING_POLICY_SEED } from './booking-policy.seed.js';

/** PWT-LEG-001 (25-11-2026): 50 % de adelanto, saldo 15 días calendario antes, topes de retención. */
const POLICY: PaymentPlanPolicy = { calendarDays: true, defaultDepositPercent: 50, balanceDueDaysBeforeService: 15, fullPaymentWithinDays: 15, thirdPartyTicketsRequireFull: true };
const item = (travelDate: string): PaymentPlanItem => ({ subtotal: Money.of(100_000n, 'USD'), travelDate, depositPercentOverride: null, includesThirdPartyTickets: false });
const at = (iso: string) => new Date(iso);

describe('PWT-LEG-001 · plan de pago', () => {
  it('con 15 días calendario se ofrece el adelanto y el saldo vence al final de ese día (Lima)', () => {
    const o = evaluatePaymentOptions({ items: [item('2026-12-16')], now: at('2026-12-01T23:30:00.000Z'), policy: POLICY }); // 18:30 Lima del 01-12
    expect(o.deposit?.depositPercent).toBe(50);
    expect(o.deposit?.balanceDueAt?.toISOString()).toBe('2026-12-02T04:59:59.999Z'); // 01-12 23:59:59.999 Lima
  });

  it('con menos de 15 días calendario solo se ofrece el 100 %', () => {
    const o = evaluatePaymentOptions({ items: [item('2026-12-15')], now: at('2026-12-01T05:00:00.000Z'), policy: POLICY });
    expect(o.deposit).toBeNull();
    expect(o.depositUnavailableReason).toBe('departure_too_close');
  });
});

describe('PWT-LEG-001 · cancelación (topes, no cargos automáticos)', () => {
  const base = { totalAmount: 100_000n, paidAmount: 50_000n, refundedAmount: 0n, firstServiceDate: '2027-01-31' };
  it.each([
    ['2026-12-31', 31, 10, 10_000n],
    ['2027-01-01', 30, 25, 25_000n],
    ['2027-01-15', 16, 25, 25_000n],
    ['2027-01-16', 15, 50, 50_000n],
    ['2027-01-23', 8, 50, 50_000n],
    ['2027-01-24', 7, 75, 50_000n],
    ['2027-01-28', 3, 75, 50_000n],
    ['2027-01-29', 2, 100, 50_000n],
  ])('recibida el %s (%i días): tope %i %% del total, limitado a lo abonado', (receivedDate, days, pct, maxRetained) => {
    const q = quoteCalendarCancellation({ ...base, receivedDate });
    expect(q.calendarDaysBefore).toBe(days);
    expect(q.tier.maxRetentionPercent).toBe(pct);
    expect(q.maxRetainedAmount).toBe(maxRetained);
    expect(q.minimumRefundAmount).toBe(50_000n - maxRetained);
  });

  it('exige monto y justificación; acepta devolución íntegra y rechaza retener más que el tope', () => {
    const p = { ...base, receivedDate: '2026-12-31' };
    expect(() => validateCalendarCancellationDecision(p)).toThrow();
    expect(() => validateCalendarCancellationDecision({ ...p, refundAmount: 30_000n, justification: 'Costos de tren' })).toThrow(); // retiene 20k > 10k
    expect(validateCalendarCancellationDecision({ ...p, refundAmount: 50_000n, justification: 'Sin costos incurridos' }).retainedAmount).toBe(0n);
    expect(validateCalendarCancellationDecision({ ...p, refundAmount: 40_000n, justification: 'Entrada MP emitida' }).retainedAmount).toBe(10_000n);
  });

  it('solo las reservas que aceptaron la versión 2.0 usan esta regla (las antiguas conservan la suya)', () => {
    expect(usesCalendarCancellationPolicy('2.0-2026-11-25')).toBe(true);
    expect(usesCalendarCancellationPolicy('2.0-2026-11-25-r3')).toBe(true);
    expect(usesCalendarCancellationPolicy('1.0-2026-11-20')).toBe(false);
  });
});

describe('PWT-LEG-001 · políticas editables', () => {
  it('sin base de datos sirve la revisión r0 con el texto aprobado', async () => {
    const service = new BookingPolicyService({ available: false } as never);
    const es = await service.current('es');
    expect(es.version).toBe('2.0-2026-11-25-r0');
    expect(es.body).toContain('15 días calendario');
    expect((await service.current('en')).title).toBe('Booking, Payment and Cancellation Policy');
  });

  it('valida los tres idiomas y rechaza HTML', () => {
    expect(validatePolicyTranslations(BOOKING_POLICY_SEED).pt.title).toContain('cancelamento');
    expect(() => validatePolicyTranslations({ ...BOOKING_POLICY_SEED, en: { title: 'x', body: 'y' } })).toThrow();
    expect(() => validatePolicyTranslations({ ...BOOKING_POLICY_SEED, es: { title: 'Título', body: `${'a'.repeat(120)}<script>alert(1)</script>` } })).toThrow();
  });
});
