/** Uploaded scripts may animate only inside an opaque-origin, network-isolated frame. */
export function heroDocumentHeaders(origin: string): Record<string, string> {
  const safeOrigin = new URL(origin).origin;
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Content-Security-Policy": `sandbox allow-scripts; frame-ancestors 'self'; default-src 'none'; img-src 'self' data: blob: ${safeOrigin}; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; worker-src 'none'; media-src 'none'`,
  };
}
