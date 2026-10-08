/**
 * Outbox transaccional: el evento se escribe en la MISMA transacción que el cambio de
 * negocio y un relay lo publica después (correo, PDF, etc.). El payload no lleva datos
 * personales: solo identificadores; el consumidor del evento los carga de la base.
 */
export interface OutboxMessage {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  availableAt: Date;
  createdAt: Date;
  /** Deduplicación (UNIQUE): un segundo `addIfAbsent` con la misma clave no inserta nada. */
  dedupeKey?: string | null;
}

export interface OutboxRepository {
  add(message: OutboxMessage): Promise<void>;
  /** Inserta salvo que exista otro evento con la misma `dedupeKey`. Devuelve true si insertó. */
  addIfAbsent(message: OutboxMessage & { dedupeKey: string }): Promise<boolean>;
}

/** Evento reclamado por el relay (con su contador de intentos ya incrementado). */
export interface ClaimedOutboxEvent extends OutboxMessage {
  attempts: number;
}

/** Cola de publicación del outbox (lado del relay). */
export interface OutboxQueue {
  /**
   * Reclama hasta `limit` eventos pendientes (`published_at IS NULL`, disponibles y con
   * intentos < max), incrementa `attempts` y corre `available_at` por `leaseSeconds` para
   * que otro proceso no los tome mientras se envían (FOR UPDATE SKIP LOCKED en PostgreSQL).
   */
  claim(now: Date, limit: number, leaseSeconds: number, maxAttempts: number): Promise<ClaimedOutboxEvent[]>;
  markPublished(id: string, now: Date): Promise<void>;
  markFailed(id: string, error: string, retryAt: Date): Promise<void>;
  stats(now: Date, maxAttempts: number): Promise<{ pending: number; retrying: number; dead: number }>;
  /** Último estado de los eventos de un agregado (backoffice: "constancia no enviada"). */
  findByAggregate(aggregateType: string, aggregateId: string): Promise<Array<ClaimedOutboxEvent & { publishedAt: Date | null; lastError: string | null }>>;
}

export interface EmailDeliveryRecord {
  id: string;
  outboxEventId: string;
  template: string;
  status: 'sent' | 'failed';
  messageId: string;
  recipientHash: Uint8Array;
  transportRef: string | null;
  sentAt: Date;
}

/** Registro de correos entregados al transporte (idempotencia por evento + plantilla). */
export interface EmailDeliveryRepository {
  find(outboxEventId: string, template: string): Promise<EmailDeliveryRecord | null>;
  insert(record: EmailDeliveryRecord): Promise<void>;
}
