import "server-only";

import { getTranslations } from "next-intl/server";
import { cache } from "react";

import type { Locale } from "@/i18n/routing";
import { categoryPath, destinationPath, toursSearchPath } from "@/i18n/paths";
import { env } from "@/lib/env";

import { createApiCatalogRepository } from "./api-repository";
import type { CatalogRepository } from "./repository";
import { matchesQuery } from "./rules";
import { seedCatalogRepository } from "./seed-repository";
import type { Destination, NavMedia, SearchOption, Tour, TourFilters, TourSummary } from "./types";

export type * from "./types";

/**
 * Fachada del catálogo (solo servidor), por idioma. Fuente según `CATALOG_SOURCE` (lib/env.ts):
 * - `api` (por defecto): `${API_BASE_URL}` con ISR por tag `catalog` y degradación al seed si la API cae.
 * - `seed`: data/seed/*.json (demo sin backend).
 */
function selectRepository(): CatalogRepository {
  return env.CATALOG_SOURCE === "api" ? createApiCatalogRepository() : seedCatalogRepository;
}

const repo = selectRepository();

/** Orden editorial de destinos (home.md §5). Claves (slugs en español del sitio viejo). */
const DESTINATION_ORDER = ["tours-en-puno", "cuzco", "tours-en-arequipa", "tours-en-ica-paracas", "tours-en-lima"];

export const getAllTours = cache((locale: Locale) => repo.listTours(locale));
export const getTour = cache((slug: string, locale: Locale) => repo.getTour(slug, locale));
export const getCategories = cache((locale: Locale) => repo.listCategories(locale));
export const getCategory = cache((slug: string, locale: Locale) => repo.getCategory(slug, locale));
export const getDestination = cache((slug: string, locale: Locale) => repo.getDestination(slug, locale));

export const getDestinations = cache(async (locale: Locale): Promise<Destination[]> => {
  const list = await repo.listDestinations(locale);
  const rank = (key: string) => {
    const i = DESTINATION_ORDER.indexOf(key);
    return i === -1 ? DESTINATION_ORDER.length : i;
  };
  return [...list].sort((a, b) => rank(a.key) - rank(b.key));
});

/** Filtro de listado (HU-1.1). Puro y síncrono sobre resúmenes ya cargados. */
export function filterTours(tours: TourSummary[], filters: TourFilters): TourSummary[] {
  return tours.filter((t) => {
    if (filters.destination && !t.destinationSlugs.includes(filters.destination)) return false;
    if (filters.category && !t.categorySlugs.includes(filters.category)) return false;
    if (filters.duration && t.durationBucket !== filters.duration) return false;
    if (filters.q && !matchesQuery(`${t.title} ${t.excerpt} ${t.destinationNames.join(" ")}`, filters.q)) {
      return false;
    }
    return true;
  });
}

/** Tours por clave (slug en español) o por slug del idioma. */
export async function getToursBySlugs(slugs: readonly string[], locale: Locale): Promise<TourSummary[]> {
  const all = await getAllTours(locale);
  const byKey = new Map<string, TourSummary>();
  for (const t of all) {
    byKey.set(t.key, t);
    byKey.set(t.slug, t);
  }
  return slugs.map((s) => byKey.get(s)).filter((t): t is TourSummary => !!t);
}

/** Destacados para la home: multidía primero (paquetes), luego full days. */
export async function getFeaturedTours(locale: Locale, limit = 6): Promise<TourSummary[]> {
  const all = await getAllTours(locale);
  return all
    .filter((t) => t.featured)
    .sort((a, b) => (b.durationDays ?? 0) - (a.durationDays ?? 0))
    .slice(0, limit);
}

