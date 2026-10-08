import type { ReactNode, Ref } from "react";

import type { Currency } from "@/lib/catalog/types";
import type { PaymentOption } from "@/lib/checkout/payment-plan";

/**
 * Contrato del paso de pago. Cada proveedor (Izipay, Niubiz, Mercado Pago, Culqi) se implementa
 * como un componente `PaymentWidget` que monta su formulario embebido (iframe / hosted fields):
 * los datos de tarjeta NUNCA pasan por formularios propios (PCI DSS SAQ-A).
 *
 * Flujo (Sprint 1, BFF): el widget solo recoge la "confirmación opaca" del proveedor con `collect()`;
 * la Server Action crea la reserva (`POST /bookings`), el cobro (`POST /bookings/:id/payments`) y lo
 * confirma servidor a servidor (`POST /payments/:id/confirm`). La confirmación definitiva de un
 * proveedor real llega además por webhook a la API.
 */

/** Métodos que ofrece la UI (subconjunto del enum PaymentMethod de la API). */
export type PaymentMethod = "card" | "yape" | "pagoefectivo";

export interface PaymentRequest {
  /** Código de la reserva si ya existe (reintento); null antes de crearla. */
  orderCode: string | null;
  amountCents: number;
  currency: Currency;
  option: PaymentOption;
  description: string;
  /** Token/sesión emitido por el backend para el proveedor. En sandbox no existe. */
  providerSessionToken: string | null;
}

/** Resultado que el SANDBOX pide simular a la pasarela simulada de la API. */
export type SimulatedOutcome = "approved" | "rejected" | "pending";

export interface ProviderConfirmation {
  simulate: SimulatedOutcome;
}

export interface PaymentWidgetHandle {
  /** Recoge la confirmación del formulario del proveedor (nunca datos de tarjeta). */
  collect(): Promise<ProviderConfirmation>;
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
