import { NextResponse, type NextRequest } from "next/server";

import { api, ApiError } from "@/lib/api/client";
import type { UploadedMedia } from "@/lib/api/content-types";
import { toUserError, type UserError } from "@/lib/api/errors";
import { assertSameOrigin, can } from "@/lib/auth/guard";
import { checkUpload, MEDIA_FOLDERS, MEDIA_MAX_BYTES } from "@/lib/content";
import { getSession } from "@/lib/session/server";

/**
 * Subida de imágenes vía BFF: el navegador manda el archivo aquí (mismo origen, cookie de sesión) y
 * este handler lo reenvía a `POST /admin/media?folder=` con el token del staff, que nunca sale del
 * servidor. Límite de tamaño antes de leer el cuerpo; la API vuelve a validar el tipo real.
 */
export const dynamic = "force-dynamic";

/** Margen para las cabeceras del multipart. */
const MAX_BODY = MEDIA_MAX_BYTES + 64 * 1024;

function fail(status: number, error: UserError) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!(await assertSameOrigin())) return fail(403, { code: "csrf-origin-mismatch", message: "La solicitud no vino de este panel. Recarga la página e intenta de nuevo." });
  const session = await getSession();
  if (!session) return fail(401, { code: "no-session", message: "Tu sesión terminó. Vuelve a iniciar sesión." });
  if (!can(session, "media:upload")) return fail(403, { code: "insufficient-permissions", message: "No tienes permiso para subir imágenes." });

  const length = Number(request.headers.get("content-length"));
  if (!Number.isFinite(length) || length <= 0) return fail(411, { code: "length-required", message: "No se recibió el archivo." });
  if (length > MAX_BODY) return fail(413, { code: "payload-too-large", message: "La imagen supera el máximo de 8 MB." });

  const folderParam = request.nextUrl.searchParams.get("folder") ?? "";
  const folder = (MEDIA_FOLDERS as readonly string[]).includes(folderParam) ? folderParam : "uploads";

  let file: File | null = null;
  try {
    const form = await request.formData();
    const value = form.get("file");
    file = value instanceof File ? value : null;
  } catch {
    return fail(400, { code: "bad-request", message: "No se pudo leer el archivo enviado." });
  }
  if (!file) return fail(400, { code: "file-required", message: "Adjunta una imagen." });
  const problem = checkUpload(file);
  if (problem) return fail(400, { code: "invalid-file", message: problem });

  const outgoing = new FormData();
  outgoing.set("file", file, file.name.replace(/[^\w.-]/g, "_").slice(0, 120) || "imagen");
  try {
    const body = await api<{ data: UploadedMedia }>("/admin/media", { method: "POST", form: outgoing, query: { folder } });
    const m = body.data;
    // Solo lo que el panel necesita (sin sha256 ni metadatos internos).
    return NextResponse.json(
      { data: { storageKey: m.storageKey, url: m.url, width: m.width, height: m.height, contentType: m.contentType, size: m.size } },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof ApiError) {
      const userError = toUserError({ status: error.status, code: error.code, detail: error.problem?.detail, errors: error.problem?.errors, details: error.problem?.details });
      return fail(error.status || 502, userError);
    }
    console.error("[admin] subida de medio fallida", error);
    return fail(500, { code: "internal-error", message: "Ocurrió un error inesperado. Intenta de nuevo." });
  }
}
