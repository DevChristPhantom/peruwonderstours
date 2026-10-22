export interface HeroBanner {
  id: string;
  title: string;
  enabled: boolean;
  sortOrder: number;
  bytes: number;
  revision: number;
  hasPoster: boolean;
  effect: BannerEffect;
  titleEmbedded?: boolean;
  sourceType?: "image" | "html" | "video";
}
export const BANNER_MAX_BYTES = 16 * 1024 * 1024;
export const BANNER_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const BANNER_EFFECTS = ["none", "water", "clouds"] as const;
export type BannerEffect = (typeof BANNER_EFFECTS)[number];
export const BANNER_EFFECT_LABELS: Record<BannerEffect, string> = { none: "Sin movimiento", water: "Agua en movimiento", clouds: "Nubes en movimiento" };
export function validBannerFile(file: File): boolean {
  if (/\.mp4$/i.test(file.name)) return file.type === "video/mp4" && file.size > 0 && file.size <= BANNER_VIDEO_MAX_BYTES;
  const types: Record<string, string[]> = { png: ["image/png"], jpg: ["image/jpeg"], jpeg: ["image/jpeg"], webp: ["image/webp"], avif: ["image/avif"], html: ["text/html"], htm: ["text/html"] };
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return Boolean(types[extension]?.includes(file.type)) && file.size > 0 && file.size <= BANNER_MAX_BYTES;
}
export function validBannerPoster(file: File): boolean {
  return /\.(png|jpe?g|webp)$/i.test(file.name) && /^image\/(png|jpeg|webp)$/.test(file.type) && file.size > 0 && file.size <= BANNER_MAX_BYTES;
}
