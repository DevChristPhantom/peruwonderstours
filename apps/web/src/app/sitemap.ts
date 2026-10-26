import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";
import { getAllTours, getCategories, getDestinations } from "@/lib/catalog";
import type { LocalePaths } from "@/lib/catalog/types";
import { getBlogPosts } from "@/lib/content/blog";
import { alternatesFor, hreflang } from "@/lib/seo/metadata";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 3600;

type Frequency = "daily" | "weekly" | "monthly";

/**
 * Sitemap propio (HU-0.4 / I3): una entrada por idioma y página, cada una con su hreflang recíproco
 * (`es-PE`, `en`, `x-default`). Los slugs traducidos salen del catálogo (`alternates`).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // El catálogo en español trae `alternates` con la URL de ambos idiomas.
  const [tours, destinations, categories, posts] = await Promise.all([
    getAllTours("es"), getDestinations("es"), getCategories("es"), getBlogPosts("es"),
  ]);

  const entries = (paths: LocalePaths, priority: number, changeFrequency: Frequency = "weekly"): MetadataRoute.Sitemap => {
    const languages = Object.fromEntries(Object.entries(hreflang(paths)).map(([lang, path]) => [lang, absoluteUrl(path)]));
    return routing.locales.map((locale) => ({
      url: absoluteUrl(paths[locale]),
      changeFrequency,
      priority,
      alternates: { languages },
    }));
  };

  return [
    ...entries(alternatesFor("/"), 1, "daily"),
    ...entries(alternatesFor("/tours"), 0.9, "daily"),
    ...entries(alternatesFor("/destinos"), 0.8),
    ...entries(alternatesFor("/tipos-de-tours"), 0.7),
    ...entries(alternatesFor("/blog"), 0.6),
    ...posts.flatMap((post) => entries(post.alternates, 0.6)),
    ...entries(alternatesFor("/contactenos"), 0.5, "monthly"),
    ...entries(alternatesFor("/testimonios"), 0.5),
    ...destinations.flatMap((d) => entries(d.alternates, 0.8)),
    ...categories.flatMap((c) => entries(c.alternates, 0.7)),
    ...tours.flatMap((t) => entries(t.alternates, 0.8)),
    ...entries(alternatesFor("/nosotros"), 0.4, "monthly"),
    ...entries(alternatesFor("/politicas/condiciones-de-pago"), 0.3, "monthly"),
    ...entries(alternatesFor("/politicas/proteccion-de-datos-personales"), 0.3, "monthly"),
    ...entries(alternatesFor("/politicas/terminos-y-condiciones"), 0.3, "monthly"),
    ...entries(alternatesFor("/politicas/cookies"), 0.3, "monthly"),
    ...entries(alternatesFor("/politicas/promociones"), 0.3, "monthly"),
    ...entries(alternatesFor("/politicas/resenas"), 0.3, "monthly"),
    ...entries(alternatesFor("/politicas/esnna"), 0.3, "monthly"),
    ...entries(alternatesFor("/libro-de-reclamaciones"), 0.3, "monthly"),
  ];
}
