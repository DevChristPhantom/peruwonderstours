import type { Prisma } from '../../../generated/prisma/client.js';
import { auditJson, type RequestMeta } from '../../../shared/application/audit.js';
import { addDays, calendarDateFromUtcDate, calendarDateToUtcDate, toLimaCalendarDate, type CalendarDate } from '../../../shared/domain/calendar-date.js';
import { BusinessRuleError, ConflictError, NotFoundError, ValidationError } from '../../../shared/domain/domain-error.js';
import { assertIdempotencyKey, IdempotencyKeyReusedError } from '../../../shared/domain/idempotency.js';
import { Money } from '../../../shared/domain/money.js';
import type { IdGenerator } from '../../../shared/domain/ports.js';
import { BOOKING_CODE_PATTERN } from '../../booking/application/booking-access.js';
import { BookingLifecycle } from '../../booking/application/booking-lifecycle.js';
import type { Booking } from '../../booking/domain/booking.js';
import type { BookingStatus } from '../../booking/domain/booking-status.js';
import type { StaffActor } from '../../identity/application/staff-auth.use-cases.js';
import { MAIL_EVENTS, outboxMessage } from '../../notifications/domain/mail-events.js';
import { quoteCancellationRefund, type RefundTier } from '../domain/cancellation-policy.js';
import { pageArgs, type AdminDatabase, type AdminTx, type PageQuery } from '../infrastructure/admin-database.js';

export interface BookingListFilters extends PageQuery {
  status?: BookingStatus;
  travelDateFrom?: CalendarDate;
  travelDateTo?: CalendarDate;
  code?: string;
  email?: string;
}

export type ManualMethod = 'cash' | 'bank_transfer';

const CANCELLABLE: readonly BookingStatus[] = ['pending', 'held', 'confirmed', 'partially_paid', 'paid'];
const VOUCHER_STATUSES: readonly BookingStatus[] = ['confirmed', 'partially_paid', 'paid', 'completed'];

export class AdminBookingNotFoundError extends NotFoundError {
  constructor() {
    super('booking-not-found', 'Reserva no encontrada.');
  }
}

const DETAIL_INCLUDE = {
  customer: { select: { id: true, email: true, firstName: true, lastName: true, country: true, preferredLocale: true } },
  items: { include: { lines: true, departure: { select: { id: true, departureDate: true, capacity: true, booked: true } } }, orderBy: { createdAt: 'asc' } },
  payments: { include: { recordedBy: { select: { id: true, fullName: true } } }, orderBy: { createdAt: 'asc' } },
  statusHistory: { orderBy: { createdAt: 'asc' } },
  travelers: { where: { deletedAt: null }, select: { id: true, firstName: true, lastName: true, paxType: true, residency: true, nationality: true, isLead: true, documentType: true } },
  legalAcceptances: { select: { document: true, documentVersion: true, createdAt: true, source: true } },
} satisfies Prisma.BookingInclude;

/**
 * Reservas en el backoffice (HU-7.5 / HU-7.6): consulta, cancelación con política de
 * reembolso configurable, pagos manuales del saldo y reembolsos manuales, reenvío de voucher.
 */
export class BookingsAdminService {
  private readonly lifecycle: BookingLifecycle;

  constructor(
    private readonly db: AdminDatabase,
    private readonly ids: IdGenerator,
    private readonly refundTiers: readonly RefundTier[],
  ) {
    this.lifecycle = new BookingLifecycle(ids);
  }

