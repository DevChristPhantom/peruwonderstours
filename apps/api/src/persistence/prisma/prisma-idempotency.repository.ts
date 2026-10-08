import { Prisma } from '../../generated/prisma/client.js';
import { IdempotencyConflictError, type IdempotencyRecord, type IdempotencyRepository } from '../../shared/domain/idempotency.js';
import type { PrismaTx } from './prisma-client.js';

/**
 * Idempotencia persistente en `idempotency_keys` (PK scope+key). Se escribe en la misma
 * transacción que el recurso creado: si la transacción se revierte, la clave no queda.
 * Dos peticiones simultáneas con la misma clave: la segunda choca con la PK (o con
 * UNIQUE(bookings.cart_id)) y recibe 409 idempotency-in-progress.
 */
export class PrismaIdempotencyRepository implements IdempotencyRepository {
  constructor(private readonly db: PrismaTx) {}

  async find(scope: string, key: string): Promise<IdempotencyRecord | null> {
    const row = await this.db.idempotencyKey.findUnique({ where: { scope_key: { scope, key } } });
    if (!row) return null;
    return {
      scope: row.scope,
      key: row.key,
      fingerprint: row.requestHash,
      resourceId: row.resourceId ?? '',
      response: (row.response ?? null) as Record<string, unknown> | null,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    };
  }

  async insert(record: IdempotencyRecord): Promise<void> {
    // Una clave vencida puede reutilizarse: se elimina antes de insertar.
    await this.db.idempotencyKey.deleteMany({
      where: { scope: record.scope, key: record.key, expiresAt: { lte: record.createdAt } },
    });
    try {
      await this.db.idempotencyKey.create({
        data: {
          scope: record.scope,
          key: record.key,
          requestHash: record.fingerprint,
          resourceId: record.resourceId || null,
          response: record.response ? (record.response as Prisma.InputJsonValue) : Prisma.DbNull,
          createdAt: record.createdAt,
          expiresAt: record.expiresAt,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new IdempotencyConflictError(record.key);
      }
      throw error;
    }
  }

  async deleteExpired(now: Date, limit = 1000): Promise<number> {
    // DELETE con LIMIT vía subconsulta (lotes pequeños, sin bloquear la tabla).
    return this.db.$executeRaw`
      DELETE FROM idempotency_keys
       WHERE (scope, key) IN (
         SELECT scope, key FROM idempotency_keys WHERE expires_at <= ${now} ORDER BY expires_at LIMIT ${limit}
       )`;
  }
}
