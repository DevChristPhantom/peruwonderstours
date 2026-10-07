import "server-only";

import { cache } from "react";

import { createApiCatalogRepository } from "./api-repository";
import type { CatalogRepository } from "./repository";
import { matchesQuery } from "./rules";
import { seedCatalogRepository } from "./seed-repository";
import type {
  Destination,
  NavMedia,
  SearchOption,
  Tour,
  TourFilters,
  TourSummary,
} from "./types";

export type * from "./types";

/**
 * Fachada del catálogo (solo servidor). Fuente según `CATALOG_SOURCE`:
 * - `seed` (por defecto): data/seed/*.json
 * - `api`: `${API_BASE_URL}/api/v1`
 */
function selectRepository(): CatalogRepository {
  if (process.env.CATALOG_SOURCE === "api" && process.env.API_BASE_URL) {
    return createApiCatalogRepository(process.env.API_BASE_URL);
  }
  return seedCatalogRepository;
}

const repo = selectRepository();

/** Orden editorial de destinos (home.md §5). Slugs del sitio viejo. */
const DESTINATION_ORDER = ["tours-en-puno", "cuzco", "tours-en-arequipa", "tours-en-ica-paracas", "tours-en-lima"];

export const getAllTours = cache(() => repo.listTours());
export const getTour = cache((slug: string) => repo.getTour(slug));
export const getCategories = cache(() => repo.listCategories());
export const getCategory = cache((slug: string) => repo.getCategory(slug));
export const getDestination = cache((slug: string) => repo.getDestination(slug));

export const getDestinations = cache(async (): Promise<Destination[]> => {
  const list = await repo.listDestinations();
  const rank = (slug: string) => {
    const i = DESTINATION_ORDER.indexOf(slug);
    return i === -1 ? DESTINATION_ORDER.length : i;
  };
  return [...list].sort((a, b) => rank(a.slug) - rank(b.slug));
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

export async function getToursBySlugs(slugs: readonly string[]): Promise<TourSummary[]> {
  const all = await getAllTours();
  const bySlug = new Map(all.map((t) => [t.slug, t]));
  return slugs.map((s) => bySlug.get(s)).filter((t): t is TourSummary => !!t);
}

/** Destacados para la home: multidía primero (paquetes), luego full days. */
export async function getFeaturedTours(limit = 6): Promise<TourSummary[]> {
  const all = await getAllTours();
  return all
    .filter((t) => t.featured)
    .sort((a, b) => (b.durationDays ?? 0) - (a.durationDays ?? 0))
    .slice(0, limit);
}

export async function getRelatedTours(tour: Tour, limit = 3): Promise<TourSummary[]> {
  const all = await getAllTours();
  return all
    .filter((t) => t.slug !== tour.slug)
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
export const getSearchOptions = cache(async (): Promise<SearchOption[]> => {
  const [destinations, categories, tours] = await Promise.all([
    getDestinations(),
    getCategories(),
    getAllTours(),
  ]);
  return [
    ...destinations.map<SearchOption>((d) => ({
      kind: "destination",
      value: d.slug,
      label: d.name,
      hint: `Destino · ${d.tourCount} tours`,
      href: `/es/tours?destino=${d.slug}`,
    })),
    ...categories.map<SearchOption>((c) => ({
      kind: "category",
      value: c.slug,
      label: c.name,
      hint: `Categoría · ${c.tourCount} tours`,
      href: `/es/tours?categoria=${c.slug}`,
    })),
    ...tours.map<SearchOption>((t) => ({
      kind: "tour",
      value: t.slug,
      label: t.shortTitle,
      hint: `Tour · ${t.destinationNames.join(", ") || "Varios destinos"}`,
      href: t.path,
    })),
  ];
});

/**
 * Contenido e imágenes del header/hero. Fotos del cliente tomadas de tours concretos del seed.
 * TODO(UX): reemplazar por fotos elegidas por el cliente (alt descriptivo verificado).
 */
export const getNavMedia = cache(async (): Promise<NavMedia> => {
  const [tours, destinations] = await Promise.all([getAllTours(), getDestinations()]);
  const img = (slug: string, alt: string) => {
    const t = tours.find((x) => x.slug === slug);
    return t?.image ? { src: t.image.src, alt } : null;
  };
  const puno = destinations.find((d) => d.slug === "tours-en-puno");
  return {
    heroImage: puno?.bannerImage
      ? { src: puno.bannerImage.src, alt: "Paisaje de Puno y el lago Titicaca" }
      : img("tour-islas-de-los-uros-y-taquile-full-day", "Lago Titicaca, Puno"),
    discover: [
      {
        key: "titicaca",
        title: "Lago Titicaca",
        description: "Islas flotantes de los Uros, Taquile y Amantaní",
        href: "/es/destinos/tours-en-puno",
        image: img("tour-islas-de-los-uros-y-taquile-full-day", ""),
      },
      {
        key: "machu-picchu",
        title: "Machu Picchu",
        description: "La ciudadela inca, en tren o por el Camino Inca",
        href: "/es/categorias/tours-a-machu-picchu",
        image: img("full-day-machu-picchu-esencia-ciudadela", ""),
      },
      {
        key: "colca",
        title: "Cañón del Colca",
        description: "Cóndores y miradores a 3 000 m de profundidad",
        href: "/es/tours?q=colca",
        image: img("tour-full-day-canon-del-colca", ""),
      },
      {
        key: "paracas",
        title: "Huacachina y Paracas",
        description: "Dunas, oasis e islas Ballestas",
        href: "/es/destinos/tours-en-ica-paracas",
        image: img("peru-especial-la-esencia-del-sur-y-costa-14-dias-13-noches", ""),
      },
    ],
    journeys: [
      {
        key: "grupo",
        title: "Tours en grupo",
        href: "/es/categorias/full-days",
        image: img("valle-sagrado-incas", ""),
      },
      {
        key: "privados",
        title: "Viajes privados",
        href: "/es/tours?q=privado",
        image: img("tour-privado-puerta-interdimensional-de-aramu-muru", ""),
      },
    ],
    regions: [
      { key: "cusco", label: "Cusco", href: "/es/destinos/cuzco" },
      { key: "puno", label: "Puno", href: "/es/destinos/tours-en-puno" },
      { key: "arequipa", label: "Arequipa", href: "/es/destinos/tours-en-arequipa" },
      { key: "ica", label: "Ica-Paracas", href: "/es/destinos/tours-en-ica-paracas" },
      { key: "lima", label: "Lima", href: "/es/destinos/tours-en-lima" },
    ],
  };
});
