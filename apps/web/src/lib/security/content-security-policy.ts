export function contentSecurityPolicy(nonce: string | null, dev: boolean, upgradeTransport: boolean, localMediaOrigin: string | null = null): string {
  const scripts = nonce ? `'self' 'nonce-${nonce}' 'strict-dynamic'` : `'self' 'unsafe-inline'`;
  return [
    "default-src 'self'",
    `script-src ${scripts}${dev ? " 'unsafe-eval'" : ""}`,
    nonce && !dev ? `style-src-elem 'self' 'nonce-${nonce}'` : "style-src-elem 'self' 'unsafe-inline'",
    "style-src-attr 'unsafe-inline'",
    `img-src 'self' data: blob:${localMediaOrigin ? ` ${localMediaOrigin}` : ""}`,
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
    ...(upgradeTransport ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

