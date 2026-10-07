import type { Metadata } from "next";

import { SITE } from "@/lib/site";

/**
 * Metadata por página: canonical + hreflang.
 * Solo existe la versión es-PE; `en` se agrega cuando haya contenido traducido (E10),
 * para no apuntar hreflang a páginas inexistentes.
 */
export function pageMetadata({
  title,
  description,
  path,
  image,
}: {
  title: string;
  description: string;
  path: string;
  image?: string | null;
}): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: path,
      languages: { "es-PE": path, "x-default": path },
    },
    openGraph: {
      title,
      description,
      url: path,
      siteName: SITE.name,
      locale: SITE.ogLocale,
      type: "website",
      ...(image ? { images: [{ url: image }] } : {}),
    },
  };
}
