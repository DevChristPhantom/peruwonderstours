import { colors } from "@pwt/ui/tokens";

import { BOOKING_CODE_RE } from "@/lib/checkout/session";
import { SITE } from "@/lib/site";

/**
 * Manifest por reserva (HU-B.A2): al instalar desde el voucher, el ícono de la pantalla de inicio abre
 * ESE voucher (start_url), incluso sin conexión (lo sirve el service worker). Solo contiene el código,
 * que el viajero ya tiene; nunca datos personales. No lee cookies.
 */
export async function GET(_req: Request, ctx: RouteContext<"/es/reserva/[codigo]/manifest.webmanifest">) {
  const { codigo } = await ctx.params;
  const code = decodeURIComponent(codigo).toUpperCase();
  if (!BOOKING_CODE_RE.test(code)) return new Response("Not found", { status: 404 });
  const path = `/es/reserva/${code}`;
  const manifest = {
    id: path,
    name: `Voucher ${code} · ${SITE.name}`,
    short_name: "Mi voucher",
    description: "Tu voucher de Peru Wonders Tours, disponible sin conexión.",
    lang: "es-PE",
    dir: "ltr",
    start_url: path,
    scope: "/es/reserva/",
    display: "standalone",
    orientation: "portrait",
    background_color: colors.light.background,
    theme_color: colors.light.primary,
    icons: [
      { src: "/icons/pwa/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/pwa/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/pwa/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
      "cache-control": "public, max-age=3600",
      "x-robots-tag": "noindex",
    },
  });
}
