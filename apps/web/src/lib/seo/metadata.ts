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
export function hreflang(paths: LocalePaths, locales: readonly Locale[] = routing.locales): Record<string, string> {
  const languages: Record<string, string> = {};
  // Solo los idiomas con traducción propia: una versión que muestra el texto en español (noindex) no se anuncia.
  for (const l of routing.locales) if (l === routing.defaultLocale || locales.includes(l)) languages[HREFLANG[l]] = paths[l];
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
  hreflangLocales,
}: {
  locale: Locale;
  title: string;
  description: string;
  /** Rutas en los tres idiomas (`alternatesFor('/tours')` o `tour.alternates`). */
  paths: LocalePaths;
  image?: string | null;
  index?: boolean;
  /** Idiomas con traducción propia (fichas de tour); por defecto, los tres. */
  hreflangLocales?: readonly Locale[];
}): Metadata {
  const path = paths[locale];
  // Google corta los títulos de más de ~60 caracteres: si con la marca no entra, va sin la marca.
  const pageTitle: Metadata["title"] = `${title} · ${SITE.name}`.length > 60 ? { absolute: title } : title;
  description = fitDescription(description);
  const shareImage = absoluteUrl(image || '/brand/peruwonderstours-logo-official-20261115.webp');
  return {
    title: pageTitle,
    description,
    alternates: { canonical: path, languages: hreflang(paths, hreflangLocales) },
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

/** Meta descripción de hasta 155 caracteres (Google muestra ~155-160): se corta en un límite de palabra. */
export function fitDescription(text: string, max = 155): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.\-–—]+$/, "")}…`;
}
