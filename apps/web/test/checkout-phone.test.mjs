import assert from 'node:assert/strict';
import test from 'node:test';
import { checkoutPhoneE164, placeInputSchema } from '../src/lib/checkout/api-checkout.ts';

test('Peru and Brazil dial codes preserve complete international phone numbers', () => {
  assert.equal(checkoutPhoneE164('+51', '924 278 597'), '+51924278597');
  assert.equal(checkoutPhoneE164('+55', '(11) 99999-0001'), '+5511999990001');
});
test('checkout payload validates the phone before forwarding to the API', () => {
  const phone = placeInputSchema.shape.contact.shape.phone;
  assert.equal(phone.safeParse('+51924278597').success, true);
  assert.equal(phone.safeParse('924278597').success, false);
  assert.equal(phone.safeParse('+').success, false);
  assert.equal(phone.safeParse('+55abc').success, false);
});
