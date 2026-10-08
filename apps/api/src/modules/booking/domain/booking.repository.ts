import type { Booking } from './booking.js';

export interface BookingRepository {
  findById(id: string): Promise<Booking | null>;
  findByCartId(cartId: string): Promise<Booking | null>;
  findByCode(code: string): Promise<Booking | null>;
  /** Inserta o actualiza (incluye ítems y líneas en la inserción). */
  save(booking: Booking): Promise<void>;
  /** Reservas `held` con retención vencida (job de expiración). */
  findWithExpiredHold(now: Date, limit: number): Promise<Booking[]>;
  /** Reservas `partially_paid` cuyo saldo vence en [from, to] (recordatorios). */
  findBalanceDueBetween(from: Date, to: Date, limit: number): Promise<Booking[]>;
}

/** Correlativo sin huecos PWT-AAAA-NNNNNN (en PostgreSQL: next_document_number('booking', año)). */
export interface BookingCodeGenerator {
  next(year: number): Promise<string>;
}

export function formatBookingCode(year: number, sequence: number): string {
  return `PWT-${year}-${String(sequence).padStart(6, '0')}`;
}
