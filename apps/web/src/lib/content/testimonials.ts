import "server-only";


import { cache } from "react";

import { INTL_LOCALE, type Locale } from "@/i18n/routing";
import { listTestimonialsSafe } from "@/lib/api/content";
import { env } from "@/lib/env";

/**
 * Testimonios publicados: solo los aprobados con consentimiento en la API.
 * Las reseñas anteriores permanecen archivadas en data/seed/testimonials.json.
 * No se renombra texto de viajeros. Sin testimonios, la
 * sección se oculta.
 */
export interface PublicTestimonial {
  id: string;
  author: string;
  country: string | null;
  title: string | null;
  body: string;
  rating: number | null;
  date: string | null;
  /** Idioma original del texto (se marca con `lang`). */
  lang: string;
  source: "web" | "tripadvisor";
  sourceUrl: string | null;
  tourTitle: string | null;
}

export const getTestimonials = cache(async (locale: Locale): Promise<PublicTestimonial[]> => {
  const fromApi = env.CATALOG_SOURCE === "api" ? await listTestimonialsSafe(locale) : [];
  const approved: PublicTestimonial[] = fromApi.map((t) => ({
    id: t.id,
    author: t.authorName,
    country: t.authorCountry,
    title: null,
    body: t.body,
    rating: t.rating,
    date: t.travelDate,
    lang: INTL_LOCALE[t.locale],
    source: "web",
    sourceUrl: null,
    tourTitle: t.tourTitle,
  }));
  return approved;
});
