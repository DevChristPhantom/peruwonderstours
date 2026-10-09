import type { Prisma } from '../../generated/prisma/client.js';
import type {
  ClaimedOutboxEvent,
  EmailDeliveryRecord,
  EmailDeliveryRepository,
  OutboxMessage,
  OutboxQueue,
  OutboxRepository,
} from '../../shared/domain/outbox.js';
import type { PrismaTx } from './prisma-client.js';

type OutboxRow = Prisma.OutboxEventGetPayload<object>;

interface RawOutboxRow {
  id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  attempts: number;
  available_at: Date;
  created_at: Date;
  dedupe_key: string | null;
}

function fromRow(row: OutboxRow): ClaimedOutboxEvent & { publishedAt: Date | null; lastError: string | null } {
  return {
    id: row.id,
    aggregateType: row.aggregateType,
    aggregateId: row.aggregateId,
    eventType: row.eventType,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    availableAt: row.availableAt,
    createdAt: row.createdAt,
    dedupeKey: row.dedupeKey,
    attempts: row.attempts,
    publishedAt: row.publishedAt,
    lastError: row.lastError,
  };
}

/** `outbox_events` dentro de la transacción en curso (lo publica el relay). */
export class PrismaOutboxRepository implements OutboxRepository, OutboxQueue {
  constructor(private readonly db: PrismaTx) {}

  async add(message: OutboxMessage): Promise<void> {
    await this.db.outboxEvent.create({
      data: {
        id: message.id,
        aggregateType: message.aggregateType,
        aggregateId: message.aggregateId,
        eventType: message.eventType,
        payload: message.payload as Prisma.InputJsonValue,
        availableAt: message.availableAt,
        createdAt: message.createdAt,
        dedupeKey: message.dedupeKey ?? null,
      },
    });
  }

  /** INSERT ... ON CONFLICT (dedupe_key) DO NOTHING: no aborta la transacción si ya existe. */
  async addIfAbsent(message: OutboxMessage & { dedupeKey: string }): Promise<boolean> {
    const inserted = await this.db.$executeRaw`
      INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload, attempts, available_at, created_at, dedupe_key)
      VALUES (${message.id}::uuid, ${message.aggregateType}, ${message.aggregateId}::uuid, ${message.eventType},
              ${JSON.stringify(message.payload)}::jsonb, 0, ${message.availableAt}, ${message.createdAt}, ${message.dedupeKey})
      ON CONFLICT (dedupe_key) DO NOTHING`;
    return inserted === 1;
  }

  /** Reclamo con FOR UPDATE SKIP LOCKED: varios procesos pueden correr el relay sin duplicar trabajo. */
  async claim(now: Date, limit: number, leaseSeconds: number, maxAttempts: number): Promise<ClaimedOutboxEvent[]> {
    const lease = new Date(now.getTime() + leaseSeconds * 1000);
    const rows = await this.db.$queryRaw<RawOutboxRow[]>`
      UPDATE outbox_events o
         SET attempts = o.attempts + 1, available_at = ${lease}
       WHERE o.id IN (
         SELECT id FROM outbox_events
          WHERE published_at IS NULL AND available_at <= ${now} AND attempts < ${maxAttempts}
          ORDER BY available_at
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED)
      RETURNING o.id, o.aggregate_type, o.aggregate_id, o.event_type, o.payload, o.attempts, o.available_at, o.created_at, o.dedupe_key`;
    return rows.map((r) => ({
      id: r.id,
      aggregateType: r.aggregate_type,
      aggregateId: r.aggregate_id,
      eventType: r.event_type,
      payload: r.payload ?? {},
      attempts: Number(r.attempts),
      availableAt: r.available_at,
      createdAt: r.created_at,
      dedupeKey: r.dedupe_key,
    }));
  }

  async markPublished(id: string, now: Date): Promise<void> {
    await this.db.outboxEvent.update({ where: { id }, data: { publishedAt: now, lastError: null } });
  }

  async markFailed(id: string, error: string, retryAt: Date): Promise<void> {
    await this.db.outboxEvent.update({ where: { id }, data: { lastError: error.slice(0, 2000), availableAt: retryAt } });
  }

  async stats(_now: Date, maxAttempts: number): Promise<{ pending: number; retrying: number; dead: number }> {
    const [pending, retrying, dead] = await Promise.all([
      this.db.outboxEvent.count({ where: { publishedAt: null, attempts: 0 } }),
      this.db.outboxEvent.count({ where: { publishedAt: null, attempts: { gt: 0, lt: maxAttempts } } }),
      this.db.outboxEvent.count({ where: { publishedAt: null, attempts: { gte: maxAttempts } } }),
    ]);
    return { pending, retrying, dead };
  }

  async findByAggregate(aggregateType: string, aggregateId: string) {
    const rows = await this.db.outboxEvent.findMany({ where: { aggregateType, aggregateId }, orderBy: { createdAt: 'asc' } });
    return rows.map(fromRow);
  }
}

export class PrismaEmailDeliveryRepository implements EmailDeliveryRepository {
  constructor(private readonly db: PrismaTx) {}

  async find(outboxEventId: string, template: string): Promise<EmailDeliveryRecord | null> {
    const row = await this.db.emailDelivery.findUnique({ where: { outboxEventId_template: { outboxEventId, template } } });
    return row
      ? {
          id: row.id,
          outboxEventId: row.outboxEventId,
          template: row.template,
          status: row.status,
          messageId: row.messageId,
          recipientHash: row.recipientHash,
          transportRef: row.transportRef,
          sentAt: row.sentAt,
        }
      : null;
  }

  async insert(r: EmailDeliveryRecord): Promise<void> {
    await this.db.emailDelivery.create({
      data: {
        id: r.id,
        outboxEventId: r.outboxEventId,
        template: r.template,
        status: r.status,
        messageId: r.messageId,
        recipientHash: Uint8Array.from(r.recipientHash),
        transportRef: r.transportRef,
        sentAt: r.sentAt,
      },
    });
  }
}
