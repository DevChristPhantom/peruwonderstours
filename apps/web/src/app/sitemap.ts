import type { MetadataRoute } from "next";

import { getAllTours, getCategories, getDestinations } from "@/lib/catalog";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 3600;

/** Sitemap propio (HU-0.4). Solo es-PE por ahora; `en` se agrega con E10. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [tours, destinations, categories] = await Promise.all([getAllTours(), getDestinations(), getCategories()]);
  const entry = (path: string, priority: number, changeFrequency: "daily" | "weekly" | "monthly" = "weekly") => ({
    url: absoluteUrl(path),
    changeFrequency,
    priority,
    alternates: { languages: { "es-PE": absoluteUrl(path) } },
  });
  return [
    entry("/es", 1, "daily"),
    entry("/es/tours", 0.9, "daily"),
    entry("/es/destinos", 0.8),
    ...destinations.map((d) => entry(d.path, 0.8)),
    ...categories.map((c) => entry(c.path, 0.7)),
    ...tours.map((t) => entry(t.path, 0.8)),
    entry("/es/nosotros", 0.4, "monthly"),
    entry("/es/politicas/condiciones-de-pago", 0.3, "monthly"),
    entry("/es/politicas/proteccion-de-datos-personales", 0.3, "monthly"),
    entry("/es/politicas/terminos-y-condiciones", 0.3, "monthly"),
    entry("/es/politicas/cookies", 0.3, "monthly"),
    entry("/es/libro-de-reclamaciones", 0.3, "monthly"),
  ];
}
