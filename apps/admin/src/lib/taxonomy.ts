import type { TaxonomyKind } from "@/lib/api/content-types";
import type { MediaFolder } from "@/lib/content";

/** Destinos y categorías comparten contrato: solo cambian rutas y textos. */
export interface TaxonomyConfig {
  kind: TaxonomyKind;
  /** Ruta del panel. */
  route: "/destinos" | "/categorias";
  /** Ruta de la API (bajo `/admin`). */
  apiPath: "/admin/destinations" | "/admin/categories";
  folder: MediaFolder;
  plural: string;
  singular: string;
  /** "el destino" / "la categoría". */
  article: string;
  newLabel: string;
}

export const TAXONOMY: Record<TaxonomyKind, TaxonomyConfig> = {
  destination: {
    kind: "destination",
    route: "/destinos",
    apiPath: "/admin/destinations",
    folder: "destinations",
    plural: "Destinos",
    singular: "Destino",
    article: "el destino",
    newLabel: "Nuevo destino",
  },
  category: {
    kind: "category",
    route: "/categorias",
    apiPath: "/admin/categories",
    folder: "categories",
    plural: "Categorías",
    singular: "Categoría",
    article: "la categoría",
    newLabel: "Nueva categoría",
  },
};

export function taxonomyConfig(kind: string): TaxonomyConfig {
  if (kind !== "destination" && kind !== "category") throw new Error("Tipo de taxonomía inválido");
  return TAXONOMY[kind];
}

export const UUID_RE = /^[0-9a-f-]{36}$/i;
