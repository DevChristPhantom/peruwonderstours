/**
 * Orígenes del formulario de Izipay: su iframe y API (`*.izipay.pe`) y su antifraude
 * (ThreatMetrix, `*.online-metrix.net`). El script del SDK entra por `'strict-dynamic'`
 * (lo inserta nuestro código con nonce); `https:` en script-src solo aplica a navegadores sin CSP3.
 */
const IZIPAY_ORIGINS = "https://*.izipay.pe https://*.online-metrix.net";

/**
 * Google Analytics 4 (solo con NEXT_PUBLIC_GA_ID y tras el consentimiento: lib/analytics/consent.ts).
 * gtag.js viene de googletagmanager.com y envía las visitas a *.google-analytics.com.
 */
const GA_SCRIPT_ORIGIN = "https://www.googletagmanager.com";
const GA_BEACON_ORIGINS = "https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com";

export function contentSecurityPolicy(
  nonce: string | null,
  dev: boolean,
  upgradeTransport: boolean,
  localMediaOrigin: string | null = null,
  izipay = false,
  analytics = false,
): string {
  const ga = analytics ? ` ${GA_SCRIPT_ORIGIN}` : "";
  const scripts = nonce ? `'self' 'nonce-${nonce}' 'strict-dynamic'${izipay ? ` ${IZIPAY_ORIGINS}` : ""}${ga}` : `'self' 'unsafe-inline'${ga}`;
  const pay = izipay ? ` ${IZIPAY_ORIGINS}` : "";
  const beacons = analytics ? ` ${GA_BEACON_ORIGINS}` : "";
  return [
    "default-src 'self'",
    `script-src ${scripts}${dev ? " 'unsafe-eval'" : ""}`,
    nonce && !dev ? `style-src-elem 'self' 'nonce-${nonce}'${pay}` : `style-src-elem 'self' 'unsafe-inline'${pay}`,
    "style-src-attr 'unsafe-inline'",
    `img-src 'self' data: blob:${localMediaOrigin ? ` ${localMediaOrigin}` : ""}${pay}${beacons}`,
    `font-src 'self'${pay}`,
    "media-src 'self'",
    `connect-src 'self'${dev ? " ws: wss:" : ""}${pay}${beacons}`,
    // Service worker del voucher offline (/sw-voucher.js) y manifest de la reserva.
    "worker-src 'self'",
    "manifest-src 'self'",
    izipay ? `frame-src${pay}` : "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(upgradeTransport ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}
