"use server";

import { apiData } from "@/lib/api/client";
import type { VoidPaymentResult } from "@/lib/api/content-types";
import { action } from "@/lib/auth/guard";
import { formObject, invalidResult, voidPaymentSchema } from "@/lib/schemas/content";

const CODE = /^PWT-\d{4}-\d{6}$/;
const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Anula un pago manual mal registrado (ADR-0003): la API crea un contra-asiento auditado y
 * retrocede el estado de la reserva. Solo admin (`payments:void`); el motivo es obligatorio.
 */
export async function voidPaymentAction(code: string, paymentId: string, _prev: unknown, fd: FormData) {
  const c = code.trim().toUpperCase();
  if (!CODE.test(c) || !UUID.test(paymentId)) throw new Error("Pago inválido");
  const parsed = voidPaymentSchema.safeParse(formObject(fd, ["reason"]));
  if (!parsed.success) return invalidResult(parsed.error);
  return action(() => apiData<VoidPaymentResult>(`/admin/bookings/${c}/payments/${paymentId}/void`, { method: "POST", body: { reason: parsed.data.reason } }), {
    message: "Pago anulado: se registró el contra-asiento y se actualizó el saldo de la reserva.",
  });
}
