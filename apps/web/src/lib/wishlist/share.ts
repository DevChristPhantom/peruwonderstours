import { localePath } from "@/i18n/paths";
import type { Locale } from "@/i18n/routing";

/**
 * Lista de favoritos compartible por URL (HU-B.A4): `/es/favoritos?tours=slug-a,slug-b`.
 * Solo identificadores públicos de tours, nunca datos personales ni del navegador.
 */

export const MAX_FAVORITES = 30;
export const SHARE_PARAM = "tours";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isTourSlug(value: string): boolean {
  return value.length > 0 && value.length <= 160 && SLUG_RE.test(value);
}

/** Lee y sanea la lista compartida (descarta valores raros, duplicados y excesos). */
export function parseSharedSlugs(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const slug = part.trim().toLowerCase();
    if (isTourSlug(slug) && !out.includes(slug)) out.push(slug);
    if (out.length >= MAX_FAVORITES) break;
  }
  return out;
}

export function sharePath(slugs: readonly string[], locale: Locale): string {
  const list = slugs.filter(isTourSlug).slice(0, MAX_FAVORITES);
  return localePath(locale, list.length ? { pathname: "/favoritos", query: { [SHARE_PARAM]: list.join(",") } } : "/favoritos");
}
