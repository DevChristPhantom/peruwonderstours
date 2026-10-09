import { NextResponse, type NextRequest } from "next/server";

import { cookieOptions, SESSION_COOKIE } from "@/lib/session/model";

/**
 * Salida forzada desde el render: un Server Component no puede borrar cookies, así que ante un
 * 401 irrecuperable redirige aquí, que borra la cookie de sesión y manda al login con el motivo.
 * GET sin efectos fuera de este navegador (no revoca nada en la API): no es un vector CSRF útil.
 */
export function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("motivo") ?? "sesion";
  const motivo = /^[a-z-]{2,40}$/.test(raw) ? raw : "sesion";
  const res = NextResponse.redirect(new URL(`/login?motivo=${motivo}`, request.url), 303);
  res.cookies.set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return res;
}
