import { NextResponse, type NextRequest } from "next/server";
import { can } from "@/lib/auth/guard";
import { env } from "@/lib/env";
import { refreshSession } from "@/lib/session/refresh";
import { getForwardHeaders, getSession, writeSession } from "@/lib/session/server";

export const dynamic = "force-dynamic";
/** Private MP4 preview. Stream upstream bytes and preserve range semantics; never expose the staff token. */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse(null, { status: 401 });
  if (!can(session, "tours:read")) return new NextResponse(null, { status: 403 });
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) return new NextResponse(null, { status: 400 });
  const range = request.headers.get("range");
  if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) return new NextResponse(null, { status: 416 });
  const forward = await getForwardHeaders();
  const send = async (token: string) => {
    const headerTimeout = new AbortController();
    const timer = setTimeout(() => headerTimeout.abort(), 120_000);
    try {
      return await fetch(`${env().API_BASE_URL}/admin/hero-banners/${id}/video`, {
        headers: { ...forward, authorization: `Bearer ${token}`, accept: "video/mp4", ...(range ? { range } : {}) },
        cache: "no-store", redirect: "error", signal: AbortSignal.any([request.signal, headerTimeout.signal]),
      });
    } finally {
      // fetch resolves at headers: slow playback must not inherit a fixed body deadline.
      clearTimeout(timer);
    }
  };
  try {
    let upstream = await send(session.at);
    if (upstream.status === 401) {
      await upstream.body?.cancel();
      const renewed = await refreshSession(session, forward);
      if (!renewed.ok) return new NextResponse(null, { status: 401 });
      await writeSession(renewed.session);
      upstream = await send(renewed.session.at);
    }
    const headers = new Headers({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
    for (const key of ["Content-Range", "Accept-Ranges", "Content-Length", "ETag", "Last-Modified"]) {
      const value = upstream.headers.get(key); if (value) headers.set(key, value);
    }
    if (upstream.status === 416) { await upstream.body?.cancel(); headers.delete("Content-Length"); return new NextResponse(null, { status: 416, headers }); }
    if (![200, 206].includes(upstream.status)) { await upstream.body?.cancel(); return new NextResponse(null, { status: upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502 }); }
    if (upstream.headers.get("content-type")?.split(";")[0].trim() !== "video/mp4") { await upstream.body?.cancel(); return new NextResponse(null, { status: 415 }); }
    headers.set("Content-Type", "video/mp4");
    return new NextResponse(upstream.body, { status: upstream.status, headers });
  } catch { return new NextResponse(null, { status: 502 }); }
}
