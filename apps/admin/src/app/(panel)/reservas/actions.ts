"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { apiData } from "@/lib/api/client";
import type { CancellationQuote, Money } from "@/lib/api/types";
import { action, assertSameOrigin, type ActionResult } from "@/lib/auth/guard";
import { EMAIL_FILTER_COOKIE } from "@/lib/bookings-filter";
import { seal } from "@/lib/session/seal";
import { cookieOptions } from "@/lib/session/model";
import { cancelSchema, paymentSchema, refundSchema, type CancelInput, type PaymentInput, type RefundInput } from "@/lib/schemas/bookings";

const CODE = /^PWT-\d{4}-\d{6}$/;

function assertCode(code: string): string {
  const c = code.trim().toUpperCase();
  if (!CODE.test(c)) throw new Error("Código de reserva inválido");
  return c;
}

const invalid = (error: z.ZodError): ActionResult<never> => ({
  ok: false,
  error: {
    code: "validation-failed",
    message: "Revisa los campos indicados.",
    fields: Object.fromEntries(error.issues.map((i) => [i.path.join("."), i.message])),
  },
});

export async function searchByEmailAction(formData: FormData): Promise<void> {
  if (!(await assertSameOrigin())) redirect("/reservas");
  const email = z.email().max(254).safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  const store = await cookies();
  if (!email.success) {
    store.set(EMAIL_FILTER_COOKIE, "", { ...cookieOptions, maxAge: 0 });
    redirect("/reservas?correo=invalido");
  }
  store.set(EMAIL_FILTER_COOKIE, seal({ email: email.data }, EMAIL_FILTER_COOKIE), { ...cookieOptions, maxAge: 15 * 60 });
  redirect("/reservas?por=correo");
}

export async function recordPaymentAction(code: string, idempotencyKey: string, input: PaymentInput) {
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!/^[0-9a-f-]{36}$/i.test(idempotencyKey)) return { ok: false as const, error: { code: "validation-failed", message: "Recarga la página e intenta de nuevo." } };
  return action(async () => {
    const v = parsed.data;
    return apiData<{ replayed: boolean; paymentId: string; bookingStatus: string }>(`/admin/bookings/${assertCode(code)}/payments`, {
      method: "POST",
      idempotencyKey,
      body: { amount: v.amountCents, method: v.method, reference: v.reference, receivedAt: v.receivedAt ?? undefined, note: v.note || undefined },
    });
  });
}

export async function recordRefundAction(code: string, idempotencyKey: string, input: RefundInput) {
  const parsed = refundSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!/^[0-9a-f-]{36}$/i.test(idempotencyKey)) return { ok: false as const, error: { code: "validation-failed", message: "Recarga la página e intenta de nuevo." } };
  return action(async () => {
    const v = parsed.data;
    return apiData<{ replayed: boolean; refundId: string }>(`/admin/bookings/${assertCode(code)}/refunds`, {
      method: "POST",
      idempotencyKey,
      body: { amount: v.amountCents, method: v.method, reference: v.reference, parentPaymentId: v.parentPaymentId || undefined, note: v.note || undefined },
    });
  });
}

export async function cancelBookingAction(code: string, input: CancelInput) {
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return action(async () => {
    const v = parsed.data;
    return apiData<{ status: string; refundDue: Money }>(`/admin/bookings/${assertCode(code)}/cancel`, {
      method: "POST",
      body: {
        reason: v.reason,
        ...(v.override ? { refundAmountOverride: v.overrideAmountCents, overrideReason: v.overrideReason } : {}),
      },
    });
  });
}

export async function cancellationQuoteAction(code: string) {
  return action(() => apiData<CancellationQuote>(`/admin/bookings/${assertCode(code)}/cancellation-quote`));
}

export async function resendVoucherAction(code: string, _prev: unknown, _formData: FormData) {
  return action(() => apiData<{ queued: boolean }>(`/admin/bookings/${assertCode(code)}/resend-voucher`, { method: "POST" }), {
    message: "Voucher en cola de envío. Revisa el estado en «Correos» en unos segundos.",
  });
}
