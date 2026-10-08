import type { IdempotencyRepository } from '../domain/idempotency.js';
import type { EmailDeliveryRepository, OutboxQueue, OutboxRepository } from '../domain/outbox.js';
import type { ConsentRepository, LegalAcceptanceRepository } from '../../modules/privacy/domain/consent.js';
import type { ComplaintRepository, ComplaintSequence, HolidayCalendar } from '../../modules/complaints/domain/complaint.repository.js';
import type { BookingCodeGenerator, BookingRepository } from '../../modules/booking/domain/booking.repository.js';
import type { CartRepository } from '../../modules/cart/domain/cart.repository.js';
import type { CatalogRepository, InventoryRepository } from '../../modules/catalog/domain/catalog.repository.js';
import type { CustomerRepository } from '../../modules/customers/domain/customer.js';
import type { PaymentEventRepository, PaymentRepository } from '../../modules/payments/domain/payment.repository.js';

/** Repositorios ligados a una misma transacción. */
export interface TransactionalRepositories {
  catalog: CatalogRepository;
  inventory: InventoryRepository;
  carts: CartRepository;
  customers: CustomerRepository;
  bookings: BookingRepository;
  bookingCodes: BookingCodeGenerator;
  payments: PaymentRepository;
  paymentEvents: PaymentEventRepository;
  idempotency: IdempotencyRepository;
  complaints: ComplaintRepository;
  complaintSequence: ComplaintSequence;
  holidays: HolidayCalendar;
  outbox: OutboxRepository;
  outboxQueue: OutboxQueue;
  emailDeliveries: EmailDeliveryRepository;
  consents: ConsentRepository;
  legalAcceptances: LegalAcceptanceRepository;
}

/**
 * Unidad de trabajo: todo lo que ocurre dentro de `run` se confirma o se revierte junto.
 * - Prisma: `$transaction` interactiva (READ COMMITTED + bloqueo optimista en departures
 *   + UNIQUE/CHECK como red de seguridad).
 * - Memoria: ejecución serializada con snapshot y rollback.
 * Las llamadas anidadas reutilizan la transacción en curso.
 */
export interface UnitOfWork {
  run<T>(work: (repos: TransactionalRepositories) => Promise<T>): Promise<T>;
}
