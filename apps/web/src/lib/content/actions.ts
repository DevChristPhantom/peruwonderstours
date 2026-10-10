"use server";

import { z } from "zod";

import { isLocale, type Locale } from "@/i18n/routing";
import { ApiError } from "@/lib/api/client";
import { PRIVACY_NOTICE_VERSION, submitContact, submitTestimonial } from "@/lib/api/content";

import type { FormState } from "./form-state";

/**
 * Server Actions de los formularios públicos (F2 testimonio, F3 contacto). Validan con Zod en el
 * servidor y reenvían a la API; el navegador solo recibe un estado sin datos personales.
 */

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

const contactSchema = z.object({
  name: text(120),
  email: z.email().trim().max(254),
  phone: optionalText(40),
  subject: text(160),
  message: text(4000),
  privacy: z.literal("on"),
});

const testimonialSchema = z.object({
  authorName: text(80),
  authorCountry: optionalText(80),
  email: z.email().trim().max(254),
  rating: z.coerce.number().int().min(1).max(5),
  body: text(2000),
  travelDate: z
    .string()
    .trim()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/)
    .transform((v) => v || null),
  publishConsent: z.literal("on"),
  privacy: z.literal("on"),
});

function localeOf(formData: FormData): Locale {
  const value = formData.get("locale");
  return isLocale(value) ? value : "es";
}

/** Campos (por nombre) con error, para marcarlos en el formulario. */
function fieldErrors(error: z.ZodError): string[] {
  return [...new Set(error.issues.map((i) => String(i.path[0])))];
}

function failure(error: unknown): FormState {
  if (error instanceof ApiError && (error.status === 429 || error.code === "too-many-requests")) return { status: "busy" };
  if (error instanceof ApiError && error.status === 400) return { status: "invalid", fields: [] };
  return { status: "unavailable" };
}

export async function submitContactAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "invalid", fields: fieldErrors(parsed.error) };
  // Los consentimientos se validan aquí; a la API solo viaja la versión del aviso aceptado.
  const { name, email, phone, subject, message } = parsed.data;
  try {
    await submitContact({ name, email, phone, subject, message, tourSlug: null, locale: localeOf(formData), privacyNoticeVersion: PRIVACY_NOTICE_VERSION });
    return { status: "success" };
  } catch (error) {
    return failure(error);
  }
}

export async function submitTestimonialAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = testimonialSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "invalid", fields: fieldErrors(parsed.error) };
  const { authorName, authorCountry, email, rating, body, travelDate } = parsed.data;
  try {
    await submitTestimonial({
      authorName,
      authorCountry,
      email,
      rating,
      body,
      travelDate,
      tourSlug: null,
      locale: localeOf(formData),
      publishConsent: true,
      privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
    });
    return { status: "success" };
  } catch (error) {
    return failure(error);
  }
}
