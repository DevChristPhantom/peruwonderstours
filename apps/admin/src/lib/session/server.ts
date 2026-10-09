import "server-only";

import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { cache } from "react";

import {
  CHALLENGE_COOKIE,
  cookieOptions,
  forwardHeaders,
  REQUEST_ID_HEADER,
  SESSION_COOKIE,
  sealChallenge,
  sealSession,
  sessionMaxAge,
  unsealChallenge,
  unsealSession,
  type AdminSession,
  type LoginChallenge,
} from "@/lib/session/model";

/**
 * Acceso a la sesión desde Server Components y Server Actions. Escribir cookies solo es posible
 * en Server Actions y Route Handlers (Next 16); en render, el refresh lo hace Proxy por adelantado.
 */

/** Sesión renovada dentro de la misma petición (Server Action que refrescó tras un 401). */
const requestOverride = cache((): { current: AdminSession | null } => ({ current: null }));

export const getSession = cache(async (): Promise<AdminSession | null> => {
  const override = requestOverride().current;
  if (override) return override;
  return unsealSession((await cookies()).get(SESSION_COOKIE)?.value);
});

/** Solo Server Actions / Route Handlers. */
export async function writeSession(session: AdminSession): Promise<void> {
  requestOverride().current = session;
  (await cookies()).set(SESSION_COOKIE, sealSession(session), { ...cookieOptions, maxAge: sessionMaxAge(session) });
}

/** Solo Server Actions / Route Handlers. */
export async function clearSession(): Promise<void> {
  requestOverride().current = null;
  (await cookies()).set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
}

export async function readChallenge(): Promise<LoginChallenge | null> {
  return unsealChallenge((await cookies()).get(CHALLENGE_COOKIE)?.value);
}

export async function writeChallenge(challenge: LoginChallenge): Promise<void> {
  const maxAge = Math.max(1, Math.floor((challenge.exp - Date.now()) / 1000));
  (await cookies()).set(CHALLENGE_COOKIE, sealChallenge(challenge), { ...cookieOptions, maxAge });
}

export async function clearChallenge(): Promise<void> {
  (await cookies()).set(CHALLENGE_COOKIE, "", { ...cookieOptions, maxAge: 0 });
}

/** IP del usuario, X-Request-Id (de Proxy o nuevo) y User-Agent para la API. */
export const getForwardHeaders = cache(async (): Promise<Record<string, string>> => {
  const h = await headers();
  const out = forwardHeaders(h);
  out[REQUEST_ID_HEADER] ??= randomUUID();
  return out;
});
