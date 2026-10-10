import { colors } from "@pwt/ui/tokens";

import { bookingPath } from "@/i18n/paths";
import { INTL_LOCALE, isLocale } from "@/i18n/routing";
import { BOOKING_CODE_RE } from "@/lib/checkout/session";
import { SITE } from "@/lib/site";

/**
 * Manifest por reserva (HU-B.A2): al instalar desde el voucher, el ícono de la pantalla de inicio abre
 * ESE voucher (start_url), incluso sin conexión (lo sirve el service worker). Solo contiene el código,
 * que el viajero ya tiene; nunca datos personales. No lee cookies.
 */
export async function GET(_req: Request, ctx: RouteContext<"/[locale]/reserva/[codigo]/manifest.webmanifest">) {
  const { locale: rawLocale, codigo } = await ctx.params;
  if (!isLocale(rawLocale)) return new Response("Not found", { status: 404 });
  const locale = rawLocale;
  const code = decodeURIComponent(codigo).toUpperCase();
  if (!BOOKING_CODE_RE.test(code)) return new Response("Not found", { status: 404 });
  // `/es/reserva/CODIGO` o `/en/booking/CODIGO`; el ámbito es la carpeta de reservas del idioma.
  const path = bookingPath(locale, code);
  const scope = path.slice(0, path.lastIndexOf("/") + 1);
  const manifest = {
    id: path,
    name: `Voucher ${code} · ${SITE.name}`,
    short_name: locale === "es" ? "Mi voucher" : "My voucher",
    description: locale === "es" ? `Tu voucher de ${SITE.name}, disponible sin conexión.` : `Your ${SITE.name} voucher, available offline.`,
    lang: INTL_LOCALE[locale],
    dir: "ltr",
    start_url: path,
    scope,
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
