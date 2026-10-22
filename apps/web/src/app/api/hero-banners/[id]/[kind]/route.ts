import { env } from "@/lib/env";

/** Only raster posters and validated MP4 are public; video bytes are streamed. */
export async function GET(request: Request, context: { params: Promise<{ id: string; kind: string }> }) {
  const { id, kind } = await context.params;
  if (!["poster", "video"].includes(kind) || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)) return new Response(null, { status: 404 });
  try {
    const range = kind === "video" ? request.headers.get("range") : null;
    const deadline = new AbortController();
    const timer = setTimeout(() => deadline.abort(), 10_000);
    let upstream: Response;
    try { upstream = await fetch(`${env.API_BASE_URL}/hero-banners/${id}/${kind}`, { cache: "no-store", headers: range ? { Range: range } : {}, signal: AbortSignal.any([request.signal, deadline.signal]) }); }
    finally { clearTimeout(timer); }
    const headers = new Headers({ "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" });
    if (kind === "video" && upstream.status === 416) {
      headers.set("Content-Range", upstream.headers.get("content-range") ?? "bytes */0");
      await upstream.body?.cancel();
      return new Response(null, { status: 416, headers });
    }
    if (!upstream.ok) { await upstream.body?.cancel(); return new Response(null, { status: upstream.status === 404 ? 404 : 502 }); }
    const type = upstream.headers.get("content-type")?.split(";")[0];
    if (!type || !(kind === "video" ? ["video/mp4"] : ["image/png", "image/jpeg", "image/webp", "image/avif"]).includes(type)) { await upstream.body?.cancel(); return new Response(null, { status: 502 }); }
    headers.set("Content-Type", type);
    // Rendimiento: cada banner guarda su archivo una sola vez con un id nuevo (escritura exclusiva
    // en la API), así que el contenido de esta URL nunca cambia: el navegador lo reutiliza en vez de
    // volver a bajar el video (~10 MB) en cada visita. Los errores siguen sin caché.
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    for (const name of ["content-length", "accept-ranges", "content-range"]) { const value = upstream.headers.get(name); if (value) headers.set(name, value); }
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch { return new Response(null, { status: 502 }); }
}
