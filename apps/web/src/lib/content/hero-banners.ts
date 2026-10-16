import "server-only";
import { env } from "@/lib/env";

export interface HeroBannerScene { id: string; title: string; poster: string | null; effect: "none" | "water" | "clouds"; titleEmbedded?: boolean }
export const BUILTIN_HERO_BANNERS: HeroBannerScene[] = [
  { id: "builtin-titicaca", title: "Lago Titicaca", effect: "water", poster: "/hero-motion/titicaca-0.webp" },
  { id: "builtin-machu-picchu", title: "Machu Picchu", effect: "clouds", titleEmbedded: true, poster: "/hero-motion/machu-picchu-0.webp" },
];

/** Seed builds work offline; API-managed banners refresh independently of the catalog. */
export async function getHeroBanners(): Promise<HeroBannerScene[]> {
  if (env.CATALOG_SOURCE === "seed" && process.env.NODE_ENV !== "development") return BUILTIN_HERO_BANNERS;
  try {
    const response = await fetch(`${env.API_BASE_URL}/hero-banners`, { next: { revalidate: 15, tags: ["hero-banners"] }, signal: AbortSignal.timeout(1500) });
    if (!response.ok) return BUILTIN_HERO_BANNERS;
    const json = await response.json() as { data?: { id: string; title: string; hasPoster: boolean; effect?: string; titleEmbedded?: boolean }[] };
    if (!Array.isArray(json.data)) return BUILTIN_HERO_BANNERS;
    return json.data.filter((record) => /^[a-f0-9-]{36}$/.test(record.id) && typeof record.title === "string").map((record) => ({
      id: record.id, title: record.title, titleEmbedded: record.titleEmbedded === true,
      effect: record.effect === "water" || record.effect === "clouds" ? record.effect : "none",
      poster: record.hasPoster ? `/api/hero-banners/${record.id}/poster` : null,
    }));
  } catch { return BUILTIN_HERO_BANNERS; }
}
