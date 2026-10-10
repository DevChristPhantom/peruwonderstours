import type { Metadata } from "next";

import { localePath } from "@/i18n/paths";
import { HREFLANG, OG_LOCALE, routing, type Locale } from "@/i18n/routing";
import type { LocalePaths } from "@/lib/catalog/types";
import { SITE } from "@/lib/site";

type Href = Parameters<typeof localePath>[1];

/** Rutas de una página estática en ambos idiomas, a partir de su ruta interna. */
export function alternatesFor(href: Href): LocalePaths {
  return { es: localePath("es", href), en: localePath("en", href) };
}

/**
 * hreflang recíproco (I3): `es-PE`, `en` y `x-default` (→ español). Cada idioma apunta a su propia
 * URL (con el slug traducido cuando existe).
 */
export function hreflang(paths: LocalePaths): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[HREFLANG[l]] = paths[l];
  languages["x-default"] = paths[routing.defaultLocale];
  return languages;
}

/** Metadata por página: canonical del idioma + hreflang + Open Graph. */
export function pageMetadata({
  locale,
  title,
  description,
  paths,
  image,
  index = true,
}: {
  locale: Locale;
  title: string;
  description: string;
  /** Rutas en ambos idiomas (`alternatesFor('/tours')` o `tour.alternates`). */
  paths: LocalePaths;
  image?: string | null;
  index?: boolean;
}): Metadata {
  const path = paths[locale];
  return {
    title,
    description,
    alternates: { canonical: path, languages: hreflang(paths) },
    openGraph: {
      title,
      description,
      url: path,
      siteName: SITE.name,
      locale: OG_LOCALE[locale],
      alternateLocale: routing.locales.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
      type: "website",
      ...(image ? { images: [{ url: image }] } : {}),
    },
    ...(index ? {} : { robots: { index: false, follow: true } }),
  };
}
