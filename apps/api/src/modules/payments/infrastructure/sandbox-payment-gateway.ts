import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { DomainError } from '../../../shared/domain/domain-error.js';
import { isCurrencyCode, Money } from '../../../shared/domain/money.js';
import type { Clock } from '../../../shared/domain/ports.js';
import { PAYMENT_STATUSES, isTerminalPaymentStatus, type PaymentStatus } from '../domain/payment.js';
import {
  InvalidWebhookSignatureError,
  PaymentGatewayError,
  type CreateIntentInput,
  type PaymentGateway,
  type PaymentIntent,
  type ProviderPaymentState,
  type RefundInput,
  type RefundResult,
  type WebhookEvent,
  type WebhookHeaders,
} from '../domain/payment-gateway.js';

export const SANDBOX_SIGNATURE_HEADER = 'x-sandbox-signature';

export interface SandboxGatewayOptions {
  webhookSecret: string;
  checkoutBaseUrl: string;
  /** Antigüedad máxima aceptada del webhook (anti-replay). */
  webhookToleranceSeconds: number;
}

interface SandboxIntent {
  providerPaymentId: string;
  idempotencyKey: string;
  amount: Money;
  status: PaymentStatus;
  failureCode: string | null;
}

/**
 * Pasarela SIMULADA para desarrollo, demo y pruebas. No mueve dinero ni contacta a nadie.
 * Imita lo esencial de un proveedor real: idempotencia por clave, estados del intento,
 * reembolsos y webhooks firmados con HMAC-SHA256 (`t=<unix>,v1=<hex>` sobre `${t}.${body}`).
 * Confirmación: `{ simulate: "fail" }` simula rechazo; cualquier otro valor, aprobación.
 */
export class SandboxPaymentGateway implements PaymentGateway {
  readonly provider = 'sandbox' as const;
  private readonly intents = new Map<string, SandboxIntent>();
  private readonly byKey = new Map<string, string>();
  private readonly refunds = new Map<string, RefundResult>();

  constructor(
    private readonly options: SandboxGatewayOptions,
    private readonly clock: Clock,
  ) {
    if (options.webhookSecret.length < 16) {
      throw new Error('SANDBOX_WEBHOOK_SECRET debe tener al menos 16 caracteres.');
    }
  }

  createIntent(input: CreateIntentInput): Promise<PaymentIntent> {
    const existingId = this.byKey.get(input.idempotencyKey);
    const existing = existingId ? this.intents.get(existingId) : undefined;
    if (existing) {
      if (!existing.amount.equals(input.amount)) {
        return Promise.reject(new PaymentGatewayError('Clave de idempotencia reutilizada con otro monto (sandbox).'));
      }
      return Promise.resolve(this.toIntent(existing));
    }
    const intent: SandboxIntent = {
      providerPaymentId: `sbx_pay_${randomUUID().replaceAll('-', '')}`,
      idempotencyKey: input.idempotencyKey,
      amount: input.amount,
      status: 'requires_action',
      failureCode: null,
    };
    this.intents.set(intent.providerPaymentId, intent);
    this.byKey.set(input.idempotencyKey, intent.providerPaymentId);
    return Promise.resolve(this.toIntent(intent));
  }

  confirm(providerPaymentId: string, confirmation: Record<string, string>): Promise<ProviderPaymentState> {
    const intent = this.intents.get(providerPaymentId);
    if (!intent) return Promise.reject(new PaymentGatewayError('Intento de pago desconocido (sandbox).', { providerPaymentId }));
    if (!isTerminalPaymentStatus(intent.status)) {
      const fail = confirmation['simulate'] === 'fail';
      intent.status = fail ? 'failed' : 'succeeded';
      intent.failureCode = fail ? 'card_declined' : null;
    }
    return Promise.resolve(this.toState(intent));
  }

  getStatus(providerPaymentId: string): Promise<ProviderPaymentState> {
    const intent = this.intents.get(providerPaymentId);
    if (!intent) return Promise.reject(new PaymentGatewayError('Intento de pago desconocido (sandbox).', { providerPaymentId }));
    return Promise.resolve(this.toState(intent));
  }

  refund(input: RefundInput): Promise<RefundResult> {
    const previous = this.refunds.get(input.idempotencyKey);
    if (previous) return Promise.resolve(previous);
    const intent = this.intents.get(input.providerPaymentId);
    if (!intent || intent.status !== 'succeeded') {
      return Promise.reject(new PaymentGatewayError('Solo se reembolsan pagos aprobados (sandbox).'));
    }
    if (input.amount.greaterThan(intent.amount)) {
      return Promise.reject(new PaymentGatewayError('El reembolso supera el pago (sandbox).'));
    }
    const result: RefundResult = { providerRefundId: `sbx_ref_${randomUUID().replaceAll('-', '')}`, status: 'succeeded' };
    this.refunds.set(input.idempotencyKey, result);
    return Promise.resolve(result);
  }

