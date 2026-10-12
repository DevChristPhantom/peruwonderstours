"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { bookingPath, localePath } from "@/i18n/paths";
import { isLocale, type Locale } from "@/i18n/routing";
import { exchangeCustomerLoginLink, grantMyBookingAccess, logoutCustomer, requestCustomerLoginLink } from "@/lib/api/access";
import { ApiError } from "@/lib/api/client";
import { BOOKING_CODE_RE, writeBookingToken } from "@/lib/checkout/session";

import { clearCustomerSession, readCustomerSession, writeCustomerSession } from "./session";
import type { AccountState } from "./types";

/**
 * Server Actions de "Mis reservas" (acceso sin contraseña). Mismo patrón que `lib/access/actions.ts`:
 * el token del enlace se canjea SOLO con un POST (botón), nunca al abrir la página, porque los
 * antivirus de correo visitan los enlaces y lo consumirían. Los tokens no salen del servidor.
 */

function localeOf(value: FormDataEntryValue | null): Locale {
  return isLocale(value) ? value : "es";
}

function stateFromError(error: unknown): AccountState {
  if (error instanceof ApiError) {
    if (error.status === 429 || error.code === "too-many-requests") return { status: "busy" };
    if (error.status === 410 || error.code === "access-link-expired") return { status: "expired" };
    if (error.status === 404 || error.status === 400) return { status: "linkNotFound" };
  }
  return { status: "unavailable" };
}

/** Pide el enlace de acceso. La API responde 202 siempre: el mensaje es el mismo exista o no el correo. */
export async function requestLoginLinkAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const email = z.email().trim().max(254).safeParse(formData.get("email"));
  if (!email.success) return { status: "invalid" };
  try {
    await requestCustomerLoginLink(email.data.toLowerCase(), localeOf(formData.get("locale")));
    return { status: "sent" };
  } catch (error) {
    // Solo el límite de intentos se informa; cualquier otro caso responde igual que un envío.
    const state = stateFromError(error);
    return state.status === "busy" || state.status === "unavailable" ? state : { status: "sent" };
  }
}

/** Canjea el token del correo por la sesión del cliente (cookie httpOnly) y abre "Mis reservas". */
export async function exchangeLoginLinkAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const token = formData.get("token");
  const locale = localeOf(formData.get("locale"));
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{20,200}$/.test(token)) return { status: "linkNotFound" };
  try {
    const { sessionToken, expiresAt } = await exchangeCustomerLoginLink(token);
    await writeCustomerSession(sessionToken, expiresAt);
  } catch (error) {
    return stateFromError(error);
  }
  // Fuera del try: `redirect` lanza una excepción de control.
  redirect(localePath(locale, "/mis-reservas"));
}

/** "Abrir": pide el token de acceso de una reserva propia, lo guarda en su cookie y abre la reserva. */
export async function openMyBookingAction(formData: FormData): Promise<void> {
  const locale = localeOf(formData.get("locale"));
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const session = await readCustomerSession();
  if (!session) redirect(localePath(locale, "/cuenta/acceso"));
  if (!BOOKING_CODE_RE.test(code)) redirect(localePath(locale, "/mis-reservas"));
  let target: string;
  try {
    const access = await grantMyBookingAccess(session, code);
    await writeBookingToken(access.code, access.accessToken);
    target = bookingPath(locale, access.code);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await clearCustomerSession();
      target = localePath(locale, "/cuenta/acceso");
    } else {
      target = localePath(locale, { pathname: "/mis-reservas", query: { error: "open" } });
    }
  }
  redirect(target);
}

/** Cerrar sesión: revoca la sesión en la API (idempotente) y borra la cookie aunque la API falle. */
export async function logoutAction(formData: FormData): Promise<void> {
  const locale = localeOf(formData.get("locale"));
  const session = await readCustomerSession();
  if (session) {
    try {
      await logoutCustomer(session);
    } catch {
      /* la cookie se borra igual: sin ella el navegador ya no tiene la sesión */
    }
  }
  await clearCustomerSession();
  redirect(localePath(locale, { pathname: "/cuenta/acceso", query: { salida: "1" } }));
}
