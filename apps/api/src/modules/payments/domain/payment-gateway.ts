import { DomainError } from '../../../shared/domain/domain-error.js';
import type { Money } from '../../../shared/domain/money.js';
import type { PaymentProviderCode, PaymentStatus } from './payment.js';

export interface CreateIntentInput {
  paymentId: string;
  amount: Money;
  /** Se reenvía al proveedor para que reintentos no generen dos cobros. */
  idempotencyKey: string;
  /** Código de reserva visible en el estado de cuenta del cliente. */
  reference: string;
  description: string;
  returnUrl?: string;
}

export type NextAction =
  | { type: 'redirect'; url: string }
  | { type: 'sdk'; token: string }
  | { type: 'none' };

export interface PaymentIntent {
  providerPaymentId: string;
  status: PaymentStatus;
  nextAction: NextAction;
}

export interface ProviderPaymentState {
  providerPaymentId: string;
  status: PaymentStatus;
  amount: Money;
  failureCode?: string | null;
  failureMessage?: string | null;
}

export interface RefundInput {
  providerPaymentId: string;
  amount: Money;
  idempotencyKey: string;
  reason: string;
}

export interface RefundResult {
  providerRefundId: string;
  status: PaymentStatus;
}

export interface WebhookEvent {
  eventId: string;
  type: string;
  providerPaymentId: string | null;
  status: PaymentStatus | null;
  amount: Money | null;
  occurredAt: Date;
  /** Payload ya saneado (sin PAN/CVV/tokens) para guardar en payment_events. */
  payload: Record<string, unknown>;
}

export type WebhookHeaders = Record<string, string | string[] | undefined>;

export class InvalidWebhookSignatureError extends DomainError {
  constructor(reason: string) {
    super('invalid-webhook-signature', 'Firma del webhook inválida.', 'unauthorized', { reason });
  }
}

export class PaymentGatewayError extends DomainError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super('payment-gateway-error', message, 'unavailable', details);
  }
}

/**
 * Puerto hacia la pasarela (Izipay, Niubiz, Mercado Pago, Culqi...). Nunca recibe ni
 * devuelve datos de tarjeta: el formulario es el del proveedor (PCI DSS SAQ-A).
 */
export interface PaymentGateway {
  readonly provider: PaymentProviderCode;
  createIntent(input: CreateIntentInput): Promise<PaymentIntent>;
  /** Completa/captura el cobro con la confirmación opaca que devolvió el formulario del proveedor. */
  confirm(providerPaymentId: string, confirmation: Record<string, string>): Promise<ProviderPaymentState>;
  refund(input: RefundInput): Promise<RefundResult>;
  getStatus(providerPaymentId: string): Promise<ProviderPaymentState>;
  /** Verifica firma y antigüedad del webhook sobre el cuerpo crudo; lanza si no es válido. */
  verifyWebhook(rawBody: Buffer, headers: WebhookHeaders): WebhookEvent;
}

export interface PaymentGatewayRegistry {
  get(provider: string): PaymentGateway;
  readonly defaultGateway: PaymentGateway;
}
