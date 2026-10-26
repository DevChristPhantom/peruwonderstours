import "server-only";

import type { TourOption } from "@/components/promotions/PromotionSettingsFields";
import { api, type Paged } from "@/lib/api/client";
import type { TourListItem } from "@/lib/api/types";

/** Paquetes y tours para el botón del evento (publicados primero, luego borradores). */
export async function loadTourOptions(): Promise<TourOption[]> {
  const result = await api<Paged<TourListItem>>("/admin/tours", { query: { page: 1, pageSize: 100 } });
  return result.data
    .filter((t) => t.status !== "archived")
    .map((t) => ({ id: t.id, title: t.title ?? t.slug, published: t.status === "published" }))
    .sort((a, b) => Number(b.published) - Number(a.published) || a.title.localeCompare(b.title, "es"));
}
