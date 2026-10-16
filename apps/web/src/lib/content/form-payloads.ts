import type { ContactInput, TestimonialInput } from '../api/content';

/** Match the API's explicit DTO allowlist after the Server Action checks consent.
 * The API freezes its configured privacy version; a client version is not accepted.
 */
export function contactPayload(input: ContactInput) {
  return {
    name: input.name, email: input.email, phone: input.phone, subject: input.subject,
    message: input.message, tourSlug: input.tourSlug, locale: input.locale,
    consentPrivacyNotice: true,
  };
}

export function testimonialPayload(input: TestimonialInput) {
  return {
    authorName: input.authorName, authorCountry: input.authorCountry, rating: input.rating,
    body: input.body, tourSlug: input.tourSlug, travelDate: input.travelDate, locale: input.locale,
    publishConsent: input.publishConsent, consentPrivacyNotice: true,
  };
}
