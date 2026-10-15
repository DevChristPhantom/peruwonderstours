import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/site";

/** Permitir leer el noindex de las páginas personales en los tres idiomas.
 * robots.txt controla rastreo; la sesión y los tokens protegen los datos.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
