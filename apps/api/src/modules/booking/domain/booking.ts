import type { CalendarDate } from '../../../shared/domain/calendar-date.js';
import { BusinessRuleError, ConflictError } from '../../../shared/domain/domain-error.js';
import { CurrencyMismatchError, Money, type CurrencyCode } from '../../../shared/domain/money.js';
import type { Locale, PaxType, Residency } from '../../catalog/domain/tour.js';
import { assertBookingTransition, type BookingStatus } from './booking-status.js';
import type { PaymentOption, PaymentPlan } from './payment-plan.js';

export type ActorType = 'system' | 'customer' | 'user' | 'webhook';
export type BookingPaymentKind = 'deposit' | 'balance' | 'full';

export interface BookingItemLineSnapshot {
  paxType: PaxType;
  residency: Residency;
  quantity: number;
  rateId: string | null;
  unitAmount: bigint;
  lineAmount: bigint;
}

export interface BookingItemSnapshot {
  id: string;
  tourId: string;
  departureId: string | null;
  travelDate: CalendarDate;
  status: 'active' | 'cancelled';
  tourTitle: string;
  paxCount: number;
  subtotalAmount: bigint;
  currency: CurrencyCode;
  lines: BookingItemLineSnapshot[];
}

export interface BookingStatusChange {
  from: BookingStatus | null;
  to: BookingStatus;
  reason: string | null;
  actorType: ActorType;
  at: Date;
}

export interface BookingSnapshot {
  id: string;
  code: string;
  customerId: string;
  cartId: string | null;
  status: BookingStatus;
  source: 'web' | 'admin' | 'agent';
  locale: Locale;
  currency: CurrencyCode;
  subtotalAmount: bigint;
  discountAmount: bigint;
  totalAmount: bigint;
  paymentOption: PaymentOption;
  depositPercent: number;
  depositAmount: bigint;
  balanceAmount: bigint;
  balanceDueAt: Date | null;
  paidAmount: bigint;
  refundedAmount: bigint;
  holdExpiresAt: Date | null;
  firstServiceDate: CalendarDate;
  lastServiceDate: CalendarDate;
  cancellationPolicyVersion: string;
  termsVersion: string;
  customerNotes: string | null;
  /** SHA-256 (hex) del token de acceso del comprador; el token en claro nunca se guarda. */
  accessTokenHash: string | null;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  /** Reembolso adeudado según la política de cancelación (lo fija el backoffice al cancelar). */
  refundDueAmount?: bigint | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  items: BookingItemSnapshot[];
  /**
   * Cambios de estado de esta sesión. En PostgreSQL el historial lo escribe el trigger
   * `bookings_status_guard_trg`; aquí se conserva para el modo en memoria y auditoría de tests.
   */
  statusHistory: BookingStatusChange[];
}

export class HoldExpiredError extends ConflictError {
  constructor(code: string) {
    super('hold-expired', 'Tu reserva temporal expiró. Vuelve al carrito para intentarlo de nuevo.', { bookingCode: code });
  }
}

export class BookingAlreadyPaidError extends ConflictError {
  constructor(code: string) {
    super('booking-already-paid', 'Tu reserva ya está pagada.', { bookingCode: code });
  }
}

export class OverpaymentError extends BusinessRuleError {
  constructor(details: Record<string, unknown>) {
    super('overpayment', 'El monto supera el saldo pendiente.', details);
  }
}

export interface StatusTransitionResult {
  from: BookingStatus;
  to: BookingStatus;
  changed: boolean;
}

const ACCESS_TOKEN_HASH = /^[0-9a-f]{64}$/;

function assertAccessTokenHash(hash: string): void {
  if (!ACCESS_TOKEN_HASH.test(hash)) throw new BusinessRuleError('invalid-access-token-hash', 'Hash de token de acceso inválido.');
}

/** Agregado reserva con plan de pago embebido (adelanto/saldo). */
export class Booking {
  private constructor(private props: BookingSnapshot) {}

