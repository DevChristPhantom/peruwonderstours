import type { TransactionalRepositories } from '../../shared/application/unit-of-work.js';
import type { CalendarDate } from '../../shared/domain/calendar-date.js';
import type { OutboxMessage, OutboxRepository } from '../../shared/domain/outbox.js';
import type { ComplaintSnapshot } from '../../modules/complaints/domain/complaint.js';
import type { ComplaintRepository, ComplaintSequence, HolidayCalendar } from '../../modules/complaints/domain/complaint.repository.js';
import { IdempotencyConflictError, type IdempotencyRecord, type IdempotencyRepository } from '../../shared/domain/idempotency.js';
import { Booking } from '../../modules/booking/domain/booking.js';
import { formatBookingCode, type BookingCodeGenerator, type BookingRepository } from '../../modules/booking/domain/booking.repository.js';
import { Cart } from '../../modules/cart/domain/cart.js';
import type { CartRepository } from '../../modules/cart/domain/cart.repository.js';
import { InMemoryCatalogRepository, InMemoryInventoryRepository } from '../../modules/catalog/infrastructure/in-memory-catalog.repository.js';
import type { Customer, CustomerRepository } from '../../modules/customers/domain/customer.js';
import { DuplicatePaymentEventError } from '../../modules/payments/application/payment.use-cases.js';
import { Payment, type PaymentEvent, type PaymentProviderCode } from '../../modules/payments/domain/payment.js';
import type { PaymentEventRepository, PaymentRepository } from '../../modules/payments/domain/payment.repository.js';
import { ConflictError } from '../../shared/domain/domain-error.js';
import type { InMemoryDataStore } from './in-memory-data-store.js';

class InMemoryCartRepository implements CartRepository {
  constructor(private readonly store: InMemoryDataStore) {}
  findById(id: string): Promise<Cart | null> {
    const s = this.store.state.carts.get(id);
    return Promise.resolve(s ? Cart.restore(s) : null);
  }
  save(cart: Cart): Promise<void> {
    this.store.state.carts.set(cart.id, cart.toSnapshot());
    return Promise.resolve();
  }
  findExpiredActive(now: Date, limit: number): Promise<Cart[]> {
    return Promise.resolve(
      [...this.store.state.carts.values()]
        .filter((c) => c.status === 'active' && c.expiresAt.getTime() <= now.getTime())
        .slice(0, limit)
        .map((c) => Cart.restore(c)),
    );
  }
}

class InMemoryCustomerRepository implements CustomerRepository {
  constructor(private readonly store: InMemoryDataStore) {}
  findByEmail(email: string): Promise<Customer | null> {
    const found = [...this.store.state.customers.values()].find((c) => c.email === email);
    return Promise.resolve(found ? { ...found } : null);
  }
  findById(id: string): Promise<Customer | null> {
    const found = this.store.state.customers.get(id);
    return Promise.resolve(found ? { ...found } : null);
  }
  save(customer: Customer): Promise<void> {
    const clash = [...this.store.state.customers.values()].find((c) => c.email === customer.email && c.id !== customer.id);
    if (clash) return Promise.reject(new ConflictError('customer-email-taken', 'El correo ya está registrado.'));
    this.store.state.customers.set(customer.id, { ...customer });
    return Promise.resolve();
  }
}

class InMemoryBookingRepository implements BookingRepository {
  constructor(private readonly store: InMemoryDataStore) {}
  findById(id: string): Promise<Booking | null> {
    const s = this.store.state.bookings.get(id);
    return Promise.resolve(s ? Booking.restore(s) : null);
  }
  findByCartId(cartId: string): Promise<Booking | null> {
    const s = [...this.store.state.bookings.values()].find((b) => b.cartId === cartId);
    return Promise.resolve(s ? Booking.restore(s) : null);
  }
  findByCode(code: string): Promise<Booking | null> {
    const s = [...this.store.state.bookings.values()].find((b) => b.code === code);
    return Promise.resolve(s ? Booking.restore(s) : null);
  }
  save(booking: Booking): Promise<void> {
    const snapshot = booking.toSnapshot();
    // Igual que UNIQUE(cart_id) en PostgreSQL: un carrito genera a lo sumo una reserva.
    const clash = [...this.store.state.bookings.values()].find((b) => b.cartId !== null && b.cartId === snapshot.cartId && b.id !== snapshot.id);
    if (clash) return Promise.reject(new ConflictError('cart-already-checked-out', 'Este carrito ya generó una reserva.'));
    this.store.state.bookings.set(snapshot.id, snapshot);
    return Promise.resolve();
  }
  findWithExpiredHold(now: Date, limit: number): Promise<Booking[]> {
    return Promise.resolve(
      [...this.store.state.bookings.values()]
        .filter((b) => b.status === 'held' && b.holdExpiresAt !== null && b.holdExpiresAt.getTime() <= now.getTime())
        .slice(0, limit)
        .map((b) => Booking.restore(b)),
    );
  }
}

