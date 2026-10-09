-- Endurecimiento H-17: una hoja solo se VINCULA a una reserva (booking_id) si el consumidor lo
-- acredita (correo de la reserva o token de acceso). Si no, el código que escribió se guarda
-- como texto "declarado, sin verificar".
-- Reverso: ALTER TABLE complaints DROP COLUMN declared_booking_code;
ALTER TABLE "complaints" ADD COLUMN "declared_booking_code" VARCHAR(20);
