import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { isLocale, type Locale } from "@/i18n/routing";
import { env, isProduction } from "@/lib/env";
import { SITE } from "@/lib/site";

/**
 * "Continuar con Google" (OpenID Connect, flujo de código con PKCE y nonce). Este módulo solo arma la
 * ida a Google y guarda el estado; el código lo canjea la API, que tiene el secreto y valida el ID token.
 *
 * El estado viaja en una cookie httpOnly de 10 minutos limitada a `/api/auth/google`, con SameSite=Lax
 * (la vuelta desde Google es una navegación de nivel superior, que Lax sí permite).
 */
export const GOOGLE_CALLBACK_PATH = "/api/auth/google/callback";
export const GOOGLE_STATE_COOKIE = "pwt_google_oauth";
const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export interface GoogleOAuthState {
  state: string;
  verifier: string;
  nonce: string;
  locale: Locale;
}

export const stateCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: isProduction,
  path: "/api/auth/google",
  maxAge: 600,
};

export function googleSignInEnabled(): boolean {
  return Boolean(env.GOOGLE_OAUTH_CLIENT_ID);
}

const random = (bytes: number) => randomBytes(bytes).toString("base64url");

/** En producción, siempre el dominio público (detrás del proxy la petición llega como http interno). */
export function callbackUrl(requestUrl: string): string {
  const origin = isProduction ? SITE.url : new URL(requestUrl).origin;
  return new URL(GOOGLE_CALLBACK_PATH, origin).toString();
}

export function newState(locale: string | null): GoogleOAuthState {
  return { state: random(24), verifier: random(48), nonce: random(24), locale: isLocale(locale) ? locale : "es" };
}

export function authorizeUrl(state: GoogleOAuthState, redirectUri: string): string {
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: env.GOOGLE_OAUTH_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: state.state,
    nonce: state.nonce,
    code_challenge: createHash("sha256").update(state.verifier).digest("base64url"),
    code_challenge_method: "S256",
    prompt: "select_account",
    hl: state.locale === "pt" ? "pt-BR" : state.locale,
  }).toString();
  return url.toString();
}

export function encodeState(state: GoogleOAuthState): string {
  return Buffer.from(JSON.stringify(state)).toString("base64url");
}

export function decodeState(raw: string | undefined): GoogleOAuthState | null {
  if (!raw || raw.length > 1024) return null;
  try {
    const v = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<GoogleOAuthState>;
    if (typeof v.state !== "string" || typeof v.verifier !== "string" || typeof v.nonce !== "string" || !isLocale(v.locale)) return null;
    return { state: v.state, verifier: v.verifier, nonce: v.nonce, locale: v.locale };
  } catch {
    return null;
  }
}

/** Comparación en tiempo constante del `state` devuelto por Google (anti-CSRF). */
export function sameState(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
