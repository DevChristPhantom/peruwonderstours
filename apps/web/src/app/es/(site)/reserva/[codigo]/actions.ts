"use server";

import { z } from "zod";

import { getBookingByCode } from "@/lib/api/bookings";
import { toUserError } from "@/lib/api/problems";
import type { ActionResult } from "@/lib/checkout/api-checkout";
import { failureFrom, payBooking } from "@/lib/checkout/checkout-service";
import { BOOKING_CODE_RE, clearPayKey, readBookingToken, readOrCreatePayKey } from "@/lib/checkout/session";

const inputSchema = z.object({
  code: z.string().regex(BOOKING_CODE_RE),
  method: z.enum(["card", "yape", "pagoefectivo"]),
  simulate: z.enum(["approved", "rejected", "pending"]),
});

/**
 * Pagar lo que corresponda (adelanto pendiente, reintento tras rechazo o saldo) desde la página
 * de la reserva. El token sale de la cookie httpOnly `pwt_bk_<código>` (path /es/reserva).
 */
export async function payBookingAction(raw: unknown): Promise<ActionResult<{ payment: "succeeded" | "pending" }>> {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: toUserError("validation-failed") };
  const { code, method, simulate } = parsed.data;
  try {
    const token = await readBookingToken(code);
    const booking = token ? await getBookingByCode(code, token) : null;
    if (!token || !booking) return { ok: false, error: toUserError("booking-not-found") };
    if (!booking.nextPayment) return { ok: false, error: toUserError("booking-already-paid") };

    const payKey = await readOrCreatePayKey(code);
    const outcome = await payBooking({ bookingCode: booking.code, token, payKey, method, simulate });
    await clearPayKey(code);
    if (outcome === "failed") return { ok: false, error: toUserError("payment-rejected") };
    return { ok: true, data: { payment: outcome } };
  } catch (error) {
    return { ok: false, error: failureFrom(error).error };
  }
}
