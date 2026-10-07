import { readFileSync } from 'node:fs';
import { Money } from '../../../shared/domain/money.js';
import { Booking } from './booking.js';
import {
  assertBookingTransition,
  BOOKING_STATUS_TRANSITIONS,
  BOOKING_STATUSES,
  canTransitionBooking,
  InvalidBookingTransitionError,
  isTerminalBookingStatus,
} from './booking-status.js';
import { calculatePaymentPlan, DEFAULT_PAYMENT_PLAN_POLICY, type PaymentOption } from './payment-plan.js';

const NOW = new Date('2026-10-07T15:00:00.000Z');

function sqlTransitions(): Set<string> {
  const sql = readFileSync(new URL('../../../../prisma/sql/constraints.sql', import.meta.url), 'utf8');
  const fn = sql.slice(sql.indexOf('FUNCTION booking_status_transition_allowed'));
  const body = fn.slice(0, fn.indexOf('$$;'));
  return new Set([...body.matchAll(/\('(\w+)',\s*'(\w+)'\)/g)].map((m) => `${m[1]}->${m[2]}`));
}

function newBooking(option: PaymentOption = 'deposit', total = 10_001n): Booking {
  const plan = calculatePaymentPlan({
    items: [{ subtotal: Money.of(total, 'USD'), travelDate: '2026-11-10', depositPercentOverride: null, includesThirdPartyTickets: false }],
    requestedOption: option,
    now: NOW,
    policy: DEFAULT_PAYMENT_PLAN_POLICY,
  });
  return Booking.create({
    id: 'b1',
    code: 'PWT-2026-000001',
    customerId: 'c1',
    cartId: 'cart1',
    locale: 'es',
    plan,
    items: [
      {
        id: 'i1',
        tourId: 't1',
        departureId: 'd1',
        travelDate: '2026-11-10',
        status: 'active',
        tourTitle: 'Valle Sagrado',
        paxCount: 1,
        subtotalAmount: total,
        currency: 'USD',
        lines: [],
      },
    ],
    lastServiceDate: '2026-11-10',
    cancellationPolicyVersion: 'v1',
    termsVersion: 'v1',
    customerNotes: null,
    now: NOW,
  });
}

describe('Máquina de estados de la reserva', () => {
  it('coincide exactamente con booking_status_transition_allowed() de constraints.sql', () => {
    const fromSql = sqlTransitions();
    const fromDomain = new Set(
      Object.entries(BOOKING_STATUS_TRANSITIONS).flatMap(([from, tos]) => tos.map((to) => `${from}->${to}`)),
    );
    expect(fromSql.size).toBeGreaterThan(10);
    expect([...fromDomain].sort()).toEqual([...fromSql].sort());
  });

  it('permite la misma transición (no-op) y rechaza las no listadas', () => {
    for (const s of BOOKING_STATUSES) expect(canTransitionBooking(s, s)).toBe(true);
    expect(canTransitionBooking('pending', 'paid')).toBe(false);
    expect(canTransitionBooking('refunded', 'paid')).toBe(false);
    expect(() => assertBookingTransition('paid', 'held', 'PWT-X')).toThrow(InvalidBookingTransitionError);
    expect(isTerminalBookingStatus('refunded')).toBe(true);
    expect(isTerminalBookingStatus('paid')).toBe(false);
  });
});

describe('Agregado Booking', () => {
  it('pending -> held -> partially_paid -> paid con adelanto y saldo', () => {
    const b = newBooking();
    expect(b.status).toBe('pending');
    b.placeHold(new Date(NOW.getTime() + 15 * 60_000), NOW);
    expect(b.nextPayment(NOW)).toMatchObject({ kind: 'deposit' });
    expect(b.nextPayment(NOW).amount.amount).toBe(5_001n);

    const r1 = b.registerPayment(Money.of(5_001n, 'USD'), NOW);
    expect(r1).toEqual({ from: 'held', to: 'partially_paid', changed: true });
    expect(b.holdExpiresAt).toBeNull();
    expect(b.nextPayment(NOW)).toMatchObject({ kind: 'balance' });
    expect(b.outstanding.amount).toBe(5_000n);

    const r2 = b.registerPayment(Money.of(5_000n, 'USD'), NOW);
    expect(r2.to).toBe('paid');
    expect(() => b.nextPayment(NOW)).toThrow(/ya está pagada/);
    expect(b.toSnapshot().statusHistory.map((h) => h.to)).toEqual(['pending', 'held', 'partially_paid', 'paid']);
  });

  it('pago total: held -> paid', () => {
    const b = newBooking('full');
    b.placeHold(new Date(NOW.getTime() + 60_000), NOW);
    expect(b.nextPayment(NOW)).toMatchObject({ kind: 'full' });
    expect(b.registerPayment(Money.of(10_001n, 'USD'), NOW).to).toBe('paid');
  });

  it('rechaza sobrepago (HU-5.4), pago menor al adelanto, moneda distinta y monto no positivo', () => {
    const b = newBooking();
    b.placeHold(new Date(NOW.getTime() + 60_000), NOW);
    expect(() => b.registerPayment(Money.of(10_002n, 'USD'), NOW)).toThrow(/supera el saldo/);
    expect(() => b.registerPayment(Money.of(100n, 'USD'), NOW)).toThrow(/no cubre el adelanto/);
    expect(() => b.registerPayment(Money.of(5_001n, 'PEN'), NOW)).toThrow(/No se pueden combinar/);
    expect(() => b.registerPayment(Money.of(0n, 'USD'), NOW)).toThrow(/mayor que cero/);
  });

  it('no admite pagos en pending ni cobra una reserva con hold vencido', () => {
    const b = newBooking();
    expect(() => b.registerPayment(Money.of(5_001n, 'USD'), NOW)).toThrow(/no admite pagos/);
    b.placeHold(new Date(NOW.getTime() + 60_000), NOW);
    const later = new Date(NOW.getTime() + 120_000);
    expect(b.isHoldExpired(later)).toBe(true);
    expect(() => b.nextPayment(later)).toThrow(/expiró/);
  });

  it('cancelación, pago tardío y reembolso: cancelled -> refunded', () => {
    const b = newBooking();
    b.placeHold(new Date(NOW.getTime() + 60_000), NOW);
    b.cancel('hold_expired', NOW, 'system');
    expect(b.status).toBe('cancelled');
    expect(() => b.registerRefund(Money.of(1n, 'USD'), NOW, 'x')).toThrow(/supera lo pagado/);
    b.registerLatePayment(Money.of(5_001n, 'USD'), NOW);
    expect(b.paid.amount).toBe(5_001n);
    const r = b.registerRefund(Money.of(5_001n, 'USD'), NOW, 'late_payment_refunded');
    expect(r.to).toBe('refunded');
    expect(() => b.cancel('again', NOW, 'system')).toThrow(InvalidBookingTransitionError);
  });

  it('registerLatePayment solo aplica a reservas canceladas', () => {
    const b = newBooking();
    expect(() => b.registerLatePayment(Money.of(1n, 'USD'), NOW)).toThrow(/canceladas/);
  });

  it('paid -> completed y snapshot/restore conserva el estado', () => {
    const b = newBooking('full');
    b.placeHold(new Date(NOW.getTime() + 60_000), NOW);
    b.registerPayment(Money.of(10_001n, 'USD'), NOW);
    b.complete(NOW);
    const restored = Booking.restore(b.toSnapshot());
    expect(restored.status).toBe('completed');
    expect(restored.paid.amount).toBe(10_001n);
  });
});
