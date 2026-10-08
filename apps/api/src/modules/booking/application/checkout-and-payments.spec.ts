import { IDS } from '../../../../test/support/fixtures.js';
import { createHarness } from '../../../../test/support/harness.js';
import { InvalidWebhookSignatureError } from '../../payments/domain/payment-gateway.js';
import {
  BookingAccessNotFoundError,
  bookingAccessTokenMatches,
  generateBookingAccessToken,
  hashBookingAccessToken,
} from './booking-access.js';

describe('Carrito', () => {
  it('crea carrito anónimo con token y protege el acceso por token', async () => {
    const h = createHarness();
    const { token, details } = await h.carts.create({ currency: 'USD', locale: 'es' });
    expect(token.length).toBeGreaterThanOrEqual(43);
    expect(details.cart.tokenHash).not.toContain(token);
    await expect(h.carts.get(details.cart.id, 'otro-token')).rejects.toMatchObject({ code: 'cart-not-found' });
    await expect(h.carts.get(details.cart.id, undefined)).rejects.toMatchObject({ code: 'cart-not-found' });
  });

  it('agrega, rechaza duplicado (doble clic) y quita ítems', async () => {
    const h = createHarness();
    const cart = await h.cartWith([{ tourId: IDS.valle, travelDate: '2026-11-10', lines: [{ paxType: 'adult', residency: 'foreign', quantity: 2 }] }]);
    const details = await h.carts.get(cart.cartId, cart.token);
    expect(details.cart.total().amount).toBe(24_000n);
    await expect(
      h.carts.addItem(cart.cartId, cart.token, { tourId: IDS.valle, travelDate: '2026-11-10', lines: [{ paxType: 'adult', residency: 'foreign', quantity: 1 }] }),
    ).rejects.toMatchObject({ code: 'cart-item-duplicate' });
    const itemId = details.cart.items[0]!.id;
    const after = await h.carts.removeItem(cart.cartId, cart.token, itemId);
    expect(after.cart.items).toHaveLength(0);
    await expect(h.carts.removeItem(cart.cartId, cart.token, itemId)).rejects.toMatchObject({ code: 'cart-item-not-found' });
  });

  it('valida tour, fecha, cierre de ventas, cupo y moneda al agregar', async () => {
    const h = createHarness();
    const { token, details } = await h.carts.create({ currency: 'PEN', locale: 'es' });
    const add = (tourId: string, travelDate: string, quantity = 1) =>
      h.carts.addItem(details.cart.id, token, { tourId, travelDate, lines: [{ paxType: 'adult', residency: 'foreign', quantity }] });
    await expect(add(IDS.draft, '2026-11-10')).rejects.toMatchObject({ code: 'tour-not-found' });
    await expect(add(IDS.valle, '2026-11-11')).rejects.toMatchObject({ code: 'no-departure' });
    await expect(add(IDS.machu, '2026-11-10')).rejects.toMatchObject({ code: 'rate-not-available' }); // sin tarifa PEN
    await expect(add(IDS.valle, '2026-11-10', 4)).rejects.toMatchObject({ code: 'sold-out' });
    h.clock.set(new Date('2026-11-09T06:00:00.000Z')); // < 24 h antes
    const late = await h.carts.create({ currency: 'USD', locale: 'es' });
    await expect(
      h.carts.addItem(late.details.cart.id, late.token, { tourId: IDS.valle, travelDate: '2026-11-10', lines: [{ paxType: 'adult', residency: 'foreign', quantity: 1 }] }),
    ).rejects.toMatchObject({ code: 'sales-closed' });
  });

  it('expira por inactividad y el job marca los vencidos', async () => {
    const h = createHarness();
    const cart = await h.cartWith([]);
    h.clock.advanceMinutes(7 * 24 * 60 + 1);
    await expect(h.carts.get(cart.cartId, cart.token)).rejects.toMatchObject({ code: 'cart-expired' });
    expect(await h.carts.expireStale()).toBe(1);
    expect(await h.carts.expireStale()).toBe(0);
  });

  it('revalidación: precio cambiado se informa sin bloquear mientras el precio está congelado', async () => {
    const h = createHarness();
    const cart = await h.cartWith([{ tourId: IDS.valle, travelDate: '2026-11-10' }]);
    const rate = h.store.catalog.rates.find((r) => r.tourId === IDS.valle && r.paxType === 'adult' && r.currency === 'USD')!;
    rate.amount = 13_000n;
    const view = await h.carts.get(cart.cartId, cart.token);
    expect(view.issues).toEqual([expect.objectContaining({ type: 'price_changed', blocking: false })]);
    h.clock.advanceMinutes(31);
    const expired = await h.carts.get(cart.cartId, cart.token);
    expect(expired.issues[0]?.blocking).toBe(true);
    const recalculated = await h.carts.recalculate(cart.cartId, cart.token);
    expect(recalculated.cart.total().amount).toBe(13_000n);
    expect((await h.carts.get(cart.cartId, cart.token)).issues).toHaveLength(0);
  });

  it('opciones de pago: adelanto disponible / salida cercana solo 100 %', async () => {
    const h = createHarness();
    const far = await h.cartWith([{ tourId: IDS.valle, travelDate: '2026-11-10' }]);
    const options = await h.carts.paymentOptions(far.cartId, far.token, { defaultDepositPercent: 50, balanceDueDaysBeforeService: 7, fullPaymentWithinDays: 7, thirdPartyTicketsRequireFull: true });
    expect(options.deposit?.deposit.amount).toBe(6_000n);
    const near = await h.cartWith([{ tourId: IDS.valle, travelDate: '2026-10-10' }]);
    const nearOptions = await h.carts.paymentOptions(near.cartId, near.token, { defaultDepositPercent: 50, balanceDueDaysBeforeService: 7, fullPaymentWithinDays: 7, thirdPartyTicketsRequireFull: true });
    expect(nearOptions.depositUnavailableReason).toBe('departure_too_close');
  });
});

