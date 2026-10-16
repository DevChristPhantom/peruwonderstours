import { defineRouting } from "next-intl/routing";

/**
 * Rutas por idioma (E10 / I1). Español por defecto (`/es/...`) e inglés con segmentos traducidos
 * (`/en/tours`, `/en/complaints-book`, …). Las CARPETAS de `app/[locale]` usan los nombres en español
 * (rutas internas); el proxy (next-intl) reescribe las URLs en inglés a esas carpetas.
 *
 * - `localePrefix: "always"`: toda URL lleva idioma (URLs estables y cacheables por idioma).
 * - `localeDetection: false` y sin cookie de idioma: `/` siempre va a `/es` (301 de `redirects.json`)
 *   y no se escribe ninguna cookie (sin consentimiento extra). El visitante elige con el selector.
 * - `alternateLinks: false`: el hreflang lo arma `lib/seo/metadata.ts` con los slugs traducidos de la
 *   API (next-intl no conoce los slugs de cada tour en inglés).
 */
export const routing = defineRouting({
  locales: ["es", "en", "pt"],
  defaultLocale: "es",
  localePrefix: "always",
  localeDetection: false,
  localeCookie: false,
  alternateLinks: false,
  pathnames: {
    "/": "/",
    "/tours": "/tours",
    "/tours/[slug]": "/tours/[slug]",
    "/destinos": { es: "/destinos", en: "/destinations", pt: "/destinos" },
    "/destinos/[slug]": { es: "/destinos/[slug]", en: "/destinations/[slug]", pt: "/destinos/[slug]" },
    "/categorias/[slug]": { es: "/categorias/[slug]", en: "/categories/[slug]", pt: "/categorias/[slug]" },
    "/tipos-de-tours": { es: "/tipos-de-tours", en: "/tour-types", pt: "/tipos-de-passeios" },
    "/carrito": { es: "/carrito", en: "/cart", pt: "/carrinho" },
    "/checkout": "/checkout",
    "/reserva/[codigo]": { es: "/reserva/[codigo]", en: "/booking/[codigo]", pt: "/reserva/[codigo]" },
    "/reserva/[codigo]/manifest.webmanifest": {
      es: "/reserva/[codigo]/manifest.webmanifest",
      en: "/booking/[codigo]/manifest.webmanifest",
      pt: "/reserva/[codigo]/manifest.webmanifest",
    },
    "/reserva/acceso": { es: "/reserva/acceso", en: "/booking/access", pt: "/reserva/acesso" },
    "/reserva/recuperar": { es: "/reserva/recuperar", en: "/booking/recover", pt: "/reserva/recuperar" },
    "/libro-de-reclamaciones": { es: "/libro-de-reclamaciones", en: "/complaints-book", pt: "/livro-de-reclamacoes" },
    "/libro-de-reclamaciones/consulta": { es: "/libro-de-reclamaciones/consulta", en: "/complaints-book/status", pt: "/livro-de-reclamacoes/consulta" },
    "/politicas/terminos-y-condiciones": { es: "/politicas/terminos-y-condiciones", en: "/policies/terms-and-conditions", pt: "/politicas/termos-e-condicoes" },
    "/politicas/condiciones-de-pago": { es: "/politicas/condiciones-de-pago", en: "/policies/payment-conditions", pt: "/politicas/condicoes-de-pagamento" },
    "/politicas/proteccion-de-datos-personales": {
      es: "/politicas/proteccion-de-datos-personales",
      en: "/policies/personal-data-protection",
      pt: "/politicas/protecao-de-dados-pessoais",
    },
    "/politicas/cookies": { es: "/politicas/cookies", en: "/policies/cookies", pt: "/politicas/cookies" },
    "/politicas/esnna": { es: "/politicas/esnna", en: "/policies/child-protection", pt: "/politicas/protecao-infantil" },
    "/favoritos": { es: "/favoritos", en: "/favorites", pt: "/favoritos" },
    "/mi-viaje": { es: "/mi-viaje", en: "/my-trip", pt: "/minha-viagem" },
    "/comparar": { es: "/comparar", en: "/compare", pt: "/comparar" },
    "/blog": "/blog",
    "/blog/[slug]": "/blog/[slug]",
    "/contactenos": { es: "/contactenos", en: "/contact", pt: "/contato" },
    "/nosotros": { es: "/nosotros", en: "/about", pt: "/sobre-nos" },
    "/testimonios": { es: "/testimonios", en: "/reviews", pt: "/avaliacoes" },
    "/dejar-testimonio": { es: "/dejar-testimonio", en: "/leave-a-review", pt: "/deixar-avaliacao" },
    "/privacidad/baja": { es: "/privacidad/baja", en: "/privacy/unsubscribe", pt: "/privacidade/cancelar-inscricao" },
    "/privacidad/confirmar": { es: "/privacidad/confirmar", en: "/privacy/confirm", pt: "/privacidade/confirmar" },
    "/mis-reservas": { es: "/mis-reservas", en: "/my-bookings", pt: "/minhas-reservas" },
    "/cuenta/ingresar": { es: "/cuenta/ingresar", en: "/account/sign-in", pt: "/conta/entrar" },
    "/cuenta/acceso": { es: "/cuenta/acceso", en: "/account/access", pt: "/conta/acesso" },
  },
});

export type Locale = (typeof routing.locales)[number];
export type AppPathname = keyof typeof routing.pathnames;

export const LOCALES = routing.locales;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (routing.locales as readonly string[]).includes(value);
}

/** Etiqueta BCP 47 para Intl y `<html lang>`: es-PE / en-US. */
export const INTL_LOCALE: Record<Locale, string> = { es: "es-PE", en: "en-US", pt: "pt-BR" };

/** Código hreflang publicado (I3): `es-PE` y `en`. */
export const HREFLANG: Record<Locale, string> = { es: "es-PE", en: "en", pt: "pt-BR" };

/** og:locale. */
export const OG_LOCALE: Record<Locale, string> = { es: "es_PE", en: "en_US", pt: "pt_BR" };

/** Zona horaria de presentación (CLAUDE.md: fechas en UTC, se muestran en America/Lima). */
export const TIME_ZONE = "America/Lima";
