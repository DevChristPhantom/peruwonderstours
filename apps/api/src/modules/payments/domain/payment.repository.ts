import type { Payment, PaymentEvent, PaymentProviderCode } from './payment.js';

export interface PaymentRepository {
  findById(id: string): Promise<Payment | null>;
  findByIdempotencyKey(key: string): Promise<Payment | null>;
  findByProviderPaymentId(provider: PaymentProviderCode, providerPaymentId: string): Promise<Payment | null>;
  findByBooking(bookingId: string): Promise<Payment[]>;
  /** Intento de cobro no terminal (pending/requires_action/authorized) de la reserva, si existe. */
  findActiveByBooking(bookingId: string): Promise<Payment | null>;
  /** Intentos no terminales creados antes de `before` (conciliación con la pasarela). */
  findStaleActive(before: Date, limit: number): Promise<Payment[]>;
  save(payment: Payment): Promise<void>;
}

export interface PaymentEventRepository {
  find(provider: PaymentProviderCode, eventId: string): Promise<PaymentEvent | null>;
  /** Inserta; lanza DuplicatePaymentEventError si (provider, eventId) ya existe. */
  insert(event: PaymentEvent): Promise<void>;
  update(event: PaymentEvent): Promise<void>;
}