export async function getRelatedTours(tour: Tour, locale: Locale, limit = 3): Promise<TourSummary[]> {
  const all = await getAllTours(locale);
  return all
    .filter((t) => t.key !== tour.key)
    .map((t) => ({
      t,
      score:
        t.destinationSlugs.filter((d) => tour.destinationSlugs.includes(d)).length * 2 +
        t.categorySlugs.filter((c) => tour.categorySlugs.includes(c)).length,
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.t);
}

/** Opciones del combobox del buscador (destinos, categorías y tours). */
export const getSearchOptions = cache(async (locale: Locale): Promise<SearchOption[]> => {
  const [destinations, categories, tours, t] = await Promise.all([
    getDestinations(locale),
    getCategories(locale),
    getAllTours(locale),
    getTranslations({ locale, namespace: "search.hints" }),
  ]);
  return [
    ...destinations.map<SearchOption>((d) => ({
      kind: "destination",
      value: d.key,
      label: d.name,
      hint: t("destination", { count: d.tourCount }),
      href: toursSearchPath(locale, { destino: d.key }),
    })),
    ...categories.map<SearchOption>((c) => ({
      kind: "category",
      value: c.key,
      label: c.name,
      hint: t("category", { count: c.tourCount }),
      href: toursSearchPath(locale, { categoria: c.key }),
    })),
    ...tours.map<SearchOption>((tour) => ({
      kind: "tour",
      value: tour.key,
      label: tour.shortTitle,
      hint: t("tour", { places: tour.destinationNames.join(", ") || t("severalDestinations") }),
      href: tour.path,
    })),
  ];
});

/**
 * Contenido e imágenes del header/hero. Fotos del cliente tomadas de tours concretos del seed.
 * TODO(UX): reemplazar por fotos elegidas por el cliente (alt descriptivo verificado).
 */
export const getNavMedia = cache(async (locale: Locale): Promise<NavMedia> => {
  const [tours, destinations, t] = await Promise.all([
    getAllTours(locale),
    getDestinations(locale),
    getTranslations({ locale, namespace: "nav.media" }),
  ]);
  const img = (key: string, alt: string) => {
    const tour = tours.find((x) => x.key === key);
    return tour?.image ? { src: tour.image.src, alt } : null;
  };
  const dest = (key: string) => destinations.find((d) => d.key === key)?.path ?? destinationPath(locale, key);
  const cat = (key: string) => categoryPath(locale, key);
  const puno = destinations.find((d) => d.key === "tours-en-puno");
  return {
    heroImage: puno?.bannerImage
      ? { src: puno.bannerImage.src, alt: t("heroAlt") }
      : img("tour-islas-de-los-uros-y-taquile-full-day", t("heroAltFallback")),
    discover: [
      {
        key: "titicaca",
        title: t("discover.titicaca.title"),
        description: t("discover.titicaca.description"),
        href: dest("tours-en-puno"),
        image: img("tour-islas-de-los-uros-y-taquile-full-day", ""),
      },
      {
        key: "machu-picchu",
        title: t("discover.machuPicchu.title"),
        description: t("discover.machuPicchu.description"),
        href: cat("tours-a-machu-picchu"),
        image: img("full-day-machu-picchu-esencia-ciudadela", ""),
      },
      {
        key: "colca",
        title: t("discover.colca.title"),
        description: t("discover.colca.description"),
        href: toursSearchPath(locale, { q: "colca" }),
        image: img("tour-full-day-canon-del-colca", ""),
      },
      {
        key: "paracas",
        title: t("discover.paracas.title"),
        description: t("discover.paracas.description"),
        href: dest("tours-en-ica-paracas"),
        image: img("peru-especial-la-esencia-del-sur-y-costa-14-dias-13-noches", ""),
      },
    ],
    journeys: [
      {
        key: "grupo",
        title: t("journeys.group"),
        href: cat("full-days"),
        image: img("valle-sagrado-incas", ""),
      },
      {
        key: "privados",
        title: t("journeys.private"),
        href: toursSearchPath(locale, { q: locale === "en" ? "private" : "privado" }),
        image: img("tour-privado-puerta-interdimensional-de-aramu-muru", ""),
      },
    ],
    regions: [
      { key: "cusco", label: "Cusco", href: dest("cuzco") },
      { key: "puno", label: "Puno", href: dest("tours-en-puno") },
      { key: "arequipa", label: "Arequipa", href: dest("tours-en-arequipa") },
      { key: "ica", label: "Ica-Paracas", href: dest("tours-en-ica-paracas") },
      { key: "lima", label: "Lima", href: dest("tours-en-lima") },
    ],
  };
});
