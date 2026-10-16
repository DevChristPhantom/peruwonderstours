import { z } from 'zod';

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
export const contactSchema = z.object({
  name: text(2, 120), email: z.email().trim().max(254),
  phone: z.string().trim().max(20).regex(/^(?:\+?[0-9 ()-]{6,20})?$/).transform((value) => value || null),
  subject: text(3, 150), message: text(10, 4000), privacy: z.literal('on'),
});
export const testimonialSchema = z.object({
  authorName: text(2, 80),
  authorCountry: z.string().trim().toUpperCase().regex(/^(?:[A-Z]{2})?$/).transform((value) => value || null),
  email: z.email().trim().max(254), rating: z.coerce.number().int().min(1).max(5),
  body: text(20, 2000),
  travelDate: z.string().trim().regex(/^(\d{4}-\d{2}-\d{2})?$/).transform((value) => value || null),
  publishConsent: z.literal('on'), privacy: z.literal('on'),
});
