import type { Locale } from "@/i18n/routing";

import type { Category, Destination, Tour, TourSummary } from "./types";

/**
 * Puerto del catálogo. Implementaciones:
 * - `seed-repository.ts`: lee `data/seed/*.json` (y `data/seed/en/` si existe).
 * - `api-repository.ts`: consume `GET /api/v1/...` con `locale` y `fallback`.
 * Cambiar de fuente = cambiar `CATALOG_SOURCE`; los componentes no se tocan.
 *
 * Los `get*` aceptan el slug de CUALQUIER idioma (o la clave en español): así un enlace con el slug
 * de otro idioma (carrito, favoritos, selector de idioma) se resuelve y la página redirige al slug
 * correcto del idioma pedido.
 */
export interface CatalogRepository {
  listTours(locale: Locale): Promise<TourSummary[]>;
  getTour(slug: string, locale: Locale): Promise<Tour | null>;
  listDestinations(locale: Locale): Promise<Destination[]>;
  getDestination(slug: string, locale: Locale): Promise<Destination | null>;
  listCategories(locale: Locale): Promise<Category[]>;
  getCategory(slug: string, locale: Locale): Promise<Category | null>;
}
