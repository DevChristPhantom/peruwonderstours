import type { TransactionalRepositories } from '../../../shared/application/unit-of-work.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import type { Money } from '../../../shared/domain/money.js';
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
  async expireIfNeeded(repos: TransactionalRepositories, booking: Booking, now: Date): Promise<boolean> {
    if (!booking.isHoldExpired(now)) return false;
    await this.releaseHolds(repos, booking, 'expired', now);
    booking.cancel('hold_expired', now, 'system');
    await repos.bookings.save(booking);
    return true;
  }

  /**
   * Aplica un cobro exitoso. Si la reserva ya estaba cancelada (webhook tardío), lo registra
   * como pago tardío para reembolsarlo; nunca reactiva la reserva sin cupo garantizado.
   */
  async applySucceededPayment(
    repos: TransactionalRepositories,
    bookingId: string,
    amount: Money,
    now: Date,
    actorType: ActorType,
  ): Promise<{ booking: Booking; outcome: 'applied' | 'late_payment' }> {
    const booking = await repos.bookings.findById(bookingId);
    if (!booking) throw new BookingNotFoundError(bookingId);
    if (booking.status === 'cancelled') {
      booking.registerLatePayment(amount, now);
      await repos.bookings.save(booking);
      return { booking, outcome: 'late_payment' };
    }
    const wasHolding = booking.status === 'held';
    booking.registerPayment(amount, now, actorType);
    if (wasHolding) await this.convertHolds(repos, booking);
    await repos.bookings.save(booking);
    return { booking, outcome: 'applied' };
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
