import type { UnitOfWork } from '../../../shared/application/unit-of-work.js';
import { ConflictError, DomainError, NotFoundError } from '../../../shared/domain/domain-error.js';
import { assertIdempotencyKey, IdempotencyKeyReusedError } from '../../../shared/domain/idempotency.js';
import type { Clock, IdGenerator } from '../../../shared/domain/ports.js';
import { loadBookingWithAccess, type BookingAccess } from '../../booking/application/booking-access.js';
import { BookingLifecycle } from '../../booking/application/booking-lifecycle.js';
import { HoldExpiredError, type Booking } from '../../booking/domain/booking.js';
import { isTerminalPaymentStatus, Payment, type PaymentEvent, type PaymentMethod } from '../domain/payment.js';
import {
  PaymentGatewayError,
  type NextAction,
  type PaymentGatewayRegistry,
  type ProviderPaymentState,
  type WebhookHeaders,
} from '../domain/payment-gateway.js';

export class PaymentNotFoundError extends NotFoundError {
  constructor(ref: string) {
    super('payment-not-found', 'Pago no encontrado.', { payment: ref });
  }
}

/** H-10: la pasarela informó un cobro con otro monto/moneda (o sin monto): no se aplica. */
export class PaymentAmountMismatchError extends DomainError {
  constructor(paymentId: string) {
    super('payment-amount-mismatch', 'El monto confirmado por la pasarela no coincide con el del pago.', 'unprocessable', { paymentId });
  }
}

export class DuplicatePaymentEventError extends ConflictError {
  constructor(provider: string, eventId: string) {
    super('duplicate-payment-event', 'Evento de pago ya registrado.', { provider, eventId });
  }
}

export interface CreatePaymentResult {
  payment: Payment;
  nextAction: NextAction;
  replayed: boolean;
}

export interface WebhookResult {
  eventId: string;
  status: 'processed' | 'duplicate' | 'ignored' | 'failed';
  paymentId: string | null;
}

type SyncOutcome = 'applied' | 'late_payment' | 'excess' | 'no_change' | 'ignored';

