-- Sprint 1 (E8): estado "settled" = solución directa aceptada (art. 6-A, D.S. 058-2017-PCM).
-- Aislada: un valor nuevo de enum no puede usarse (CHECK de la migración siguiente) en la
-- misma transacción en que se agrega. Reverso: no hay DROP VALUE en PostgreSQL.

-- AlterEnum
ALTER TYPE "complaint_status" ADD VALUE IF NOT EXISTS 'settled';
