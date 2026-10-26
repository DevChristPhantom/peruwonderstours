import { localePath } from "@/i18n/paths";
import { routing, type AppPathname, type Locale } from "@/i18n/routing";
import { getCategories, getDestinations, getTour } from "@/lib/catalog";
import { catalogImageSource } from "@/lib/catalog/image-source";
import type { CatalogImage } from "@/lib/catalog/types";
import { env } from "@/lib/env";
import { whatsappHref } from "@/lib/site";

/** Evento o campaña destacada (Panel → Eventos y promociones), ya resuelto para este idioma. */
export interface Promotion {
  id: string;
  fallback: boolean;
  title: string;
  eyebrow: string | null;
  summary: string;
  image: CatalogImage | null;
  /** Días del evento (AAAA-MM-DD), para mostrar la fecha. */
  eventStartsOn: string | null;
  eventEndsOn: string | null;
  cta: { href: string; label: string | null; external: boolean; kind: "tour" | "page" | "whatsapp" };
  showPopup: boolean;
  /** Cambia cuando el equipo edita el evento: el anuncio vuelve a mostrarse a quien ya lo cerró. */
  revision: string;
}

interface ApiPromotion {
  id: string;
  fallback: boolean;
  title: string;
  eyebrow: string | null;
  summary: string;
  ctaLabel: string | null;
  whatsappMessage: string | null;
  cta: { kind: "tour" | "page" | "whatsapp"; tourSlug: string | null; path: string | null };
  image: { url: string | null; alt: string } | null;
  event: { startsOn: string | null; endsOn: string | null };
  showPopup: boolean;
  updatedAt: string;
}

/** Solo rutas internas (la API y la base ya lo exigen; aquí se vuelve a comprobar antes de enlazar). */
const INTERNAL_PATH = /^\/[a-z0-9/_-]*$/;

/** Eventos vigentes. Sin API (build offline o caída) devuelve [] y la home se muestra sin ellos. */
export async function getPromotions(locale: Locale): Promise<Promotion[]> {
  if (env.CATALOG_SOURCE === "seed" && process.env.NODE_ENV !== "development") return [];
  let rows: ApiPromotion[];
  try {
    const response = await fetch(`${env.API_BASE_URL}/promotions?locale=${locale}`, {
      next: { revalidate: 300, tags: ["promotions"] },
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) return [];
    const json = (await response.json()) as { data?: ApiPromotion[] };
    rows = Array.isArray(json.data) ? json.data : [];
  } catch {
    return [];
  }
  const out = await Promise.all(rows.map((p) => resolve(p, locale)));
  return out.filter((p): p is Promotion => p !== null);
}

/**
 * El panel guarda la ruta en español tal como se ve en el sitio (p. ej. /destinos/tours-en-puno).
 * Cada idioma tiene sus propios segmentos y slugs (/en/destinations/puno), así que se busca la
 * misma página en el catálogo o en las rutas fijas; si no se encuentra, se enlaza la versión en español.
 */
async function localizedPage(path: string, locale: Locale): Promise<string> {
  const es = `/es${path === "/" ? "" : path}`;
  const [destinations, categories] = await Promise.all([getDestinations(locale), getCategories(locale)]);
  const match = [...destinations, ...categories].find((item) => item.alternates.es === es);
  if (match) return match.alternates[locale];
  const fixed = (Object.keys(routing.pathnames) as AppPathname[]).find((key) => key === path && !key.includes("["));
  if (fixed) return localePath(locale, fixed as Parameters<typeof localePath>[1]);
  return es;
}

async function resolve(p: ApiPromotion, locale: Locale): Promise<Promotion | null> {
  if (!p?.id || !p.title || !p.summary) return null;
  const whatsapp = () => ({ href: whatsappHref(p.whatsappMessage || p.title), external: true, kind: "whatsapp" as const });
  let target: { href: string; external: boolean; kind: Promotion["cta"]["kind"] } = whatsapp();
  if (p.cta.kind === "tour" && p.cta.tourSlug) {
    const tour = await getTour(p.cta.tourSlug, locale);
    if (tour) target = { href: tour.path, external: false, kind: "tour" };
  } else if (p.cta.kind === "page" && p.cta.path && INTERNAL_PATH.test(p.cta.path) && !p.cta.path.startsWith("//")) {
    target = { href: await localizedPage(p.cta.path, locale), external: false, kind: "page" };
  }
  return {
    id: p.id,
    fallback: p.fallback,
    title: p.title,
    eyebrow: p.eyebrow,
    summary: p.summary,
    image: p.image?.url ? { src: catalogImageSource(p.image.url), alt: p.image.alt || p.title } : null,
    eventStartsOn: p.event.startsOn,
    eventEndsOn: p.event.endsOn,
    cta: { ...target, label: p.ctaLabel },
    showPopup: p.showPopup,
    revision: `${p.id}:${p.updatedAt}`,
  };
}
