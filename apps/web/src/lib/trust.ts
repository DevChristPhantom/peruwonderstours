import trustJson from "@seed/trust-badges.json";

import type { Locale } from "@/i18n/routing";
import { BADGE_SWITCHES } from "@/lib/site";

/**
 * Sellos y enlaces oficiales (franja de confianza). Fuente: `data/seed/trust-badges.json`
 * (URLs oficiales verificadas). Reglas (coordinación sprint 3):
 * - Siempre visible: el aviso del Libro de Reclamaciones (obligatorio, en la home y el pie).
 * - Los demás sellos (Safe Travels, Marca Perú, PromPerú, SERNANP, Dircetur/Gercetur y el distintivo
 *   MINCETUR "Agencia registrada") quedan APAGADOS (`enabled: false`) hasta que el cliente envíe la
 *   constancia: mostrar un sello sin tenerlo es publicidad engañosa. Al encenderlo se muestra con un
 *   placeholder neutro con su nombre (nunca un logo recreado ni una imagen enlazada de un sitio del Estado).
 * - Los enlaces oficiales informativos (boletos de Machu Picchu, directorio MINCETUR, peru.travel, iPerú,
 *   SERNANP y ESNNA) se muestran como recursos visuales con fotos ilustrativas e iconos Rune.
 */

interface RawBadge {
  id: string;
  officialName: string;
  officialUrl: string;
  accessibleAlt: Record<Locale, string>;
}

interface RawLink {
  id: string;
  name: string;
  issuer: string;
  url: string;
}

const raw = trustJson as unknown as { badges: RawBadge[]; touristLinks: RawLink[] };

export interface TrustBadge {
  id: string;
  name: string;
  url: string;
  alt: string;
}

/** Sellos encendidos (sin el Libro de Reclamaciones, que se muestra aparte). */
export function enabledBadges(locale: Locale): TrustBadge[] {
  return raw.badges
    .filter((b) => (BADGE_SWITCHES as Record<string, { enabled: boolean }>)[b.id]?.enabled === true)
    .map((b) => ({ id: b.id, name: b.officialName, url: b.officialUrl, alt: b.accessibleAlt[locale] ?? b.officialName }));
}

/** Orden de la franja "Enlaces oficiales". */
const OFFICIAL_LINKS = ["machu-picchu-tickets", "mincetur-directory", "peru-travel", "iperu", "sernanp-visit", "esnna-info"] as const;
export type OfficialLinkId = (typeof OFFICIAL_LINKS)[number];

export function officialLinks(): { id: OfficialLinkId; url: string }[] {
  return OFFICIAL_LINKS.flatMap((id) => {
    const link = raw.touristLinks.find((l) => l.id === id);
    if (!link) return [];
    // peru.travel tiene versión en inglés.
    return [{ id, url: link.url }];
  });
}

export function officialUrl(id: string): string | null {
  return raw.touristLinks.find((l) => l.id === id)?.url ?? raw.badges.find((b) => b.id === id)?.officialUrl ?? null;
}

/** INDECOPI: información oficial del Libro de Reclamaciones. */
export const INDECOPI_COMPLAINTS_URL =
  raw.badges.find((b) => b.id === "indecopi-libro-reclamaciones")?.officialUrl ?? "https://consumidor.gob.pe/libro-de-reclamaciones/";
