import { Money } from '../../../shared/domain/money.js';
import { FixedClock } from '../../../shared/infrastructure/system.js';
import { InvalidWebhookSignatureError, PaymentGatewayError } from '../domain/payment-gateway.js';
import { IzipayPaymentGateway, type IzipayGatewayOptions } from './izipay-payment-gateway.js';

const clock = new FixedClock(new Date('2026-11-01T15:00:00.000Z'));
const options: IzipayGatewayOptions = {
  environment: 'sandbox',
  merchantCode: '4007701',
  apiKey: 'test-api-key-0123456789',
  rsaPublicKey: 'test-rsa-public-key-0123456789',
  hashKey: 'test-hash-key-0123456789',
  ruc: '20123456789',
  ipnUrl: 'https://api.example.test/api/v1/payments/webhooks/izipay',
};
const intentInput = { paymentId: 'p1', amount: Money.of(14_900, 'USD'), idempotencyKey: 'k-12345678', reference: 'PWT-2026-000001', description: 'test' };
const orderNumber = IzipayPaymentGateway.orderNumberFor(intentInput.idempotencyKey);

type Call = { path: string; headers: Record<string, string>; body: Record<string, unknown> };

/** Izipay falso: responde por ruta y registra cada llamada. */
function fakeIzipay(routes: Record<string, (body: Record<string, unknown>) => { status?: number; json: unknown }>) {
  const calls: Call[] = [];
  const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
    const path = new URL(url instanceof Request ? url.url : url).pathname;
    const body = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as Record<string, unknown>;
    calls.push({ path, headers: init?.headers as Record<string, string>, body });
    const route = routes[path];
    if (!route) return new Response('not found', { status: 404 });
    const { status = 200, json } = route(body);
    return new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  return { calls, fetchFn };
}

const tokenRoute = () => ({ json: { code: '00', message: 'OK', response: { token: 'session-token' } } });
const paidOrder = (amount = '149.00', currency = 'USD') => ({
  code: '00',
  message: 'Pago aceptado',
  messageUser: 'Operación exitosa',
  transactionId: '1762009200000123456',
  response: { order: [{ orderNumber, amount, currency, codeAuth: '303556', referenceNumber: '8000000', uniqueId: '449858239', stateMessage: 'Autorizado', dateTransaction: '20261101' }] },
});

