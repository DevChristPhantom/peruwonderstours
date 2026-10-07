import { Money } from '../../../shared/domain/money.js';
import { FixedClock } from '../../../shared/infrastructure/system.js';
import { InvalidWebhookSignatureError } from '../domain/payment-gateway.js';
import { SandboxPaymentGateway, StaticPaymentGatewayRegistry } from './sandbox-payment-gateway.js';

const clock = new FixedClock(new Date('2026-10-07T15:00:00.000Z'));
const options = { webhookSecret: 'sandbox-test-secret-0123456789', checkoutBaseUrl: 'http://localhost/checkout/', webhookToleranceSeconds: 300 };
const intentInput = { paymentId: 'p1', amount: Money.of(5_000, 'USD'), idempotencyKey: 'k-12345678', reference: 'PWT-2026-000001', description: 'test' };

describe('SandboxPaymentGateway', () => {
  it('createIntent es idempotente por clave y rechaza otro monto con la misma clave', async () => {
    const gw = new SandboxPaymentGateway(options, clock);
    const a = await gw.createIntent(intentInput);
    const b = await gw.createIntent(intentInput);
    expect(a.providerPaymentId).toBe(b.providerPaymentId);
    expect(a.nextAction).toEqual({ type: 'redirect', url: `http://localhost/checkout/${a.providerPaymentId}` });
    await expect(gw.createIntent({ ...intentInput, amount: Money.of(1, 'USD') })).rejects.toThrow(/otro monto/);
  });

  it('confirm aprueba o rechaza; refund solo sobre aprobados y es idempotente', async () => {
    const gw = new SandboxPaymentGateway(options, clock);
    const ok = await gw.createIntent(intentInput);
    const ko = await gw.createIntent({ ...intentInput, idempotencyKey: 'k-87654321' });
    expect((await gw.confirm(ok.providerPaymentId, {})).status).toBe('succeeded');
    expect((await gw.confirm(ko.providerPaymentId, { simulate: 'fail' })).failureCode).toBe('card_declined');
    expect((await gw.getStatus(ko.providerPaymentId)).status).toBe('failed');
    await expect(gw.refund({ providerPaymentId: ko.providerPaymentId, amount: Money.of(1, 'USD'), idempotencyKey: 'r1', reason: 'x' })).rejects.toThrow(/aprobados/);
    const r1 = await gw.refund({ providerPaymentId: ok.providerPaymentId, amount: Money.of(5_000, 'USD'), idempotencyKey: 'r2', reason: 'x' });
    const r2 = await gw.refund({ providerPaymentId: ok.providerPaymentId, amount: Money.of(5_000, 'USD'), idempotencyKey: 'r2', reason: 'x' });
    expect(r1).toEqual(r2);
    await expect(gw.confirm('desconocido', {})).rejects.toThrow(/desconocido/);
  });

  it('verifica HMAC, antigüedad y formato del webhook', () => {
    const gw = new SandboxPaymentGateway(options, clock);
    const body = JSON.stringify({ id: 'evt_1', type: 'payment.succeeded', data: { providerPaymentId: 'sbx_1', status: 'succeeded', amount: 5000, currency: 'USD' } });
    const event = gw.verifyWebhook(Buffer.from(body), { 'x-sandbox-signature': gw.signWebhook(body) });
    expect(event).toMatchObject({ eventId: 'evt_1', providerPaymentId: 'sbx_1', status: 'succeeded' });
    expect(event.amount?.amount).toBe(5_000n);
    const reason = (fn: () => unknown) => {
      try {
        fn();
      } catch (e) {
        expect(e).toBeInstanceOf(InvalidWebhookSignatureError);
        return (e as InvalidWebhookSignatureError).details['reason'];
      }
      return 'no-error';
    };
    expect(reason(() => gw.verifyWebhook(Buffer.from(body), {}))).toBe('missing_signature');
    expect(reason(() => gw.verifyWebhook(Buffer.from(body), { 'x-sandbox-signature': 'basura' }))).toBe('malformed_signature');
    expect(reason(() => gw.verifyWebhook(Buffer.from(`${body} `), { 'x-sandbox-signature': gw.signWebhook(body) }))).toBe('signature_mismatch');
    const old = gw.signWebhook(body, Math.floor(clock.now().getTime() / 1000) - 301);
    expect(reason(() => gw.verifyWebhook(Buffer.from(body), { 'x-sandbox-signature': old }))).toBe('timestamp_out_of_tolerance');
    const other = new SandboxPaymentGateway({ ...options, webhookSecret: 'otro-secreto-0123456789' }, clock);
    expect(reason(() => gw.verifyWebhook(Buffer.from(body), { 'x-sandbox-signature': other.signWebhook(body) }))).toBe('signature_mismatch');
    const bad = '{"type":"x"}';
    expect(() => gw.verifyWebhook(Buffer.from(bad), { 'x-sandbox-signature': gw.signWebhook(bad) })).toThrow(/sin id/);
  });

  it('exige un secreto de al menos 16 caracteres; el registro resuelve por proveedor', () => {
    expect(() => new SandboxPaymentGateway({ ...options, webhookSecret: 'corto' }, clock)).toThrow(/16/);
    const gw = new SandboxPaymentGateway(options, clock);
    const registry = new StaticPaymentGatewayRegistry([gw], gw);
    expect(registry.get('sandbox')).toBe(gw);
    expect(() => registry.get('izipay')).toThrow(/no configurado/);
  });
});
