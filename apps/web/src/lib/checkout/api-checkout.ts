import { z } from "zod";

import type { Currency } from "@/lib/catalog/types";
import type { UserError } from "@/lib/api/problems";

/**
 * Contrato entre el checkout (cliente) y sus Server Actions (BFF). Módulo puro y compartido:
 * el cliente solo conoce estos tipos; los tokens de la API nunca forman parte de ellos.
 */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const quoteLineInputSchema = z.object({
  id: z.string().min(1).max(200),
  tourSlug: z.string().regex(SLUG).max(160),
  title: z.string().min(1).max(300),
  date: z.string().regex(ISO_DATE),
  travelers: z.object({
    adults: z.number().int().min(0).max(20),
    children: z.number().int().min(0).max(20),
    infants: z.number().int().min(0).max(20),
  }),
  /** Total que el viajero vio en el carrito (céntimos) o null si estaba "por cotizar". */
  expectedCents: z.number().int().nonnegative().nullable(),
  currency: z.enum(["PEN", "USD"]).nullable(),
});

export const prepareInputSchema = z.object({
  lines: z.array(quoteLineInputSchema).min(1).max(8),
  /** País de residencia (texto del formulario): define tarifa nacional/extranjera. */
  country: z.string().min(1).max(60),
});
export type PrepareInput = z.infer<typeof prepareInputSchema>;

export const placeInputSchema = z.object({
  option: z.enum(["deposit", "full"]),
  method: z.enum(["card", "yape", "pagoefectivo"]),
  /** Resultado a simular en la pasarela SANDBOX. Se ignora cuando haya pasarela real. */
  simulate: z.enum(["approved", "rejected", "pending"]),
  contact: z.object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: z.email().max(254),
    country: z.string().min(1).max(60),
  }),
  notes: z.string().max(2000).optional(),
  acceptTerms: z.literal(true),
  acceptPrivacy: z.literal(true),
  /** Total mostrado en la cotización (céntimos): si la API calcula otro → "el precio cambió". */
  expectedTotalCents: z.number().int().positive(),
});
export type PlaceInput = z.infer<typeof placeInputSchema>;

export interface PlanView {
  depositPercent: number;
  payNowCents: number;
  balanceCents: number;
  /** ISO 8601 (UTC). */
  balanceDueAt: string | null;
}

export interface QuoteLine {
  lineId: string;
  title: string;
  date: string;
  subtotalCents: number;
  expectedCents: number | null;
  /** Subtotal anterior según la API (recotización) o el que vio el viajero. */
  previousCents: number | null;
  priceChanged: boolean;
}

export interface QuoteIssue {
  lineId: string | null;
  message: string;
  blocking: boolean;
}

export interface CheckoutQuote {
  currency: Currency;
  totalCents: number;
  lines: QuoteLine[];
  issues: QuoteIssue[];
  priceChanged: boolean;
  canCheckout: boolean;
  plans: { deposit: PlanView | null; full: PlanView | null; depositUnavailableReason: string | null } | null;
  /** Ya existe una reserva (hold) para este pedido: solo falta pagar. */
  booking: { code: string; option: "deposit" | "full"; holdExpiresAt: string | null } | null;
}

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: UserError; requote?: boolean; bookingCode?: string };

export interface PlaceResult {
  code: string;
  payment: "succeeded" | "pending";
}

/** País (texto del formulario) → ISO 3166-1 alfa-2 que pide la API. */
export const COUNTRY_ISO: Record<string, string> = {
  Perú: "PE",
  Argentina: "AR",
  Bolivia: "BO",
  Brasil: "BR",
  Chile: "CL",
  Colombia: "CO",
  Ecuador: "EC",
  España: "ES",
  "Estados Unidos": "US",
  México: "MX",
};
