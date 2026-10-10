import { auditJson, type RequestMeta } from '../../../shared/application/audit.js';
import { startOfDayInLima, addDays, type CalendarDate } from '../../../shared/domain/calendar-date.js';
import { ConflictError, NotFoundError } from '../../../shared/domain/domain-error.js';
import { Money } from '../../../shared/domain/money.js';
import type { IdGenerator } from '../../../shared/domain/ports.js';
import { BOOKING_CODE_PATTERN } from '../../booking/application/booking-access.js';
import type { StaffActor } from '../../identity/application/staff-auth.use-cases.js';
import type { AdminDatabase } from '../infrastructure/admin-database.js';

type Totals = Record<string, bigint>;

function add(t: Totals, currency: string, amount: bigint) {
  t[currency] = (t[currency] ?? 0n) + amount;
}

function asList(t: Totals) {
  return Object.entries(t).map(([currency, amount]) => ({ amount, currency }));
}

/**
 * Pagos manuales (ADR-0003, sin doble control): reporte del día por usuario para el tablero y
 * anulación con contra-asiento auditado (solo admin, permiso `payments:void`).
 */
export class PaymentsAdminService {
  constructor(
    private readonly db: AdminDatabase,
    private readonly ids: IdGenerator,
  ) {}

  /** Pagos manuales con fecha de recepción (succeeded_at) en el día de Lima indicado. */
  manualPaymentsOfDay(date: CalendarDate) {
    const from = startOfDayInLima(date);
    const to = startOfDayInLima(addDays(date, 1));
    return this.db.read(async (prisma) => {
      const rows = await prisma.payment.findMany({
        where: { provider: 'manual', status: 'succeeded', succeededAt: { gte: from, lt: to } },
        include: { booking: { select: { code: true } }, recordedBy: { select: { id: true, fullName: true } } },
        orderBy: { succeededAt: 'asc' },
      });
      const byUser = new Map<string, { user: { id: string; fullName: string } | null; count: number; received: Totals; refunded: Totals; voided: Totals }>();
      const totals = { received: {} as Totals, refunded: {} as Totals, voided: {} as Totals };
      for (const p of rows) {
        const key = p.recordedBy?.id ?? 'unknown';
        const entry = byUser.get(key) ?? { user: p.recordedBy, count: 0, received: {}, refunded: {}, voided: {} };
        entry.count += 1;
        if (p.kind === 'refund') {
          // Los contra-asientos de anulación se informan aparte de los reembolsos.
          add(p.isReversal ? entry.voided : entry.refunded, p.currency, p.amount);
          add(p.isReversal ? totals.voided : totals.refunded, p.currency, p.amount);
        } else {
          add(entry.received, p.currency, p.amount);
          add(totals.received, p.currency, p.amount);
        }
        byUser.set(key, entry);
      }
      return {
        date,
        totals: { received: asList(totals.received), refunded: asList(totals.refunded), voided: asList(totals.voided) },
        byUser: [...byUser.values()].map((u) => ({ user: u.user, count: u.count, received: asList(u.received), refunded: asList(u.refunded), voided: asList(u.voided) })),
        items: rows.map((p) => ({
          id: p.id,
          bookingCode: p.booking.code,
          kind: p.kind,
          method: p.method,
          amount: { amount: p.amount, currency: p.currency },
          reference: p.providerPaymentId,
          receivedAt: p.succeededAt,
          recordedBy: p.recordedBy,
          isReversal: p.isReversal,
          voidedAt: p.voidedAt,
          voidReason: p.voidReason,
        })),
      };
    });
  }

  /**
   * Anula un pago manual mal registrado: el pago queda `succeeded` con `voided_at` y se inserta un
   * contra-asiento (kind refund, is_reversal, parent = pago) que resta del total pagado de la reserva.
   * Idempotente: anular dos veces el mismo pago responde 409 `payment-already-voided`.
   */
  voidManualPayment(actor: StaffActor, meta: RequestMeta, code: string, paymentId: string, reason: string) {
    const normalized = code.trim().toUpperCase();
    return this.db.run(actor, meta, async (ctx) => {
      if (!BOOKING_CODE_PATTERN.test(normalized)) throw new NotFoundError('booking-not-found', 'Reserva no encontrada.');
      const locked = await ctx.tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM bookings WHERE code = ${normalized} AND deleted_at IS NULL FOR UPDATE`;
      if (locked.length === 0) throw new NotFoundError('booking-not-found', 'Reserva no encontrada.');
      const payment = await ctx.tx.payment.findFirst({ where: { id: paymentId, bookingId: locked[0]!.id } });
      if (!payment) throw new NotFoundError('payment-not-found', 'Pago no encontrado en esta reserva.');
      if (payment.provider !== 'manual' || payment.kind === 'refund' || payment.status !== 'succeeded') {
        throw new ConflictError('payment-not-voidable', 'Solo se anulan pagos manuales exitosos (no reembolsos ni cobros en línea: esos se reembolsan).');
      }
      if (payment.voidedAt) throw new ConflictError('payment-already-voided', 'Este pago ya fue anulado.');
      const refunds = await ctx.tx.payment.count({ where: { parentPaymentId: payment.id, kind: 'refund', status: 'succeeded' } });
      if (refunds > 0) throw new ConflictError('payment-has-refunds', 'El pago tiene reembolsos registrados: no se puede anular.');

      const booking = await ctx.repos.bookings.findById(payment.bookingId);
      if (!booking) throw new NotFoundError('booking-not-found', 'Reserva no encontrada.');
      const result = booking.voidPayment(Money.of(payment.bookingCurrencyAmount, booking.currency), ctx.now, 'user');
      await ctx.repos.bookings.save(booking);

      await ctx.tx.payment.update({ where: { id: payment.id }, data: { voidedAt: ctx.now, voidedByUserId: actor.userId, voidReason: reason.trim().slice(0, 500) } });
      const reversalId = this.ids.next();
      await ctx.tx.payment.create({
        data: {
          id: reversalId,
          bookingId: payment.bookingId,
          kind: 'refund',
          provider: 'manual',
          method: payment.method,
          status: 'succeeded',
          amount: payment.amount,
          currency: payment.currency,
          bookingCurrencyAmount: payment.bookingCurrencyAmount,
          providerPaymentId: `void:${payment.id}`,
          idempotencyKey: `void:${payment.id}`,
          parentPaymentId: payment.id,
          recordedByUserId: actor.userId,
          succeededAt: ctx.now,
          isReversal: true,
          raw: { void: true, voidOf: payment.id },
        },
      });
      const after = booking.toSnapshot();
      await ctx.audit({
        entityType: 'payments',
        entityId: payment.id,
        action: 'PAYMENT_VOIDED_MANUAL',
        // El motivo es texto libre: no va al audit_log (H-06); queda en payments.void_reason.
        after: auditJson({ bookingCode: normalized, amount: payment.amount, currency: payment.currency, reversalId, statusFrom: result.from, statusTo: result.to }),
      });
      return {
        paymentId: payment.id,
        reversalId,
        bookingStatus: after.status,
        paid: { amount: after.paidAmount, currency: after.currency },
        balance: { amount: after.totalAmount - after.paidAmount, currency: after.currency },
      };
    });
  }
}
