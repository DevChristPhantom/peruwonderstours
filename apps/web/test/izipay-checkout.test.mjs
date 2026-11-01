import assert from 'node:assert/strict';
import test from 'node:test';
import { buyerError, holderError, izipayConfig, izipayName, izipayPlace, izipayStreet, loadIzipaySdk } from '../src/lib/payments/izipay-checkout.ts';
import { providerConfirmSchema } from '../src/lib/checkout/api-checkout.ts';
import { contentSecurityPolicy } from '../src/lib/security/content-security-policy.ts';

const holder = { documentType: 'PASAPORTE', document: 'xa1234567', street: 'Av. São João 1234', city: 'São Paulo', state: 'São Paulo', postalCode: '01310100' };
const action = {
  provider: 'izipay',
  paymentId: 'pay_1',
  token: 'session-token',
  params: {
    scriptUrl: 'https://sandbox-checkout.izipay.pe/payments/v1/js/index.js',
    keyRSA: 'rsa-public',
    transactionId: '1762009200000123456',
    merchantCode: '4007701',
    orderNumber: 'PW0A1B2C3D4E5F6',
    amount: '149.00',
    currency: 'USD',
    processType: 'AT',
    urlIPN: 'https://api.example.test/api/v1/payments/webhooks/izipay',
  },
};

test('names, places and streets are normalized to the formats Izipay accepts', () => {
  assert.equal(izipayName("José O'Brien-Núñez", 'Viajero'), 'José OBrienNúñez');
  assert.equal(izipayName('François', 'Viajero'), 'Francois');
  assert.equal(izipayName('李', 'Viajero'), 'Viajero');
  assert.equal(izipayPlace('São Paulo 2'), 'Sao Paulo');
  assert.equal(izipayStreet('Calle #5, dpto. 3 <b>'), 'Calle 5 dpto. 3 b');
});

test('holder and buyer details are validated before opening the form', () => {
  assert.equal(holderError(holder), null);
  assert.equal(holderError({ ...holder, documentType: 'DNI', document: '1234567' }), 'document');
  assert.equal(holderError({ ...holder, documentType: 'DNI', document: '12345678' }), null);
  assert.equal(holderError({ ...holder, street: 'Av' }), 'street');
  assert.equal(holderError({ ...holder, postalCode: 'SW1A1AA' }), 'postalCode');
  assert.equal(buyerError({ firstName: 'Ana', lastName: 'Silva', phone: '+55 11 91234-5678', country: 'BR' }), null);
  assert.equal(buyerError({ firstName: 'Ana', lastName: 'Silva', phone: '123', country: 'BR' }), 'phone');
  assert.equal(buyerError({ firstName: 'Ana', lastName: 'Silva', phone: '+5511912345678', country: '' }), 'country');
});

test('the SDK config reuses the API order data and only public values', () => {
  const config = izipayConfig(action, { firstName: 'Ana', lastName: 'Silva', email: 'ana@example.test', phone: '+5511912345678', country: 'BR', holder }, 'card', 'pt', 'PWT-2026-000123');
  assert.equal(config.transactionId, action.params.transactionId);
  assert.deepEqual(
    { ...config.order, dateTimeTransaction: undefined },
    { orderNumber: 'PW0A1B2C3D4E5F6', currency: 'USD', amount: '149.00', processType: 'AT', merchantBuyerId: 'PWT-2026-000123', dateTimeTransaction: undefined, payMethod: 'CARD', showAmount: true },
  );
  assert.match(config.order.dateTimeTransaction, /^\d{16}$/);
  assert.equal(config.billing.phoneNumber, '5511912345678');
  assert.equal(config.billing.city, 'Sao Paulo');
  assert.equal(config.billing.document, 'XA1234567');
  assert.deepEqual(config.render, { typeForm: 'pop-up' });
  assert.equal(config.language.init, 'ENG');
  assert.equal(izipayConfig(action, { firstName: 'Ana', lastName: 'Silva', email: '', phone: '+51987654321', country: 'PE', holder }, 'yape', 'es', 'PWT-2026-000123').order.payMethod, 'YAPE_CODE');
});

test('only the official Izipay SDK URLs are loaded', async () => {
  await assert.rejects(loadIzipaySdk('https://evil.example/index.js'), /izipay-sdk-url/);
  await assert.rejects(loadIzipaySdk('https://checkout.izipay.pe.evil.example/payments/v1/js/index.js'), /izipay-sdk-url/);
});

test('signed responses are bounded before reaching the API', () => {
  assert.equal(providerConfirmSchema.safeParse({ code: 'PWT-2026-000123', paymentId: 'pay_1', payloadHttp: '{}', signature: 'abc=' }).success, true);
  assert.equal(providerConfirmSchema.safeParse({ code: 'PWT-2026-000123', paymentId: 'pay_1' }).success, true);
  assert.equal(providerConfirmSchema.safeParse({ code: 'PWT-2026-000123', paymentId: '../x' }).success, false);
  assert.equal(providerConfirmSchema.safeParse({ code: 'PWT-2026-000123', paymentId: 'pay_1', payloadHttp: 'x'.repeat(8193) }).success, false);
});

test('the CSP opens Izipay origins only when Izipay is active', () => {
  const closed = contentSecurityPolicy('bm9uY2U=', false, true);
  assert.ok(closed.includes("frame-src 'none'"));
  assert.ok(!closed.includes('izipay'));
  const open = contentSecurityPolicy('bm9uY2U=', false, true, null, true);
  assert.ok(open.includes('frame-src https://*.izipay.pe https://*.online-metrix.net'));
  assert.match(open, /connect-src 'self' https:\/\/\*\.izipay\.pe/);
  assert.match(open, /script-src 'self' 'nonce-bm9uY2U=' 'strict-dynamic'/);
  assert.ok(open.includes("object-src 'none'") && open.includes("frame-ancestors 'none'"));
});
