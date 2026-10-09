-- Endurecimiento H-01 (brain/wiki/concepts/revision-seguridad-sprint2.md): lost update en reservas
-- y pagos. (1) Bloqueo optimista en bookings: cada guardado hace UPDATE ... WHERE version = $leida.
-- (2) Un solo intento de cobro no terminal por reserva.
-- Reverso: DROP INDEX payments_one_active_per_booking_key; ALTER TABLE bookings DROP COLUMN version;

ALTER TABLE "bookings" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_version_ck" CHECK (version >= 0);

-- Datos previos: si una reserva tiene varios intentos activos, los más antiguos pasan a `expired`
-- (nunca se aprobaron; la conciliación consulta la pasarela antes de expirar los nuevos).
UPDATE "payments" p SET status = 'expired', updated_at = now()
 WHERE p.status IN ('pending', 'requires_action', 'authorized') AND p.kind <> 'refund'
   AND EXISTS (SELECT 1 FROM "payments" q
                WHERE q.booking_id = p.booking_id AND q.kind <> 'refund'
                  AND q.status IN ('pending', 'requires_action', 'authorized')
                  AND (q.created_at, q.id) > (p.created_at, p.id));

CREATE UNIQUE INDEX "payments_one_active_per_booking_key" ON "payments"("booking_id")
  WHERE status IN ('pending', 'requires_action', 'authorized') AND kind <> 'refund';
