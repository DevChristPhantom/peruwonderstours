import { BusinessRuleError, DomainError } from '../../../shared/domain/domain-error.js';
import { Money, type CurrencyCode } from '../../../shared/domain/money.js';

export const PAYMENT_STATUSES = ['pending', 'requires_action', 'authorized', 'succeeded', 'failed', 'cancelled', 'expired'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type PaymentKind = 'deposit' | 'balance' | 'full' | 'refund';

/**
 * Proveedores del enum `payment_provider` + `sandbox` (adaptador simulado).
 * PENDIENTE DBA: `sandbox` no existe en el enum de PostgreSQL; el repositorio Prisma
 * rechaza persistirlo hasta que se agregue (ver informe).
 */
export type PaymentProviderCode = 'izipay' | 'niubiz' | 'mercadopago' | 'culqi' | 'manual' | 'sandbox';
export type PaymentMethod = 'card' | 'yape' | 'plin' | 'pagoefectivo' | 'bank_transfer' | 'cash';

/** Máquina de estados de un intento de cobro ante el proveedor. */
export const PAYMENT_STATUS_TRANSITIONS: Readonly<Record<PaymentStatus, readonly PaymentStatus[]>> = {
  pending: ['requires_action', 'authorized', 'succeeded', 'failed', 'cancelled', 'expired'],
  requires_action: ['authorized', 'succeeded', 'failed', 'cancelled', 'expired'],
  authorized: ['succeeded', 'failed', 'cancelled', 'expired'],
  succeeded: [],
  failed: [],
  cancelled: [],
  expired: [],
};

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return from === to || PAYMENT_STATUS_TRANSITIONS[from].includes(to);
}

export function isTerminalPaymentStatus(status: PaymentStatus): boolean {
  return PAYMENT_STATUS_TRANSITIONS[status].length === 0;
}

export class InvalidPaymentTransitionError extends DomainError {
  constructor(from: PaymentStatus, to: PaymentStatus, paymentId: string) {
    super('invalid-payment-transition', `El pago no puede pasar de "${from}" a "${to}".`, 'conflict', { from, to, paymentId });
  }
}

export interface PaymentSnapshot {
  id: string;
  bookingId: string;
  kind: PaymentKind;
  provider: PaymentProviderCode;
  method: PaymentMethod | null;
  status: PaymentStatus;
  amount: bigint;
  currency: CurrencyCode;
  /** Monto en la moneda de la reserva (sin conversión en el MVP: igual a amount). */
  bookingCurrencyAmount: bigint;
  providerPaymentId: string | null;
  idempotencyKey: string;
  parentPaymentId: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  succeededAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentStatusChange {
  from: PaymentStatus;
  to: PaymentStatus;
  changed: boolean;
  /** true si el evento se ignoró por llegar fuera de orden (p. ej. failed tras succeeded). */
  ignored: boolean;
}

export class Payment {
  private constructor(private props: PaymentSnapshot) {}

  static create(params: {
    id: string;
    bookingId: string;
    kind: PaymentKind;
    provider: PaymentProviderCode;
    method: PaymentMethod | null;
    amount: Money;
    idempotencyKey: string;
    parentPaymentId?: string | null;
    now: Date;
  }): Payment {
    if (!params.amount.isPositive()) {
      throw new BusinessRuleError('invalid-amount', 'El monto del pago debe ser mayor que cero.');
    }
    if ((params.kind === 'refund') !== Boolean(params.parentPaymentId)) {
      throw new BusinessRuleError('refund-parent-required', 'Un reembolso debe referir al pago original.');
    }
    return new Payment({
      id: params.id,
      bookingId: params.bookingId,
      kind: params.kind,
      provider: params.provider,
      method: params.method,
      status: 'pending',
      amount: params.amount.amount,
      currency: params.amount.currency,
      bookingCurrencyAmount: params.amount.amount,
      providerPaymentId: null,
      idempotencyKey: params.idempotencyKey,
      parentPaymentId: params.parentPaymentId ?? null,
      failureCode: null,
      failureMessage: null,
      succeededAt: null,
      createdAt: params.now,
      updatedAt: params.now,
    });
  }

  static restore(snapshot: PaymentSnapshot): Payment {
    return new Payment({ ...snapshot });
  }

  get id(): string {
    return this.props.id;
  }
  get bookingId(): string {
    return this.props.bookingId;
  }
  get kind(): PaymentKind {
    return this.props.kind;
  }
  get provider(): PaymentProviderCode {
    return this.props.provider;
  }
  get status(): PaymentStatus {
    return this.props.status;
  }
  get amount(): Money {
    return Money.of(this.props.amount, this.props.currency);
  }
  get bookingCurrencyAmount(): Money {
    return Money.of(this.props.bookingCurrencyAmount, this.props.currency);
  }
  get providerPaymentId(): string | null {
    return this.props.providerPaymentId;
  }
  get idempotencyKey(): string {
    return this.props.idempotencyKey;
  }

  attachProviderPayment(providerPaymentId: string, now: Date): void {
    if (this.props.providerPaymentId && this.props.providerPaymentId !== providerPaymentId) {
      throw new BusinessRuleError('provider-payment-mismatch', 'El pago ya está asociado a otra operación del proveedor.');
    }
    this.props.providerPaymentId = providerPaymentId;
    this.props.updatedAt = now;
  }

  /**
   * Aplica el estado informado por el proveedor. Idempotente para el mismo estado; los
   * eventos que intentan salir de un estado terminal se ignoran (llegan fuera de orden).
   */
  applyProviderStatus(
    to: PaymentStatus,
    now: Date,
    failure?: { code?: string | null; message?: string | null },
  ): PaymentStatusChange {
    const from = this.props.status;
    if (from === to) return { from, to, changed: false, ignored: false };
    if (!canTransitionPayment(from, to)) {
      if (isTerminalPaymentStatus(from)) return { from, to: from, changed: false, ignored: true };
      throw new InvalidPaymentTransitionError(from, to, this.id);
    }
    this.props.status = to;
    this.props.updatedAt = now;
    if (to === 'succeeded') this.props.succeededAt = now;
    if (to === 'failed') {
      this.props.failureCode = failure?.code?.slice(0, 80) ?? 'provider_declined';
      this.props.failureMessage = failure?.message?.slice(0, 500) ?? null;
    }
    return { from, to, changed: true, ignored: false };
  }

  toSnapshot(): PaymentSnapshot {
    return { ...this.props };
  }
}

export type EventProcessingStatus = 'received' | 'processed' | 'ignored' | 'failed';

/** Webhook entrante; idempotencia por (provider, eventId). */
export interface PaymentEvent {
  id: string;
  provider: PaymentProviderCode;
  eventId: string;
  eventType: string;
  paymentId: string | null;
  signatureValid: boolean;
  payload: Record<string, unknown>;
  processingStatus: EventProcessingStatus;
  attempts: number;
  lastError: string | null;
  receivedAt: Date;
  processedAt: Date | null;
}
