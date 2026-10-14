"use server";

import { z } from "zod";

import { isLocale, type Locale } from "@/i18n/routing";
import { ApiError } from "@/lib/api/client";
import { PRIVACY_NOTICE_VERSION, submitContact, submitTestimonial } from "@/lib/api/content";

import type { FormState } from "./form-state";
import { contactSchema, testimonialSchema } from './form-schemas';

/**
 * Server Actions de los formularios públicos (F2 testimonio, F3 contacto). Validan con Zod en el
 * servidor y reenvían a la API; el navegador solo recibe un estado sin datos personales.
 */

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
  // El adaptador transmite el consentimiento validado; la API registra su versión del aviso.
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
