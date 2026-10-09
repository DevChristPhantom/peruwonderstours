import type { TransactionalRepositories } from '../../../shared/application/unit-of-work.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import type { Money } from '../../../shared/domain/money.js';
import type { IdGenerator } from '../../../shared/domain/ports.js';
import { UuidV7Generator } from '../../../shared/infrastructure/system.js';
import { MAIL_EVENTS, outboxMessage } from '../../notifications/domain/mail-events.js';
import type { HoldStatus } from '../../catalog/domain/departure.js';
import type { ActorType, Booking } from '../domain/booking.js';

export class BookingNotFoundError extends NotFoundError {
  constructor(ref: string) {
    super('booking-not-found', 'Reserva no encontrada.', { booking: ref });
  }
}

/**
 * Operaciones de ciclo de vida que tocan reserva + inventario en la misma transacción.
 * Las comparten checkout, pagos (webhook/confirmación) y los jobs de expiración.
 */
export class BookingLifecycle {
  constructor(private readonly ids: IdGenerator = new UuidV7Generator()) {}

  /** Convierte holds activos en cupos vendidos (held -> booked). */
  async convertHolds(repos: TransactionalRepositories, booking: Booking): Promise<void> {
    await this.settleHolds(repos, booking, 'converted', null);
  }

  /** Libera holds activos (vencimiento o cancelación antes del pago). */
  async releaseHolds(repos: TransactionalRepositories, booking: Booking, status: Extract<HoldStatus, 'released' | 'expired'>, now: Date): Promise<void> {
    await this.settleHolds(repos, booking, status, now);
  }

  /**
   * Si la retención venció, cancela la reserva y libera cupos. Devuelve true si expiró.
   * (HU-4.3: "Tu reserva temporal expiró", se liberan los cupos.)
   */
  async expireIfNeeded(repos: TransactionalRepositories, candidate: Booking, now: Date): Promise<boolean> {
    if (!candidate.isHoldExpired(now)) return false;
    // Se relee bajo bloqueo: un pago pudo confirmarse mientras tanto (H-01).
    const booking = (await repos.bookings.findByIdForUpdate(candidate.id)) ?? candidate;
    if (!booking.isHoldExpired(now)) return false;
    await this.releaseHolds(repos, booking, 'expired', now);
    booking.cancel('hold_expired', now, 'system');
    await repos.bookings.save(booking);
    return true;
  }

  /**
   * Aplica un cobro exitoso con la reserva BLOQUEADA (FOR UPDATE, H-01). Resultados:
   *  - `applied`: suma al pagado y avanza el estado.
   *  - `late_payment`: la reserva ya estaba cancelada; se suma al pagado para reembolsarlo.
   *  - `excess`: la reserva ya no admite el cobro (pagada, sobrepago, completada...); NO se toca la
   *    reserva y el llamador debe reembolsarlo automáticamente (nunca queda un pago colgado).
   * Con `onExcess: 'throw'` (pagos manuales del staff) se lanza el error de dominio en vez de `excess`.
   */
  async applySucceededPayment(
    repos: TransactionalRepositories,
    bookingId: string,
    amount: Money,
    now: Date,
    actorType: ActorType,
    paymentId?: string,
    options: { onExcess?: 'refund' | 'throw' } = {},
  ): Promise<{ booking: Booking; outcome: 'applied' | 'late_payment' | 'excess' }> {
    const booking = await repos.bookings.findByIdForUpdate(bookingId);
    if (!booking) throw new BookingNotFoundError(bookingId);
    if (booking.status === 'cancelled') {
      if (booking.paid.add(amount).greaterThan(booking.total)) return { booking, outcome: 'excess' };
      booking.registerLatePayment(amount, now);
      await repos.bookings.save(booking);
      return { booking, outcome: 'late_payment' };
    }
    if (!booking.canAcceptPayment(amount)) {
      // registerPayment lanza el error de dominio preciso (sobrepago, adelanto insuficiente, estado).
      if (options.onExcess === 'throw') booking.registerPayment(amount, now, actorType);
      return { booking, outcome: 'excess' };
    }
    const wasHolding = booking.status === 'held';
    const firstPayment = booking.paid.amount === 0n;
    booking.registerPayment(amount, now, actorType);
    if (wasHolding) await this.convertHolds(repos, booking);
    await repos.bookings.save(booking);
    // Correo: confirmación + voucher en el primer cobro; "pago recibido" en los siguientes.
    await repos.outbox.add(
      outboxMessage(this.ids, {
        aggregateType: 'booking',
        aggregateId: booking.id,
        eventType: firstPayment ? MAIL_EVENTS.bookingConfirmed : MAIL_EVENTS.bookingPaymentReceived,
        payload: { bookingId: booking.id, bookingCode: booking.code, amount: amount.amount.toString(), currency: amount.currency, ...(paymentId ? { paymentId } : {}) },
        now,
      }),
    );
    return { booking, outcome: 'applied' };
  }

  /**
   * Cancelación (backoffice): libera retenciones activas y cupos ya vendidos de los ítems.
   * Las retenciones convertidas pasan a `released` (CHECK released_at) y devuelven el cupo.
   */
  async releaseInventoryForCancellation(repos: TransactionalRepositories, booking: Booking, now: Date): Promise<number> {
    const holds = await repos.inventory.findHoldsByBookingItems(booking.items.map((i) => i.id));
    let released = 0;
    for (const hold of holds.filter((h) => h.status === 'active' || h.status === 'converted')) {
      const departure = await repos.inventory.findDeparture(hold.departureId);
      if (!departure) continue;
      if (hold.status === 'active') departure.releaseHold(hold.quantity);
      else departure.releaseBooked(hold.quantity);
      await repos.inventory.saveDeparture(departure);
      await repos.inventory.saveHold({ ...hold, status: 'released', releasedAt: now });
      released += hold.quantity;
    }
    return released;
  }

  private async settleHolds(repos: TransactionalRepositories, booking: Booking, status: Exclude<HoldStatus, 'active'>, now: Date | null): Promise<void> {
    const holds = await repos.inventory.findHoldsByBookingItems(booking.items.map((i) => i.id));
    for (const hold of holds.filter((h) => h.status === 'active')) {
      const departure = await repos.inventory.findDeparture(hold.departureId);
      if (!departure) continue;
      if (status === 'converted') departure.confirmHold(hold.quantity);
      else departure.releaseHold(hold.quantity);
      await repos.inventory.saveDeparture(departure);
      await repos.inventory.saveHold({ ...hold, status, releasedAt: status === 'converted' ? null : now });
    }
  }
}
