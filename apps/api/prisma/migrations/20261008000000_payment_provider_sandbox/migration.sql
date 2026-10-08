-- Sprint 1: pasarela simulada persistible con DATA_SOURCE=prisma.
-- Migración aislada: un valor nuevo de enum no puede usarse en la misma transacción
-- en que se agrega. La app prohíbe PAYMENT_GATEWAY=sandbox en producción.
-- Reverso: PostgreSQL no permite DROP VALUE; habría que recrear el tipo (no previsto).

-- AlterEnum
ALTER TYPE "payment_provider" ADD VALUE IF NOT EXISTS 'sandbox';