  static create(params: {
    id: string;
    code: string;
    customerId: string;
    cartId: string | null;
    locale: Locale;
    plan: PaymentPlan;
    items: BookingItemSnapshot[];
    lastServiceDate: CalendarDate;
    cancellationPolicyVersion: string;
    termsVersion: string;
    customerNotes: string | null;
    /** SHA-256 (hex) del token de acceso entregado al comprador. */
    accessTokenHash?: string | null;
    now: Date;
  }): Booking {
    const accessTokenHash = params.accessTokenHash ?? null;
    if (accessTokenHash !== null) assertAccessTokenHash(accessTokenHash);
    const { plan, now } = params;
    const itemsTotal = Money.sum(params.items.map((i) => Money.of(i.subtotalAmount, i.currency)));
    if (!itemsTotal.equals(plan.total)) {
      throw new BusinessRuleError('booking-total-mismatch', 'El total de los ítems no coincide con el plan de pago.');
    }
    return new Booking({
      id: params.id,
      code: params.code,
      customerId: params.customerId,
      cartId: params.cartId,
      status: 'pending',
      source: 'web',
      locale: params.locale,
      currency: plan.total.currency,
      subtotalAmount: plan.total.amount,
      discountAmount: 0n,
      totalAmount: plan.total.amount,
      paymentOption: plan.option,
      depositPercent: plan.depositPercent,
      depositAmount: plan.deposit.amount,
      balanceAmount: plan.balance.amount,
      balanceDueAt: plan.balanceDueAt,
      paidAmount: 0n,
      refundedAmount: 0n,
      holdExpiresAt: null,
      firstServiceDate: plan.firstServiceDate,
      lastServiceDate: params.lastServiceDate,
      cancellationPolicyVersion: params.cancellationPolicyVersion,
      termsVersion: params.termsVersion,
      customerNotes: params.customerNotes,
      accessTokenHash,
      confirmedAt: null,
      cancelledAt: null,
      cancellationReason: null,
      refundDueAmount: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
      items: params.items,
      statusHistory: [{ from: null, to: 'pending', reason: 'checkout', actorType: 'customer', at: now }],
    });
  }

  static restore(snapshot: BookingSnapshot): Booking {
    return new Booking(structuredClone(snapshot));
  }

  get id(): string {
    return this.props.id;
  }
  get code(): string {
    return this.props.code;
  }
  get status(): BookingStatus {
    return this.props.status;
  }
  get currency(): CurrencyCode {
    return this.props.currency;
  }
  get items(): readonly BookingItemSnapshot[] {
    return this.props.items;
  }
  get holdExpiresAt(): Date | null {
    return this.props.holdExpiresAt;
  }
  get paymentOption(): PaymentOption {
    return this.props.paymentOption;
  }
  get total(): Money {
    return Money.of(this.props.totalAmount, this.props.currency);
  }
  get deposit(): Money {
    return Money.of(this.props.depositAmount, this.props.currency);
  }
  get paid(): Money {
    return Money.of(this.props.paidAmount, this.props.currency);
  }
  get refunded(): Money {
    return Money.of(this.props.refundedAmount, this.props.currency);
  }
  get outstanding(): Money {
    return this.total.subtract(this.paid);
  }

  isHoldExpired(now: Date): boolean {
    return this.props.status === 'held' && this.props.holdExpiresAt !== null && this.props.holdExpiresAt.getTime() <= now.getTime();
  }

  /** pending -> held: los cupos quedaron retenidos hasta `expiresAt`. */
  get cartId(): string | null {
    return this.props.cartId;
  }

  get accessTokenHash(): string | null {
    return this.props.accessTokenHash;
  }

  /** Reemplaza el token de acceso (el anterior deja de servir). */
  rotateAccessToken(accessTokenHash: string, now: Date): void {
    assertAccessTokenHash(accessTokenHash);
    this.props.accessTokenHash = accessTokenHash;
    this.props.updatedAt = now;
  }

  placeHold(expiresAt: Date, now: Date): void {
    this.transition('held', now, 'inventory_held', 'customer');
    this.props.holdExpiresAt = expiresAt;
  }

  /** Qué cobro corresponde ahora y por cuánto (HU-4.4 / HU-5.1). */
  nextPayment(now: Date): { kind: BookingPaymentKind; amount: Money } {
    switch (this.props.status) {
      case 'held':
        if (this.isHoldExpired(now)) throw new HoldExpiredError(this.code);
        return this.initialPayment();
      case 'confirmed':
        return this.initialPayment();
      case 'partially_paid':
        return { kind: 'balance', amount: this.outstanding };
      case 'paid':
      case 'completed':
        throw new BookingAlreadyPaidError(this.code);
      default:
        throw new ConflictError('booking-not-payable', 'La reserva no admite pagos en su estado actual.', {
          bookingCode: this.code,
          status: this.props.status,
        });
    }
  }

  /**
   * Aplica un cobro exitoso: suma a paidAmount y avanza el estado
   * (held/confirmed -> partially_paid | paid; partially_paid -> paid).
   */
  registerPayment(amount: Money, now: Date, actorType: ActorType = 'webhook'): StatusTransitionResult {
    this.assertPositiveSameCurrency(amount);
    const newPaid = this.paid.add(amount);
    if (newPaid.greaterThan(this.total)) {
      throw new OverpaymentError({ outstanding: this.outstanding.amount, attempted: amount.amount });
    }
    const from = this.props.status;
    if (!['held', 'confirmed', 'partially_paid'].includes(from)) {
      throw new ConflictError('booking-not-payable', 'La reserva no admite pagos en su estado actual.', {
        bookingCode: this.code,
        status: from,
      });
    }
    let to: BookingStatus;
    if (newPaid.equals(this.total)) to = 'paid';
    else if (!newPaid.lessThan(this.deposit)) to = 'partially_paid';
    else {
      throw new BusinessRuleError('insufficient-deposit', 'El pago no cubre el adelanto requerido.', {
        deposit: this.props.depositAmount,
        attempted: amount.amount,
      });
    }
    this.props.paidAmount = newPaid.amount;
    if (to !== from) this.transition(to, now, to === 'paid' ? 'payment_completed' : 'deposit_paid', actorType);
    this.props.holdExpiresAt = null;
    this.props.confirmedAt ??= now;
    this.props.updatedAt = now;
    return { from, to, changed: from !== to };
  }

