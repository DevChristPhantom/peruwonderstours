import "server-only";
import { env } from "@/lib/env";

export interface HeroBannerScene { id: string; title: string; poster: string | null; effect: "none" | "water" | "clouds"; titleEmbedded?: boolean; video?: string; videoMobile?: string }
export const BUILTIN_HERO_BANNERS: HeroBannerScene[] = [
  { id: "builtin-video", title: "Peru Wonders Tours", effect: "none", poster: "/hero-video/peru-wonders-poster.webp", video: "/hero-video/peru-wonders.mp4", videoMobile: "/hero-video/peru-wonders-720.mp4" },
];

/** Seed builds work offline; API-managed banners refresh independently of the catalog. */
export async function getHeroBanners(): Promise<HeroBannerScene[]> {
  if (env.CATALOG_SOURCE === "seed" && process.env.NODE_ENV !== "development") return BUILTIN_HERO_BANNERS;
  try {
    const response = await fetch(`${env.API_BASE_URL}/hero-banners`, { next: { revalidate: 15, tags: ["hero-banners"] }, signal: AbortSignal.timeout(1500) });
    if (!response.ok) return BUILTIN_HERO_BANNERS;
    const json = await response.json() as { configured?: boolean; data?: { id: string; title: string; hasPoster: boolean; effect?: string; titleEmbedded?: boolean; sourceType?: string; revision?: number }[] };
    if (!Array.isArray(json.data)) return BUILTIN_HERO_BANNERS;
    const scenes = json.data.filter((record) => /^[a-f0-9-]{36}$/.test(record.id) && typeof record.title === "string").map((record): HeroBannerScene => {
      // La API sirve el video con caché "immutable" de un año: la revisión en la URL hace que un archivo
      // reemplazado (p. ej. un video recortado) llegue a quien ya vio el anterior. El póster no la lleva:
      // pasa por next/image, que por defecto rechaza rutas locales con query string.
      const v = Number.isInteger(record.revision) ? `?v=${record.revision}` : "";
      return {
        id: record.id, title: record.title, titleEmbedded: record.titleEmbedded === true,
        effect: record.sourceType !== "video" && (record.effect === "water" || record.effect === "clouds") ? record.effect : "none",
        poster: record.hasPoster ? `/api/hero-banners/${record.id}/poster` : null,
        ...(record.sourceType === "video" ? { video: `/api/hero-banners/${record.id}/video${v}` } : {}),
      };
    });
    return scenes.length || json.configured ? scenes : BUILTIN_HERO_BANNERS;
  } catch { return BUILTIN_HERO_BANNERS; }
}
