import "server-only";

import { cookies } from "next/headers";

import { isProduction } from "@/lib/env";

/**
 * Sesión del cliente ("Mis reservas", sin contraseña). El token opaco de la API vive SOLO en una
 * cookie httpOnly (Secure en producción, SameSite=Lax, path `/`): el navegador no puede leerlo y
 * nunca viaja en URLs. Se escribe y borra únicamente desde Server Actions.
 */
const CUSTOMER_COOKIE = "pwt_customer";
/** La API emite sesiones de 30 días. */
const MAX_AGE = 30 * 24 * 3600;
const TOKEN_RE = /^[A-Za-z0-9_.~-]{16,512}$/;

const options = { httpOnly: true, sameSite: "lax" as const, secure: isProduction, path: "/" };

export async function readCustomerSession(): Promise<string | null> {
  const value = (await cookies()).get(CUSTOMER_COOKIE)?.value;
  return value && TOKEN_RE.test(value) ? value : null;
}

export async function writeCustomerSession(token: string, expiresAt: string | null): Promise<void> {
  if (!TOKEN_RE.test(token)) throw new Error("Token de sesión de cliente con formato inesperado.");
  const until = expiresAt ? Math.floor((Date.parse(expiresAt) - Date.now()) / 1000) : NaN;
  const maxAge = Number.isFinite(until) && until > 0 ? Math.min(until, MAX_AGE) : MAX_AGE;
  (await cookies()).set(CUSTOMER_COOKIE, token, { ...options, maxAge });
}

export async function clearCustomerSession(): Promise<void> {
  (await cookies()).set(CUSTOMER_COOKIE, "", { ...options, maxAge: 0 });
}
