-- Sprint 1: token de acceso del comprador a su reserva (cabecera X-Booking-Token).
-- Solo se guarda el SHA-256 en hex (64 caracteres). audit_redact() ya excluye las
-- columnas *_hash del audit_log. Reservas previas quedan sin acceso público (NULL).
-- Reverso: ALTER TABLE "bookings" DROP COLUMN "access_token_hash";

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN "access_token_hash" CHAR(64);

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_access_token_hash_format_ck"
  CHECK ("access_token_hash" IS NULL OR "access_token_hash" ~ '^[0-9a-f]{64}$');
