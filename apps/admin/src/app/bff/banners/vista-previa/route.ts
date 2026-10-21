import { NextResponse, type NextRequest } from "next/server";
import { apiBinary, ApiError } from "@/lib/api/client";
import { can } from "@/lib/auth/guard";
import { getSession } from "@/lib/session/server";

export const dynamic = "force-dynamic";
const IMAGE_TYPES = /^image\/(png|jpeg|webp|avif)$/;

/** Vista previa de un banner (también inactivos) para el panel. `GET /bff/banners/vista-previa?id=` */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse(null, { status: 401 });
  if (!can(session, "tours:read")) return new NextResponse(null, { status: 403 });
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) return new NextResponse(null, { status: 400 });
  try {
    const image = await apiBinary(`/admin/hero-banners/${id}/poster`);
    // Solo se reenvían tipos de imagen conocidos (nunca HTML) para no servir contenido activo.
    if (!IMAGE_TYPES.test(image.contentType.split(";")[0] ?? "")) return new NextResponse(null, { status: 415 });
    return new NextResponse(image.body, { headers: { "Content-Type": image.contentType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    return new NextResponse(null, { status: error instanceof ApiError && error.status ? error.status : 502 });
  }
}
