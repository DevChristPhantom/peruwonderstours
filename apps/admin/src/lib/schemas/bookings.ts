import { z } from "zod";

import { limaLocalToIso, parseAmountToCents } from "@/lib/format";

/**
 * Esquemas compartidos cliente/servidor (React Hook Form + zodResolver en el navegador; la Server
 * Action vuelve a validar lo mismo). La entrada es lo que escribe el usuario; la salida, el cuerpo
 * que espera la API (montos en céntimos, fechas en ISO UTC).
 */

const amount = z
  .string()
  .trim()
  .min(1, "Ingresa el monto.")
  .transform((v, ctx) => {
    const cents = parseAmountToCents(v);
    if (cents === null || cents <= 0) {
      ctx.addIssue({ code: "custom", message: "Monto inválido (ej. 450.00)." });
      return z.NEVER;
    }
    return cents;
  });

const reference = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9._:/-]{3,80}$/, "3-80 caracteres: letras, números y . _ : / -");

const method = z.enum(["cash", "bank_transfer"], { error: "Elige el medio de pago." });
const note = z.string().trim().max(500, "Máximo 500 caracteres.").optional().default("");

export const paymentSchema = z
  .object({
    amount,
    method,
    reference,
    receivedAt: z.string().optional().default(""),
    note,
  })
  .transform((v, ctx) => {
    let receivedAt: string | null = null;
    if (v.receivedAt) {
      receivedAt = limaLocalToIso(v.receivedAt);
      if (!receivedAt) ctx.addIssue({ code: "custom", path: ["receivedAt"], message: "Fecha y hora inválidas." });
      else if (Date.parse(receivedAt) > Date.now() + 5 * 60_000) ctx.addIssue({ code: "custom", path: ["receivedAt"], message: "No puede ser futura." });
    }
    return { amountCents: v.amount, method: v.method, reference: v.reference, receivedAt, note: v.note };
  });
export type PaymentInput = z.input<typeof paymentSchema>;

export const refundSchema = z
  .object({ amount, method, reference, parentPaymentId: z.string().optional().default(""), note })
  .transform((v) => ({ amountCents: v.amount, method: v.method, reference: v.reference, parentPaymentId: v.parentPaymentId, note: v.note }));
export type RefundInput = z.input<typeof refundSchema>;

export const cancelSchema = z
  .object({
    reason: z.string().trim().min(5, "Mínimo 5 caracteres.").max(500, "Máximo 500 caracteres."),
    override: z.boolean().default(false),
    overrideAmount: z.string().optional().default(""),
    overrideReason: z.string().trim().max(500).optional().default(""),
  })
  .transform((v, ctx) => {
    let overrideAmountCents = 0;
    if (v.override) {
      const cents = parseAmountToCents(v.overrideAmount || "");
      if (cents === null) ctx.addIssue({ code: "custom", path: ["overrideAmount"], message: "Monto inválido (puede ser 0)." });
      else overrideAmountCents = cents;
      if (v.overrideReason.length < 5) ctx.addIssue({ code: "custom", path: ["overrideReason"], message: "Explica por qué el reembolso es distinto al de la política (mín. 5)." });
    }
    return { reason: v.reason, override: v.override, overrideAmountCents, overrideReason: v.overrideReason };
  });
export type CancelInput = z.input<typeof cancelSchema>;
