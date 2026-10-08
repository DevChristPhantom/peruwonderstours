import "server-only";

import { ApiError, apiRequest } from "./client";
import type { ApiCurrency, ApiMoney } from "./carts";

/**
 * ADAPTADOR AISLADO de reservas y pagos (Sprint 1).
 *
 * Contrato acordado con backend (en implementación en paralelo; ajustar SOLO este archivo):
 * - `POST /bookings` (Idempotency-Key, X-Cart-Token) → `{ data: Booking & { accessToken } }`.
 *   `accessToken`: secreto opaco de la reserva, se devuelve una vez (también se acepta en la
 *   cabecera `X-Booking-Token` de la respuesta o en `data.access.token` por si cambia el nombre).
 * - `GET /bookings/:code` con `X-Booking-Token` → `{ data: Booking }`; 401/403/404 si no coincide.
 * - `POST /bookings/:code/payments` (Idempotency-Key, X-Booking-Token) → `{ data: { payment, nextAction } }`.
 * - `POST /bookings/:code/payments/:paymentId/confirm` (X-Booking-Token) `{ confirmation }` → `{ data: Payment }`.
 *   En sandbox, `confirmation: { simulate: "fail" }` simula rechazo.
 */

export const BOOKING_TOKEN_HEADER = "x-booking-token";
const BOOKING_BY_CODE_PATH = (code: string) => `/bookings/${encodeURIComponent(code)}`;

export type BookingStatus = "pending" | "held" | "confirmed" | "partially_paid" | "paid" | "cancelled" | "refunded" | "completed";
export type PaymentOption = "deposit" | "full";
export type PaymentStatus = "pending" | "requires_action" | "authorized" | "succeeded" | "failed" | "cancelled" | "expired";
export type PaymentMethod = "card" | "yape" | "plin" | "pagoefectivo";

export interface BookingItem {
  id: string;
  tourTitle: string;
  travelDate: string;
  paxCount: number;
  status: string;
  subtotal: ApiMoney;
}

/** Vista pública de la reserva (sin datos personales; `presentBooking` de la API). */
export interface Booking {
  id: string;
  code: string;
  status: BookingStatus;
  currency: ApiCurrency;
  total: ApiMoney;
  paymentOption: PaymentOption;
  depositPercent: number;
  deposit: ApiMoney;
  balance: ApiMoney;
  balanceDueAt: string | null;
  paid: ApiMoney;
  refunded: ApiMoney;
  outstanding: ApiMoney;
  nextPayment: { kind: string; amount: ApiMoney } | null;
  holdExpiresAt: string | null;
  firstServiceDate: string | null;
  lastServiceDate: string | null;
  items: BookingItem[];
  createdAt: string;
}

export interface Payment {
  id: string;
  bookingId: string;
  kind: string;
  status: PaymentStatus;
  method: PaymentMethod | null;
  amount: ApiMoney;
  failureCode: string | null;
  failureMessage: string | null;
  succeededAt: string | null;
}

export type NextAction = { type: "redirect"; url: string } | { type: "sdk"; token: string } | { type: "none" };

export interface CheckoutInput {
  cartId: string;
  cartToken: string;
  idempotencyKey: string;
  paymentOption: PaymentOption;
  customer: { email: string; firstName: string; lastName: string; country?: string };
  customerNotes?: string;
  expectedTotalAmount?: number;
}

export interface CheckoutResult {
  booking: Booking;
  /** null si la API aún no lo devuelve (contrato en curso) o si fue un replay sin token. */
  accessToken: string | null;
  replayed: boolean;
}

type CheckoutBody = { data: Booking & { accessToken?: string; access?: { token?: string } }; accessToken?: string };

export async function checkout(input: CheckoutInput): Promise<CheckoutResult> {
  const res = await apiRequest<CheckoutBody>("/bookings", {
    method: "POST",
    headers: { "idempotency-key": input.idempotencyKey, "x-cart-token": input.cartToken },
    body: {
      cartId: input.cartId,
      paymentOption: input.paymentOption,
      customer: input.customer,
      acceptTerms: true,
      acceptPrivacyPolicy: true,
      customerNotes: input.customerNotes || undefined,
      expectedTotalAmount: input.expectedTotalAmount,
    },
  });
  if (!res) throw new ApiError(404, "booking-not-found", null);
  const { accessToken, access, ...booking } = res.body.data;
  const token = accessToken ?? access?.token ?? res.body.accessToken ?? res.headers.get(BOOKING_TOKEN_HEADER) ?? null;
  return { booking: booking as Booking, accessToken: token, replayed: res.headers.get("idempotent-replayed") === "true" };
}

/** Lee la reserva con su token. Cualquier rechazo (sin token, no coincide, no existe) → null. */
export async function getBookingByCode(code: string, token: string): Promise<Booking | null> {
  try {
    const res = await apiRequest<{ data: Booking }>(BOOKING_BY_CODE_PATH(code), {
      headers: { [BOOKING_TOKEN_HEADER]: token },
      nullOn404: true,
    });
    return res?.body.data ?? null;
  } catch (error) {
    if (error instanceof ApiError && [400, 401, 403, 404, 410].includes(error.status)) return null;
    throw error;
  }
}

export async function createPayment(
  code: string,
  token: string,
  idempotencyKey: string,
  method: PaymentMethod,
): Promise<{ payment: Payment; nextAction: NextAction }> {
  const res = await apiRequest<{ data: { payment: Payment; nextAction: NextAction } }>(`${BOOKING_BY_CODE_PATH(code)}/payments`, {
    method: "POST",
    headers: { "idempotency-key": idempotencyKey, [BOOKING_TOKEN_HEADER]: token },
    body: { method },
  });
  return res!.body.data;
}

export async function confirmPayment(
  code: string,
  paymentId: string,
  token: string,
  confirmation: Record<string, string>,
): Promise<Payment> {
  const res = await apiRequest<{ data: Payment }>(`${BOOKING_BY_CODE_PATH(code)}/payments/${paymentId}/confirm`, {
    method: "POST",
    headers: { [BOOKING_TOKEN_HEADER]: token },
    body: { confirmation },
  });
  return res!.body.data;
}