describe('Checkout', () => {
  it('crea la reserva held, retiene cupo y convierte el carrito', async () => {
    const h = createHarness();
    const cart = await h.cartWith([{ tourId: IDS.valle, travelDate: '2026-11-10', lines: [{ paxType: 'adult', residency: 'foreign', quantity: 2 }] }]);
    const { booking, replayed } = await h.bookings.checkout(h.checkoutInput(cart, 'checkout-key-0001'));
    expect(replayed).toBe(false);
    expect(booking.code).toBe('PWT-2026-000001');
    expect(booking.status).toBe('held');
    expect(booking.deposit.amount).toBe(12_000n);
    expect(booking.holdExpiresAt?.toISOString()).toBe('2026-10-07T15:15:00.000Z');
    expect(h.store.state.departures.get(IDS.depValleNov10)).toMatchObject({ held: 2, booked: 0, version: 1 });
    expect([...h.store.state.customers.values()][0]?.email).toBe('ana.quispe@example.com');
    expect(h.store.state.carts.get(cart.cartId)?.status).toBe('converted');
  });

  it('es idempotente: la misma clave devuelve la misma reserva sin efectos nuevos', async () => {
    const h = createHarness();
    const cart = await h.cartWith([{ tourId: IDS.valle, travelDate: '2026-11-10' }]);
    const first = await h.bookings.checkout(h.checkoutInput(cart, 'checkout-key-0002'));
    const second = await h.bookings.checkout(h.checkoutInput(cart, 'checkout-key-0002'));
    expect(second.replayed).toBe(true);
    expect(second.booking.id).toBe(first.booking.id);
    expect(h.store.state.bookings.size).toBe(1);
    expect(h.store.state.departures.get(IDS.depValleNov10)?.held).toBe(1);
  });

  it('doble clic simultáneo con la misma clave => una sola reserva', async () => {
    const h = createHarness();
    const cart = await h.cartWith([{ tourId: IDS.valle, travelDate: '2026-11-10' }]);
    const results = await Promise.all([1, 2, 3].map(() => h.bookings.checkout(h.checkoutInput(cart, 'checkout-key-0003'))));
    expect(new Set(results.map((r) => r.booking.id)).size).toBe(1);
    expect(results.filter((r) => !r.replayed)).toHaveLength(1);
    expect(h.store.state.bookings.size).toBe(1);
  });

  it('misma clave con otro cuerpo => idempotency-key-reused; otra clave sobre carrito convertido => 409', async () => {
    const h = createHarness();
    const cart = await h.cartWith([{ tourId: IDS.valle, travelDate: '2026-11-10' }]);
    await h.bookings.checkout(h.checkoutInput(cart, 'checkout-key-0004'));
    await expect(h.bookings.checkout(h.checkoutInput(cart, 'checkout-key-0004', { paymentOption: 'full' }))).rejects.toMatchObject({
      code: 'idempotency-key-reused',
    });
    await expect(h.bookings.checkout(h.checkoutInput(cart, 'checkout-key-0005'))).rejects.toMatchObject({ code: 'cart-already-checked-out' });
  });

  it('exige Idempotency-Key válida y consentimientos', async () => {
    const h = createHarness();
    const cart = await h.cartWith([{ tourId: IDS.valle, travelDate: '2026-11-10' }]);
    expect(() => h.bookings.checkout(h.checkoutInput(cart, ''))).toThrow(/Idempotency-Key/);
    expect(() => h.bookings.checkout(h.checkoutInput(cart, 'short'))).toThrow(/Idempotency-Key/);
    expect(() => h.bookings.checkout(h.checkoutInput(cart, 'checkout-key-0006', { acceptPrivacyPolicy: false }))).toThrow(/política de privacidad/);
  });

  it('sin cupo al crear el hold: no crea nada (rollback total)', async () => {
    const h = createHarness();
    const a = await h.cartWith([{ tourId: IDS.valle, travelDate: '2026-11-10', lines: [{ paxType: 'adult', residency: 'foreign', quantity: 2 }] }]);
    const b = await h.cartWith([{ tourId: IDS.valle, travelDate: '2026-11-10', lines: [{ paxType: 'adult', residency: 'foreign', quantity: 2 }] }]);
    const [ra, rb] = await Promise.allSettled([
      h.bookings.checkout(h.checkoutInput(a, 'checkout-key-a001')),
      h.bookings.checkout(h.checkoutInput(b, 'checkout-key-b001', { customer: { email: 'b@example.com', firstName: 'B', lastName: 'B' } })),
    ]);
    expect([ra.status, rb.status].sort((x, y) => x.localeCompare(y))).toEqual(['fulfilled', 'rejected']);
    const rejected = [ra, rb].find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ code: 'cart-has-issues' });
    expect(h.store.state.bookings.size).toBe(1);
    expect(h.store.state.departures.get(IDS.depValleNov10)?.held).toBe(2);
  });

  it('adelanto pedido con salida cercana => deposit-not-available; total cambiado => total-changed', async () => {
    const h = createHarness();
    const near = await h.cartWith([{ tourId: IDS.valle, travelDate: '2026-10-10' }]);
    await expect(h.bookings.checkout(h.checkoutInput(near, 'checkout-key-0007'))).rejects.toMatchObject({ code: 'deposit-not-available' });
    await expect(h.bookings.checkout(h.checkoutInput(near, 'checkout-key-0008', { paymentOption: 'full', expectedTotalAmount: 1n }))).rejects.toMatchObject({
      code: 'total-changed',
    });
    const ok = await h.bookings.checkout(h.checkoutInput(near, 'checkout-key-0009', { paymentOption: 'full', expectedTotalAmount: 12_000n }));
    expect(ok.booking.paymentOption).toBe('full');
  });

  it('el job de expiración cancela holds vencidos y libera cupo', async () => {
    const h = createHarness();
    const cart = await h.cartWith([{ tourId: IDS.valle, travelDate: '2026-11-10' }]);
    const { booking } = await h.bookings.checkout(h.checkoutInput(cart, 'checkout-key-0010'));
    h.clock.advanceMinutes(16);
    expect(await h.bookings.expireHolds()).toBe(1);
    expect((await h.bookings.getById(booking.id)).status).toBe('cancelled');
    expect(h.store.state.departures.get(IDS.depValleNov10)?.held).toBe(0);
  });
});

