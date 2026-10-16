/**
 * Cabeceras de seguridad comunes del panel (Proxy para páginas; next.config para estáticos).
 * La CSP con nonce la arma Proxy por petición.
 */
/** Allow the configured owned website for images; plain HTTP is limited to loopback demos. */
export function publicWebImageOrigin(value: string | undefined): string {
  try {
    const url = new URL(value || "https://peruwonderstours.com");
    return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) ? url.origin : "";
  } catch { return ""; }
}

export function securityHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "Cache-Control": "no-store, max-age=0",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
  };
  if (process.env.NODE_ENV === "production") headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload";
  return headers;
}
