import "server-only";

import type { CatalogRepository } from "./repository";
import type { Category, Destination, Tour, TourSummary } from "./types";

/**
 * Adaptador para el backend NestJS (`apps/api`, `/api/v1`).
 * Supone que la API responde JSON camelCase con la misma forma que `./types`
 * (contrato a cerrar con backend-senior; si difiere, solo se ajusta el mapeo aquí).
 * Caché: ISR por tag `catalog` (revalidar con `revalidateTag('catalog', 'max')` desde el backoffice).
 */
const REVALIDATE_SECONDS = 3600;

async function getJson<T>(baseUrl: string, path: string): Promise<T | null> {
  const res = await fetch(`${baseUrl}/api/v1${path}`, {
    headers: { accept: "application/json", "accept-language": "es-PE" },
    next: { revalidate: REVALIDATE_SECONDS, tags: ["catalog"] },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Catálogo: ${res.status} en ${path}`);
  return (await res.json()) as T;
}

interface ListResponse<T> {
  data: T[];
}

export function createApiCatalogRepository(baseUrl: string): CatalogRepository {
  const base = baseUrl.replace(/\/$/, "");
  return {
    async listTours() {
      const res = await getJson<ListResponse<TourSummary>>(base, "/tours?locale=es&limit=500");
      return res?.data ?? [];
    },
    getTour: (slug) => getJson<Tour>(base, `/tours/${encodeURIComponent(slug)}?locale=es`),
    async listDestinations() {
      const res = await getJson<ListResponse<Destination>>(base, "/destinations?locale=es");
      return res?.data ?? [];
    },
    getDestination: (slug) => getJson<Destination>(base, `/destinations/${encodeURIComponent(slug)}?locale=es`),
    async listCategories() {
      const res = await getJson<ListResponse<Category>>(base, "/categories?locale=es");
      return res?.data ?? [];
    },
    getCategory: (slug) => getJson<Category>(base, `/categories/${encodeURIComponent(slug)}?locale=es`),
  };
}
