import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { localePath } from "@/i18n/paths";
import type { Locale } from "@/i18n/routing";
import { decodeState, GOOGLE_STATE_COOKIE, callbackUrl, sameState, stateCookieOptions } from "@/lib/account/google";
import { writeCustomerSession } from "@/lib/account/session";
import { signInWithGoogle } from "@/lib/api/access";
import { ApiError } from "@/lib/api/client";

export const dynamic = "force-dynamic";

type Outcome = "ok" | "sin-reservas" | "error" | "cancelado";

/**
 * `GET /api/auth/google/callback`: vuelta desde Google. Comprueba el `state`, borra la cookie de un solo
 * uso, pide a la API que canjee el código y, si hay reservas con ese correo, abre "Mis reservas".
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const jar = await cookies();
  const saved = decodeState(jar.get(GOOGLE_STATE_COOKIE)?.value);
  const locale: Locale = saved?.locale ?? "es";
  const base = callbackUrl(request.url);

  const finish = (outcome: Outcome) => {
    const target =
      outcome === "ok"
        ? localePath(locale, "/mis-reservas")
        : localePath(locale, { pathname: "/cuenta/acceso", query: { google: outcome } });
    const res = NextResponse.redirect(new URL(target, base), 303);
    res.cookies.set(GOOGLE_STATE_COOKIE, "", { ...stateCookieOptions, maxAge: 0 });
    res.headers.set("Cache-Control", "no-store");
    // El código de Google va en la URL de esta respuesta: que no se filtre por Referer.
    res.headers.set("Referrer-Policy", "no-referrer");
    return res;
  };

  if (url.searchParams.get("error")) return finish("cancelado");
  const code = url.searchParams.get("code");
  if (!saved || !code || !sameState(url.searchParams.get("state"), saved.state)) return finish("error");

  try {
    const session = await signInWithGoogle({ code, codeVerifier: saved.verifier, redirectUri: base, nonce: saved.nonce });
    await writeCustomerSession(session.sessionToken, session.expiresAt);
  } catch (error) {
    if (error instanceof ApiError && error.code === "google-account-without-bookings") return finish("sin-reservas");
    return finish("error");
  }
  return finish("ok");
}
