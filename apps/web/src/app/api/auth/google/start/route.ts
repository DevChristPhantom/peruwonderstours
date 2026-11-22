import { NextResponse } from "next/server";

import { localePath } from "@/i18n/paths";
import { authorizeUrl, callbackUrl, encodeState, GOOGLE_STATE_COOKIE, googleSignInEnabled, newState, stateCookieOptions } from "@/lib/account/google";

export const dynamic = "force-dynamic";

/** `GET /api/auth/google/start?locale=es`: guarda state/PKCE/nonce y lleva a la pantalla de Google. */
export function GET(request: Request) {
  const locale = new URL(request.url).searchParams.get("locale");
  const state = newState(locale);
  if (!googleSignInEnabled()) {
    return NextResponse.redirect(new URL(localePath(state.locale, "/cuenta/acceso"), callbackUrl(request.url)), 303);
  }
  const res = NextResponse.redirect(authorizeUrl(state, callbackUrl(request.url)), 303);
  res.cookies.set(GOOGLE_STATE_COOKIE, encodeState(state), stateCookieOptions);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
