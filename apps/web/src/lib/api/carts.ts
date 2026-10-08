import "server-only";

import { apiJson, apiRequest } from "./client";

/**
 * Adaptador del carrito de la API (`apps/api/src/modules/cart/interface/carts.controller.ts`).
 * El `token` del carrito viaja solo servidor→API en `X-Cart-Token`; el navegador nunca lo ve.
 */

export type ApiCurrency = "PEN" | "USD";
export type PaxType = "adult" | "child" | "student" | "senior";
export type Residency = "national" | "foreign";

export interface ApiMoney {
  amount: number;
  currency: ApiCurrency;
}

export interface ApiCartIssue {
  itemId: string;
  type: "price_changed" | "sold_out" | "date_unavailable" | "unavailable";
  code: string;
  blocking: boolean;
  message: string;
  previousSubtotal?: ApiMoney;
  currentSubtotal?: ApiMoney;
}

export interface ApiCartItem {
  id: string;
  tourId: string;
  tourSlug: string | null;
  tourTitle: string | null;
  departureId: string | null;
  travelDate: string;
  priceLockedUntil: string | null;
  pax: { paxType: PaxType; residency: Residency; quantity: number; unitAmount: ApiMoney; lineAmount: ApiMoney }[];
  subtotal: ApiMoney;
}

export interface ApiCart {
  id: string;
  status: string;
  currency: ApiCurrency;
  expiresAt: string;
  items: ApiCartItem[];
  itemCount: number;
  total: ApiMoney;
  issues: ApiCartIssue[];
  canCheckout: boolean;
}

export interface ApiPlan {
  option: "deposit" | "full";
  depositPercent: number;
  total: ApiMoney;
  payNow: ApiMoney;
  balance: ApiMoney;
  balanceDueAt: string | null;
  fullPaymentReason: string | null;
}

export interface ApiPaymentOptions {
  total: ApiMoney;
  firstServiceDate: string | null;
  depositAvailable: boolean;
  depositUnavailableReason: string | null;
  deposit: ApiPlan | null;
  full: ApiPlan;
}

export interface AddItemInput {
  tourId: string;
  travelDate: string;
  departureId?: string;
  pax: { paxType: PaxType; residency: Residency; quantity: number }[];
}

const tokenHeader = (token: string) => ({ "x-cart-token": token });

export async function createCart(currency: ApiCurrency): Promise<{ token: string; cart: ApiCart }> {
  const res = await apiJson<{ data: { token: string; cart: ApiCart } }>("/carts", {
    method: "POST",
    body: { currency, locale: "es" },
  });
  return res.data;
}

export async function addCartItem(cartId: string, token: string, input: AddItemInput): Promise<ApiCart> {
  const res = await apiJson<{ data: { itemId: string; cart: ApiCart } }>(`/carts/${cartId}/items`, {
    method: "POST",
    headers: tokenHeader(token),
    body: input,
  });
  return res.data.cart;
}

/** Recotiza y aplica precios vigentes (RN-12). Devuelve incidencias (precio/cupo/fecha). */
export async function recalculateCart(cartId: string, token: string): Promise<ApiCart> {
  const res = await apiJson<{ data: ApiCart }>(`/carts/${cartId}/recalculate`, { method: "POST", headers: tokenHeader(token) });
  return res.data;
}

export async function getPaymentOptions(cartId: string, token: string): Promise<ApiPaymentOptions> {
  const res = await apiJson<{ data: ApiPaymentOptions }>(`/carts/${cartId}/payment-options`, { headers: tokenHeader(token) });
  return res.data;
}

/* ---------- Catálogo transaccional (sin caché larga: cupos y precios cambian) ---------- */

export interface ApiBookableTour {
  id: string;
  slug: string;
  title: string;
  bookable: boolean;
  minPax: number;
  maxPax: number | null;
}

export async function getBookableTour(slug: string, currency: ApiCurrency): Promise<ApiBookableTour | null> {
  const res = await apiRequest<{ data: ApiBookableTour }>(
    `/tours/${encodeURIComponent(slug)}?locale=es&currency=${currency}`,
    { nullOn404: true, next: { revalidate: 60, tags: ["catalog"] } },
  );
  return res?.body.data ?? null;
}

export interface ApiDeparture {
  id: string;
  date: string;
  startTime: string | null;
  capacity: number | null;
  available: number | null;
  isClosed: boolean;
}

export async function listDepartures(slug: string, date: string): Promise<ApiDeparture[]> {
  const res = await apiJson<{ data: ApiDeparture[] }>(
    `/tours/${encodeURIComponent(slug)}/departures?from=${date}&to=${date}`,
  );
  return res.data;
}