  list(filters: BookingListFilters) {
    return this.db.read(async (prisma) => {
      const where: Prisma.BookingWhereInput = {
        deletedAt: null,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.code ? { code: { startsWith: filters.code.trim().toUpperCase() } } : {}),
        ...(filters.email ? { customer: { email: filters.email.trim().toLowerCase() } } : {}),
        ...(filters.travelDateFrom || filters.travelDateTo
          ? {
              firstServiceDate: {
                ...(filters.travelDateFrom ? { gte: calendarDateToUtcDate(filters.travelDateFrom) } : {}),
                ...(filters.travelDateTo ? { lte: calendarDateToUtcDate(filters.travelDateTo) } : {}),
              },
            }
          : {}),
      };
      const [total, rows] = await Promise.all([
        prisma.booking.count({ where }),
        prisma.booking.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          ...pageArgs(filters),
          include: { customer: { select: { email: true, firstName: true, lastName: true } }, items: { select: { tourTitle: true, travelDate: true, paxCount: true } } },
        }),
      ]);
      return {
        total,
        items: rows.map((b) => ({
          id: b.id,
          code: b.code,
          status: b.status,
          source: b.source,
          customer: { fullName: `${b.customer.firstName} ${b.customer.lastName}`.trim(), email: b.customer.email },
          firstServiceDate: calendarDateFromUtcDate(b.firstServiceDate),
          tours: b.items.map((i) => ({ title: i.tourTitle, travelDate: calendarDateFromUtcDate(i.travelDate), paxCount: i.paxCount })),
          total: { amount: b.totalAmount, currency: b.currency },
          paid: { amount: b.paidAmount, currency: b.currency },
          balance: { amount: b.totalAmount - b.paidAmount, currency: b.currency },
          refunded: { amount: b.refundedAmount, currency: b.currency },
          balanceDueAt: b.balanceDueAt,
          createdAt: b.createdAt,
        })),
      };
    });
  }

  async detail(code: string, actor?: StaffActor, meta?: RequestMeta) {
    const row = await this.db.read(async (prisma) => {
      const normalized = code.trim().toUpperCase();
      return BOOKING_CODE_PATTERN.test(normalized) ? prisma.booking.findUnique({ where: { code: normalized }, include: DETAIL_INCLUDE }) : null;
    });
    if (!row || row.deletedAt) throw new AdminBookingNotFoundError();
    // H-15: lectura de datos personales (cliente y viajeros) auditada.
    if (actor && meta) await this.db.run(actor, meta, (ctx) => ctx.audit({ entityType: 'bookings', entityId: row.id, action: 'BOOKING_PII_VIEWED' }));
    const outbox = await this.db.read((prisma) => prisma.outboxEvent.findMany({ where: { aggregateType: 'booking', aggregateId: row.id }, orderBy: { createdAt: 'asc' } }));
    const quote = CANCELLABLE.includes(row.status) ? await this.quote(row) : null;
    return {
      id: row.id,
      code: row.code,
      status: row.status,
      source: row.source,
      locale: row.locale,
      customer: { ...row.customer, fullName: `${row.customer.firstName} ${row.customer.lastName}`.trim() },
      paymentOption: row.paymentOption,
      depositPercent: row.depositPercent,
      total: { amount: row.totalAmount, currency: row.currency },
      deposit: { amount: row.depositAmount, currency: row.currency },
      paid: { amount: row.paidAmount, currency: row.currency },
      refunded: { amount: row.refundedAmount, currency: row.currency },
      balance: { amount: row.totalAmount - row.paidAmount, currency: row.currency },
      refundDue: row.refundDueAmount !== null ? { amount: row.refundDueAmount, currency: row.currency } : null,
      balanceDueAt: row.balanceDueAt,
      holdExpiresAt: row.holdExpiresAt,
      firstServiceDate: calendarDateFromUtcDate(row.firstServiceDate),
      lastServiceDate: calendarDateFromUtcDate(row.lastServiceDate),
      cancellationPolicyVersion: row.cancellationPolicyVersion,
      termsVersion: row.termsVersion,
      customerNotes: row.customerNotes,
      internalNotes: row.internalNotes,
      confirmedAt: row.confirmedAt,
      cancelledAt: row.cancelledAt,
      cancellationReason: row.cancellationReason,
      createdAt: row.createdAt,
      items: row.items.map((i) => ({
        id: i.id,
        tourId: i.tourId,
        tourTitle: i.tourTitle,
        status: i.status,
        travelDate: calendarDateFromUtcDate(i.travelDate),
        departureId: i.departureId,
        paxCount: i.paxCount,
        subtotal: { amount: i.subtotalAmount, currency: i.currency },
        lines: i.lines.map((l) => ({ paxType: l.paxType, residency: l.residency, quantity: l.quantity, unitAmount: l.unitAmount, lineAmount: l.lineAmount })),
      })),
      travelers: row.travelers,
      payments: row.payments.map((p) => ({
        id: p.id,
        kind: p.kind,
        provider: p.provider,
        method: p.method,
        status: p.status,
        amount: { amount: p.amount, currency: p.currency },
        providerPaymentId: p.providerPaymentId,
        parentPaymentId: p.parentPaymentId,
        recordedBy: p.recordedBy,
        succeededAt: p.succeededAt,
        createdAt: p.createdAt,
      })),
      statusHistory: row.statusHistory.map((h) => ({ from: h.fromStatus, to: h.toStatus, reason: h.reason, actorType: h.actorType, actorId: h.actorId, at: h.createdAt })),
      legalAcceptances: row.legalAcceptances,
      emails: outbox.map((e) => ({ eventType: e.eventType, createdAt: e.createdAt, publishedAt: e.publishedAt, attempts: e.attempts, lastError: e.lastError })),
      cancellationQuote: quote,
    };
  }

  async cancellationQuote(code: string) {
    const row = await this.db.read((prisma) => prisma.booking.findUnique({ where: { code: code.trim().toUpperCase() } }));
    if (!row || row.deletedAt) throw new AdminBookingNotFoundError();
    if (!CANCELLABLE.includes(row.status)) throw new ConflictError('booking-not-cancellable', `Una reserva en estado "${row.status}" no se puede cancelar.`);
    return this.quote(row);
  }

  /** Cancela con cálculo de reembolso (política configurable) y libera el cupo. */
  cancel(actor: StaffActor, meta: RequestMeta, code: string, input: { reason: string; refundAmountOverride?: bigint; overrideReason?: string }) {
    if (input.refundAmountOverride !== undefined && !input.overrideReason?.trim()) {
      throw new ValidationError('validation-failed', 'Indica el motivo del reembolso distinto al de la política.', {
        errors: [{ field: 'overrideReason', messages: ['Obligatorio si se envía refundAmountOverride.'] }],
      });
    }
    return this.db.run(actor, meta, async (ctx) => {
      const booking = await this.lockByCode(ctx, code);
      if (!CANCELLABLE.includes(booking.status)) throw new ConflictError('booking-not-cancellable', `Una reserva en estado "${booking.status}" no se puede cancelar.`);
      const snapshot = booking.toSnapshot();
      const holidays = await this.holidaysUntil(ctx, snapshot.firstServiceDate);
      const quote = quoteCancellationRefund({
        paidAmount: snapshot.paidAmount,
        refundedAmount: snapshot.refundedAmount,
        today: toLimaCalendarDate(ctx.now),
        firstServiceDate: snapshot.firstServiceDate,
        holidays,
        tiers: this.refundTiers,
      });
      const refundDue = input.refundAmountOverride ?? quote.refundAmount;
      const released = await this.lifecycle.releaseInventoryForCancellation(ctx.repos, booking, ctx.now);
      booking.cancelByStaff(input.reason.trim(), ctx.now, Money.of(refundDue, booking.currency));
      await ctx.repos.bookings.save(booking);
      await ctx.repos.outbox.add(
        outboxMessage(this.ids, {
          aggregateType: 'booking',
          aggregateId: booking.id,
          eventType: MAIL_EVENTS.bookingCancelled,
          payload: { bookingId: booking.id, bookingCode: booking.code, refundDueAmount: refundDue.toString(), currency: booking.currency },
          now: ctx.now,
        }),
      );
      await ctx.audit({
        entityType: 'bookings',
        entityId: booking.id,
        action: 'BOOKING_CANCELLED',
        before: { status: snapshot.status },
        after: auditJson({
          // H-06: sin textos libres (motivos) en audit_log; el motivo queda en bookings.cancellation_reason.
          hasReason: input.reason.length > 0,
          policyRefund: quote.refundAmount,
          refundDue,
          override: input.refundAmountOverride !== undefined ? { amount: input.refundAmountOverride } : null,
          businessDaysBefore: quote.businessDaysBefore,
          tier: quote.tier,
          releasedSeats: released,
        }),
      });
      return {
        code: booking.code,
        status: booking.status,
        releasedSeats: released,
        quote: { ...quote, currency: booking.currency },
        refundDue: { amount: refundDue, currency: booking.currency },
        pendingRefund: { amount: refundDue, currency: booking.currency },
      };
    });
  }

  /** Pago manual (efectivo/transferencia) del saldo o del adelanto en venta asistida. */
  recordManualPayment(
    actor: StaffActor,
    meta: RequestMeta,
    code: string,
    idempotencyKey: string | undefined,
    input: { amount: bigint; method: ManualMethod; reference: string; receivedAt?: Date; note?: string },
  ) {
    const key = assertIdempotencyKey(idempotencyKey);
    return this.db.run(actor, meta, async (ctx) => {
      const booking = await this.lockByCode(ctx, code);
      const replay = await ctx.tx.payment.findUnique({ where: { idempotencyKey: key } });
      if (replay) {
        if (replay.bookingId !== booking.id || replay.amount !== input.amount || replay.kind === 'refund') throw new IdempotencyKeyReusedError(key);
        return { replayed: true, paymentId: replay.id, bookingStatus: booking.status, paid: { amount: booking.paid.amount, currency: booking.currency } };
      }
      if (booking.isHoldExpired(ctx.now)) throw new ConflictError('hold-expired', 'La retención de cupo de esta reserva venció: no admite pagos.');
      const providerPaymentId = `${input.method}:${input.reference.trim()}`.slice(0, 120);
      if (await ctx.tx.payment.findFirst({ where: { provider: 'manual', providerPaymentId }, select: { id: true } })) {
        throw new ConflictError('payment-reference-taken', 'Ya se registró un pago con ese número de operación o recibo.');
      }
      if (input.receivedAt && input.receivedAt.getTime() > ctx.now.getTime() + 5 * 60_000) {
        throw new ValidationError('validation-failed', 'La fecha de recepción no puede ser futura.', { errors: [{ field: 'receivedAt', messages: ['No puede ser futura.'] }] });
      }
      const before = booking.toSnapshot();
      const kind = before.paidAmount > 0n ? 'balance' : before.paymentOption === 'full' ? 'full' : 'deposit';
      const amount = Money.of(input.amount, booking.currency);
      const paymentId = this.ids.next();
      // H-01: con un cobro en línea en curso, un pago manual podría duplicar el cobro.
      const active = await ctx.repos.payments.findActiveByBooking(booking.id);
      if (active) {
        throw new ConflictError('payment-in-progress', 'Hay un cobro en línea en curso para esta reserva. Espera a que termine o concílialo antes de registrar un pago manual.', {
          paymentId: active.id,
        });
      }
      // Primero la reserva (valida estado, adelanto mínimo y que no supere el saldo).
      const applied = await this.lifecycle.applySucceededPayment(ctx.repos, booking.id, amount, ctx.now, 'user', paymentId, { onExcess: 'throw' });
      if (applied.outcome !== 'applied') throw new ConflictError('booking-not-payable', 'La reserva no admite pagos en su estado actual.');
      await ctx.tx.payment.create({
        data: {
          id: paymentId,
          bookingId: booking.id,
          kind,
          provider: 'manual',
          method: input.method,
          status: 'succeeded',
          amount: input.amount,
          currency: booking.currency,
          bookingCurrencyAmount: input.amount,
          providerPaymentId,
          idempotencyKey: key,
          recordedByUserId: actor.userId,
          succeededAt: input.receivedAt ?? ctx.now,
          raw: { reference: input.reference.trim(), note: input.note?.trim() ?? null, recordedAt: ctx.now.toISOString() },
        },
      });
      const after = applied.booking.toSnapshot();
      await ctx.audit({
        entityType: 'payments',
        entityId: paymentId,
        action: 'PAYMENT_RECORDED_MANUAL',
        after: auditJson({ bookingCode: booking.code, kind, method: input.method, amount: input.amount, reference: input.reference, statusFrom: before.status, statusTo: after.status }),
      });
      return {
        replayed: false,
        paymentId,
        kind,
        bookingStatus: after.status,
        paid: { amount: after.paidAmount, currency: after.currency },
        balance: { amount: after.totalAmount - after.paidAmount, currency: after.currency },
      };
    });
  }

  /** Reembolso manual (transferencia/efectivo) registrado contra un pago original. */
  recordManualRefund(
    actor: StaffActor,
    meta: RequestMeta,
    code: string,
    idempotencyKey: string | undefined,
    input: { amount: bigint; method: ManualMethod; reference: string; parentPaymentId?: string; note?: string },
  ) {
    const key = assertIdempotencyKey(idempotencyKey);
    return this.db.run(actor, meta, async (ctx) => {
      const booking = await this.lockByCode(ctx, code);
      const replay = await ctx.tx.payment.findUnique({ where: { idempotencyKey: key } });
      if (replay) {
        if (replay.bookingId !== booking.id || replay.amount !== input.amount || replay.kind !== 'refund') throw new IdempotencyKeyReusedError(key);
        return { replayed: true, refundId: replay.id, bookingStatus: booking.status, refunded: { amount: booking.refunded.amount, currency: booking.currency } };
      }
      const payments = await ctx.tx.payment.findMany({ where: { bookingId: booking.id, status: 'succeeded' } });
      const parent = input.parentPaymentId
        ? payments.find((p) => p.id === input.parentPaymentId && p.kind !== 'refund')
        : payments.filter((p) => p.kind !== 'refund').sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      if (!parent) throw new NotFoundError('payment-not-found', 'No hay un pago exitoso de esta reserva para reembolsar.');
      const alreadyRefunded = payments.filter((p) => p.kind === 'refund' && p.parentPaymentId === parent.id).reduce((sum, p) => sum + p.amount, 0n);
      if (input.amount + alreadyRefunded > parent.amount) {
        throw new BusinessRuleError('refund-exceeds-payment', 'El reembolso supera lo cobrado en el pago original.', { parentPaymentId: parent.id, refundable: parent.amount - alreadyRefunded });
      }
      const before = booking.toSnapshot();
      booking.registerRefund(Money.of(input.amount, booking.currency), ctx.now, 'manual_refund');
      await ctx.repos.bookings.save(booking);
      const refundId = this.ids.next();
      const providerPaymentId = `refund:${input.method}:${input.reference.trim()}`.slice(0, 120);
      if (await ctx.tx.payment.findFirst({ where: { provider: 'manual', providerPaymentId }, select: { id: true } })) {
        throw new ConflictError('payment-reference-taken', 'Ya se registró un reembolso con ese número de operación.');
      }
      await ctx.tx.payment.create({
        data: {
          id: refundId,
          bookingId: booking.id,
          kind: 'refund',
          provider: 'manual',
          method: input.method,
          status: 'succeeded',
          amount: input.amount,
          currency: booking.currency,
          bookingCurrencyAmount: input.amount,
          providerPaymentId,
          idempotencyKey: key,
          parentPaymentId: parent.id,
          recordedByUserId: actor.userId,
          succeededAt: ctx.now,
          raw: { reference: input.reference.trim(), note: input.note?.trim() ?? null },
        },
      });
      const after = booking.toSnapshot();
      await ctx.audit({
        entityType: 'payments',
        entityId: refundId,
        action: 'REFUND_RECORDED_MANUAL',
        after: auditJson({ bookingCode: booking.code, amount: input.amount, method: input.method, reference: input.reference, parentPaymentId: parent.id, statusFrom: before.status, statusTo: after.status }),
      });
      return { replayed: false, refundId, bookingStatus: after.status, refunded: { amount: after.refundedAmount, currency: after.currency } };
    });
  }

  /** Reenvía el voucher por correo (evento del outbox; el relay lo entrega). */
  resendVoucher(actor: StaffActor, meta: RequestMeta, code: string) {
    return this.db.run(actor, meta, async (ctx) => {
      const booking = await this.lockByCode(ctx, code);
      if (!VOUCHER_STATUSES.includes(booking.status)) throw new ConflictError('voucher-not-available', 'La reserva aún no tiene voucher (sin pago confirmado) o está cancelada.');
      const message = outboxMessage(this.ids, {
        aggregateType: 'booking',
        aggregateId: booking.id,
        eventType: MAIL_EVENTS.bookingVoucherRequested,
        payload: { bookingId: booking.id, bookingCode: booking.code, requestedByUserId: actor.userId },
        now: ctx.now,
      });
      await ctx.repos.outbox.add(message);
      await ctx.audit({ entityType: 'bookings', entityId: booking.id, action: 'VOUCHER_RESEND_REQUESTED', after: { outboxEventId: message.id } });
      return { queued: true, outboxEventId: message.id };
    });
  }

  private async lockByCode(ctx: AdminTx, code: string): Promise<Booking> {
    const normalized = code.trim().toUpperCase();
    if (!BOOKING_CODE_PATTERN.test(normalized)) throw new AdminBookingNotFoundError();
    // Serializa operaciones del staff y del webhook sobre la misma reserva.
    const locked = await ctx.tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM bookings WHERE code = ${normalized} AND deleted_at IS NULL FOR UPDATE`;
    if (locked.length === 0) throw new AdminBookingNotFoundError();
    const booking = await ctx.repos.bookings.findById(locked[0]!.id);
    if (!booking) throw new AdminBookingNotFoundError();
    return booking;
  }

  private async holidaysUntil(ctx: AdminTx, until: CalendarDate): Promise<Set<CalendarDate>> {
    const from = toLimaCalendarDate(ctx.now);
    const rows = await ctx.tx.businessHoliday.findMany({
      where: { scope: 'national', holidayDate: { gte: calendarDateToUtcDate(from), lte: calendarDateToUtcDate(until > from ? until : addDays(from, 1)) } },
      select: { holidayDate: true },
    });
    return new Set(rows.map((r) => calendarDateFromUtcDate(r.holidayDate)));
  }

  private async quote(row: { paidAmount: bigint; refundedAmount: bigint; firstServiceDate: Date; currency: string }) {
    const first = calendarDateFromUtcDate(row.firstServiceDate);
    const today = toLimaCalendarDate(this.db.now());
    const holidays = await this.db.holidays(today, first > today ? first : addDays(today, 1));
    const q = quoteCancellationRefund({ paidAmount: row.paidAmount, refundedAmount: row.refundedAmount, today, firstServiceDate: first, holidays, tiers: this.refundTiers });
    return {
      businessDaysBefore: q.businessDaysBefore,
      tier: q.tier,
      refundAmount: { amount: q.refundAmount, currency: row.currency },
      retainedAmount: { amount: q.retainedAmount, currency: row.currency },
      paid: { amount: row.paidAmount, currency: row.currency },
      tiers: this.refundTiers,
      policyNote: 'Política de cancelación en borrador [A VALIDAR con el cliente]: % de lo pagado según días hábiles antes del primer servicio.',
    };
  }
}
