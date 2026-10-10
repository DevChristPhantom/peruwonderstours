import "server-only";

import type { Locale } from "@/i18n/routing";

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
 *   → `{ sessionToken }`; `GET /me`, `GET /me/bookings`, `POST /me/logout` con la sesión del cliente.
 * - `POST /me/bookings/:code/access` → `{ code, accessToken }` (abrir una reserva propia).
 */

/** Cabecera con la que la API recibe la sesión del cliente (BFF → API): `X-Customer-Token`, sin prefijo. */
const CUSTOMER_HEADER = "x-customer-token";
const bearer = (token: string) => token;

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

export interface CustomerProfile {
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export interface CustomerBooking {
  code: string;
  status: string;
  createdAt: string | null;
  firstTravelDate: string | null;
  total: { amount: number; currency: "PEN" | "USD" } | null;
  items: { tourTitle: string; travelDate: string; paxCount: number }[];
}

export async function requestCustomerLoginLink(email: string, locale: Locale): Promise<void> {
  await apiRequest("/customers/login-link", { method: "POST", body: { email, locale } });
}

export async function exchangeCustomerLoginLink(token: string): Promise<{ sessionToken: string; expiresAt: string | null }> {
  const res = await apiJson<{ data: { sessionToken?: string; token?: string; accessToken?: string; expiresAt?: string } }>(
    "/customers/login-link/exchange",
    { method: "POST", body: { token } },
  );
  const sessionToken = res.data.sessionToken ?? res.data.token ?? res.data.accessToken;
  if (!sessionToken) throw new Error("La API no devolvió la sesión del cliente.");
  return { sessionToken, expiresAt: res.data.expiresAt ?? null };
}

export async function getMe(session: string): Promise<CustomerProfile | null> {
  const res = await apiRequest<{ data: CustomerProfile }>("/me", { headers: { [CUSTOMER_HEADER]: bearer(session) }, nullOn404: true });
  return res?.body.data ?? null;
}

export async function listMyBookings(session: string): Promise<CustomerBooking[]> {
  const res = await apiJson<{ data: Partial<CustomerBooking> & { code: string; items?: CustomerBooking["items"] }[] }>("/me/bookings", {
    headers: { [CUSTOMER_HEADER]: bearer(session) },
  });
  return (res.data as (Partial<CustomerBooking> & { code: string })[]).map((b) => {
    const items = b.items ?? [];
    return {
      code: b.code,
      status: b.status ?? "pending",
      createdAt: b.createdAt ?? null,
      firstTravelDate: b.firstTravelDate ?? items.map((i) => i.travelDate).sort()[0] ?? null,
      total: b.total ?? null,
      items,
    };
  });
}

export async function grantMyBookingAccess(session: string, code: string): Promise<ExchangeResult> {
  const res = await apiJson<{ data: ExchangeResult }>(`/me/bookings/${encodeURIComponent(code)}/access`, {
    method: "POST",
    headers: { [CUSTOMER_HEADER]: bearer(session) },
  });
  return res.data;
}

export async function logoutCustomer(session: string): Promise<void> {
  await apiRequest("/me/logout", { method: "POST", headers: { [CUSTOMER_HEADER]: bearer(session) } });
}
