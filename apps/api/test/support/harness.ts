import { BookingUseCases, type CheckoutInput } from '../../src/modules/booking/application/booking.use-cases.js';
import { CartUseCases } from '../../src/modules/cart/application/cart.use-cases.js';
import type { PaxLine } from '../../src/modules/catalog/domain/pricing.js';
import { PaymentUseCases } from '../../src/modules/payments/application/payment.use-cases.js';
import { SandboxPaymentGateway, StaticPaymentGatewayRegistry } from '../../src/modules/payments/infrastructure/sandbox-payment-gateway.js';
import type { InMemoryDataStore } from '../../src/persistence/in-memory/in-memory-data-store.js';
import { InMemoryUnitOfWork } from '../../src/persistence/in-memory/in-memory-unit-of-work.js';
import type { CurrencyCode } from '../../src/shared/domain/money.js';
import { BOOKING_SETTINGS, buildStore, CART_SETTINGS, fixedClock, sequentialIds, WEBHOOK_SECRET } from './fixtures.js';

export function createHarness(store: InMemoryDataStore = buildStore()) {
  const clock = fixedClock();
  const ids = sequentialIds();
  const uow = new InMemoryUnitOfWork(store);
  const gateway = new SandboxPaymentGateway(
    { webhookSecret: WEBHOOK_SECRET, checkoutBaseUrl: 'http://localhost/sandbox', webhookToleranceSeconds: 300 },
    clock,
  );
  const carts = new CartUseCases(uow, clock, ids, CART_SETTINGS);
  const bookings = new BookingUseCases(uow, clock, ids, carts, BOOKING_SETTINGS);
  const payments = new PaymentUseCases(uow, clock, ids, new StaticPaymentGatewayRegistry([gateway], gateway));

  async function cartWith(items: Array<{ tourId: string; travelDate: string; lines?: PaxLine[] }>, currency: CurrencyCode = 'USD') {
    const { token, details } = await carts.create({ currency, locale: 'es' });
    for (const item of items) {
      await carts.addItem(details.cart.id, token, {
        tourId: item.tourId,
        travelDate: item.travelDate,
        lines: item.lines ?? [{ paxType: 'adult', residency: 'foreign', quantity: 1 }],
      });
    }
    return { cartId: details.cart.id, token };
  }

  function checkoutInput(cart: { cartId: string; token: string }, key: string, extra: Partial<CheckoutInput> = {}): CheckoutInput {
    return {
      cartId: cart.cartId,
      cartToken: cart.token,
      idempotencyKey: key,
      paymentOption: 'deposit',
      customer: { email: 'Ana.Quispe@Example.com', firstName: 'Ana', lastName: 'Quispe', country: 'PE' },
      acceptTerms: true,
      acceptPrivacyPolicy: true,
      ...extra,
    };
  }

  function webhook(event: { id: string; providerPaymentId: string; status: string; amount?: number; currency?: string }, timestamp?: number) {
    const body = JSON.stringify({
      id: event.id,
      type: `payment.${event.status}`,
      created: Math.floor(clock.now().getTime() / 1000),
      data: { providerPaymentId: event.providerPaymentId, status: event.status, amount: event.amount, currency: event.currency },
    });
    return { raw: Buffer.from(body), headers: { 'x-sandbox-signature': gateway.signWebhook(body, timestamp) } };
  }

  return { store, clock, ids, uow, gateway, carts, bookings, payments, cartWith, checkoutInput, webhook };
}
