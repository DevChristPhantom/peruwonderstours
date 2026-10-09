import { IDS } from '../../../../test/support/fixtures.js';
import { createHarness } from '../../../../test/support/harness.js';
import { Money } from '../../../shared/domain/money.js';
import { BookingLifecycle } from '../../booking/application/booking-lifecycle.js';
import type { ProviderPaymentState } from '../domain/payment-gateway.js';
import { StaticPaymentGatewayRegistry } from '../infrastructure/sandbox-payment-gateway.js';
import { PaymentUseCases } from './payment.use-cases.js';

async function heldBooking(h: ReturnType<typeof createHarness>, key = 'checkout-key-hard1') {
  const cart = await h.cartWith([{ tourId: IDS.valle, travelDate: '2026-11-10' }]);
  const result = await h.bookings.checkout(h.checkoutInput(cart, key));
  return { booking: result.booking, access: { code: result.booking.code, token: result.accessToken } };
}

describe('Endurecimiento de pagos (H-01 / H-10)', () => {
  it('un cobro que llega con la reserva ya pagada se reembolsa automáticamente (nunca queda colgado)', async () => {
    const h = createHarness();
    const { booking, access } = await heldBooking(h);
    const intent = await h.payments.createPayment({ booking: access, idempotencyKey: 'pay-key-hard1' });
    // Mientras tanto la reserva se paga completa por otro medio.
    await h.uow.run((repos) => new BookingLifecycle().applySucceededPayment(repos, booking.id, Money.of(12_000n, 'USD'), h.clock.now(), 'user'));
    const confirmed = await h.payments.confirmPayment(access, intent.payment.id, {});
    expect(confirmed.status).toBe('succeeded');
    const payments = [...h.store.state.payments.values()];
    const refund = payments.find((p) => p.kind === 'refund');
    expect(refund).toMatchObject({ status: 'succeeded', parentPaymentId: intent.payment.id, amount: 6_000n });
    expect(payments.find((p) => p.id === intent.payment.id)?.kind).toBe('balance'); // reclasificado (excedente)
    const after = h.store.state.bookings.get(booking.id)!;
    expect(after).toMatchObject({ status: 'paid', paidAmount: 12_000n, refundedAmount: 0n });
  });

  it('pago tardío sobre una reserva cancelada: se suma y se reembolsa', async () => {
    const h = createHarness();
    const { booking, access } = await heldBooking(h);
    const intent = await h.payments.createPayment({ booking: access, idempotencyKey: 'pay-key-hard2' });
    h.clock.advanceMinutes(16);
    expect(await h.bookings.expireHolds()).toBe(1);
    await h.payments.confirmPayment(access, intent.payment.id, {});
    expect(h.store.state.bookings.get(booking.id)).toMatchObject({ status: 'refunded', paidAmount: 6_000n, refundedAmount: 6_000n });
  });

  it('H-10: si la pasarela confirma otro monto, no se aplica el cobro', async () => {
    const h = createHarness();
    const { booking, access } = await heldBooking(h);
    const tampered = Object.create(h.gateway) as typeof h.gateway;
    tampered.confirm = async (id: string, c: Record<string, string>): Promise<ProviderPaymentState> => ({ ...(await h.gateway.confirm(id, c)), amount: Money.of(1n, 'USD') });
    const payments = new PaymentUseCases(h.uow, h.clock, h.ids, new StaticPaymentGatewayRegistry([tampered], tampered));
    const intent = await payments.createPayment({ booking: access, idempotencyKey: 'pay-key-hard3' });
    await expect(payments.confirmPayment(access, intent.payment.id, {})).rejects.toMatchObject({ code: 'payment-amount-mismatch' });
    expect(h.store.state.payments.get(intent.payment.id)?.status).toBe('requires_action');
    expect(h.store.state.bookings.get(booking.id)?.paidAmount).toBe(0n);
  });

  it('H-10: un webhook de cobro aprobado sin monto se rechaza', async () => {
    const h = createHarness();
    const { access } = await heldBooking(h);
    const intent = await h.payments.createPayment({ booking: access, idempotencyKey: 'pay-key-hard4' });
    const hook = h.webhook({ id: 'evt-no-amount', providerPaymentId: intent.payment.providerPaymentId!, status: 'succeeded' });
    const result = await h.payments.handleWebhook('sandbox', hook.raw, hook.headers);
    expect(result.status).toBe('failed');
    expect([...h.store.state.paymentEvents.values()][0]).toMatchObject({ processingStatus: 'failed', lastError: 'amount_missing' });
    expect(h.store.state.payments.get(intent.payment.id)?.status).toBe('requires_action');
  });

  it('un segundo "Pagar" con otra clave retoma el intento activo', async () => {
    const h = createHarness();
    const { access } = await heldBooking(h);
    const first = await h.payments.createPayment({ booking: access, idempotencyKey: 'pay-key-hard5' });
    const second = await h.payments.createPayment({ booking: access, idempotencyKey: 'pay-key-hard6' });
    expect(second).toMatchObject({ replayed: true });
    expect(second.payment.id).toBe(first.payment.id);
    expect(second.nextAction).toEqual(first.nextAction);
  });

  it('conciliación: sincroniza cobros aprobados no notificados y expira intentos abandonados', async () => {
    const h = createHarness();
    const a = await heldBooking(h, 'checkout-key-hard7');
    const paid = await h.payments.createPayment({ booking: a.access, idempotencyKey: 'pay-key-hard7' });
    await h.gateway.confirm(paid.payment.providerPaymentId!, {}); // aprobado, sin webhook ni confirmación
    h.clock.advanceMinutes(31);
    const r1 = await h.payments.reconcileStalePayments({ staleBefore: new Date(h.clock.now().getTime() - 30 * 60_000), expireBefore: new Date(h.clock.now().getTime() - 24 * 3600_000) });
    expect(r1).toMatchObject({ checked: 1, synced: 1, expired: 0 });
    expect(h.store.state.bookings.get(a.booking.id)?.status).toBe('partially_paid');

    const balance = await h.payments.createPayment({ booking: a.access, idempotencyKey: 'pay-key-hard8' });
    h.clock.advanceMinutes(25 * 60);
    const r2 = await h.payments.reconcileStalePayments({ staleBefore: new Date(h.clock.now().getTime() - 30 * 60_000), expireBefore: new Date(h.clock.now().getTime() - 24 * 3600_000) });
    expect(r2).toMatchObject({ checked: 1, expired: 1 });
    expect(h.store.state.payments.get(balance.payment.id)?.status).toBe('expired');
  });

  it('bloqueo optimista de la reserva: guardar una versión vieja falla', async () => {
    const h = createHarness();
    const { booking } = await heldBooking(h);
    const stale = await h.uow.run((r) => r.bookings.findById(booking.id));
    await h.uow.run(async (r) => {
      const fresh = (await r.bookings.findById(booking.id))!;
      fresh.cancel('test', h.clock.now(), 'user');
      await r.bookings.save(fresh);
    });
    await expect(h.uow.run((r) => r.bookings.save(stale!))).rejects.toMatchObject({ code: 'concurrency-conflict' });
  });
});
