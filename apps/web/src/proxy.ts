import createIntlMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";

import { contentSecurityPolicy } from "./lib/security/content-security-policy";
import { isHttpLoopback, localDemoMediaOrigin } from "./lib/security/transport-policy.mjs";

import { routing } from "./i18n/routing";

/**
 * Proxy de Next 16 (runtime Node.js): idioma (next-intl) + cabeceras de seguridad (H-02).
 *
 * 1. next-intl resuelve el idioma de la URL, redirige lo que no lo tiene (`/tours` → `/es/tours`) y
 *    reescribe las rutas traducidas (`/en/complaints-book` → carpeta interna `libro-de-reclamaciones`).
 * 2. Sobre su respuesta (next, rewrite o redirect) se aplican la CSP y el resto de cabeceras.
 *
 * CSP con nonce por petición en las rutas DINÁMICAS con datos sensibles (checkout, reserva y pago,
 * Libro de Reclamaciones, privacidad, comparador, cuenta y formularios): `script-src 'nonce-…'
 * 'strict-dynamic'`. El nonce viaja en las cabeceras de la PETICIÓN que next-intl copia al reescribir
 * (se le pasa una petición clonada con `x-nonce` y la CSP), así Next lo aplica a sus scripts.
 *
 * Las páginas de catálogo son SSG/ISR (Core Web Vitals): su HTML se genera sin petición y no puede
 * llevar nonce, y Next inserta scripts en línea para hidratar. Ahí la CSP permite `'unsafe-inline'`
 * en scripts pero mantiene el resto (sin orígenes externos de script, `object-src 'none'`,
 * `base-uri 'none'`, `form-action 'self'`, `frame-ancestors 'none'`). Riesgo residual documentado:
 * migrar a hashes/SRI cuando Next lo soporte para los scripts en línea.
 *
 * Estilos: GSAP/anime.js/Lenis animan con `element.style` (CSSOM, no lo bloquea la CSP) y React
 * renderiza algunos `style={}` en el HTML: por eso `style-src-attr 'unsafe-inline'`; las etiquetas
 * `<style>` sí exigen nonce en las rutas dinámicas.
 */

const handleI18nRouting = createIntlMiddleware(routing);

/** Rutas sensibles (externas, en ambos idiomas) que se renderizan por petición con nonce. */
const NONCE_ROUTES = [
  /^\/(es|en|pt)\/checkout(\/|$)/,
  /^\/pt\/(reserva|livro-de-reclamacoes|privacidade|comparar|conta|minhas-reservas|contato|deixar-avaliacao)(\/|$)/,
  /^\/es\/reserva\//,
  /^\/en\/booking\//,
  /^\/es\/libro-de-reclamaciones(\/|$)/,
  /^\/en\/complaints-book(\/|$)/,
  /^\/es\/privacidad\//,
  /^\/en\/privacy\//,
  /^\/es\/comparar(\/|$)/,
  /^\/en\/compare(\/|$)/,
  /^\/es\/(mis-reservas|cuenta|contactenos|dejar-testimonio)(\/|$)/,
  /^\/en\/(my-bookings|account|contact|leave-a-review)(\/|$)/,
];


/** Páginas y el manifest de la reserva pasan por next-intl; el resto (archivos, íconos) no. */
function isLocalizable(pathname: string): boolean {
  if (pathname.startsWith("/icons/") || pathname.startsWith("/api/")) return false;
  if (pathname.endsWith("/manifest.webmanifest")) return true;
  return !/\.[a-z0-9]+$/i.test(pathname);
}

export function proxy(request: NextRequest) {
  const dev = process.env.NODE_ENV !== "production";
  const reportOnly = process.env.CSP_REPORT_ONLY === "true";
  const pathname = request.nextUrl.pathname;
  const sensitive = NONCE_ROUTES.some((re) => re.test(pathname));
  const nonce = sensitive ? Buffer.from(crypto.randomUUID()).toString("base64") : null;
  const upgradeTransport = !dev && !isHttpLoopback(request.nextUrl);
  const localMediaOrigin = isHttpLoopback(request.nextUrl)
    ? localDemoMediaOrigin(process.env.PWT_DEMO_BUILD, process.env.PUBLIC_WEB_BASE_URL, process.env.MEDIA_PUBLIC_BASE_URL, process.env.API_BASE_URL)
    : null;
  const policy = contentSecurityPolicy(nonce, dev, upgradeTransport, localMediaOrigin);
  const cspHeader = reportOnly ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";

  const requestHeaders = new Headers(request.headers);
  if (nonce) {
    requestHeaders.set("x-nonce", nonce);
    // Next lee el nonce de la CSP de la PETICIÓN y lo aplica a sus scripts y estilos.
    requestHeaders.set("Content-Security-Policy", policy);
  }

  let response: NextResponse;
  if (isLocalizable(pathname)) {
    // next-intl copia las cabeceras de la petición recibida a la reescritura: se le pasa la clonada.
    const forwarded = nonce ? new NextRequest(request, { headers: requestHeaders }) : request;
    response = handleI18nRouting(forwarded);
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }

  response.headers.set(cspHeader, policy);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(self), usb=(), interest-cohort=()");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  if (upgradeTransport) response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  return response;
}

export const config = {
  // Páginas (no estáticos con hash ni imágenes optimizadas). El SW y los íconos llevan sus cabeceras
  // desde next.config. Incluye los prefetch: sin el proxy, las rutas traducidas (`/en/cart`) no se
  // reescribirían y el prefetch daría 404.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw-voucher.js|robots.txt|sitemap.xml).*)"],
};
