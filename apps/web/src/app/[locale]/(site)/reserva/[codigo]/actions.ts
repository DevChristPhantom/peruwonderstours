"use server";

import { z } from "zod";

import { getBookingByCode } from "@/lib/api/bookings";
import { toUserError } from "@/lib/api/problems";
import { requestLocale } from "@/lib/i18n/request-locale";
import { providerConfirmSchema, type ActionResult } from "@/lib/checkout/api-checkout";
import { confirmProviderPayment, failureFrom, payBooking } from "@/lib/checkout/checkout-service";
import type { ProviderAction, ProviderPaymentOutcome } from "@/lib/payments/types";
import { BOOKING_CODE_RE, clearPayKey, readBookingToken, readOrCreatePayKey } from "@/lib/checkout/session";

const inputSchema = z.object({
  code: z.string().regex(BOOKING_CODE_RE),
  method: z.enum(["card", "yape", "pagoefectivo"]),
  simulate: z.enum(["approved", "rejected", "pending"]),
});

/**
 * Pagar lo que corresponda (adelanto pendiente, reintento tras rechazo o saldo) desde la página
 * de la reserva. El token sale de la cookie httpOnly `pwt_bk_<código>` (path /).
 */
export async function payBookingAction(
  raw: unknown,
): Promise<ActionResult<{ payment: "succeeded" | "pending" } | { payment: "action"; action: ProviderAction }>> {
  const locale = await requestLocale();
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: toUserError("validation-failed", undefined, locale) };
  const { code, method, simulate } = parsed.data;
  try {
    const token = await readBookingToken(code);
    const booking = token ? await getBookingByCode(code, token) : null;
    if (!token || !booking) return { ok: false, error: toUserError("booking-not-found", undefined, locale) };
    if (!booking.nextPayment) return { ok: false, error: toUserError("booking-already-paid", undefined, locale) };

    const payKey = await readOrCreatePayKey(code);
    const outcome = await payBooking({ bookingCode: booking.code, token, payKey, method, simulate });
    // Izipay: la clave se conserva hasta que su formulario responda (reintento = mismo cobro).
    if (typeof outcome === "object") return { ok: true, data: { payment: "action", action: outcome } };
    await clearPayKey(code);
    if (outcome === "failed") return { ok: false, error: toUserError("payment-rejected", undefined, locale) };
    return { ok: true, data: { payment: outcome } };
  } catch (error) {
    return { ok: false, error: failureFrom(error, locale).error };
  }
}

/** Respuesta del formulario de Izipay desde la página de la reserva (la API verifica la firma). */
export async function confirmBookingPaymentAction(raw: unknown): Promise<ActionResult<{ payment: Exclude<ProviderPaymentOutcome, "failed"> }>> {
  const locale = await requestLocale();
  const parsed = providerConfirmSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: toUserError("validation-failed", undefined, locale) };
  const { code, paymentId, payloadHttp, signature } = parsed.data;
  try {
    const token = await readBookingToken(code);
    if (!token) return { ok: false, error: toUserError("booking-not-found", undefined, locale) };
    const outcome = await confirmProviderPayment({ bookingCode: code, token, paymentId, payloadHttp, signature });
    if (outcome !== "open") await clearPayKey(code);
    if (outcome === "failed") return { ok: false, error: toUserError("payment-rejected", undefined, locale) };
    return { ok: true, data: { payment: outcome } };
  } catch (error) {
    return { ok: false, error: failureFrom(error, locale).error };
  }
}
