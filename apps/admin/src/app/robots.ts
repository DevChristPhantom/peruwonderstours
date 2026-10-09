import type { MetadataRoute } from "next";

/** Panel interno: nada indexable. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
