import { readFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import { heroDocumentHeaders } from "@/lib/content/hero-document-policy";

const builtinFiles: Record<string, string> = { "builtin-titicaca": "titicaca.html", "builtin-machu-picchu": "machu-picchu.html" };
export async function GET(request: Request, context: { params: Promise<{ id: string; kind: string }> }) {
  const { id, kind } = await context.params;
  const unavailable = (status: number) => kind === "document"
    ? new Response('<!doctype html><html><head><style>html,body{margin:0;background:transparent}</style></head><body></body></html>', { status, headers: heroDocumentHeaders(new URL(request.url).origin) })
    : new Response(null, { status });
  if (!["document", "poster"].includes(kind)) return new Response(null, { status: 404 });
  if (builtinFiles[id] && kind === "document") {
    for (const directory of ["src/content/hero-motion", "apps/web/src/content/hero-motion"]) {
      try {
        const html = await readFile(path.join(process.cwd(), directory, builtinFiles[id]), "utf8");
        return new Response(html, { headers: heroDocumentHeaders(new URL(request.url).origin) });
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") return unavailable(502); }
    }
    return unavailable(502);
  }
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)) return unavailable(404);
  try {
    const upstream = await fetch(`${env.API_BASE_URL}/hero-banners/${id}/${kind}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!upstream.ok) return unavailable(upstream.status === 404 ? 404 : 502);
    if (kind === "document") {
      const html = await upstream.text();
      if (Buffer.byteLength(html) > 16 * 1024 * 1024) return unavailable(502);
      return new Response(html, { headers: heroDocumentHeaders(new URL(request.url).origin) });
    }
    const type = upstream.headers.get("content-type")?.split(";")[0];
    if (!type || !["image/png", "image/jpeg", "image/webp", "image/avif"].includes(type)) return new Response(null, { status: 502 });
    return new Response(await upstream.arrayBuffer(), { headers: { "Content-Type": type, "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=3600" } });
  } catch { return unavailable(502); }
}
