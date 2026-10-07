import type { Payment, PaymentEvent, PaymentProviderCode } from './payment.js';

export interface PaymentRepository {
  findById(id: string): Promise<Payment | null>;
  findByIdempotencyKey(key: string): Promise<Payment | null>;
  findByProviderPaymentId(provider: PaymentProviderCode, providerPaymentId: string): Promise<Payment | null>;
  findByBooking(bookingId: string): Promise<Payment[]>;
  save(payment: Payment): Promise<void>;
}

export interface PaymentEventRepository {
  find(provider: PaymentProviderCode, eventId: string): Promise<PaymentEvent | null>;
  /** Inserta; lanza DuplicatePaymentEventError si (provider, eventId) ya existe. */
  insert(event: PaymentEvent): Promise<void>;
  update(event: PaymentEvent): Promise<void>;
}