/** Casos de uso de cobro: intento, confirmación, webhook idempotente y reembolso automático. */
export class PaymentUseCases {
  private readonly lifecycle = new BookingLifecycle();

  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly gateways: PaymentGatewayRegistry,
  ) {}

  /**
   * Crea el intento de cobro que corresponde al estado de la reserva (adelanto, total o
   * saldo). Idempotente por Idempotency-Key (doble clic en "Pagar" => un solo intento).
   * La llamada al proveedor ocurre fuera de la transacción de base de datos.
   */
  async createPayment(input: {
    /** Código legible + X-Booking-Token del comprador. */
    booking: BookingAccess;
    idempotencyKey: string | undefined;
    method?: PaymentMethod | null;
    returnUrl?: string;
  }): Promise<CreatePaymentResult> {
    const key = assertIdempotencyKey(input.idempotencyKey);
    const gateway = this.gateways.defaultGateway;

    const prepared = await this.unitOfWork.run(async (repos) => {
      const now = this.clock.now();
      const booking = await loadBookingWithAccess(repos, input.booking);
      const existing = await repos.payments.findByIdempotencyKey(key);
      if (existing) {
        if (existing.bookingId !== booking.id) throw new IdempotencyKeyReusedError(key);
        return { kind: 'replay' as const, payment: existing, booking };
      }
      // Reserva bloqueada (H-01): serializa intentos de cobro, webhooks y cambios del staff.
      const locked = (await repos.bookings.findByIdForUpdate(booking.id)) ?? booking;
      if (await this.lifecycle.expireIfNeeded(repos, locked, now)) return { kind: 'expired' as const, booking: locked };
      const next = locked.nextPayment(now);
      // Un solo intento activo por reserva: un segundo "Pagar" (otra pestaña, otra clave) retoma
      // el intento en curso en vez de abrir otro cobro en paralelo.
      const active = await repos.payments.findActiveByBooking(locked.id);
      if (active) {
        if (active.kind === next.kind && active.amount.equals(next.amount)) return { kind: 'resume' as const, payment: active, booking: locked };
        throw new ConflictError('payment-in-progress', 'Ya hay un pago en curso para esta reserva. Termínalo o espera unos minutos.', {
          paymentId: active.id,
        });
      }
      const payment = Payment.create({
        id: this.ids.next(),
        bookingId: booking.id,
        kind: next.kind,
        provider: gateway.provider,
        method: input.method ?? null,
        amount: next.amount,
        idempotencyKey: key,
        now,
      });
      await repos.payments.save(payment);
      return { kind: 'created' as const, payment, booking };
    });

    if (prepared.kind === 'expired') throw new HoldExpiredError(prepared.booking.code);
    const { payment, booking } = prepared;
    if (prepared.kind !== 'created' && isTerminalPaymentStatus(payment.status)) {
      return { payment, nextAction: { type: 'none' }, replayed: true };
    }

    let intent;
    try {
      // El proveedor deduplica por la misma clave: un reintento devuelve el mismo intento.
      intent = await gateway.createIntent({
        paymentId: payment.id,
        amount: payment.amount,
        idempotencyKey: payment.idempotencyKey,
        reference: booking.code,
        description: `Reserva ${booking.code} (${payment.kind})`,
        returnUrl: input.returnUrl,
      });
    } catch (error) {
      await this.unitOfWork.run(async (repos) => {
        const current = await repos.payments.findById(payment.id);
        if (current && !isTerminalPaymentStatus(current.status)) {
          current.applyProviderStatus('failed', this.clock.now(), { code: 'gateway_error', message: 'No se pudo crear el intento de pago.' });
          await repos.payments.save(current);
        }
      });
      if (error instanceof DomainError) throw error;
      throw new PaymentGatewayError('La pasarela de pagos no respondió. Intenta de nuevo.');
    }

    const synced = await this.syncFromProvider(payment.id, { ...intent, amount: payment.amount }, 'customer', intent.providerPaymentId);
    return { payment: synced.payment, nextAction: intent.nextAction, replayed: prepared.kind !== 'created' };
  }

  /** Completa el cobro con la confirmación del formulario del proveedor (consulta servidor a servidor). */
  async confirmPayment(access: BookingAccess, paymentId: string, confirmation: Record<string, string>): Promise<Payment> {
    const payment = await this.getPayment(access, paymentId);
    if (!payment.providerPaymentId) {
      throw new ConflictError('payment-not-started', 'El pago aún no tiene un intento en la pasarela.');
    }
    if (isTerminalPaymentStatus(payment.status)) return payment;
    const gateway = this.gateways.get(payment.provider);
    const state = await gateway.confirm(payment.providerPaymentId, confirmation);
    return (await this.syncFromProvider(payment.id, state, 'customer')).payment;
  }

  /** Pago de la reserva indicada (404 si no existe o pertenece a otra reserva). */
  getPayment(access: BookingAccess, paymentId: string): Promise<Payment> {
    return this.unitOfWork.run(async (repos) => {
      const booking = await loadBookingWithAccess(repos, access);
      const payment = await repos.payments.findById(paymentId);
      if (!payment || payment.bookingId !== booking.id) throw new PaymentNotFoundError(paymentId);
      return payment;
    });
  }

  /** Pagos y reembolsos de la reserva, del más antiguo al más reciente. */
  listPayments(access: BookingAccess): Promise<Payment[]> {
    return this.unitOfWork.run(async (repos) => {
      const booking = await loadBookingWithAccess(repos, access);
      return repos.payments.findByBooking(booking.id);
    });
  }

  /**
   * Webhook del proveedor: firma verificada sobre el cuerpo crudo, idempotente por
   * (provider, eventId). Un evento repetido devuelve `duplicate` sin volver a aplicar nada.
   */
  async handleWebhook(provider: string, rawBody: Buffer, headers: WebhookHeaders): Promise<WebhookResult> {
    const gateway = this.gateways.get(provider);
    const event = gateway.verifyWebhook(rawBody, headers);
    const now = this.clock.now();

    let record: PaymentEvent;
    try {
      const registered = await this.unitOfWork.run(async (repos) => {
        const existing = await repos.paymentEvents.find(gateway.provider, event.eventId);
        if (existing && existing.processingStatus !== 'failed' && existing.processingStatus !== 'received') {
          return { duplicate: true as const, existing };
        }
        const base: PaymentEvent = existing ?? {
          id: this.ids.next(),
          provider: gateway.provider,
          eventId: event.eventId,
          eventType: event.type,
          paymentId: null,
          signatureValid: true,
          payload: event.payload,
          processingStatus: 'received',
          attempts: 0,
          lastError: null,
          receivedAt: now,
          processedAt: null,
        };
        const next = { ...base, attempts: base.attempts + 1 };
        if (existing) await repos.paymentEvents.update(next);
        else await repos.paymentEvents.insert(next);
        return { duplicate: false as const, record: next };
      });
      if (registered.duplicate) {
        return { eventId: event.eventId, status: 'duplicate', paymentId: registered.existing.paymentId };
      }
      record = registered.record;
    } catch (error) {
      if (error instanceof DuplicatePaymentEventError) return { eventId: event.eventId, status: 'duplicate', paymentId: null };
      throw error;
    }

    if (!event.providerPaymentId || !event.status) {
      await this.finishEvent(record, 'ignored', null, null);
      return { eventId: event.eventId, status: 'ignored', paymentId: null };
    }

    try {
      const payment = await this.unitOfWork.run((repos) => repos.payments.findByProviderPaymentId(gateway.provider, event.providerPaymentId!));
      if (!payment) {
        // Puede llegar antes de que confirmemos el intento: queda `failed` para el job de reproceso.
        await this.finishEvent(record, 'failed', null, 'payment_not_found');
        return { eventId: event.eventId, status: 'failed', paymentId: null };
      }
      // H-10: un cobro aprobado debe traer monto y moneda y coincidir con el intento.
      if (event.status === 'succeeded' && !event.amount) {
        await this.finishEvent(record, 'failed', payment.id, 'amount_missing');
        return { eventId: event.eventId, status: 'failed', paymentId: payment.id };
      }
      if (event.amount && !event.amount.equals(payment.amount)) {
        await this.finishEvent(record, 'failed', payment.id, 'amount_mismatch');
        return { eventId: event.eventId, status: 'failed', paymentId: payment.id };
      }
      const result = await this.syncFromProvider(
        payment.id,
        { providerPaymentId: event.providerPaymentId, status: event.status, amount: event.amount ?? payment.amount },
        'webhook',
      );
      await this.finishEvent(record, result.outcome === 'ignored' ? 'ignored' : 'processed', payment.id, null);
      return { eventId: event.eventId, status: result.outcome === 'ignored' ? 'ignored' : 'processed', paymentId: payment.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.finishEvent(record, 'failed', null, message.slice(0, 500));
      throw error;
    }
  }

  /**
   * Aplica el estado informado por el proveedor al pago y, si quedó `succeeded`, a la
   * reserva e inventario, en una sola transacción. Si la reserva estaba cancelada
   * (webhook tardío), reembolsa automáticamente.
   */
  private async syncFromProvider(
    paymentId: string,
    state: ProviderPaymentState,
    actor: 'customer' | 'webhook',
    providerPaymentId?: string,
  ): Promise<{ payment: Payment; outcome: SyncOutcome }> {
    const result = await this.unitOfWork.run(async (repos) => {
      const now = this.clock.now();
      const located = await repos.payments.findById(paymentId);
      if (!located) throw new PaymentNotFoundError(paymentId);
      // H-01: todo cambio de un pago se hace con la reserva bloqueada y releyendo el pago, así la
      // confirmación del cliente y el webhook del mismo cobro no lo aplican dos veces.
      await repos.bookings.findByIdForUpdate(located.bookingId);
      const payment = (await repos.payments.findById(paymentId))!;
      // H-10: monto y moneda confirmados por la pasarela deben coincidir con el intento.
      if (state.status === 'succeeded' && !isTerminalPaymentStatus(payment.status) && (!state.amount || !state.amount.equals(payment.amount))) {
        throw new PaymentAmountMismatchError(payment.id);
      }
      if (providerPaymentId) payment.attachProviderPayment(providerPaymentId, now);
      const change = payment.applyProviderStatus(state.status, now, { code: state.failureCode, message: state.failureMessage });
      let outcome: SyncOutcome = change.ignored ? 'ignored' : 'no_change';
      let booking: Booking | null = null;
      if (change.changed && change.to === 'succeeded') {
        const applied = await this.lifecycle.applySucceededPayment(repos, payment.bookingId, payment.bookingCurrencyAmount, now, actor, payment.id);
        outcome = applied.outcome;
        booking = applied.booking;
        if (outcome === 'excess') payment.reclassifyAsAdditional(now);
      }
      await repos.payments.save(payment);
      return { payment, outcome, booking };
    });
    // Pago tardío (reserva cancelada) o excedente (ya pagada / sobrepago): reembolso automático.
    if (result.outcome === 'late_payment') await this.refundPayment(result.payment, 'late_payment_after_cancellation', true);
    if (result.outcome === 'excess') await this.refundPayment(result.payment, 'excess_payment', false);
    return { payment: result.payment, outcome: result.outcome };
  }

  /**
   * Conciliación (H-01): intentos de cobro no terminales más viejos que `staleBefore` se consultan a
   * la pasarela y se sincronizan (aplicando o reembolsando). Los que siguen pendientes después de
   * `expireBefore` se marcan `expired` (liberan el "un pago activo por reserva").
   */
  async reconcileStalePayments(params: { staleBefore: Date; expireBefore: Date; limit?: number }): Promise<{ checked: number; synced: number; expired: number; failed: number }> {
    const stale = await this.unitOfWork.run((repos) => repos.payments.findStaleActive(params.staleBefore, params.limit ?? 100));
    const summary = { checked: stale.length, synced: 0, expired: 0, failed: 0 };
    for (const payment of stale) {
      try {
        let state: ProviderPaymentState | null = null;
        if (payment.providerPaymentId) state = await this.gateways.get(payment.provider).getStatus(payment.providerPaymentId);
        if (state && isTerminalPaymentStatus(state.status)) {
          await this.syncFromProvider(payment.id, state, 'webhook');
          summary.synced += 1;
        } else if (payment.createdAt.getTime() < params.expireBefore.getTime()) {
          await this.unitOfWork.run(async (repos) => {
            await repos.bookings.findByIdForUpdate(payment.bookingId);
            const current = await repos.payments.findById(payment.id);
            if (current && !isTerminalPaymentStatus(current.status)) {
              current.applyProviderStatus('expired', this.clock.now());
              await repos.payments.save(current);
            }
          });
          summary.expired += 1;
        }
      } catch {
        summary.failed += 1;
      }
    }
    return summary;
  }

  /**
   * Reembolso automático en la pasarela. `affectsBooking`: el cobro se sumó al pagado de la reserva
   * (pago tardío) y el reembolso se descuenta; un excedente nunca tocó la reserva.
   */
  private async refundPayment(payment: Payment, reason: string, affectsBooking: boolean): Promise<void> {
    const gateway = this.gateways.get(payment.provider);
    const refundKey = `refund-${payment.id}`;
    const refund = await gateway.refund({
      providerPaymentId: payment.providerPaymentId!,
      amount: payment.amount,
      idempotencyKey: refundKey,
      reason,
    });
    await this.unitOfWork.run(async (repos) => {
      const now = this.clock.now();
      if (await repos.payments.findByIdempotencyKey(refundKey)) return;
      const refundPayment = Payment.create({
        id: this.ids.next(),
        bookingId: payment.bookingId,
        kind: 'refund',
        provider: payment.provider,
        method: null,
        amount: payment.amount,
        idempotencyKey: refundKey,
        parentPaymentId: payment.id,
        now,
      });
      refundPayment.attachProviderPayment(refund.providerRefundId, now);
      refundPayment.applyProviderStatus(refund.status, now);
      await repos.payments.save(refundPayment);
      if (refund.status === 'succeeded' && affectsBooking) {
        const booking = await repos.bookings.findByIdForUpdate(payment.bookingId);
        if (booking) {
          booking.registerRefund(payment.bookingCurrencyAmount, now, 'late_payment_refunded');
          await repos.bookings.save(booking);
        }
      }
    });
  }

  private finishEvent(record: PaymentEvent, status: PaymentEvent['processingStatus'], paymentId: string | null, error: string | null): Promise<void> {
    return this.unitOfWork.run((repos) =>
      repos.paymentEvents.update({
        ...record,
        paymentId: paymentId ?? record.paymentId,
        processingStatus: status,
        lastError: error,
        processedAt: status === 'failed' ? null : this.clock.now(),
      }),
    );
  }
}
