import { createHash } from "node:crypto";

import { env } from "@/lib/env";
import { sessionFromTokens, type AdminSession, type ApiSessionTokens } from "@/lib/session/model";

/**
 * Refresh del access token SERIALIZADO por sesión (mutex en proceso).
 *
 * La API rota el refresh token en cada uso y, si recibe uno ya rotado, revoca toda la sesión
 * (`refresh-token-reused`). Dos peticiones simultáneas del mismo navegador llegan con la misma
 * cookie: la primera rota y la segunda, en lugar de volver a llamar a la API con el token viejo,
 * espera en la cola y recibe el resultado ya rotado (caché de gracia de 90 s por hash del token).
 *
 * El estado vive en `globalThis` para que Proxy y Server Actions (bundles distintos del mismo
 * proceso Node) compartan la misma cola. Con varias réplicas de Next, la afinidad de sesión o un
 * store compartido serían necesarios (documentado en el README).
 */

/** Códigos tras los que la sesión no se puede recuperar: se borra la cookie y se va al login. */
export const TERMINAL_AUTH_CODES = new Set([
  "refresh-token-reused",
  "refresh-token-expired",
  "invalid-refresh-token",
  "session-revoked",
  "access-token-required",
]);

export type RefreshResult = { ok: true; session: AdminSession } | { ok: false; code: string; terminal: boolean };

interface SessionQueue {
  tail: Promise<unknown>;
  rotations: Map<string, { result: RefreshResult; at: number }>;
}

const GRACE_MS = 90_000;
const STORE_KEY = Symbol.for("pwt.admin.refresh-queues");

function queues(): Map<string, SessionQueue> {
  const g = globalThis as unknown as Record<symbol, Map<string, SessionQueue> | undefined>;
  g[STORE_KEY] ??= new Map();
  return g[STORE_KEY];
}

const tokenHash = (token: string) => createHash("sha256").update(token).digest("base64url");

async function callRefresh(refreshToken: string, forward: Record<string, string>): Promise<RefreshResult> {
  let res: Response;
  try {
    res = await fetch(`${env().API_BASE_URL}/auth/staff/refresh`, {
      method: "POST",
      headers: { ...forward, accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
      signal: AbortSignal.timeout(env().ADMIN_API_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, code: "api-unavailable", terminal: false };
  }
  const json = (await res.json().catch(() => null)) as { data?: ApiSessionTokens; code?: string } | null;
  if (res.ok && json?.data) return { ok: true, session: sessionFromTokens(json.data) };
  const code = json?.code ?? `http-${res.status}`;
  // 401 de refresh = sesión irrecuperable; 429/5xx = transitorio (se conserva la sesión).
  return { ok: false, code, terminal: TERMINAL_AUTH_CODES.has(code) || res.status === 401 };
}

export function refreshSession(session: AdminSession, forward: Record<string, string>): Promise<RefreshResult> {
  const all = queues();
  let queue = all.get(session.sid);
  if (!queue) {
    queue = { tail: Promise.resolve(), rotations: new Map() };
    all.set(session.sid, queue);
  }
  const q = queue;
  const key = tokenHash(session.rt);

  const run = q.tail.then(async (): Promise<RefreshResult> => {
    const now = Date.now();
    for (const [k, v] of q.rotations) if (now - v.at > GRACE_MS) q.rotations.delete(k);
    const cached = q.rotations.get(key);
    if (cached) return cached.result;
    const result = await callRefresh(session.rt, forward);
    // Solo se recuerda el resultado definitivo (éxito o terminal); los transitorios se reintentan.
    if (result.ok || result.terminal) q.rotations.set(key, { result, at: Date.now() });
    return result;
  });

  q.tail = run.catch(() => undefined).finally(() => {
    // Limpieza: cola vacía y sin rotaciones recientes.
    if (q.tail === tailRef && q.rotations.size === 0) all.delete(session.sid);
  });
  const tailRef = q.tail;
  return run;
}
