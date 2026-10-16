import assert from 'node:assert/strict';
import test from 'node:test';
import { contactPayload, testimonialPayload } from '../src/lib/content/form-payloads.ts';

test('contact forwards accepted consent with only API-supported fields', () => {
  const body = contactPayload({ name: 'Visitor', email: 'visitor@example.test', phone: null,
    subject: 'Tour dates', message: 'Please confirm tour dates.', tourSlug: null, locale: 'es', privacyNoticeVersion: 'client-version' });
  assert.equal(body.consentPrivacyNotice, true);
  assert.equal(body.message, 'Please confirm tour dates.');
  assert.equal(body.email, 'visitor@example.test');
  assert.equal('privacyNoticeVersion' in body, false);
  assert.deepEqual(Object.keys(body).sort(), ['name','email','phone','subject','message','tourSlug','locale','consentPrivacyNotice'].sort());
});

test('testimonial explicitly carries both consents without unsupported email or version', () => {
  const body = testimonialPayload({ authorName: 'Visitor', authorCountry: 'PE', email: 'private@example.test',
    rating: 5, body: 'A memorable visit to the lake.', tourSlug: null, travelDate: null, locale: 'en',
    publishConsent: true, privacyNoticeVersion: 'client-version' });
  assert.equal(body.consentPrivacyNotice, true);
  assert.equal(body.publishConsent, true);
  assert.equal(body.authorName, 'Visitor');
  assert.equal('email' in body, false);
  assert.equal('privacyNoticeVersion' in body, false);
  assert.deepEqual(Object.keys(body).sort(), ['authorName','authorCountry','rating','body','tourSlug','travelDate','locale','publishConsent','consentPrivacyNotice'].sort());
});
