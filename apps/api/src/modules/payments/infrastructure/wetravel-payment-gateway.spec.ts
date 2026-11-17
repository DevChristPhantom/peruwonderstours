import { createHmac } from 'node:crypto';
import { Money } from '../../../shared/domain/money.js';
import { FixedClock } from '../../../shared/infrastructure/system.js';
import { InvalidWebhookSignatureError, PaymentGatewayError } from '../domain/payment-gateway.js';
import { WeTravelPaymentGateway } from './wetravel-payment-gateway.js';

const clock = new FixedClock(new Date('2026-11-17T15:00:00.000Z'));
const secretBytes = Buffer.from('wetravel-test-signing-secret-32b');
const options = { environment: 'sandbox' as const, apiKey: 'refresh-token-for-tests-0123456789', webhookSecret: `whsec_${secretBytes.toString('base64')}`, webhookToleranceSeconds: 300 };
const intentInput = { paymentId: 'p1', amount: Money.of(15_050, 'PEN'), idempotencyKey: 'k-12345678', reference: 'PWT-2026-000001', description: 'Reserva PWT-2026-000001 (deposit)' };

type Call = { url: string; method: string; auth: string; body: unknown };

function fakeFetch(handler: (call: Call) => { status?: number; json: unknown }) {
  const calls: Call[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    const call = { url, method: String(init.method), auth: String((init.headers as Record<string, string>).authorization), body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined };
    calls.push(call);
    const { status = 200, json } = handler(call);
    return new Response(JSON.stringify(json), { status, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

function api(transactions: unknown[] = []) {
  return fakeFetch((call) => {
    if (call.url.endsWith('/v2/auth/tokens/access')) return { status: 201, json: { access_token: 'access-jwt' } };
    if (call.url.includes('/v2/payment_links')) return { status: 201, json: { data: { trip: { uuid: 'trip-uuid-1', url: 'https://www.wetravel.com/trips/abc' }, pricing: { price: 150.5 } } } };
    if (call.url.endsWith('/v2/transactions')) return { json: { data: transactions, pagination: {} } };
    return { status: 404, json: {} };
  });
}

describe('WeTravelPaymentGateway', () => {
  it('crea un enlace de pago con el monto exacto y la moneda, y lo reutiliza en reintentos', async () => {
    const { fn, calls } = api();
    const gw = new WeTravelPaymentGateway(options, clock, fn);
    const a = await gw.createIntent(intentInput);
    const b = await gw.createIntent(intentInput);
    expect(a).toEqual({ providerPaymentId: 'trip-uuid-1', status: 'requires_action', nextAction: { type: 'redirect', url: 'https://www.wetravel.com/trips/abc' } });
    expect(b).toEqual(a);
    expect(calls.map((c) => c.url)).toEqual(['https://api.demo.wetravel.to/v2/auth/tokens/access', 'https://api.demo.wetravel.to/v2/payment_links?publish_immediately=true']);
    expect(calls[0]!.auth).toBe(`Bearer ${options.apiKey}`);
    expect(calls[1]!.auth).toBe('Bearer access-jwt');
    expect(calls[1]!.body).toEqual({
      data: {
        trip: { title: intentInput.description, trip_id: WeTravelPaymentGateway.tripIdFor('k-12345678'), start_date: '2026-11-17', end_date: '2026-11-17', currency: 'PEN', participant_fees: 'none' },
        pricing: { price: 150.5 },
      },
    });
  });

  it('getStatus: aprobado con monto, pendiente sin transacciones y fallido si fue rechazado', async () => {
    const paid = new WeTravelPaymentGateway(options, clock, api([{ type: 'Payment', status: 'processed', amount: 15_050, customer_facing_amount: 15_050, refunded_amount: 0, currency: 'PEN' }]).fn);
    const state = await paid.getStatus('trip-uuid-1');
    expect(state.status).toBe('succeeded');
    expect(state.amount?.equals(Money.of(15_050, 'PEN'))).toBe(true);

    expect((await new WeTravelPaymentGateway(options, clock, api([]).fn).getStatus('trip-uuid-1')).status).toBe('requires_action');
    expect((await new WeTravelPaymentGateway(options, clock, api([{ type: 'Payment', status: 'failed', amount: 15_050, currency: 'PEN' }]).fn).getStatus('t')).status).toBe('failed');
  });

  it('pide un token nuevo si WeTravel responde 401 y no expone el cuerpo en errores', async () => {
    let first = true;
    const { fn, calls } = fakeFetch((call) => {
      if (call.url.endsWith('/tokens/access')) return { status: 201, json: { access_token: `jwt-${calls.length}` } };
      if (first) {
        first = false;
        return { status: 401, json: { error: 'A token is not valid.' } };
      }
      return { status: 500, json: { secret: 'x' } };
    });
    const gw = new WeTravelPaymentGateway(options, clock, fn);
    const error = await gw.getStatus('t').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PaymentGatewayError);
    expect((error as PaymentGatewayError).details).toEqual({ status: 500, path: '/v2/transactions' });
    expect(calls.filter((c) => c.url.endsWith('/tokens/access'))).toHaveLength(2);
  });

  it('verifica la firma Svix y la antigüedad del webhook, sin confiar en el estado que trae', () => {
    const gw = new WeTravelPaymentGateway(options, clock);
    const body = JSON.stringify({ type: 'payment.created', data: { trip: { uuid: 'trip-uuid-1' }, status: 'processed', amount: 1 } });
    const ts = String(Math.floor(clock.now().getTime() / 1000));
    const sign = (b: string, t = ts) => `v1,${createHmac('sha256', secretBytes).update(`msg_1.${t}.${b}`).digest('base64')}`;

    const event = gw.verifyWebhook(Buffer.from(body), { 'svix-id': 'msg_1', 'svix-timestamp': ts, 'svix-signature': `v1,AAAA ${sign(body)}` });
    expect(event).toMatchObject({ eventId: 'msg_1', type: 'payment.created', providerPaymentId: 'trip-uuid-1', status: null, amount: null });

    const reason = (fn: () => unknown) => {
      try {
        fn();
        return 'ok';
      } catch (e) {
        expect(e).toBeInstanceOf(InvalidWebhookSignatureError);
        return (e as InvalidWebhookSignatureError).details.reason;
      }
    };
    expect(reason(() => gw.verifyWebhook(Buffer.from(`${body} `), { 'svix-id': 'msg_1', 'svix-timestamp': ts, 'svix-signature': sign(body) }))).toBe('signature_mismatch');
    const old = String(Number(ts) - 3600);
    expect(reason(() => gw.verifyWebhook(Buffer.from(body), { 'svix-id': 'msg_1', 'svix-timestamp': old, 'svix-signature': sign(body, old) }))).toBe('timestamp_out_of_tolerance');
    expect(reason(() => gw.verifyWebhook(Buffer.from(body), {}))).toBe('missing_headers');
    const noSecret = new WeTravelPaymentGateway({ ...options, webhookSecret: undefined }, clock);
    expect(reason(() => noSecret.verifyWebhook(Buffer.from(body), { 'svix-id': 'msg_1', 'svix-timestamp': ts, 'svix-signature': sign(body) }))).toBe('webhook_secret_not_configured');
  });

  it('no permite reembolsos por API', async () => {
    const gw = new WeTravelPaymentGateway(options, clock);
    await expect(gw.refund({ providerPaymentId: 't', amount: Money.of(1, 'PEN'), idempotencyKey: 'r', reason: 'x' })).rejects.toThrow(/panel de WeTravel/);
  });
});
