import { DomainError } from '../../../shared/domain/domain-error.js';

export const BOOKING_STATUSES = [
  'pending',
  'held',
  'confirmed',
  'partially_paid',
  'paid',
  'cancelled',
  'refunded',
  'completed',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/**
 * Transiciones permitidas. DEBE coincidir con `booking_status_transition_allowed()` de
 * prisma/sql/constraints.sql (hay un test que parsea el SQL y compara ambas tablas).
 */
export const BOOKING_STATUS_TRANSITIONS: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = {
  pending: ['held', 'confirmed', 'cancelled'],
  held: ['partially_paid', 'paid', 'confirmed', 'cancelled'],
  confirmed: ['partially_paid', 'paid', 'cancelled'],
  // Retrocesos (partially_paid/paid -> confirmed/partially_paid): solo la anulación de un pago manual (Sprint 3).
  partially_paid: ['paid', 'confirmed', 'cancelled'],
  paid: ['partially_paid', 'confirmed', 'completed', 'cancelled'],
  cancelled: ['refunded'],
  completed: ['refunded'],
  refunded: [],
};

export function canTransitionBooking(from: BookingStatus, to: BookingStatus): boolean {
  return from === to || BOOKING_STATUS_TRANSITIONS[from].includes(to);
}

export class InvalidBookingTransitionError extends DomainError {
  constructor(from: BookingStatus, to: BookingStatus, bookingCode: string) {
    super('invalid-booking-transition', `La reserva ${bookingCode} no puede pasar de "${from}" a "${to}".`, 'conflict', {
      from,
      to,
      bookingCode,
    });
  }
}

export function assertBookingTransition(from: BookingStatus, to: BookingStatus, bookingCode: string): void {
  if (!canTransitionBooking(from, to)) throw new InvalidBookingTransitionError(from, to, bookingCode);
}

export function isTerminalBookingStatus(status: BookingStatus): boolean {
  return BOOKING_STATUS_TRANSITIONS[status].length === 0;
}