  /**
   * Pago que llega con la reserva ya cancelada (webhook tardío): se registra el cobro
   * para poder reembolsarlo (refunded <= paid), sin reactivar la reserva.
   */
  registerLatePayment(amount: Money, now: Date): void {
    this.assertPositiveSameCurrency(amount);
    if (this.props.status !== 'cancelled') {
      throw new ConflictError('late-payment-invalid', 'Solo se registran pagos tardíos sobre reservas canceladas.');
    }
    const newPaid = this.paid.add(amount);
    if (newPaid.greaterThan(this.total)) throw new OverpaymentError({ attempted: amount.amount });
    this.props.paidAmount = newPaid.amount;
    this.props.updatedAt = now;
  }

  registerRefund(amount: Money, now: Date, reason: string): StatusTransitionResult {
    this.assertPositiveSameCurrency(amount);
    const newRefunded = this.refunded.add(amount);
    if (newRefunded.greaterThan(this.paid)) {
      throw new BusinessRuleError('refund-exceeds-paid', 'El reembolso supera lo pagado.', {
        paid: this.props.paidAmount,
        refunded: this.props.refundedAmount,
        attempted: amount.amount,
      });
    }
    this.props.refundedAmount = newRefunded.amount;
    const from = this.props.status;
    if (from === 'cancelled' || from === 'completed') this.transition('refunded', now, reason, 'system');
    this.props.updatedAt = now;
    return { from, to: this.props.status, changed: from !== this.props.status };
  }

  cancel(reason: string, now: Date, actorType: ActorType): StatusTransitionResult {
    const from = this.props.status;
    this.transition('cancelled', now, reason, actorType);
    this.props.cancelledAt = now;
    this.props.cancellationReason = reason.slice(0, 500);
    this.props.holdExpiresAt = null;
    return { from, to: 'cancelled', changed: from !== 'cancelled' };
  }

  /**
   * Cancelación por el staff (HU-7.5): fija el reembolso adeudado según la política vigente
   * y marca los ítems como cancelados. El inventario lo libera BookingLifecycle.
   */
  cancelByStaff(reason: string, now: Date, refundDue: Money): StatusTransitionResult {
    if (refundDue.currency !== this.props.currency) throw new CurrencyMismatchError(this.props.currency, refundDue.currency);
    const maxRefundable = this.paid.subtract(this.refunded);
    if (refundDue.amount < 0n || refundDue.greaterThan(maxRefundable)) {
      throw new BusinessRuleError('refund-exceeds-paid', 'El reembolso no puede superar lo pagado neto.', {
        paid: this.props.paidAmount,
        refunded: this.props.refundedAmount,
        attempted: refundDue.amount,
      });
    }
    const result = this.cancel(reason, now, 'user');
    this.props.refundDueAmount = refundDue.amount + this.props.refundedAmount;
    for (const item of this.props.items) item.status = 'cancelled';
    return result;
  }

  get snapshot(): Readonly<BookingSnapshot> {
    return this.props;
  }

  complete(now: Date): void {
    this.transition('completed', now, 'service_finished', 'system');
    this.props.completedAt = now;
  }

  toSnapshot(): BookingSnapshot {
    return structuredClone(this.props);
  }

  private initialPayment(): { kind: BookingPaymentKind; amount: Money } {
    return this.props.paymentOption === 'full'
      ? { kind: 'full', amount: this.total }
      : { kind: 'deposit', amount: this.deposit };
  }

  private transition(to: BookingStatus, now: Date, reason: string, actorType: ActorType): void {
    const from = this.props.status;
    assertBookingTransition(from, to, this.props.code);
    if (from === to) return;
    this.props.status = to;
    this.props.updatedAt = now;
    this.props.statusHistory.push({ from, to, reason, actorType, at: now });
  }

  private assertPositiveSameCurrency(amount: Money): void {
    if (amount.currency !== this.props.currency) throw new CurrencyMismatchError(this.props.currency, amount.currency);
    if (!amount.isPositive()) throw new BusinessRuleError('invalid-amount', 'El monto debe ser mayor que cero.');
  }
}
