import type { MetadataRoute } from "next";

import { HREFLANG, routing, type Locale } from "@/i18n/routing";
import { getAllTours, getCategories, getDestinations } from "@/lib/catalog";
import type { LocalePaths } from "@/lib/catalog/types";
import { getBlogPosts } from "@/lib/content/blog";
import { alternatesFor } from "@/lib/seo/metadata";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 3600;

type Frequency = "daily" | "weekly" | "monthly";

/**
 * Sitemap propio (HU-0.4 / I3): una entrada por idioma y página, cada una con su hreflang recíproco
 * (`es-PE`, `en`, `pt-BR`, `x-default`). Los slugs traducidos salen del catálogo (`alternates`).
 *
 * Solo idiomas indexables: un tour, destino, categoría o artículo sin traducción se muestra en español
 * con `noindex` (ver sus `generateMetadata`); listarlo aquí sería un error en Search Console
 * («URL enviada marcada como noindex»), así que ni su URL ni su hreflang entran al sitemap.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [tours, destinations, categories, posts] = await Promise.all([
    Promise.all(routing.locales.map((l) => getAllTours(l))),
    Promise.all(routing.locales.map((l) => getDestinations(l))),
    Promise.all(routing.locales.map((l) => getCategories(l))),
    Promise.all(routing.locales.map((l) => getBlogPosts(l))),
  ]);

  /** Por cada clave, los idiomas en que existe traducción real (el español siempre). */
  const translated = (lists: { key: string; fallback: boolean }[][]) => {
    const byKey = new Map<string, Locale[]>();
    routing.locales.forEach((locale, i) => {
      for (const item of lists[i]) {
        if (locale !== routing.defaultLocale && item.fallback) continue;
        byKey.set(item.key, [...(byKey.get(item.key) ?? []), locale]);
      }
    });
    return byKey;
  };

  const entries = (
    paths: LocalePaths,
    priority: number,
    changeFrequency: Frequency = "weekly",
    locales: readonly Locale[] = routing.locales,
  ): MetadataRoute.Sitemap => {
    const languages: Record<string, string> = Object.fromEntries(locales.map((l) => [HREFLANG[l], absoluteUrl(paths[l])]));
    languages["x-default"] = absoluteUrl(paths[routing.defaultLocale]);
    return locales.map((locale) => ({
      url: absoluteUrl(paths[locale]),
      changeFrequency,
      priority,
      alternates: { languages },
    }));
  };

  /** Entradas de una colección del catálogo (lista en español + idiomas traducidos por clave). */
  const collection = (lists: { key: string; fallback: boolean; alternates: LocalePaths }[][], priority: number) => {
    const locales = translated(lists);
    return lists[routing.locales.indexOf(routing.defaultLocale)].flatMap((item) =>
      entries(item.alternates, priority, "weekly", locales.get(item.key) ?? [routing.defaultLocale]),
    );
  };

  return [
    ...entries(alternatesFor("/"), 1, "daily"),
    ...entries(alternatesFor("/tours"), 0.9, "daily"),
    ...entries(alternatesFor("/destinos"), 0.8),
    ...entries(alternatesFor("/tipos-de-tours"), 0.7),
    ...entries(alternatesFor("/blog"), 0.6),
    ...collection(posts, 0.6),
    ...entries(alternatesFor("/contactenos"), 0.5, "monthly"),
    ...entries(alternatesFor("/testimonios"), 0.5),
    ...collection(destinations, 0.8),
    ...collection(categories, 0.7),
    ...collection(tours, 0.8),
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
