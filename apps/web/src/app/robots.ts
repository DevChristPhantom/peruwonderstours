import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/site";

/** El sitio viejo tenía `Disallow: /`; el nuevo permite indexar (HU-0.4). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/es/checkout", "/es/carrito", "/es/reserva/", "/en/checkout", "/en/cart", "/en/booking/"] }],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
