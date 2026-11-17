-- Pasarela WeTravel (enlaces de pago). Solo agrega un valor al enum: no toca datos existentes.
ALTER TYPE "payment_provider" ADD VALUE IF NOT EXISTS 'wetravel';
