import { env } from "@/lib/env";

/** Native scenes need only validated raster posters. HTML is never served here. */
export async function GET(_request: Request, context: { params: Promise<{ id: string; kind: string }> }) {
  const { id, kind } = await context.params;
  if (kind !== "poster" || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)) return new Response(null, { status: 404 });
  try {
    const upstream = await fetch(`${env.API_BASE_URL}/hero-banners/${id}/poster`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!upstream.ok) return new Response(null, { status: upstream.status === 404 ? 404 : 502 });
    const type = upstream.headers.get("content-type")?.split(";")[0];
    if (!type || !["image/png", "image/jpeg", "image/webp", "image/avif"].includes(type)) return new Response(null, { status: 502 });
    return new Response(await upstream.arrayBuffer(), { headers: { "Content-Type": type, "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=3600" } });
  } catch { return new Response(null, { status: 502 }); }
}
