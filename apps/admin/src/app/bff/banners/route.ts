import { NextResponse, type NextRequest } from "next/server";
import { api, ApiError } from "@/lib/api/client";
import { toUserError, type UserError } from "@/lib/api/errors";
import { assertSameOrigin, can } from "@/lib/auth/guard";
import { getSession } from "@/lib/session/server";
import type { Permission } from "@/lib/auth/permissions";
import { BANNER_MAX_BYTES, type HeroBanner } from "@/components/banners/types";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };
function fail(status: number, error: UserError) { return NextResponse.json({ error }, { status, headers: noStore }); }
async function authorize(mutation: boolean, ...permissions: Permission[]) {
  if (mutation && !(await assertSameOrigin())) return fail(403, { code: "csrf-origin-mismatch", message: "Recarga el panel e intenta de nuevo." });
  const session = await getSession();
  if (!session) return fail(401, { code: "no-session", message: "Tu sesión terminó. Vuelve a iniciar sesión." });
  if (!can(session, ...permissions)) return fail(403, { code: "insufficient-permissions", message: "No tienes permiso para gestionar banners." });
  return null;
}
async function forward(fn: () => Promise<unknown>, status = 200) {
  try { return NextResponse.json(await fn(), { status, headers: noStore }); }
  catch (error) {
    if (error instanceof ApiError) return fail(error.status || 502, toUserError({ status: error.status, code: error.code, detail: error.problem?.detail, errors: error.problem?.errors }));
    return fail(500, { code: "internal-error", message: "No se pudo completar la operación. Intenta de nuevo." });
  }
}
/** Bound streaming bodies too; a declared Content-Length is not trusted. */
async function bounded(request: NextRequest, limit: number) {
  if (!request.body) throw new Error("missing-body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > limit) { await reader.cancel(); throw new Error("payload-too-large"); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}
export async function GET() {
  const denied = await authorize(false, "tours:read"); if (denied) return denied;
  return forward(() => api<{ data: HeroBanner[] }>("/admin/hero-banners"));
}
export async function POST(request: NextRequest) {
  const denied = await authorize(true, "media:upload", "tours:write"); if (denied) return denied;
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data;")) return fail(400, { code: "invalid-file", message: "Adjunta un archivo HTML." });
  let form: FormData;
  try {
    const bytes = await bounded(request, BANNER_MAX_BYTES + 64 * 1024);
    form = await new Response(bytes, { headers: { "Content-Type": contentType } }).formData();
  } catch (error) {
    return fail(error instanceof Error && error.message === "payload-too-large" ? 413 : 400, { code: "invalid-file", message: "No se pudo leer el archivo. El máximo es 16 MB." });
  }
  const file = form.get("file");
  const title = form.get("title");
  if (!(file instanceof File) || !/\.html?$/i.test(file.name) || file.size === 0 || file.size > BANNER_MAX_BYTES) return fail(400, { code: "invalid-file", message: "Selecciona un archivo .html o .htm de hasta 16 MB." });
  if (typeof title !== "string" || !title.trim() || title.trim().length > 120) return fail(400, { code: "invalid-title", message: "Escribe un título de 1 a 120 caracteres." });
  const outgoing = new FormData();
  outgoing.set("file", file, file.name.replace(/[^\w.-]/g, "_").slice(0, 120));
  outgoing.set("title", title.trim());
  return forward(() => api<{ data: HeroBanner }>("/admin/hero-banners", { method: "POST", form: outgoing }), 201);
}
export async function PATCH(request: NextRequest) {
  const denied = await authorize(true, "tours:write"); if (denied) return denied;
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) return fail(400, { code: "invalid-id", message: "Banner inválido." });
  let value: Record<string, unknown>;
  try { value = JSON.parse(new TextDecoder().decode(await bounded(request, 4096))); }
  catch { return fail(400, { code: "bad-request", message: "No se pudo leer el cambio solicitado." }); }
  if (!value || typeof value !== "object" || Array.isArray(value) || !Number.isSafeInteger(value.revision)) return fail(400, { code: "bad-request", message: "Recarga la lista antes de guardar." });
  const body = { title: value.title, enabled: value.enabled, sortOrder: value.sortOrder, revision: value.revision };
  return forward(() => api<{ data: HeroBanner }>(`/admin/hero-banners/${id}`, { method: "PATCH", body }));
}
