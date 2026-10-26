import "server-only";

import { env } from "@/lib/env";

/**
 * Qué datos cachea la web pública según la ruta de la API que cambió (tags de `next.fetch` en
 * apps/web). Una escritura en el panel que coincide avisa a la web para que deje de servir la
 * copia vieja: así una portada, un precio o un banner nuevos se ven en la siguiente visita.
 */
const TAGS_BY_PATH: [RegExp, string[]][] = [
  [/^\/admin\/(tours|seasons|rates|destinations|categories|media)(\/|$)/, ["catalog", "departures"]],
  [/^\/admin\/departures(\/|$)/, ["departures", "catalog"]],
  [/^\/admin\/bookings(\/|$)/, ["departures"]],
  [/^\/admin\/blog-posts(\/|$)/, ["content"]],
  [/^\/admin\/testimonials(\/|$)/, ["content", "testimonials"]],
  [/^\/admin\/hero-banners(\/|$)/, ["hero-banners"]],
  [/^\/admin\/promotions(\/|$)/, ["promotions"]],
];

export function publicTagsFor(path: string): string[] {
  const clean = path.split("?")[0] ?? "";
  return [...new Set(TAGS_BY_PATH.filter(([re]) => re.test(clean)).flatMap(([, tags]) => tags))];
}

/**
 * Avisa a la web (POST /api/revalidate con secreto compartido). Nunca hace fallar la acción del
 * panel: si la web no responde, el contenido igual se actualiza al vencer su caché (≤ 1 h).
 */
export async function notifyPublicSite(path: string): Promise<void> {
  const tags = publicTagsFor(path);
  const { REVALIDATE_SECRET, WEB_REVALIDATE_URLS, PUBLIC_WEB_BASE_URL } = env();
  if (!tags.length || !REVALIDATE_SECRET) return;
  const targets = WEB_REVALIDATE_URLS.length ? WEB_REVALIDATE_URLS : [`${PUBLIC_WEB_BASE_URL}/api/revalidate`];
  await Promise.allSettled(
    targets.map((url) =>
      fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-revalidate-secret": REVALIDATE_SECRET },
        body: JSON.stringify({ tags }),
        cache: "no-store",
        signal: AbortSignal.timeout(2_000),
      }),
    ),
  );
}
