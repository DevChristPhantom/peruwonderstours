import assert from 'node:assert/strict';
import test from 'node:test';
import { contactSchema, testimonialSchema } from '../src/lib/content/form-schemas.ts';

const contact = { name: 'Visitor', email: 'visitor@example.test', phone: '', subject: 'Dates', message: 'Please confirm tour dates.', privacy: 'on' };
const review = { authorName: 'Visitor', authorCountry: 'pe', email: 'visitor@example.test', rating: '5', body: 'A memorable visit to the lake.', travelDate: '', publishConsent: 'on', privacy: 'on' };
test('contact rejects subjects outside API limits before sending, with optional phone retained', () => {
  assert.equal(contactSchema.safeParse({ ...contact, subject: 'a'.repeat(150) }).success, true);
  assert.equal(contactSchema.safeParse({ ...contact, subject: 'a'.repeat(151) }).success, false);
  assert.equal(contactSchema.safeParse({ ...contact, subject: 'ab' }).success, false);
  assert.equal(contactSchema.parse(contact).phone, null);
  assert.equal(contactSchema.safeParse({ ...contact, message: 'Short' }).success, false);
});
test('review accepts ISO country codes and rejects too-short text before API validation', () => {
  assert.equal(testimonialSchema.parse(review).authorCountry, 'PE');
  assert.equal(testimonialSchema.parse({ ...review, authorCountry: '' }).authorCountry, null);
  assert.equal(testimonialSchema.safeParse({ ...review, authorCountry: 'Peru' }).success, false);
  assert.equal(testimonialSchema.safeParse({ ...review, body: 'a'.repeat(19) }).success, false);
  assert.equal(testimonialSchema.safeParse({ ...review, body: 'a'.repeat(20) }).success, true);
  assert.equal(testimonialSchema.safeParse({ ...review, publishConsent: '' }).success, false);
  assert.equal(testimonialSchema.safeParse({ ...review, privacy: '' }).success, false);
});
