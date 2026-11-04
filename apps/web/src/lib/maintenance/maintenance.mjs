/**
 * Página de mantenimiento (una sola fuente para los dos casos):
 *
 * 1. Mantenimiento planificado con la web encendida: `MAINTENANCE_MODE=on` → el proxy responde esta
 *    página con 503 a toda página pública (las rutas `/api/` y los archivos siguen respondiendo).
 * 2. Web apagada durante un despliegue: Next no puede responder nada. El servidor de delante (nginx o
 *    Caddy) sirve `public/mantenimiento.html`, generado desde aquí con `scripts/build-maintenance-page.mjs`.
 *
 * HTML autosuficiente: estilos en línea y sin imágenes ni scripts, para que funcione sin el resto del sitio.
 * 503 + Retry-After le dice a Google que es temporal: no desindexa las páginas.
 */

export const RETRY_AFTER_SECONDS = 600;

/** Cabeceras de la respuesta 503. CSP propia: la página no carga nada externo. */
export const MAINTENANCE_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Retry-After": String(RETRY_AFTER_SECONDS),
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

/** Activo solo con `on`, `true` o `1` (cualquier otro valor o ausente: apagado). */
export function isMaintenanceOn(value) {
  return ["on", "true", "1"].includes(String(value ?? "").trim().toLowerCase());
}

/** Rutas que siguen respondiendo durante el mantenimiento: API propia y archivos con extensión. */
export function bypassesMaintenance(pathname) {
  return pathname.startsWith("/api/") || /\.[a-z0-9]+$/i.test(pathname);
}

/** @param {{ whatsappDigits: string; whatsappDisplay: string }} contact */
export function maintenanceHtml({ whatsappDigits, whatsappDisplay }) {
  const wa = (text) => `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(text)}`;
  return `<!doctype html>
<html lang="es-PE">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="60">
<title>Volvemos en unos minutos · peruwonderstours</title>
<style>
:root{--bg:#F7F5F2;--surface:#FFFFFF;--fg:#1F1C19;--muted:#5F574C;--line:#E0DAD2;--primary:#153F63;--accent:#A34224;--on-accent:#FFFFFF;--green:#23794F;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{--bg:#0B1013;--surface:#12191E;--fg:#F3F0EB;--muted:#B5ADA3;--line:#2A353D;--primary:#7AA8CC;--accent:#D46F4D;--on-accent:#1F1C19;--green:#6FBA92}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px 16px;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{width:100%;max-width:560px;background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:40px 28px;text-align:center;box-shadow:0 10px 30px rgb(0 0 0 / .06)}
.brand{margin:0 0 28px;font:600 26px/1.1 Georgia,"Times New Roman",serif;color:var(--primary)}
.brand span{color:var(--green)}
.brand small{display:block;font-size:20px;color:var(--fg)}
svg{display:block;margin:0 auto 20px;color:var(--accent)}
h1{margin:0;font:500 clamp(26px,6vw,34px)/1.2 Georgia,"Times New Roman",serif}
p{margin:12px 0 0;color:var(--muted)}
.cta{display:inline-flex;align-items:center;justify-content:center;min-height:48px;margin-top:24px;padding:0 22px;border-radius:8px;background:var(--accent);color:var(--on-accent);font-weight:600;text-decoration:none}
.cta:focus-visible{outline:3px solid var(--primary);outline-offset:3px}
.other{margin-top:32px;padding-top:20px;border-top:1px solid var(--line);font-size:14px}
.other p{margin:6px 0 0}
.other a{color:var(--primary)}
.note{margin-top:20px;font-size:13px}
</style>
</head>
<body>
<main>
<p class="brand" aria-label="Peru Wonders Tours">Peru<span>Wonders</span><small>Tours</small></p>
<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/><path d="M4.14 15.08c2.62-1.57 5.24-1.43 7.86.42 2.74 1.94 5.49 2 8.23.19"/></svg>
<h1>Estamos mejorando la web</h1>
<p>Volvemos en unos minutos. Tus reservas ya confirmadas siguen vigentes. Si necesitas ayuda ahora, escríbenos por WhatsApp.</p>
<a class="cta" href="${wa("Hola Peru Wonders Tours, la web está en mantenimiento y necesito ayuda.")}" rel="noopener noreferrer">WhatsApp ${whatsappDisplay}</a>
<div class="other">
<p lang="en"><strong>We'll be back in a few minutes.</strong> Your confirmed bookings remain valid. <a href="${wa("Hi Peru Wonders Tours, the website is under maintenance and I need help.")}" rel="noopener noreferrer">Message us on WhatsApp</a>.</p>
<p lang="pt-BR"><strong>Voltamos em poucos minutos.</strong> Suas reservas confirmadas continuam válidas. <a href="${wa("Olá Peru Wonders Tours, o site está em manutenção e preciso de ajuda.")}" rel="noopener noreferrer">Fale conosco pelo WhatsApp</a>.</p>
</div>
<p class="note">Esta página se recarga sola cada minuto.</p>
</main>
</body>
</html>
`;
}
