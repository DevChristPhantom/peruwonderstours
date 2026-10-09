import { z } from "zod";

import { env, isProduction } from "@/lib/env";
import { seal, unseal } from "@/lib/session/seal";

/**
 * Sesión del staff guardada SOLO en el servidor de Next, dentro de una cookie cifrada
 * (HttpOnly, SameSite=Strict, Secure en producción, prefijo `__Host-`). El navegador no puede
 * leer ni el access token ni el refresh token. Módulo sin `next/headers`: lo usan Proxy y servidor.
 */

export const SESSION_COOKIE = isProduction ? "__Host-pwt_admin" : "pwt_admin";
export const CHALLENGE_COOKIE = isProduction ? "__Host-pwt_admin_mfa" : "pwt_admin_mfa";

/** Cabeceras que Proxy pasa a la app (no salen al navegador). */
export const PATH_HEADER = "x-pwt-path";
export const REQUEST_ID_HEADER = "x-request-id";

/** Refresca si al access token le quedan menos de 2 min (dura 10 min en la API). */
export const REFRESH_MARGIN_MS = 120_000;

export const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "strict" as const,
  path: "/",
};

const profileSchema = z.object({
  id: z.string().min(1).max(64),
  email: z.string().min(3).max(254),
  fullName: z.string().max(200),
  role: z.enum(["admin", "operator", "agent"]),
  permissions: z.array(z.string().max(60)).max(60),
  mfaEnabled: z.boolean(),
});
export type StaffProfile = z.infer<typeof profileSchema>;

const sessionSchema = z.object({
  v: z.literal(1),
  sid: z.string().min(1).max(64),
  at: z.string().min(10).max(4096),
  atExp: z.number().int(),
  rt: z.string().min(10).max(200),
  rtExp: z.number().int(),
  user: profileSchema,
});
export type AdminSession = z.infer<typeof sessionSchema>;

const challengeSchema = z.object({
  kind: z.enum(["mfa", "enroll", "pwchange"]),
  token: z.string().min(10).max(4096),
  exp: z.number().int(),
  email: z.string().max(254),
});
export type LoginChallenge = z.infer<typeof challengeSchema>;

export function sealSession(session: AdminSession): string {
  return seal(session, SESSION_COOKIE);
}

export function unsealSession(raw: string | undefined): AdminSession | null {
  const parsed = sessionSchema.safeParse(unseal(raw, SESSION_COOKIE));
  if (!parsed.success) return null;
  // Refresh vencido: la sesión ya no sirve aunque la cookie siga en el navegador.
  return parsed.data.rtExp > Date.now() ? parsed.data : null;
}

export function sealChallenge(challenge: LoginChallenge): string {
  return seal(challenge, CHALLENGE_COOKIE);
}

export function unsealChallenge(raw: string | undefined): LoginChallenge | null {
  const parsed = challengeSchema.safeParse(unseal(raw, CHALLENGE_COOKIE));
  return parsed.success && parsed.data.exp > Date.now() ? parsed.data : null;
}

/** Respuesta `SessionTokensDataDto` de la API → sesión del BFF. */
export interface ApiSessionTokens {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  sessionId: string;
  user: StaffProfile & { lastLoginAt?: string | null };
}

export function sessionFromTokens(tokens: ApiSessionTokens): AdminSession {
  return {
    v: 1,
    sid: tokens.sessionId,
    at: tokens.accessToken,
    atExp: Date.parse(tokens.accessTokenExpiresAt),
    rt: tokens.refreshToken,
    rtExp: Date.parse(tokens.refreshTokenExpiresAt),
    user: {
      id: tokens.user.id,
      email: tokens.user.email,
      fullName: tokens.user.fullName,
      role: tokens.user.role,
      permissions: tokens.user.permissions,
      mfaEnabled: tokens.user.mfaEnabled,
    },
  };
}

/** Segundos de vida de la cookie: hasta que vence el refresh (12 h de inactividad / 72 h absolutas). */
export function sessionMaxAge(session: AdminSession): number {
  return Math.max(0, Math.floor((session.rtExp - Date.now()) / 1000));
}

/**
 * IP del usuario según `TRUSTED_PROXY_HOPS` (H-07). Nunca se confía en el primer valor de
 * `X-Forwarded-For` (lo controla el cliente): con N proxies de confianza, la IP real es la entrada
 * N-ésima desde la derecha. Con 0 no se reenvía nada y la API ve la IP del servidor de Next.
 */
export function clientIp(source: Headers): string | null {
  const hops = env().TRUSTED_PROXY_HOPS;
  if (hops === 0) return null;
  const chain = (source.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const ip = chain.length >= hops ? chain[chain.length - hops] : undefined;
  return ip && /^[0-9a-fA-F:.]{3,45}$/.test(ip) ? ip : null;
}

/** Cabeceras hacia la API: IP real del usuario (bloqueo y rate limit por IP), id de petición y UA. */
export function forwardHeaders(source: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  const ip = clientIp(source);
  if (ip) out["x-forwarded-for"] = ip;
  const requestId = source.get(REQUEST_ID_HEADER);
  if (requestId && /^[A-Za-z0-9._-]{8,64}$/.test(requestId)) out[REQUEST_ID_HEADER] = requestId;
  const ua = source.get("user-agent");
  if (ua) out["user-agent"] = ua.slice(0, 400);
  return out;
}
