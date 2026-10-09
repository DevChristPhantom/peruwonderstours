import "server-only";

import { headers } from "next/headers";

import { env } from "@/lib/env";

/**
 * Cliente HTTP del BFF hacia la API NestJS (`API_BASE_URL`, solo servidor).
 * - Respuestas 2xx: `{ data }` (sobre de la API) → se devuelve el cuerpo completo tipado.
 * - Errores: RFC 9457 `application/problem+json` → `ApiError` con `code` estable.
 * - Red caída / timeout / 5xx sin cuerpo → `ApiError` con `code: "api-unavailable"`.
 * Las cabeceras sensibles (X-Cart-Token, X-Booking-Token) nunca salen del servidor.
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
  readonly status: number;
  readonly code: string;
  readonly problem: ProblemDetails | null;

  constructor(status: number, code: string, problem: ProblemDetails | null, message?: string) {
    super(message ?? problem?.detail ?? `API ${status} (${code})`);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.problem = problem;
  }

  /** La API no respondió o falló del lado del servidor: reintentable / degradable. */
  get unavailable(): boolean {
    return this.code === "api-unavailable" || this.status >= 500;
  }
}

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  headers?: Record<string, string | undefined>;
  /** Caché de Next (solo GET públicos). Por defecto `no-store`. */
  next?: { revalidate?: number | false; tags?: string[] };
  /** Devuelve null en 404 en lugar de lanzar. */
  nullOn404?: boolean;
}

export interface ApiResponse<T> {
  body: T;
  status: number;
  headers: Headers;
}

function problemCode(problem: ProblemDetails): string {
  if (problem.code) return problem.code;
  const last = problem.type?.split("/").pop();
  return last && last !== "about:blank" ? last : `http-${problem.status}`;
}

/**
 * IP del visitante para el rate limit de la API (H-07). NUNCA el primer valor de `X-Forwarded-For`
 * (lo controla el cliente): con `TRUSTED_PROXY_HOPS = N` se toma la entrada N-ésima desde la derecha,
 * la que escribió nuestro proxy de entrada. Con 0 (por defecto) no se reenvía nada y la API ve la IP
 * del servidor de Next. El proxy de entrada debe sobrescribir o anexar la cabecera con la IP del socket.
 */
async function visitorIp(): Promise<string | undefined> {
  const hops = env.TRUSTED_PROXY_HOPS;
  if (hops === 0) return undefined;
  try {
    const h = await headers();
    const chain = (h.get("x-forwarded-for") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const ip = chain.length >= hops ? chain[chain.length - hops] : undefined;
    return ip && /^[0-9a-fA-F:.]{3,45}$/.test(ip) ? ip : undefined;
  } catch {
    return undefined; // fuera de una petición (build/ISR): no aplica
  }
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<ApiResponse<T> | null> {
  const requestHeaders: Record<string, string> = { accept: "application/json, application/problem+json" };
  for (const [key, value] of Object.entries(options.headers ?? {})) if (value !== undefined) requestHeaders[key] = value;
  if (options.body !== undefined) requestHeaders["content-type"] = "application/json";
  // Solo en llamadas por visitante (sin caché compartida): las de catálogo cacheadas no llevan IP.
  if (!options.next) {
    const ip = await visitorIp();
    if (ip) requestHeaders["x-forwarded-for"] = ip;
  }

  let res: Response;
  try {
    res = await fetch(`${env.API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers: requestHeaders,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(env.PWT_API_TIMEOUT_MS),
      ...(options.next ? { next: options.next } : { cache: "no-store" as const }),
    });
  } catch (cause) {
    throw new ApiError(0, "api-unavailable", null, `API no disponible en ${path}: ${String(cause)}`);
  }

  if (res.status === 404 && options.nullOn404) return null;

  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!res.ok) {
    const problem =
      json && typeof json === "object" && "status" in json ? ({ ...(json as ProblemDetails), status: res.status } as ProblemDetails) : null;
    const code = problem ? problemCode(problem) : res.status >= 500 ? "api-unavailable" : `http-${res.status}`;
    throw new ApiError(res.status, code, problem);
  }

  return { body: json as T, status: res.status, headers: res.headers };
}

/** Atajo: devuelve el cuerpo o lanza (404 incluido). */
export async function apiJson<T>(path: string, options: Omit<ApiRequestOptions, "nullOn404"> = {}): Promise<T> {
  const res = await apiRequest<T>(path, options);
  return (res as ApiResponse<T>).body;
}