class InMemoryBookingCodeGenerator implements BookingCodeGenerator {
  constructor(private readonly store: InMemoryDataStore) {}
  next(year: number): Promise<string> {
    const value = (this.store.state.bookingSequences.get(year) ?? 0) + 1;
    this.store.state.bookingSequences.set(year, value);
    return Promise.resolve(formatBookingCode(year, value));
  }
}

class InMemoryPaymentRepository implements PaymentRepository {
  constructor(private readonly store: InMemoryDataStore) {}
  private all() {
    return [...this.store.state.payments.values()];
  }
  findById(id: string): Promise<Payment | null> {
    const s = this.store.state.payments.get(id);
    return Promise.resolve(s ? Payment.restore(s) : null);
  }
  findByIdempotencyKey(key: string): Promise<Payment | null> {
    const s = this.all().find((p) => p.idempotencyKey === key);
    return Promise.resolve(s ? Payment.restore(s) : null);
  }
  findByProviderPaymentId(provider: PaymentProviderCode, providerPaymentId: string): Promise<Payment | null> {
    const s = this.all().find((p) => p.provider === provider && p.providerPaymentId === providerPaymentId);
    return Promise.resolve(s ? Payment.restore(s) : null);
  }
  findByBooking(bookingId: string): Promise<Payment[]> {
    return Promise.resolve(
      this.all()
        .filter((p) => p.bookingId === bookingId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((p) => Payment.restore(p)),
    );
  }
  save(payment: Payment): Promise<void> {
    const s = payment.toSnapshot();
    const others = this.all().filter((p) => p.id !== s.id);
    // Espejo de las restricciones UNIQUE de `payments`.
    if (others.some((p) => p.idempotencyKey === s.idempotencyKey)) {
      return Promise.reject(new ConflictError('payment-idempotency-conflict', 'Pago duplicado.'));
    }
    if (
      s.status === 'succeeded' &&
      (s.kind === 'deposit' || s.kind === 'full') &&
      others.some((p) => p.bookingId === s.bookingId && p.status === 'succeeded' && (p.kind === 'deposit' || p.kind === 'full'))
    ) {
      return Promise.reject(new ConflictError('duplicate-initial-payment', 'La reserva ya tiene un adelanto o pago total exitoso.'));
    }
    this.store.state.payments.set(s.id, s);
    return Promise.resolve();
  }
}

class InMemoryPaymentEventRepository implements PaymentEventRepository {
  constructor(private readonly store: InMemoryDataStore) {}
  private key(provider: string, eventId: string): string {
    return `${provider}:${eventId}`;
  }
  find(provider: PaymentProviderCode, eventId: string): Promise<PaymentEvent | null> {
    const e = this.store.state.paymentEvents.get(this.key(provider, eventId));
    return Promise.resolve(e ? structuredClone(e) : null);
  }
  insert(event: PaymentEvent): Promise<void> {
    const key = this.key(event.provider, event.eventId);
    if (this.store.state.paymentEvents.has(key)) return Promise.reject(new DuplicatePaymentEventError(event.provider, event.eventId));
    this.store.state.paymentEvents.set(key, structuredClone(event));
    return Promise.resolve();
  }
  update(event: PaymentEvent): Promise<void> {
    this.store.state.paymentEvents.set(this.key(event.provider, event.eventId), structuredClone(event));
    return Promise.resolve();
  }
}

/** Idempotencia en memoria (modos seed/memory y pruebas). Con Prisma: PrismaIdempotencyRepository. */
export class InMemoryIdempotencyRepository implements IdempotencyRepository {
  constructor(private readonly records: () => Map<string, IdempotencyRecord>) {}
  find(scope: string, key: string): Promise<IdempotencyRecord | null> {
    return Promise.resolve(this.records().get(`${scope}:${key}`) ?? null);
  }
  insert(record: IdempotencyRecord): Promise<void> {
    const id = `${record.scope}:${record.key}`;
    const existing = this.records().get(id);
    if (existing && existing.expiresAt.getTime() > record.createdAt.getTime()) {
      return Promise.reject(new IdempotencyConflictError(record.key));
    }
    this.records().set(id, { ...record });
    return Promise.resolve();
  }
  deleteExpired(now: Date, limit = 1000): Promise<number> {
    let deleted = 0;
    for (const [id, record] of this.records()) {
      if (deleted >= limit) break;
      if (record.expiresAt.getTime() <= now.getTime()) {
        this.records().delete(id);
        deleted += 1;
      }
    }
    return Promise.resolve(deleted);
  }
}

class InMemoryComplaintRepository implements ComplaintRepository {
  constructor(private readonly store: InMemoryDataStore) {}
  insert(complaint: ComplaintSnapshot): Promise<void> {
    const all = [...this.store.state.complaints.values()];
    if (this.store.state.complaints.has(complaint.id) || all.some((c) => c.code === complaint.code)) {
      return Promise.reject(new ConflictError('unique-violation', 'La hoja ya existe.'));
    }
    this.store.state.complaints.set(complaint.id, structuredClone(complaint));
    return Promise.resolve();
  }
  findByCode(code: string): Promise<ComplaintSnapshot | null> {
    const found = [...this.store.state.complaints.values()].find((c) => c.code === code);
    return Promise.resolve(found ? structuredClone(found) : null);
  }
  findById(id: string): Promise<ComplaintSnapshot | null> {
    const found = this.store.state.complaints.get(id);
    return Promise.resolve(found ? structuredClone(found) : null);
  }
  updateAccessTokenHash(id: string, accessTokenHash: string): Promise<void> {
    const found = this.store.state.complaints.get(id);
    if (found) found.accessTokenHash = accessTokenHash;
    return Promise.resolve();
  }
}

class InMemoryComplaintSequence implements ComplaintSequence {
  constructor(private readonly store: InMemoryDataStore) {}
  next(year: number): Promise<number> {
    const value = (this.store.state.complaintSequences.get(year) ?? 0) + 1;
    this.store.state.complaintSequences.set(year, value);
    return Promise.resolve(value);
  }
}

class InMemoryHolidayCalendar implements HolidayCalendar {
  constructor(private readonly store: InMemoryDataStore) {}
  holidaysBetween(from: CalendarDate, to: CalendarDate): Promise<Set<CalendarDate>> {
    return Promise.resolve(new Set([...this.store.state.holidays].filter((d) => d >= from && d <= to)));
  }
}

class InMemoryOutboxRepository implements OutboxRepository {
  constructor(private readonly store: InMemoryDataStore) {}
  add(message: OutboxMessage): Promise<void> {
    this.store.state.outbox.set(message.id, structuredClone(message));
    return Promise.resolve();
  }
}

export function createInMemoryRepositories(store: InMemoryDataStore): TransactionalRepositories {
  return {
    catalog: new InMemoryCatalogRepository(store.catalog),
    inventory: new InMemoryInventoryRepository(store),
    carts: new InMemoryCartRepository(store),
    customers: new InMemoryCustomerRepository(store),
    bookings: new InMemoryBookingRepository(store),
    bookingCodes: new InMemoryBookingCodeGenerator(store),
    payments: new InMemoryPaymentRepository(store),
    paymentEvents: new InMemoryPaymentEventRepository(store),
    idempotency: new InMemoryIdempotencyRepository(() => store.state.idempotency),
    complaints: new InMemoryComplaintRepository(store),
    complaintSequence: new InMemoryComplaintSequence(store),
    holidays: new InMemoryHolidayCalendar(store),
    outbox: new InMemoryOutboxRepository(store),
  };
}
