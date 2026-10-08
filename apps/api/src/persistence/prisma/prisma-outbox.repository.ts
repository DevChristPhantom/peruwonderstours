import type { Prisma } from '../../generated/prisma/client.js';
import type { OutboxMessage, OutboxRepository } from '../../shared/domain/outbox.js';
import type { PrismaTx } from './prisma-client.js';

/** Inserta en `outbox_events` dentro de la transacción en curso (lo publica un relay). */
export class PrismaOutboxRepository implements OutboxRepository {
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
      },
    });
  }
}