describe('Pagos', () => {
  /** Acceso del comprador (código + X-Booking-Token) por reserva creada en la prueba. */
  const accessByBooking = new Map<string, { code: string; token: string }>();
  const acc = (booking: { id: string }) => accessByBooking.get(booking.id)!;

  async function heldBooking(h: ReturnType<typeof createHarness>, key = 'checkout-key-p001') {
    const cart = await h.cartWith([{ tourId: IDS.valle, travelDate: '2026-11-10' }]);
    const result = await h.bookings.checkout(h.checkoutInput(cart, key));
    accessByBooking.set(result.booking.id, { code: result.booking.code, token: result.accessToken });
    return result.booking;
  }

  it('adelanto confirmado => partially_paid y cupo vendido; saldo => paid', async () => {
    const h = createHarness();
    const booking = await heldBooking(h);
    const intent = await h.payments.createPayment({ booking: acc(booking), idempotencyKey: 'pay-key-0001' });
    expect(intent.payment.kind).toBe('deposit');
    expect(intent.payment.status).toBe('requires_action');
    expect(intent.nextAction.type).toBe('redirect');
    const confirmed = await h.payments.confirmPayment(acc(booking), intent.payment.id, {});
    expect(confirmed.status).toBe('succeeded');
    let current = await h.bookings.getById(booking.id);
    expect(current.status).toBe('partially_paid');
    expect(h.store.state.departures.get(IDS.depValleNov10)).toMatchObject({ held: 0, booked: 1 });

    const balance = await h.payments.createPayment({ booking: acc(booking), idempotencyKey: 'pay-key-0002' });
    expect(balance.payment.kind).toBe('balance');
    expect(balance.payment.amount.amount).toBe(6_000n);
    await h.payments.confirmPayment(acc(booking), balance.payment.id, {});
    current = await h.bookings.getById(booking.id);
    expect(current.status).toBe('paid');
    await expect(h.payments.createPayment({ booking: acc(booking), idempotencyKey: 'pay-key-0003' })).rejects.toMatchObject({ code: 'booking-already-paid' });
  });

  it('doble clic en "Pagar" (misma clave) => un solo intento', async () => {
    const h = createHarness();
    const booking = await heldBooking(h);
    const [a, b] = await Promise.all([
      h.payments.createPayment({ booking: acc(booking), idempotencyKey: 'pay-key-0004' }),
      h.payments.createPayment({ booking: acc(booking), idempotencyKey: 'pay-key-0004' }),
    ]);
    expect(a.payment.id).toBe(b.payment.id);
    expect([a.replayed, b.replayed].filter(Boolean)).toHaveLength(1);
    expect(h.store.state.payments.size).toBe(1);
    const other = await heldBooking(h, 'checkout-key-p002');
    await expect(h.payments.createPayment({ booking: acc(other), idempotencyKey: 'pay-key-0004' })).rejects.toMatchObject({
      code: 'idempotency-key-reused',
    });
  });

  it('pago rechazado: queda failed y la reserva sigue held para reintentar', async () => {
    const h = createHarness();
    const booking = await heldBooking(h);
    const intent = await h.payments.createPayment({ booking: acc(booking), idempotencyKey: 'pay-key-0005' });
    const failed = await h.payments.confirmPayment(acc(booking), intent.payment.id, { simulate: 'fail' });
    expect(failed.toSnapshot()).toMatchObject({ status: 'failed', failureCode: 'card_declined' });
    expect((await h.bookings.getById(booking.id)).status).toBe('held');
  });

  it('hold vencido al pagar => hold-expired y libera cupo', async () => {
    const h = createHarness();
    const booking = await heldBooking(h);
    h.clock.advanceMinutes(20);
    await expect(h.payments.createPayment({ booking: acc(booking), idempotencyKey: 'pay-key-0006' })).rejects.toMatchObject({ code: 'hold-expired' });
    expect((await h.bookings.getById(booking.id)).status).toBe('cancelled');
    expect(h.store.state.departures.get(IDS.depValleNov10)?.held).toBe(0);
  });

  it('webhook: aplica una vez; duplicado devuelve duplicate sin efectos', async () => {
    const h = createHarness();
    const booking = await heldBooking(h);
    const intent = await h.payments.createPayment({ booking: acc(booking), idempotencyKey: 'pay-key-0007' });
    const providerPaymentId = intent.payment.providerPaymentId!;
    await h.gateway.confirm(providerPaymentId, {});
    const event = h.webhook({ id: 'evt_0001', providerPaymentId, status: 'succeeded', amount: 6_000, currency: 'USD' });

    const first = await h.payments.handleWebhook('sandbox', event.raw, event.headers);
    expect(first.status).toBe('processed');
    const dupes = await Promise.all([1, 2].map(() => h.payments.handleWebhook('sandbox', event.raw, event.headers)));
    expect(dupes.map((d) => d.status)).toEqual(['duplicate', 'duplicate']);
    const current = await h.bookings.getById(booking.id);
    expect(current.status).toBe('partially_paid');
    expect(current.paid.amount).toBe(6_000n);
    expect(h.store.state.paymentEvents.size).toBe(1);
    expect([...h.store.state.paymentEvents.values()][0]).toMatchObject({ processingStatus: 'processed', attempts: 1 });
  });

  it('webhook con firma inválida, vencida o monto distinto no aplica nada', async () => {
    const h = createHarness();
    const booking = await heldBooking(h);
    const intent = await h.payments.createPayment({ booking: acc(booking), idempotencyKey: 'pay-key-0008' });
    const providerPaymentId = intent.payment.providerPaymentId!;
    const event = h.webhook({ id: 'evt_0002', providerPaymentId, status: 'succeeded' });
    const tampered = Buffer.from(event.raw.toString().replace('succeeded', 'failed'));
    await expect(h.payments.handleWebhook('sandbox', tampered, event.headers)).rejects.toBeInstanceOf(InvalidWebhookSignatureError);
    await expect(h.payments.handleWebhook('sandbox', event.raw, {})).rejects.toBeInstanceOf(InvalidWebhookSignatureError);
    const old = h.webhook({ id: 'evt_0003', providerPaymentId, status: 'succeeded' }, Math.floor(h.clock.now().getTime() / 1000) - 3600);
    await expect(h.payments.handleWebhook('sandbox', old.raw, old.headers)).rejects.toMatchObject({ details: { reason: 'timestamp_out_of_tolerance' } });
    const wrongAmount = h.webhook({ id: 'evt_0004', providerPaymentId, status: 'succeeded', amount: 1, currency: 'USD' });
    expect((await h.payments.handleWebhook('sandbox', wrongAmount.raw, wrongAmount.headers)).status).toBe('failed');
    expect((await h.bookings.getById(booking.id)).status).toBe('held');
  });

  it('webhook de pago desconocido queda failed para reproceso; sin estado se ignora', async () => {
    const h = createHarness();
    const unknown = h.webhook({ id: 'evt_0005', providerPaymentId: 'sbx_pay_unknown', status: 'succeeded' });
    expect((await h.payments.handleWebhook('sandbox', unknown.raw, unknown.headers)).status).toBe('failed');
    const info = h.webhook({ id: 'evt_0006', providerPaymentId: 'sbx_pay_unknown', status: 'not-a-status' });
    expect((await h.payments.handleWebhook('sandbox', info.raw, info.headers)).status).toBe('ignored');
    await expect(h.payments.handleWebhook('niubiz', unknown.raw, unknown.headers)).rejects.toMatchObject({ code: 'unknown-payment-provider' });
  });

  it('webhook tardío tras cancelar por hold vencido => reembolso automático y reserva refunded', async () => {
    const h = createHarness();
    const booking = await heldBooking(h);
    const intent = await h.payments.createPayment({ booking: acc(booking), idempotencyKey: 'pay-key-0009' });
    h.clock.advanceMinutes(16);
    expect(await h.bookings.expireHolds()).toBe(1);
    const providerPaymentId = intent.payment.providerPaymentId!;
    await h.gateway.confirm(providerPaymentId, {});
    const event = h.webhook({ id: 'evt_0007', providerPaymentId, status: 'succeeded', amount: 6_000, currency: 'USD' });
    expect((await h.payments.handleWebhook('sandbox', event.raw, event.headers)).status).toBe('processed');
    const current = await h.bookings.getById(booking.id);
    expect(current.status).toBe('refunded');
    expect(current.refunded.amount).toBe(6_000n);
    const refunds = [...h.store.state.payments.values()].filter((p) => p.kind === 'refund');
    expect(refunds).toHaveLength(1);
    expect(refunds[0]).toMatchObject({ status: 'succeeded', parentPaymentId: intent.payment.id });
  });
});

