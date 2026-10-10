import type { Locale } from "./routing";
import { getPathname } from "./navigation";

/**
 * Rutas públicas por idioma (con prefijo y segmentos traducidos). Funciones puras, sirven en el
 * servidor y en el cliente: `/es/destinos/cuzco` ↔ `/en/destinations/cusco`.
 */
type Href = Parameters<typeof getPathname>[0]["href"];

export function localePath(locale: Locale, href: Href): string {
  return getPathname({ locale, href });
}

export const tourPath = (locale: Locale, slug: string) => localePath(locale, { pathname: "/tours/[slug]", params: { slug } });
export const destinationPath = (locale: Locale, slug: string) =>
  localePath(locale, { pathname: "/destinos/[slug]", params: { slug } });
export const categoryPath = (locale: Locale, slug: string) =>
  localePath(locale, { pathname: "/categorias/[slug]", params: { slug } });
export const blogPostPath = (locale: Locale, slug: string) => localePath(locale, { pathname: "/blog/[slug]", params: { slug } });
export const bookingPath = (locale: Locale, code: string) =>
  localePath(locale, { pathname: "/reserva/[codigo]", params: { codigo: code } });

/** `/es/tours?destino=x` con la ruta traducida del idioma. */
export function toursSearchPath(locale: Locale, query: Record<string, string>): string {
  return localePath(locale, { pathname: "/tours", query });
}
