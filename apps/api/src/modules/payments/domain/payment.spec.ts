import { Money } from '../../../shared/domain/money.js';
import { canTransitionPayment, InvalidPaymentTransitionError, Payment, PAYMENT_STATUSES } from './payment.js';

const NOW = new Date('2026-10-07T15:00:00.000Z');

function payment(kind: 'deposit' | 'refund' = 'deposit'): Payment {
  return Payment.create({
    id: 'p1',
    bookingId: 'b1',
    kind,
    provider: 'sandbox',
    method: 'card',
    amount: Money.of(5_000n, 'USD'),
    idempotencyKey: 'key-12345678',
    parentPaymentId: kind === 'refund' ? 'p0' : null,
    now: NOW,
  });
}

describe('Máquina de estados del pago', () => {
  it('pending -> requires_action -> succeeded', () => {
    const p = payment();
    expect(p.applyProviderStatus('requires_action', NOW)).toMatchObject({ changed: true });
    expect(p.applyProviderStatus('succeeded', NOW)).toMatchObject({ from: 'requires_action', to: 'succeeded', changed: true });
    expect(p.toSnapshot().succeededAt).toEqual(NOW);
  });

  it('es idempotente para el mismo estado', () => {
    const p = payment();
    p.applyProviderStatus('succeeded', NOW);
    expect(p.applyProviderStatus('succeeded', NOW)).toEqual({ from: 'succeeded', to: 'succeeded', changed: false, ignored: false });
  });

  it('ignora eventos fuera de orden que intentan salir de un estado terminal', () => {
    const p = payment();
    p.applyProviderStatus('succeeded', NOW);
    expect(p.applyProviderStatus('failed', NOW)).toMatchObject({ changed: false, ignored: true });
    expect(p.status).toBe('succeeded');
  });

  it('registra el motivo de rechazo', () => {
    const p = payment();
    p.applyProviderStatus('failed', NOW, { code: 'card_declined', message: 'Rechazada' });
    expect(p.toSnapshot()).toMatchObject({ status: 'failed', failureCode: 'card_declined', failureMessage: 'Rechazada' });
  });

  it('rechaza transiciones inválidas desde estados no terminales', () => {
    const p = payment();
    p.applyProviderStatus('authorized', NOW);
    expect(() => p.applyProviderStatus('requires_action', NOW)).toThrow(InvalidPaymentTransitionError);
  });

  it('tabla de transiciones: los terminales no salen', () => {
    for (const to of PAYMENT_STATUSES) {
      if (to !== 'succeeded') expect(canTransitionPayment('succeeded', to)).toBe(false);
    }
    expect(canTransitionPayment('pending', 'succeeded')).toBe(true);
  });

  it('valida monto positivo y padre en reembolsos', () => {
    expect(() =>
      Payment.create({ id: 'x', bookingId: 'b', kind: 'deposit', provider: 'sandbox', method: null, amount: Money.zero('USD'), idempotencyKey: 'k-12345678', now: NOW }),
    ).toThrow(/mayor que cero/);
    expect(() =>
      Payment.create({ id: 'x', bookingId: 'b', kind: 'refund', provider: 'sandbox', method: null, amount: Money.of(1, 'USD'), idempotencyKey: 'k-12345678', now: NOW }),
    ).toThrow(/pago original/);
    expect(payment('refund').kind).toBe('refund');
  });

  it('no permite reasociar a otro id del proveedor', () => {
    const p = payment();
    p.attachProviderPayment('sbx_1', NOW);
    p.attachProviderPayment('sbx_1', NOW);
    expect(() => p.attachProviderPayment('sbx_2', NOW)).toThrow(/otra operación/);
  });
});