  /** Firma un cuerpo de webhook como lo haría el proveedor (tests y herramientas locales). */
  signWebhook(body: string, timestamp = Math.floor(this.clock.now().getTime() / 1000)): string {
    const signature = createHmac('sha256', this.options.webhookSecret).update(`${timestamp}.${body}`).digest('hex');
    return `t=${timestamp},v1=${signature}`;
  }

  verifyWebhook(rawBody: Buffer, headers: WebhookHeaders): WebhookEvent {
    const header = headers[SANDBOX_SIGNATURE_HEADER];
    const value = Array.isArray(header) ? header[0] : header;
    if (!value) throw new InvalidWebhookSignatureError('missing_signature');
    const parts = Object.fromEntries(value.split(',').map((p) => p.trim().split('=') as [string, string]));
    const timestamp = Number(parts['t']);
    const provided = parts['v1'];
    if (!Number.isInteger(timestamp) || !provided || !/^[0-9a-f]{64}$/.test(provided)) {
      throw new InvalidWebhookSignatureError('malformed_signature');
    }
    const ageSeconds = Math.abs(this.clock.now().getTime() / 1000 - timestamp);
    if (ageSeconds > this.options.webhookToleranceSeconds) throw new InvalidWebhookSignatureError('timestamp_out_of_tolerance');

    const expected = createHmac('sha256', this.options.webhookSecret).update(`${timestamp}.`).update(rawBody).digest();
    const actual = Buffer.from(provided, 'hex');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new InvalidWebhookSignatureError('signature_mismatch');
    }
    return this.parseEvent(rawBody);
  }

  private parseEvent(rawBody: Buffer): WebhookEvent {
    let body: unknown;
    try {
      body = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new DomainError('invalid-webhook-payload', 'Cuerpo del webhook inválido.', 'validation');
    }
    const event = body as { id?: unknown; type?: unknown; created?: unknown; data?: Record<string, unknown> };
    if (typeof event.id !== 'string' || event.id.length === 0 || event.id.length > 160 || typeof event.type !== 'string') {
      throw new DomainError('invalid-webhook-payload', 'Evento sin id o tipo.', 'validation');
    }
    const data = event.data ?? {};
    const status = typeof data['status'] === 'string' && (PAYMENT_STATUSES as readonly string[]).includes(data['status'])
      ? (data['status'] as PaymentStatus)
      : null;
    const amount =
      (typeof data['amount'] === 'number' || typeof data['amount'] === 'string') && isCurrencyCode(data['currency'])
        ? Money.of(data['amount'], data['currency'])
        : null;
    return {
      eventId: event.id,
      type: event.type.slice(0, 80),
      providerPaymentId: typeof data['providerPaymentId'] === 'string' ? data['providerPaymentId'] : null,
      status,
      amount,
      occurredAt: typeof event.created === 'number' ? new Date(event.created * 1000) : this.clock.now(),
      payload: { id: event.id, type: event.type, data: { providerPaymentId: data['providerPaymentId'], status: data['status'], amount: data['amount'], currency: data['currency'] } },
    };
  }

  private toIntent(intent: SandboxIntent): PaymentIntent {
    return {
      providerPaymentId: intent.providerPaymentId,
      status: intent.status,
      nextAction: isTerminalPaymentStatus(intent.status)
        ? { type: 'none' }
        : { type: 'redirect', url: `${this.options.checkoutBaseUrl.replace(/\/$/, '')}/${intent.providerPaymentId}` },
    };
  }

  private toState(intent: SandboxIntent): ProviderPaymentState {
    return {
      providerPaymentId: intent.providerPaymentId,
      status: intent.status,
      amount: intent.amount,
      failureCode: intent.failureCode,
      failureMessage: intent.failureCode ? 'Tu banco rechazó el pago. Prueba otra tarjeta o medio.' : null,
    };
  }
}

export class StaticPaymentGatewayRegistry {
  private readonly byProvider: Map<string, PaymentGateway>;

  constructor(
    gateways: PaymentGateway[],
    readonly defaultGateway: PaymentGateway,
  ) {
    this.byProvider = new Map(gateways.map((g) => [g.provider, g]));
  }

  get(provider: string): PaymentGateway {
    const gateway = this.byProvider.get(provider);
    if (!gateway) throw new DomainError('unknown-payment-provider', 'Proveedor de pagos no configurado.', 'not_found', { provider });
    return gateway;
  }
}
