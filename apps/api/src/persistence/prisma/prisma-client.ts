import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { ConcurrencyError, ConflictError, DomainError } from '../../shared/domain/domain-error.js';

export type PrismaTx = Prisma.TransactionClient;

/** Cliente Prisma 7 con driver adapter `pg` (requerido por el generador `prisma-client`). */
export function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/**
 * Traduce errores de Prisma/PostgreSQL a errores de dominio con semántica HTTP clara.
 * P2002 = UNIQUE, P2034 = conflicto de escritura/serialización, 23514 = CHECK.
 */
export function mapPrismaError(error: unknown): unknown {
  if (error instanceof DomainError) return error;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return new ConflictError('unique-violation', 'El recurso ya existe o fue creado por otra petición simultánea.', {
        target: error.meta?.['target'] ?? error.meta?.['constraint'] ?? null,
      });
    }
    if (error.code === 'P2034') return new ConcurrencyError();
  }
  const message = error instanceof Error ? error.message : '';
  if (/check_violation|violates check constraint|Transición de reserva no permitida/i.test(message)) {
    return new ConflictError('constraint-violation', 'La operación viola una regla de integridad de la base de datos.');
  }
  return error;
}
