/**
 * Orígenes del formulario de Izipay: su iframe y API (`*.izipay.pe`) y su antifraude
 * (ThreatMetrix, `*.online-metrix.net`). El script del SDK entra por `'strict-dynamic'`
 * (lo inserta nuestro código con nonce); `https:` en script-src solo aplica a navegadores sin CSP3.
 */
const IZIPAY_ORIGINS = "https://*.izipay.pe https://*.online-metrix.net";

export function contentSecurityPolicy(
  nonce: string | null,
  dev: boolean,
  upgradeTransport: boolean,
  localMediaOrigin: string | null = null,
  izipay = false,
): string {
  const scripts = nonce ? `'self' 'nonce-${nonce}' 'strict-dynamic'${izipay ? ` ${IZIPAY_ORIGINS}` : ""}` : `'self' 'unsafe-inline'`;
  const pay = izipay ? ` ${IZIPAY_ORIGINS}` : "";
  return [
    "default-src 'self'",
    `script-src ${scripts}${dev ? " 'unsafe-eval'" : ""}`,
    nonce && !dev ? `style-src-elem 'self' 'nonce-${nonce}'${pay}` : `style-src-elem 'self' 'unsafe-inline'${pay}`,
    "style-src-attr 'unsafe-inline'",
    `img-src 'self' data: blob:${localMediaOrigin ? ` ${localMediaOrigin}` : ""}${pay}`,
    `font-src 'self'${pay}`,
    "media-src 'self'",
    `connect-src 'self'${dev ? " ws: wss:" : ""}${pay}`,
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
