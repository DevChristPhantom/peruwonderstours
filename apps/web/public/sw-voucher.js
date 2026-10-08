/*
 * Service worker del voucher sin conexión (HU-B.A2). Peru Wonders Tours.
 *
 * Alcance: /es/reserva/ (solo controla las páginas de reserva).
 * Reglas de privacidad:
 * - Solo se guarda la página del voucher que ESTE navegador pudo abrir con su cookie httpOnly
 *   `pwt_bk_<código>`: la respuesta se pide a la red con las cookies del propio navegador y se guarda
 *   solo si es 200 y contiene el marcador del mismo código (`data-pwt-voucher="<código>"`).
 * - Con conexión siempre manda la red (network-first). Si el servidor responde 401/403/404/410
 *   (token borrado, vencido o que no coincide), la copia se elimina y no se vuelve a servir.
 * - Nunca se guardan POST (Server Actions de pago), respuestas RSC ni otras rutas con datos.
 * - Los estáticos de /_next/static son públicos e inmutables (nombre con hash).
 */
const PAGES = "pwt-voucher-pages-v1";
const ASSETS = "pwt-voucher-assets-v1";
const KNOWN = [PAGES, ASSETS];
const VOUCHER_RE = /^\/es\/reserva\/([A-Z0-9][A-Z0-9-]{3,39})\/?$/;
const MAX_ASSETS = 120;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith("pwt-voucher-") && !KNOWN.includes(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

function voucherCode(url) {
  const match = VOUCHER_RE.exec(url.pathname);
  return match ? match[1] : null;
}

function pageKey(url) {
  return `${url.origin}${url.pathname.replace(/\/$/, "")}`;
}

function isPublicAsset(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/_next/image") || url.pathname === "/logo.png";
}

/** Guarda la respuesta del voucher solo si es la página real de ESE código. */
async function storeVoucher(url, response) {
  const code = voucherCode(url);
  const cache = await caches.open(PAGES);
  if (!code) return false;
  if ([401, 403, 404, 410].includes(response.status)) {
    await cache.delete(pageKey(url));
    return false;
  }
  if (!response.ok || response.redirected) return false;
  const type = response.headers.get("content-type") || "";
  if (!type.includes("text/html")) return false;
  const html = await response.text();
  if (!html.includes(`data-pwt-voucher="${code}"`)) return false;
  await cache.put(
    pageKey(url),
    new Response(html, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", "x-pwt-saved-at": new Date().toISOString() },
    }),
  );
  return true;
}

async function trimAssets() {
  const cache = await caches.open(ASSETS);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ASSETS)).map((k) => cache.delete(k)));
}

const OFFLINE_HTML = `<!doctype html><html lang="es-PE"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin conexión · Peru Wonders Tours</title>
<meta name="color-scheme" content="light dark"><style>body{font-family:system-ui,sans-serif;margin:0;padding:32px 16px;background:Canvas;color:CanvasText}main{max-width:560px;margin:auto}a{color:LinkText}</style></head>
<body><main><h1>Sin conexión</h1><p>Este voucher todavía no se guardó en este dispositivo. Ábrelo una vez con internet para tenerlo disponible sin conexión.</p><p><a href="">Reintentar</a></p></main></body></html>`;

async function handleVoucherNavigation(event) {
  const request = event.request;
  const url = new URL(request.url);
  try {
    const response = await fetch(request);
    // Se guarda en segundo plano: el navegador recibe la respuesta sin esperar a la caché.
    event.waitUntil(storeVoucher(url, response.clone()).catch(() => false));
    return response;
  } catch {
    const cached = await caches.match(pageKey(url), { cacheName: PAGES });
    if (cached) return cached;
    return new Response(OFFLINE_HTML, { status: 503, headers: { "content-type": "text/html; charset=utf-8" } });
  }
}

async function handleAsset(request) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    await cache.put(request, response.clone());
    void trimAssets();
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate" && voucherCode(url)) {
    event.respondWith(handleVoucherNavigation(event));
    return;
  }
  // Las peticiones RSC (navegación del cliente) no se guardan: siempre red.
  if (request.headers.get("rsc") || url.searchParams.has("_rsc")) return;
  if (isPublicAsset(url)) event.respondWith(handleAsset(request));
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  const port = event.ports && event.ports[0];
  const reply = (payload) => port && port.postMessage(payload);

  if (data.type === "save-voucher" && typeof data.path === "string") {
    event.waitUntil(
      (async () => {
        try {
          const url = new URL(data.path, self.location.origin);
          if (!voucherCode(url)) return reply({ ok: false });
          // Se pide con las cookies del propio navegador (same-origin): el servidor decide.
          const response = await fetch(url.toString(), { credentials: "same-origin", cache: "no-store" });
          const ok = await storeVoucher(url, response);
          const assets = Array.isArray(data.assets) ? data.assets.slice(0, 80) : [];
          const cache = await caches.open(ASSETS);
          await Promise.all(
            assets.map(async (href) => {
              try {
                const assetUrl = new URL(href, self.location.origin);
                if (assetUrl.origin !== self.location.origin || !isPublicAsset(assetUrl)) return;
                if (await cache.match(assetUrl.toString())) return;
                const res = await fetch(assetUrl.toString());
                if (res.ok) await cache.put(assetUrl.toString(), res);
              } catch {
                /* un estático que falla no impide guardar el voucher */
              }
            }),
          );
          reply({ ok, savedAt: ok ? new Date().toISOString() : null });
        } catch {
          reply({ ok: false });
        }
      })(),
    );
  }

  if (data.type === "status-voucher" && typeof data.path === "string") {
    event.waitUntil(
      (async () => {
        const url = new URL(data.path, self.location.origin);
        const cached = await caches.match(pageKey(url), { cacheName: PAGES });
        reply({ saved: !!cached, savedAt: cached ? cached.headers.get("x-pwt-saved-at") : null });
      })(),
    );
  }

  if (data.type === "forget-voucher" && typeof data.path === "string") {
    event.waitUntil(
      (async () => {
        const url = new URL(data.path, self.location.origin);
        const cache = await caches.open(PAGES);
        await cache.delete(pageKey(url));
        reply({ ok: true });
      })(),
    );
  }
});
