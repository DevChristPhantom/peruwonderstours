import type { TransactionalRepositories } from '../../shared/application/unit-of-work.js';
import type { CalendarDate } from '../../shared/domain/calendar-date.js';
import type {
  ClaimedOutboxEvent,
  EmailDeliveryRecord,
  EmailDeliveryRepository,
  OutboxMessage,
  OutboxQueue,
  OutboxRepository,
} from '../../shared/domain/outbox.js';
import type {
  ConsentPurpose,
  ConsentRecord,
  ConsentRepository,
  LegalAcceptanceRecord,
  LegalAcceptanceRepository,
} from '../../modules/privacy/domain/consent.js';
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
import { ConcurrencyError, ConflictError } from '../../shared/domain/domain-error.js';
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
  findByIdForUpdate(id: string): Promise<Booking | null> {
    // La unidad de trabajo en memoria serializa las transacciones: equivale a FOR UPDATE.
    return this.findById(id);
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
    const stored = this.store.state.bookings.get(snapshot.id);
    if (stored) {
      // Espejo del UPDATE ... WHERE version = $leida de PostgreSQL.
      if ((stored.version ?? 0) !== (snapshot.version ?? 0)) return Promise.reject(new ConcurrencyError());
      const next = (snapshot.version ?? 0) + 1;
      this.store.state.bookings.set(snapshot.id, { ...snapshot, version: next });
      booking.markPersisted(next);
      return Promise.resolve();
    }
    this.store.state.bookings.set(snapshot.id, { ...snapshot, version: snapshot.version ?? 0 });
    return Promise.resolve();
  }
  findBalanceDueBetween(from: Date, to: Date, limit: number): Promise<Booking[]> {
    return Promise.resolve(
      [...this.store.state.bookings.values()]
        .filter((b) => b.status === 'partially_paid' && b.balanceDueAt !== null && b.balanceDueAt >= from && b.balanceDueAt <= to)
        .slice(0, limit)
        .map((b) => Booking.restore(b)),
    );
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
  findActiveByBooking(bookingId: string): Promise<Payment | null> {
    const s = this.all()
      .filter((p) => p.bookingId === bookingId && p.kind !== 'refund' && ['pending', 'requires_action', 'authorized'].includes(p.status))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    return Promise.resolve(s ? Payment.restore(s) : null);
  }
  findStaleActive(before: Date, limit: number): Promise<Payment[]> {
    return Promise.resolve(
      this.all()
        .filter((p) => p.kind !== 'refund' && ['pending', 'requires_action', 'authorized'].includes(p.status) && p.createdAt.getTime() < before.getTime())
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .slice(0, limit)
        .map((p) => Payment.restore(p)),
    );
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
    const active = (p: { kind: string; status: string }) => p.kind !== 'refund' && ['pending', 'requires_action', 'authorized'].includes(p.status);
    if (active(s) && others.some((p) => p.bookingId === s.bookingId && active(p))) {
      return Promise.reject(new ConflictError('unique-violation', 'La reserva ya tiene un intento de cobro activo.'));
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
  markAcknowledgmentSent(id: string, sentAt: Date, deliveryRef: string): Promise<void> {
    const found = this.store.state.complaints.get(id);
    if (found) Object.assign(found, { acknowledgmentSentAt: sentAt, acknowledgmentDeliveryRef: deliveryRef });
    return Promise.resolve();
  }
  markResponseSent(id: string, sentAt: Date, deliveryRef: string): Promise<void> {
    const found = this.store.state.complaints.get(id);
    if (found) Object.assign(found, { responseSentAt: sentAt, responseDeliveryRef: deliveryRef });
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

class InMemoryOutboxRepository implements OutboxRepository, OutboxQueue {
  constructor(private readonly store: InMemoryDataStore) {}
  add(message: OutboxMessage): Promise<void> {
    if (message.dedupeKey && [...this.store.state.outbox.values()].some((m) => m.dedupeKey === message.dedupeKey)) {
      return Promise.reject(new ConflictError('unique-violation', 'Evento duplicado.'));
    }
    this.store.state.outbox.set(message.id, { ...structuredClone(message), attempts: 0, publishedAt: null, lastError: null });
    return Promise.resolve();
  }
  async addIfAbsent(message: OutboxMessage & { dedupeKey: string }): Promise<boolean> {
    if ([...this.store.state.outbox.values()].some((m) => m.dedupeKey === message.dedupeKey)) return false;
    await this.add(message);
    return true;
  }
  claim(now: Date, limit: number, leaseSeconds: number, maxAttempts: number): Promise<ClaimedOutboxEvent[]> {
    const due = [...this.store.state.outbox.values()]
      .filter((m) => m.publishedAt === null && m.availableAt.getTime() <= now.getTime() && m.attempts < maxAttempts)
      .sort((a, b) => a.availableAt.getTime() - b.availableAt.getTime())
      .slice(0, limit);
    for (const m of due) {
      m.attempts += 1;
      m.availableAt = new Date(now.getTime() + leaseSeconds * 1000);
    }
    return Promise.resolve(due.map((m) => structuredClone(m)));
  }
  markPublished(id: string, now: Date): Promise<void> {
    const m = this.store.state.outbox.get(id);
    if (m) Object.assign(m, { publishedAt: now, lastError: null });
    return Promise.resolve();
  }
  markFailed(id: string, error: string, retryAt: Date): Promise<void> {
    const m = this.store.state.outbox.get(id);
    if (m) Object.assign(m, { lastError: error.slice(0, 2000), availableAt: retryAt });
    return Promise.resolve();
  }
  stats(_now: Date, maxAttempts: number): Promise<{ pending: number; retrying: number; dead: number }> {
    const open = [...this.store.state.outbox.values()].filter((m) => m.publishedAt === null);
    return Promise.resolve({
      pending: open.filter((m) => m.attempts === 0).length,
      retrying: open.filter((m) => m.attempts > 0 && m.attempts < maxAttempts).length,
      dead: open.filter((m) => m.attempts >= maxAttempts).length,
    });
  }
  findByAggregate(aggregateType: string, aggregateId: string) {
    return Promise.resolve(
      [...this.store.state.outbox.values()]
        .filter((m) => m.aggregateType === aggregateType && m.aggregateId === aggregateId)
        .map((m) => structuredClone(m)),
    );
  }
}

class InMemoryEmailDeliveryRepository implements EmailDeliveryRepository {
  constructor(private readonly store: InMemoryDataStore) {}
  find(outboxEventId: string, template: string): Promise<EmailDeliveryRecord | null> {
    return Promise.resolve(structuredClone(this.store.state.emailDeliveries.get(`${outboxEventId}:${template}`) ?? null));
  }
  insert(record: EmailDeliveryRecord): Promise<void> {
    const key = `${record.outboxEventId}:${record.template}`;
    if (this.store.state.emailDeliveries.has(key)) return Promise.reject(new ConflictError('unique-violation', 'Entrega ya registrada.'));
    this.store.state.emailDeliveries.set(key, structuredClone(record));
    return Promise.resolve();
  }
}

const sameBytes = (a: Uint8Array | null, b: Uint8Array) => a !== null && Buffer.from(a).equals(Buffer.from(b));

class InMemoryConsentRepository implements ConsentRepository {
  constructor(private readonly store: InMemoryDataStore) {}
  insert(record: ConsentRecord): Promise<void> {
    this.store.state.consents.push(structuredClone(record));
    return Promise.resolve();
  }
  latestBySubject(subjectEmailHash: Uint8Array, purpose: ConsentPurpose): Promise<ConsentRecord | null> {
    const rows = this.store.state.consents.filter((c) => c.purpose === purpose && sameBytes(c.subjectEmailHash, subjectEmailHash));
    return Promise.resolve(structuredClone(rows.at(-1) ?? null));
  }
  historyBySubject(subjectEmailHash: Uint8Array): Promise<ConsentRecord[]> {
    return Promise.resolve(structuredClone(this.store.state.consents.filter((c) => sameBytes(c.subjectEmailHash, subjectEmailHash))));
  }
}

class InMemoryLegalAcceptanceRepository implements LegalAcceptanceRepository {
  constructor(private readonly store: InMemoryDataStore) {}
  insert(record: LegalAcceptanceRecord): Promise<void> {
    this.store.state.legalAcceptances.push(structuredClone(record));
    return Promise.resolve();
  }
  findByBooking(bookingId: string): Promise<LegalAcceptanceRecord[]> {
    return Promise.resolve(structuredClone(this.store.state.legalAcceptances.filter((a) => a.bookingId === bookingId)));
  }
}

export function createInMemoryRepositories(store: InMemoryDataStore): TransactionalRepositories {
  const outbox = new InMemoryOutboxRepository(store);
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
    outbox,
    outboxQueue: outbox,
    emailDeliveries: new InMemoryEmailDeliveryRepository(store),
    consents: new InMemoryConsentRepository(store),
    legalAcceptances: new InMemoryLegalAcceptanceRepository(store),
  };
}
