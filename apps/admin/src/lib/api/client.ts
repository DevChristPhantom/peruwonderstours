import "server-only";

import { env } from "@/lib/env";
import { refreshSession } from "@/lib/session/refresh";
import { getForwardHeaders, getSession, writeSession } from "@/lib/session/server";

/**
 * Cliente del BFF hacia la API NestJS. Solo servidor: el navegador nunca habla con la API.
 * - `Authorization: Bearer` con el access token de la sesión cifrada.
 * - Reenvía `X-Forwarded-For` (según TRUSTED_PROXY_HOPS), `X-Request-Id` y `User-Agent`.
 * - Ante `401 access-token-expired` refresca (cola serializada por sesión) y reintenta una vez.
 * - Errores RFC 9457 → `ApiError` con `code` estable; red caída → `api-unavailable`.
 */

export interface ProblemDetails {
  type?: string;
  title?: string;
  status: number;
  detail?: string;
  code?: string;
  traceId?: string;
  errors?: { field: string; messages: string[] }[];
  details?: Record<string, unknown>;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly problem: ProblemDetails | null,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(problem?.detail ?? `API ${status} (${code})`);
    this.name = "ApiError";
  }
}

/** Sin sesión válida en el BFF (cookie ausente, vencida o manipulada). */
export class NoSessionError extends ApiError {
  constructor() {
    super(401, "no-session", null);
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

export interface ApiOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Cuerpo multipart (subida de medios); excluyente con `body`. */
  form?: FormData;
  query?: Query;
  idempotencyKey?: string;
  /** false = endpoint público (login, MFA): no exige sesión. */
  auth?: boolean;
}

const EXPIRED_ACCESS = new Set(["access-token-expired", "invalid-access-token"]);

function buildUrl(path: string, query?: Query): string {
  const url = new URL(`${env().API_BASE_URL}${path}`);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  return url.toString();
}

async function send(path: string, options: ApiOptions, accessToken: string | null): Promise<Response> {
  const headers: Record<string, string> = {
    ...(await getForwardHeaders()),
    accept: "application/json, application/problem+json",
  };
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (options.idempotencyKey) headers["idempotency-key"] = options.idempotencyKey;
  try {
    return await fetch(buildUrl(path, options.query), {
      method: options.method ?? "GET",
      headers,
      // Con FormData, fetch arma el `content-type` multipart con su boundary.
      body: options.form ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
      cache: "no-store",
      signal: AbortSignal.timeout(env().ADMIN_API_TIMEOUT_MS),
    });
  } catch {
    throw new ApiError(0, "api-unavailable", null);
  }
}

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  if (res.ok) return json as T;
  const problem = json && typeof json === "object" && "status" in json ? ({ ...(json as ProblemDetails), status: res.status } as ProblemDetails) : null;
  const code = problem?.code ?? (res.status >= 500 ? "api-unavailable" : `http-${res.status}`);
  const retryHeader = Number(res.headers.get("retry-after"));
  const retryDetail = Number(problem?.details?.retryAfterSeconds);
  const retryAfter = Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader : Number.isFinite(retryDetail) && retryDetail > 0 ? retryDetail : null;
  throw new ApiError(res.status, code, problem, retryAfter);
}

async function peekCode(res: Response): Promise<string | null> {
  try {
    const json = (await res.clone().json()) as { code?: string };
    return json.code ?? null;
  } catch {
    return null;
  }
}

/** Respuesta completa (`{ data, meta }`); `null` en 204. */
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  if (options.auth === false) return parse<T>(await send(path, options, null));

  const session = await getSession();
  if (!session) throw new NoSessionError();
  let res = await send(path, options, session.at);

  if (res.status === 401 && EXPIRED_ACCESS.has((await peekCode(res)) ?? "")) {
    const refreshed = await refreshSession(session, await getForwardHeaders());
    if (refreshed.ok) {
      try {
        await writeSession(refreshed.session);
      } catch {
        // En render (Server Component) no se pueden escribir cookies: Proxy persistirá la rotación
        // en la próxima petición gracias a la caché de gracia de la cola de refresh.
      }
      res = await send(path, options, refreshed.session.at);
    } else {
      throw new ApiError(401, refreshed.code, null);
    }
  }
  return parse<T>(res);
}

/** Atajo para respuestas `{ data }`. */
export async function apiData<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const body = await api<{ data: T } | null>(path, options);
  return (body?.data ?? null) as T;
}

export interface Paged<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}
