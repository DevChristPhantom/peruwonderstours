import type { ReactNode, Ref } from "react";

import type { Currency } from "@/lib/catalog/types";
import type { PaymentOption } from "@/lib/checkout/payment-plan";

/**
 * Contrato del paso de pago. Cada proveedor (Izipay, Niubiz, Mercado Pago, Culqi) se implementa
 * como un componente `PaymentWidget` que monta su formulario embebido (iframe / hosted fields):
 * los datos de tarjeta NUNCA pasan por formularios propios (PCI DSS SAQ-A).
 *
 * Flujo real previsto: el backend crea la orden + hold de cupos y devuelve un `PaymentRequest`
 * con el token de sesión del proveedor → el widget monta su formulario → `confirm()` devuelve el
 * resultado → la confirmación definitiva llega por webhook al backend.
 */

/** Alineado con el enum PaymentMethod de Prisma (apps/api). */
export type PaymentMethod = "card" | "yape" | "pagoefectivo";

export interface PaymentRequest {
  /** Código de la orden (p. ej. PWT-7K4Q2). */
  orderCode: string;
  amountCents: number;
  currency: Currency;
  option: PaymentOption;
  description: string;
  customer: { firstName: string; lastName: string; email: string };
  /** Token/sesión emitido por el backend para el proveedor. En sandbox es ficticio. */
  providerSessionToken: string | null;
}

export type PaymentResult =
  | { status: "approved"; reference: string; methodLabel: string }
  | { status: "pending"; reference: string; instructions: string; expiresAt: string }
  | { status: "rejected"; code: string; message: string };

export interface PaymentWidgetHandle {
  /** Envía el pago al proveedor y resuelve con el resultado (nunca lanza por rechazo). */
  confirm(): Promise<PaymentResult>;
}

export interface PaymentWidgetProps {
  request: PaymentRequest;
  method: PaymentMethod;
  disabled?: boolean;
  ref?: Ref<PaymentWidgetHandle>;
}

export type PaymentWidget = (props: PaymentWidgetProps) => ReactNode;

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  card: "Tarjeta",
  yape: "Yape",
  pagoefectivo: "PagoEfectivo",
};

/** Modo de pagos. Hoy solo existe el sandbox simulado (no hay pasarela contratada: ADR pendiente). */
export const PAYMENTS_MODE: "sandbox" | "live" = process.env.NEXT_PUBLIC_PAYMENTS_MODE === "live" ? "live" : "sandbox";