describe('IzipayPaymentGateway', () => {
  it('createIntent genera el token de sesión y devuelve la configuración pública del SDK', async () => {
    const izi = fakeIzipay({ '/security/v1/Token/Generate': tokenRoute });
    const gw = new IzipayPaymentGateway(options, clock, izi.fetchFn);
    const intent = await gw.createIntent(intentInput);

    expect(intent.providerPaymentId).toBe(orderNumber);
    expect(orderNumber).toMatch(/^[A-Z0-9]{15}$/);
    expect(IzipayPaymentGateway.orderNumberFor(intentInput.idempotencyKey)).toBe(orderNumber);
    expect(intent.status).toBe('requires_action');
    expect(intent.nextAction).toMatchObject({
      type: 'sdk',
      token: 'session-token',
      params: { orderNumber, amount: '149.00', currency: 'USD', merchantCode: '4007701', keyRSA: options.rsaPublicKey, urlIPN: options.ipnUrl, scriptUrl: 'https://sandbox-checkout.izipay.pe/payments/v1/js/index.js' },
    });
    const [call] = izi.calls;
    expect(call!.body).toEqual({ requestSource: 'ECOMMERCE', merchantCode: '4007701', orderNumber, publicKey: options.apiKey, amount: '149.00' });
    // El SDK debe usar el mismo transactionId con el que se generó el token.
    expect(call!.headers['transactionId']).toBe(intent.nextAction.type === 'sdk' ? intent.nextAction.params?.['transactionId'] : undefined);
    // Las claves secretas nunca salen al navegador.
    expect(JSON.stringify(intent.nextAction)).not.toContain(options.apiKey);
    expect(JSON.stringify(intent.nextAction)).not.toContain(options.hashKey);
  });

  it('confirm acepta solo respuestas del SDK firmadas con la claveHash y del mismo pedido', async () => {
    const gw = new IzipayPaymentGateway(options, clock, fakeIzipay({}).fetchFn);
    const payloadHttp = JSON.stringify(paidOrder());
    const state = await gw.confirm(orderNumber, { payloadHttp, signature: gw.sign(payloadHttp) });
    expect(state).toEqual({ providerPaymentId: orderNumber, status: 'succeeded', amount: Money.of(14_900, 'USD'), failureCode: null, failureMessage: null });

    await expect(gw.confirm(orderNumber, { payloadHttp, signature: gw.sign(`${payloadHttp} `) })).rejects.toThrow(/firma válida/);
    const other = JSON.stringify({ ...paidOrder(), response: { order: [{ ...paidOrder().response.order[0], orderNumber: 'PWOTRO000000000' }] } });
    await expect(gw.confirm(orderNumber, { payloadHttp: other, signature: gw.sign(other) })).rejects.toThrow(/otro pedido/);

    const declined = JSON.stringify({ code: 'R05', message: 'Denegada', messageUser: 'Tu banco rechazó la operación.', transactionId: '1', response: {} });
    expect(await gw.confirm(orderNumber, { payloadHttp: declined, signature: gw.sign(declined) })).toMatchObject({ status: 'failed', amount: null, failureCode: 'izipay_R05', failureMessage: 'Tu banco rechazó la operación.' });
  });

  it('confirm sin firma y getStatus consultan el pedido; «no encontrada» sigue abierto', async () => {
    let search: { status?: number; json: unknown } = { json: paidOrder() };
    const izi = fakeIzipay({ '/security/v1/Token/Generate': tokenRoute, '/orderinfo/v1/Transaction/Search': () => search });
    const gw = new IzipayPaymentGateway(options, clock, izi.fetchFn);

    expect((await gw.confirm(orderNumber, {})).status).toBe('succeeded');
    expect(izi.calls.at(-1)).toMatchObject({ body: { merchantCode: '4007701', numberOrden: orderNumber }, headers: { Authorization: 'Bearer session-token' } });

    search = { status: 400, json: { code: '400', message: 'Transacción no encontrada', response: {} } };
    expect(await gw.getStatus(orderNumber)).toMatchObject({ status: 'requires_action', amount: null });
    search = { json: { code: '021', message: 'Error de comunicación', response: {} } };
    expect((await gw.getStatus(orderNumber)).status).toBe('requires_action');
    search = { status: 500, json: { code: '500', message: 'Error interno en el servidor', response: {} } };
    await expect(gw.getStatus(orderNumber)).rejects.toBeInstanceOf(PaymentGatewayError);
  });

  it('refund usa los datos de la autorización, valida el monto y es idempotente', async () => {
    const izi = fakeIzipay({
      '/security/v1/Token/Generate': tokenRoute,
      '/orderinfo/v1/Transaction/Search': () => ({ json: paidOrder() }),
      '/refund/v1/Transaction/Refund': () => ({ json: { code: '00', message: 'La devolución fue registrada', response: { result: { refundTransactionId: '762954' } } } }),
    });
    const gw = new IzipayPaymentGateway(options, clock, izi.fetchFn);
    const input = { providerPaymentId: orderNumber, amount: Money.of(5_000, 'USD'), idempotencyKey: 'refund-p1', reason: 'late_payment' };

    const first = await gw.refund(input);
    expect(first).toEqual({ providerRefundId: 'izp_ref_762954', status: 'succeeded' });
    const refundToken = izi.calls.find((c) => c.path === '/security/v1/Token/Generate' && c.body['requestSource'] === 'REFUND');
    expect(refundToken?.body['amount']).toBe('50.00');
    expect(izi.calls.find((c) => c.path === '/refund/v1/Transaction/Refund')?.body).toEqual({
      merchantCode: '4007701',
      ruc: '20123456789',
      idUnique: '449858239',
      order: { authorizationCode: '303556', referenceNumber: '8000000', currency: 'USD', refundAmount: '50.00', totalAmount: '149.00', transactionDate: '20261101' },
      language: 'ESP',
    });
    const calls = izi.calls.length;
    expect(await gw.refund(input)).toEqual(first);
    expect(izi.calls.length).toBe(calls);

    await expect(gw.refund({ ...input, idempotencyKey: 'refund-p2', amount: Money.of(20_000, 'USD') })).rejects.toThrow(/supera/);
    await expect(gw.refund({ ...input, idempotencyKey: 'refund-p3', amount: Money.of(5_000, 'PEN') })).rejects.toThrow(/otra moneda/);
  });

  it('verifyWebhook valida la firma de la IPN y entrega solo datos para conciliar', () => {
    const gw = new IzipayPaymentGateway(options, clock, fakeIzipay({}).fetchFn);
    const payloadHttp = JSON.stringify({ ...paidOrder(), response: { ...paidOrder().response, card: { pan: '520474******1127' }, billing: { email: 'viajero@example.test' } } });
    const ipn = (signature: string) => Buffer.from(JSON.stringify({ code: '00', payloadHttp, signature, transactionId: '1762009200000123456' }));

    const event = gw.verifyWebhook(ipn(gw.sign(payloadHttp)), {});
    expect(event).toMatchObject({ eventId: '1762009200000123456:449858239', type: 'izipay.00', providerPaymentId: orderNumber, status: 'succeeded', amount: Money.of(14_900, 'USD') });
    expect(JSON.stringify(event.payload)).not.toMatch(/520474|viajero@/);

    expect(() => gw.verifyWebhook(ipn(gw.sign('otro')), {})).toThrow(InvalidWebhookSignatureError);
    expect(() => gw.verifyWebhook(Buffer.from('{"code":"00"}'), {})).toThrow(InvalidWebhookSignatureError);
    expect(() => gw.verifyWebhook(Buffer.from('no-json'), {})).toThrow(/inválido/);
  });

  it('exige credenciales completas', () => {
    expect(() => new IzipayPaymentGateway({ ...options, hashKey: 'corta' }, clock)).toThrow(/IZIPAY_HASH_KEY/);
    expect(() => new IzipayPaymentGateway({ ...options, merchantCode: '' }, clock)).toThrow(/IZIPAY_MERCHANT_CODE/);
  });
});
