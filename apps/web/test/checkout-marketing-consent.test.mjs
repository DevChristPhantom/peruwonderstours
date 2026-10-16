import assert from 'node:assert/strict';
import test from 'node:test';
import { placeInputSchema } from '../src/lib/checkout/api-checkout.ts';

const request = {
  option: 'full', method: 'card', simulate: 'approved',
  contact: { firstName: 'Ana', lastName: 'Silva', email: 'ana@example.test', country: 'Brasil' },
  acceptTerms: true, acceptPrivacy: true, expectedTotalCents: 10000,
};

test('checkout retains explicit marketing choices separately without implicit enrollment', () => {
  const none = placeInputSchema.parse(request).contact;
  assert.equal(none.marketingEmail, false);
  assert.equal(none.marketingWhatsapp, false);
  const email = placeInputSchema.parse({ ...request, contact: { ...request.contact, marketingEmail: true, marketingWhatsapp: false } }).contact;
  assert.equal(email.marketingEmail, true);
  assert.equal(email.marketingWhatsapp, false);
  const whatsapp = placeInputSchema.parse({ ...request, contact: { ...request.contact, marketingEmail: false, marketingWhatsapp: true } }).contact;
  assert.equal(whatsapp.marketingEmail, false);
  assert.equal(whatsapp.marketingWhatsapp, true);
  assert.equal(placeInputSchema.safeParse({ ...request, contact: { ...request.contact, marketingEmail: 'true' } }).success, false);
});