describe('Acceso del comprador a su reserva (X-Booking-Token)', () => {
  async function checkout(h: ReturnType<typeof createHarness>, key = 'checkout-key-a001') {
    const cart = await h.cartWith([{ tourId: IDS.valle, travelDate: '2026-11-10' }]);
    return { cart, result: await h.bookings.checkout(h.checkoutInput(cart, key)) };
  }

  it('entrega un token de 256 bits y solo guarda su SHA-256', async () => {
    const h = createHarness();
    const { result } = await checkout(h);
    expect(result.accessToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.booking.accessTokenHash).toBe(hashBookingAccessToken(result.accessToken));
    expect(JSON.stringify([...h.store.state.bookings.values()], (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v))).not.toContain(result.accessToken);
    const found = await h.bookings.getByCode({ code: result.booking.code, token: result.accessToken });
    expect(found.id).toBe(result.booking.id);
  });

  it('token incorrecto y código inexistente devuelven el mismo 404 genérico; sin token => 401', async () => {
    const h = createHarness();
    const { result } = await checkout(h);
    const other = generateBookingAccessToken().token;
    const wrong = await h.bookings.getByCode({ code: result.booking.code, token: other }).catch((e: unknown) => e);
    const missing = await h.bookings.getByCode({ code: 'PWT-2099-999999', token: result.accessToken }).catch((e: unknown) => e);
    const malformed = await h.bookings.getByCode({ code: 'no-es-un-codigo', token: result.accessToken }).catch((e: unknown) => e);
    for (const error of [wrong, missing, malformed]) {
      expect(error).toBeInstanceOf(BookingAccessNotFoundError);
      expect(error).toMatchObject({ code: 'booking-not-found', message: 'Reserva no encontrada.', details: {} });
    }
    await expect(h.bookings.getByCode({ code: result.booking.code, token: undefined })).rejects.toMatchObject({ code: 'booking-token-required' });
    await expect(h.bookings.getByCode({ code: result.booking.code, token: 'corto' })).rejects.toMatchObject({ code: 'booking-token-required' });
  });

  it('replay idempotente: exige el X-Cart-Token y rota el token (el anterior deja de servir)', async () => {
    const h = createHarness();
    const { cart, result } = await checkout(h);
    await expect(h.bookings.checkout({ ...h.checkoutInput(cart, 'checkout-key-a001'), cartToken: 'otro' })).rejects.toMatchObject({ code: 'cart-not-found' });
    const replay = await h.bookings.checkout(h.checkoutInput(cart, 'checkout-key-a001'));
    expect(replay.replayed).toBe(true);
    expect(replay.booking.id).toBe(result.booking.id);
    expect(replay.accessToken).not.toBe(result.accessToken);
    await expect(h.bookings.getByCode({ code: result.booking.code, token: result.accessToken })).rejects.toBeInstanceOf(BookingAccessNotFoundError);
    expect((await h.bookings.getByCode({ code: result.booking.code, token: replay.accessToken })).id).toBe(result.booking.id);
    expect(h.store.state.idempotency.get(`checkout:checkout-key-a001`)?.response).toEqual({ bookingId: result.booking.id, bookingCode: result.booking.code });
  });

  it('los pagos solo se ven con el token de su reserva', async () => {
    const h = createHarness();
    const a = (await checkout(h, 'checkout-key-a002')).result;
    const b = (await checkout(h, 'checkout-key-a003')).result;
    const accessA = { code: a.booking.code, token: a.accessToken };
    const accessB = { code: b.booking.code, token: b.accessToken };
    const intent = await h.payments.createPayment({ booking: accessA, idempotencyKey: 'pay-key-a001' });
    expect((await h.payments.getPayment(accessA, intent.payment.id)).id).toBe(intent.payment.id);
    expect(await h.payments.listPayments(accessA)).toHaveLength(1);
    expect(await h.payments.listPayments(accessB)).toHaveLength(0);
    await expect(h.payments.getPayment(accessB, intent.payment.id)).rejects.toMatchObject({ code: 'payment-not-found' });
    await expect(h.payments.confirmPayment(accessB, intent.payment.id, {})).rejects.toMatchObject({ code: 'payment-not-found' });
    await expect(h.payments.createPayment({ booking: { ...accessA, token: b.accessToken }, idempotencyKey: 'pay-key-a002' })).rejects.toBeInstanceOf(
      BookingAccessNotFoundError,
    );
  });
});

describe('bookingAccessTokenMatches', () => {
  it('compara en tiempo constante y nunca acepta sin hash guardado', () => {
    const { token, tokenHash } = generateBookingAccessToken();
    expect(bookingAccessTokenMatches(token, tokenHash)).toBe(true);
    expect(bookingAccessTokenMatches(token, null)).toBe(false);
    expect(bookingAccessTokenMatches(token, '0'.repeat(64))).toBe(false);
    expect(bookingAccessTokenMatches(token, 'no-hex')).toBe(false);
  });
});
