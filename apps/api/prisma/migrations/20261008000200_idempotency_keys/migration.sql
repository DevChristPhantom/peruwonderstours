-- Sprint 1: idempotencia persistente (reemplaza el Map en memoria del proceso).
-- Reverso: DROP TABLE "idempotency_keys";

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "scope" VARCHAR(40) NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "resource_id" UUID,
    "response" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("scope","key")
);

-- CreateIndex (purga de vencidas)
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

ALTER TABLE "idempotency_keys"
  ADD CONSTRAINT "idempotency_keys_key_format_ck" CHECK ("key" ~ '^[A-Za-z0-9._:-]{8,100}$'),
  ADD CONSTRAINT "idempotency_keys_request_hash_format_ck" CHECK ("request_hash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "idempotency_keys_expiry_ck" CHECK ("expires_at" > "created_at");
