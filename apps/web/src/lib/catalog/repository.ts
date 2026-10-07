import type { Category, Destination, Tour, TourSummary } from "./types";

/**
 * Puerto del catálogo. Implementaciones:
 * - `seed-repository.ts`: lee `data/seed/*.json` (hoy).
 * - `api-repository.ts`: consume `GET /api/v1/...` (cuando exista el backend).
 * Cambiar de fuente = cambiar `CATALOG_SOURCE`; los componentes no se tocan.
 */
export interface CatalogRepository {
  listTours(): Promise<TourSummary[]>;
  getTour(slug: string): Promise<Tour | null>;
  listDestinations(): Promise<Destination[]>;
  getDestination(slug: string): Promise<Destination | null>;
  listCategories(): Promise<Category[]>;
  getCategory(slug: string): Promise<Category | null>;
}
