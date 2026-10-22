import type { Metadata } from "next";

import { localePath } from "@/i18n/paths";
import { HREFLANG, OG_LOCALE, routing, type Locale } from "@/i18n/routing";
import type { LocalePaths } from "@/lib/catalog/types";
import { absoluteUrl, SITE } from "@/lib/site";

type Href = Parameters<typeof localePath>[1];

/** Rutas de una página estática en los tres idiomas, a partir de su ruta interna. */
export function alternatesFor(href: Href): LocalePaths {
  return { es: localePath("es", href), en: localePath("en", href), pt: localePath("pt", href) };
}

/**
 * hreflang recíproco (I3): `es-PE`, `en`, `pt-BR` y `x-default` (→ español). Cada idioma apunta a su propia
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
  /** Rutas en los tres idiomas (`alternatesFor('/tours')` o `tour.alternates`). */
  paths: LocalePaths;
  image?: string | null;
  index?: boolean;
}): Metadata {
  const path = paths[locale];
  const shareImage = absoluteUrl(image || '/brand/peruwonderstours-logo-color.png');
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
      images: [{ url: shareImage, alt: image ? title : SITE.name }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [{ url: shareImage, alt: image ? title : SITE.name }] },
    robots: index ? { index: true, follow: true, googleBot: { 'max-image-preview': 'large' } } : { index: false, follow: true },
  };
}
