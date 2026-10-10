import "server-only";

import legacyJson from "@seed/testimonials.json";
import { cache } from "react";

import type { Locale } from "@/i18n/routing";
import { listTestimonialsSafe } from "@/lib/api/content";
import { env } from "@/lib/env";

/**
 * Testimonios publicados (F2 / W7). Solo reales: los aprobados con consentimiento en la API y las 4
 * reseñas de TripAdvisor que el sitio viejo mostraba en su home (`data/seed/testimonials.json`), con
 * atribución visible "vía TripAdvisor". Nunca se muestran tarjetas de ejemplo: sin testimonios, la
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

interface LegacyTestimonial {
  id: string;
  authorName: string;
  title: string | null;
  text: string;
  country: string | null;
  date: string | null;
  rating: number | null;
  source: string;
  sourceProfileUrl: string | null;
  language: string;
}

/** La URL del perfil de TripAdvisor trae espacios: se codifica (site-content.json · socialLinks). */
function encodeUrl(url: string | null): string | null {
  return url ? encodeURI(decodeURI(url)) : null;
}

const legacy: PublicTestimonial[] = ((legacyJson as unknown as { testimonials: LegacyTestimonial[] }).testimonials ?? []).map((t) => ({
  id: t.id,
  author: t.authorName,
  country: t.country,
  title: t.title,
  body: t.text,
  rating: t.rating,
  date: t.date,
  lang: t.language === "en" ? "en" : "es-PE",
  source: t.source.toLowerCase() === "tripadvisor" ? "tripadvisor" : "web",
  sourceUrl: encodeUrl(t.sourceProfileUrl),
  tourTitle: null,
}));

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
    lang: t.locale === "en" ? "en" : "es-PE",
    source: "web",
    sourceUrl: null,
    tourTitle: t.tourTitle,
  }));
  // Las reseñas heredadas pueden venir ya cargadas en la API (origen legacy_site): se evita duplicarlas.
  const seen = new Set(approved.map((t) => `${t.author}|${t.body.slice(0, 40)}`));
  return [...approved, ...legacy.filter((t) => !seen.has(`${t.author}|${t.body.slice(0, 40)}`))];
});
