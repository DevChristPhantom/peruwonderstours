import "server-only";

import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";

import { ApiError } from "@/lib/api/client";
import { toUserError, type UserError } from "@/lib/api/errors";
import type { Permission } from "@/lib/auth/permissions";
import { env } from "@/lib/env";
import { TERMINAL_AUTH_CODES } from "@/lib/session/refresh";
import { clearSession, getSession } from "@/lib/session/server";
import type { AdminSession } from "@/lib/session/model";

/* ------------------------------------------------------------------ Páginas (Server Components) */

/** Exige sesión. Sin cookie válida → login (Proxy ya filtra, esto es defensa en profundidad). */
export async function requireSession(): Promise<AdminSession> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export function can(session: AdminSession, ...required: Permission[]): boolean {
  return required.every((p) => session.user.permissions.includes(p));
}

export type Loaded<T> = { ok: true; data: T } | { ok: false; error: UserError };

/**
 * Carga datos de la API en un Server Component. 401 → sale por `/auth/salir` (borra la cookie,
 * cosa que el render no puede hacer); 403/404/409… → error para mostrar en la página.
 */
export async function load<T>(fn: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      if (error.status === 401) redirect(`/auth/salir?motivo=${encodeURIComponent(error.code)}`);
      return { ok: false, error: errorFrom(error) };
    }
    throw error;
  }
}

/* ------------------------------------------------------------------ Server Actions */

export type ActionResult<T = undefined> = { ok: true; data: T; message?: string } | { ok: false; error: UserError };

/**
 * CSRF: además del chequeo propio de Next (Origin vs Host), cada acción compara `Origin` con el
 * host de la petición o con `ADMIN_TRUSTED_ORIGINS`, y rechaza `Sec-Fetch-Site: cross-site`.
 */
export async function assertSameOrigin(): Promise<boolean> {
  const h = await headers();
  const origin = h.get("origin");
  const site = h.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  if (!origin) return false;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const host = h.get("x-forwarded-host")?.split(",")[0]?.trim() || h.get("host");
  if (host && originHost === host) return true;
  return env().ADMIN_TRUSTED_ORIGINS.includes(origin.replace(/\/+$/, ""));
}

function errorFrom(error: unknown): UserError {
  if (error instanceof ApiError) {
    return toUserError({
      status: error.status,
      code: error.code,
      detail: error.problem?.detail,
      errors: error.problem?.errors,
      details: error.problem?.details,
      retryAfterSeconds: error.retryAfterSeconds,
    });
  }
  console.error("[admin] acción fallida", error);
  return { code: "internal-error", message: "Ocurrió un error inesperado. Intenta de nuevo." };
}

/**
 * Envoltura de cada Server Action del panel: CSRF, sesión y traducción de errores. Si la API dice
 * que la sesión ya no sirve (reuso de refresh, revocada…), borra la cookie y manda al login.
 */
export async function action<T>(fn: (session: AdminSession) => Promise<T>, options: { message?: string } = {}): Promise<ActionResult<T>> {
  if (!(await assertSameOrigin())) return { ok: false, error: { code: "csrf-origin-mismatch", message: "La solicitud no vino de este panel. Recarga la página e intenta de nuevo." } };
  const session = await getSession();
  if (!session) redirect("/login?motivo=sesion");
  let terminal: string | null = null;
  try {
    return { ok: true, data: await fn(session), message: options.message };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError && error.status === 401 && (TERMINAL_AUTH_CODES.has(error.code) || error.code === "no-session" || error.code.startsWith("invalid-") || error.code.endsWith("-expired"))) {
      terminal = error.code;
    } else {
      return { ok: false, error: errorFrom(error) };
    }
  }
  await clearSession();
  redirect(`/login?motivo=${encodeURIComponent(terminal)}`);
}

/** Acción pública (login/MFA): solo CSRF + traducción de errores. */
export async function publicAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  if (!(await assertSameOrigin())) return { ok: false, error: { code: "csrf-origin-mismatch", message: "La solicitud no vino de este panel. Recarga la página e intenta de nuevo." } };
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: errorFrom(error) };
  }
}
