import "server-only";

import type { Locale } from "@/i18n/routing";

import type { Booking } from "./bookings";
import { apiJson, apiRequest } from "./client";

/**
 * ADAPTADOR AISLADO del acceso sin contraseña (sprint 3, F0/F0b/F6/F7). Contrato del backend
 * (apps/api, módulo `access`): ajustar SOLO aquí si cambian los nombres.
 *
 * Enlace mágico de un solo uso que llega por correo:
 * - `POST /bookings/access-link { code, email, locale }` → 202 (respuesta genérica, no revela si existe).
 * - `POST /bookings/access-link/exchange { token }` → `{ code, accessToken }`.
 * - Igual para `/complaints/access-link`.
 * - `POST /customers/login-link { email, locale }` → 202; `POST /customers/login-link/exchange { token }`
 *   → `{ sessionToken }`; `GET /me/bookings`, `POST /me/logout` con la sesión del cliente.
 * - `POST /me/bookings/:code/access` → `{ code, accessToken }` (abrir una reserva propia).
 */

/** Cabecera con la que la API recibe la sesión del cliente (BFF → API): `X-Customer-Token`, sin prefijo. */
const CUSTOMER_HEADER = "x-customer-token";

export interface ExchangeResult {
  code: string;
  accessToken: string;
}

export async function requestBookingAccessLink(code: string, email: string, locale: Locale): Promise<void> {
  await apiRequest("/bookings/access-link", { method: "POST", body: { code, email, locale } });
}

export async function exchangeBookingAccessLink(token: string): Promise<ExchangeResult> {
  const res = await apiJson<{ data: ExchangeResult }>("/bookings/access-link/exchange", { method: "POST", body: { token } });
  return res.data;
}

export async function requestComplaintAccessLink(code: string, email: string, locale: Locale): Promise<void> {
  await apiRequest("/complaints/access-link", { method: "POST", body: { code, email, locale } });
}

export async function exchangeComplaintAccessLink(token: string): Promise<ExchangeResult> {
  const res = await apiJson<{ data: ExchangeResult }>("/complaints/access-link/exchange", { method: "POST", body: { token } });
  return res.data;
}

/* ---------- Cuenta de cliente ---------- */

export async function requestCustomerLoginLink(email: string, locale: Locale): Promise<void> {
  await apiRequest("/customers/login-link", { method: "POST", body: { email, locale } });
}

export async function exchangeCustomerLoginLink(token: string): Promise<{ sessionToken: string; expiresAt: string | null }> {
  const res = await apiJson<{ data: { sessionToken?: string; expiresAt?: string } }>("/customers/login-link/exchange", {
    method: "POST",
    body: { token },
  });
  if (!res.data.sessionToken) throw new Error("La API no devolvió la sesión del cliente.");
  return { sessionToken: res.data.sessionToken, expiresAt: res.data.expiresAt ?? null };
}

/** Reservas del cliente (más recientes primero), con la misma vista que `GET /bookings/:code`. */
export async function listMyBookings(session: string): Promise<Booking[]> {
  const res = await apiJson<{ data: Booking[] }>("/me/bookings?limit=50", { headers: { [CUSTOMER_HEADER]: session } });
  return res.data;
}

export async function grantMyBookingAccess(session: string, code: string): Promise<ExchangeResult> {
  const res = await apiJson<{ data: ExchangeResult }>(`/me/bookings/${encodeURIComponent(code)}/access`, {
    method: "POST",
    headers: { [CUSTOMER_HEADER]: session },
  });
  return res.data;
}

export async function logoutCustomer(session: string): Promise<void> {
  await apiRequest("/me/logout", { method: "POST", headers: { [CUSTOMER_HEADER]: session }, body: {} });
}
