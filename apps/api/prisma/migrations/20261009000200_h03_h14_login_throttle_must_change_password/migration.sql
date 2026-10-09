-- Endurecimiento H-03/H-13 (limitador atómico por cuenta y por cuenta+IP, igual para correos
-- inexistentes) y H-14 (cambio de contraseña obligatorio en el primer ingreso).
-- Reverso: DROP TABLE auth_login_throttle; ALTER TABLE users DROP COLUMN must_change_password;

ALTER TABLE "users" ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "auth_login_throttle" (
    "key" CHAR(64) NOT NULL,
    "account_key" CHAR(64) NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "last_failure_at" TIMESTAMPTZ(6) NOT NULL,
    "blocked_until" TIMESTAMPTZ(6),
    CONSTRAINT "auth_login_throttle_pkey" PRIMARY KEY ("key"),
    CONSTRAINT "auth_login_throttle_key_ck" CHECK (key ~ '^[0-9a-f]{64}$' AND account_key ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "auth_login_throttle_failures_ck" CHECK (failures >= 0)
);
CREATE INDEX "auth_login_throttle_account_key_idx" ON "auth_login_throttle"("account_key");
