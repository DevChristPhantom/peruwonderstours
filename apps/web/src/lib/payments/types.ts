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

/** Pasarela activa (variable de servidor `PAYMENT_PROVIDER`; debe coincidir con la de la API). */
export type PaymentProvider = "sandbox" | "izipay";

/** Datos del titular que exige el formulario de Izipay (no son datos de tarjeta). */
export interface CardHolder {
  documentType: "DNI" | "CE" | "PASAPORTE" | "OTROS";
  document: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
}

/** Comprador, cuando la página no lo conoce (pago desde la reserva: la API no expone datos personales). */
export interface PaymentBuyer {
  firstName: string;
  lastName: string;
  /** Con código de país, solo dígitos o E.164. */
  phone: string;
  /** ISO 3166-1 alfa-2. */
  country: string;
}

export interface ProviderConfirmation {
  simulate: SimulatedOutcome;
  /** Solo Izipay. */
  holder?: CardHolder;
  /** Solo Izipay con `askBuyer`. */
  buyer?: PaymentBuyer;
}

export interface PaymentWidgetHandle {
  /** Recoge la confirmación del formulario (nunca datos de tarjeta); null si falta corregir algo. */
  collect(): Promise<ProviderConfirmation | null>;
}

/** El cobro quedó creado y espera el formulario del proveedor en el navegador. */
export interface ProviderAction {
  provider: "izipay";
  paymentId: string;
  /** Token de sesión de un solo uso (15 min). */
  token: string;
  /** Configuración pública del SDK que entrega la API (scriptUrl, keyRSA, transactionId, orderNumber...). */
  params: Record<string, string>;
}

/** Resultado de confirmar el formulario del proveedor. `open`: el viajero no terminó de pagar. */
export type ProviderPaymentOutcome = "succeeded" | "pending" | "failed" | "open";

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
