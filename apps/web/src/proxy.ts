import { NextResponse, type NextRequest } from "next/server";

/**
 * Cabeceras de seguridad del sitio público (H-02). Proxy de Next 16 (runtime Node.js).
 *
 * CSP con nonce por petición en las rutas DINÁMICAS con datos sensibles (checkout, reserva y pago,
 * Libro de Reclamaciones, privacidad, comparador): `script-src 'nonce-…' 'strict-dynamic'`.
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

const NONCE_ROUTES = [/^\/es\/checkout(\/|$)/, /^\/es\/reserva\//, /^\/es\/libro-de-reclamaciones(\/|$)/, /^\/es\/privacidad\//, /^\/es\/comparar(\/|$)/];

/** Fotos del cliente servidas temporalmente desde su sitio (HU-0.3; ver next.config images). */
const IMAGE_ORIGINS = "https://www.andeanperutours.com";

function csp(nonce: string | null, dev: boolean): string {
  const scripts = nonce ? `'self' 'nonce-${nonce}' 'strict-dynamic'` : `'self' 'unsafe-inline'`;
  return [
    "default-src 'self'",
    `script-src ${scripts}${dev ? " 'unsafe-eval'" : ""}`,
    nonce && !dev ? `style-src-elem 'self' 'nonce-${nonce}'` : "style-src-elem 'self' 'unsafe-inline'",
    "style-src-attr 'unsafe-inline'",
    `img-src 'self' data: blob: ${IMAGE_ORIGINS}`,
    "font-src 'self'",
    "media-src 'self'",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    // Service worker del voucher offline (/sw-voucher.js) y manifest de la reserva.
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const dev = process.env.NODE_ENV !== "production";
  const reportOnly = process.env.CSP_REPORT_ONLY === "true";
  const sensitive = NONCE_ROUTES.some((re) => re.test(request.nextUrl.pathname));
  const nonce = sensitive ? Buffer.from(crypto.randomUUID()).toString("base64") : null;
  const policy = csp(nonce, dev);
  const cspHeader = reportOnly ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";

  const requestHeaders = new Headers(request.headers);
  if (nonce) {
    requestHeaders.set("x-nonce", nonce);
    // Next lee el nonce de la CSP de la PETICIÓN y lo aplica a sus scripts y estilos.
    requestHeaders.set("Content-Security-Policy", policy);
  }
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(cspHeader, policy);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(self), usb=(), interest-cohort=()");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  if (!dev) response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  return response;
}

export const config = {
  matcher: [
    {
      // Páginas (no estáticos con hash ni imágenes optimizadas). El SW y los íconos llevan sus cabeceras desde next.config.
      source: "/((?!_next/static|_next/image|favicon.ico|sw-voucher.js|robots.txt|sitemap.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
