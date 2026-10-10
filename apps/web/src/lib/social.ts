import siteContentJson from "@seed/site-content.json";

/**
 * Redes sociales publicadas (data/seed/site-content.json · socialLinks). Solo se leen las redes: el
 * resto del archivo (equipo, correos, datos legales del sitio viejo) NO se publica desde aquí.
 * Por ahora solo Facebook y TripAdvisor (las demás no existen en el sitio actual).
 */
export type SocialNetwork = "facebook" | "tripadvisor";

interface RawSocial {
  network: string;
  url: string;
  urlEncoded?: string;
}

const raw = ((siteContentJson as unknown as { socialLinks?: RawSocial[] }).socialLinks ?? []) as RawSocial[];

/** Codifica espacios y caracteres no válidos sin volver a codificar los `%XX` existentes. */
function percentEncode(url: string): string {
  return encodeURI(decodeURI(url));
}

export const SOCIAL_LINKS: { network: SocialNetwork; url: string }[] = raw.flatMap((s) => {
  const network = s.network.toLowerCase();
  if (network !== "facebook" && network !== "tripadvisor") return [];
  return [{ network, url: percentEncode(s.urlEncoded ?? s.url) }];
});
