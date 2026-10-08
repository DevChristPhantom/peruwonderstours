import {
  accessTokenMatches,
  generateAccessToken,
  hashAccessToken,
  isWellFormedAccessToken,
} from '../../../shared/application/access-token.js';
import type { TransactionalRepositories } from '../../../shared/application/unit-of-work.js';
import { DomainError, NotFoundError } from '../../../shared/domain/domain-error.js';
import type { Booking } from '../domain/booking.js';

/**
 * Acceso del comprador (sin cuenta) a su reserva: código legible PWT-AAAA-NNNNNN + token
 * opaco de 256 bits entregado en el checkout (cabecera `X-Booking-Token`).
 */
export const BOOKING_CODE_PATTERN = /^PWT-\d{4}-\d{6}$/;

export const hashBookingAccessToken = hashAccessToken;
export const generateBookingAccessToken = generateAccessToken;
export const bookingAccessTokenMatches = accessTokenMatches;

/** Falta la cabecera o su formato es inválido (se valida antes de tocar la base). */
export class BookingTokenRequiredError extends DomainError {
  constructor() {
    super('booking-token-required', 'Falta la cabecera X-Booking-Token o su formato es inválido.', 'unauthorized');
  }
}

/**
 * 404 genérico: mismo código, mensaje y forma tanto si la reserva no existe como si el
 * token no coincide (no revela la existencia del código).
 */
export class BookingAccessNotFoundError extends NotFoundError {
  constructor() {
    super('booking-not-found', 'Reserva no encontrada.');
  }
}

export interface BookingAccess {
  code: string;
  token: string | undefined;
}

/** Carga la reserva solo si el código y el token coinciden. */
export async function loadBookingWithAccess(repos: TransactionalRepositories, access: BookingAccess): Promise<Booking> {
  if (!isWellFormedAccessToken(access.token)) throw new BookingTokenRequiredError();
  const booking = BOOKING_CODE_PATTERN.test(access.code) ? await repos.bookings.findByCode(access.code) : null;
  const matches = accessTokenMatches(access.token, booking?.accessTokenHash ?? null);
  if (!booking || !matches) throw new BookingAccessNotFoundError();
  return booking;
}
