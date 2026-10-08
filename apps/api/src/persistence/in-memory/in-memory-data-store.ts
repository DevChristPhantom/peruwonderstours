import type { IdempotencyRecord } from '../../shared/domain/idempotency.js';
import type { EmailDeliveryRecord, OutboxMessage } from '../../shared/domain/outbox.js';
import type { ConsentRecord, LegalAcceptanceRecord } from '../../modules/privacy/domain/consent.js';
import type { ComplaintSnapshot } from '../../modules/complaints/domain/complaint.js';
import { PERU_NATIONAL_HOLIDAYS } from '../../modules/complaints/infrastructure/peru-national-holidays.js';
import type { BookingSnapshot } from '../../modules/booking/domain/booking.js';
import type { CartSnapshot } from '../../modules/cart/domain/cart.js';
import type { DepartureSnapshot, InventoryHold } from '../../modules/catalog/domain/departure.js';
import type { Rate } from '../../modules/catalog/domain/pricing.js';
import type { Category, Destination } from '../../modules/catalog/domain/taxonomy.js';
import type { Tour } from '../../modules/catalog/domain/tour.js';
import type { Customer } from '../../modules/customers/domain/customer.js';
import type { PaymentEvent, PaymentSnapshot } from '../../modules/payments/domain/payment.js';

/** Catálogo (solo lectura en tiempo de ejecución; lo administra el backoffice/seed). */
export interface CatalogData {
  tours: Tour[];
  rates: Rate[];
  destinations: Destination[];
  categories: Category[];
}

/** Evento del outbox con su estado de publicación (equivalente a la fila de outbox_events). */
export interface StoredOutboxMessage extends OutboxMessage {
  attempts: number;
  publishedAt: Date | null;
  lastError: string | null;
}

/** Estado mutable transaccional: se guarda como registros planos clonables. */
export interface InMemoryState {
  departures: Map<string, DepartureSnapshot>;
  holds: Map<string, InventoryHold>;
  carts: Map<string, CartSnapshot>;
  customers: Map<string, Customer>;
  bookings: Map<string, BookingSnapshot>;
  bookingSequences: Map<number, number>;
  payments: Map<string, PaymentSnapshot>;
  paymentEvents: Map<string, PaymentEvent>;
  idempotency: Map<string, IdempotencyRecord>;
  complaints: Map<string, ComplaintSnapshot>;
  complaintSequences: Map<number, number>;
  outbox: Map<string, StoredOutboxMessage>;
  emailDeliveries: Map<string, EmailDeliveryRecord>;
  consents: ConsentRecord[];
  legalAcceptances: LegalAcceptanceRecord[];
  /** Días no hábiles (CalendarDate) del ámbito nacional. */
  holidays: Set<string>;
}

export function emptyState(): InMemoryState {
  return {
    departures: new Map(),
    holds: new Map(),
    carts: new Map(),
    customers: new Map(),
    bookings: new Map(),
    bookingSequences: new Map(),
    payments: new Map(),
    paymentEvents: new Map(),
    idempotency: new Map(),
    complaints: new Map(),
    complaintSequences: new Map(),
    outbox: new Map(),
    emailDeliveries: new Map(),
    consents: [],
    legalAcceptances: [],
    holidays: new Set(PERU_NATIONAL_HOLIDAYS),
  };
}

/**
 * Almacén en memoria para tests y modo demo (`DATA_SOURCE=seed|memory`).
 * No es para producción: no persiste y no escala a varios procesos.
 */
export class InMemoryDataStore {
  state: InMemoryState;

  constructor(
    readonly catalog: CatalogData = { tours: [], rates: [], destinations: [], categories: [] },
    departures: DepartureSnapshot[] = [],
  ) {
    this.state = emptyState();
    for (const d of departures) this.state.departures.set(d.id, { ...d });
  }

  snapshot(): InMemoryState {
    return structuredClone(this.state);
  }

  restore(snapshot: InMemoryState): void {
    this.state = snapshot;
  }
}
