-- Sprint 2: auth del staff (MFA TOTP, bloqueo progresivo, refresh rotativo), backoffice
-- (bloqueo optimista, reembolso adeudado, Libro de Reclamaciones: reclasificación y solución
-- directa), correo transaccional (dedupe del outbox, entregas) y consentimientos v2 (titular sin
-- cuenta, legal_acceptances separado, solicitudes ARCO).
-- Generado con `prisma migrate diff --from-config-datasource --to-schema` y revisado a mano:
-- se QUITARON los DROP/CREATE de índices parciales/SQL-only (drift conocido de Prisma) y el
-- cambio de DEFAULT de departures.start_time.
-- Reverso (manual): DROP TABLE email_deliveries, data_subject_requests, legal_acceptances,
--   user_recovery_codes; DROP TYPE email_delivery_status, data_subject_request_status,
--   data_subject_request_type, legal_document, consent_method; ALTER TABLE ... DROP COLUMN de
--   las columnas agregadas abajo y DROP CONSTRAINT de los CHECK nuevos; DROP TRIGGER nuevos.
--   consents.customer_id no puede volver a NOT NULL si hay filas de titulares sin cuenta.

-- CreateEnum
CREATE TYPE "consent_method" AS ENUM ('checkbox', 'banner', 'email_link', 'otp_signature', 'staff_recorded');
CREATE TYPE "legal_document" AS ENUM ('privacy_policy_ack', 'terms_and_conditions', 'cancellation_policy');
CREATE TYPE "data_subject_request_type" AS ENUM ('information', 'access', 'portability', 'rectification', 'cancellation', 'opposition', 'revoke_consent');
CREATE TYPE "data_subject_request_status" AS ENUM ('received', 'in_progress', 'answered', 'rejected', 'withdrawn');
CREATE TYPE "email_delivery_status" AS ENUM ('sent', 'failed');

-- -----------------------------------------------------------------------------
-- Auth del staff
-- -----------------------------------------------------------------------------
-- absolute_expires_at: se agrega nullable, se rellena con expires_at y se vuelve NOT NULL.
ALTER TABLE "auth_sessions" ADD COLUMN "absolute_expires_at" TIMESTAMPTZ(6),
ADD COLUMN "revoked_reason" VARCHAR(40);
UPDATE "auth_sessions" SET "absolute_expires_at" = "expires_at" WHERE "absolute_expires_at" IS NULL;
ALTER TABLE "auth_sessions" ALTER COLUMN "absolute_expires_at" SET NOT NULL;
ALTER TABLE "auth_sessions"
  ADD CONSTRAINT "auth_sessions_absolute_expiry_ck" CHECK (absolute_expires_at >= expires_at),
  ADD CONSTRAINT "auth_sessions_token_hash_len_ck" CHECK (octet_length(token_hash) = 32),
  ADD CONSTRAINT "auth_sessions_revoked_reason_ck" CHECK ((revoked_at IS NULL) = (revoked_reason IS NULL));

ALTER TABLE "users" ADD COLUMN "failed_login_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "last_failed_login_at" TIMESTAMPTZ(6),
ADD COLUMN "locked_until" TIMESTAMPTZ(6),
ADD COLUMN "mfa_enabled_at" TIMESTAMPTZ(6),
ADD COLUMN "mfa_last_time_step" BIGINT,
ADD COLUMN "password_changed_at" TIMESTAMPTZ(6),
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users"
  ADD CONSTRAINT "users_failed_login_count_ck" CHECK (failed_login_count >= 0),
  ADD CONSTRAINT "users_mfa_enabled_secret_ck" CHECK (mfa_enabled_at IS NULL OR mfa_secret_enc IS NOT NULL),
  ADD CONSTRAINT "users_email_format_ck" CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');

CREATE TABLE "user_recovery_codes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code_hash" CHAR(64) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_recovery_codes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_recovery_codes_hash_ck" CHECK (code_hash ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX "user_recovery_codes_user_id_code_hash_key" ON "user_recovery_codes"("user_id", "code_hash");
ALTER TABLE "user_recovery_codes" ADD CONSTRAINT "user_recovery_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- Backoffice: catálogo, precios, reservas
-- -----------------------------------------------------------------------------
ALTER TABLE "tours" ADD COLUMN "updated_by_user_id" UUID,
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "tours" ADD CONSTRAINT "tours_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tours" ADD CONSTRAINT "tours_version_ck" CHECK (version >= 0);

ALTER TABLE "rates" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "seasons" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "bookings" ADD COLUMN "refund_due_amount" BIGINT;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_refund_due_ck" CHECK (
  refund_due_amount IS NULL OR (refund_due_amount >= 0 AND refund_due_amount <= paid_amount));

-- Auditoría automática también para el catálogo editable desde el backoffice
-- (además del registro de acciones que escribe la aplicación).
CREATE TRIGGER tours_audit_trg AFTER INSERT OR UPDATE OR DELETE ON tours
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER seasons_audit_trg AFTER INSERT OR UPDATE OR DELETE ON seasons
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();

-- -----------------------------------------------------------------------------
-- Libro de Reclamaciones: reclasificación y solución directa (art. 6-A)
-- -----------------------------------------------------------------------------
ALTER TABLE "complaints" ADD COLUMN "original_response_due_at" TIMESTAMPTZ(6),
ADD COLUMN "reclassification_reason" VARCHAR(500),
ADD COLUMN "reclassified_at" TIMESTAMPTZ(6),
ADD COLUMN "reclassified_by_user_id" UUID,
ADD COLUMN "settlement_expires_at" TIMESTAMPTZ(6),
ADD COLUMN "settlement_rejected_at" TIMESTAMPTZ(6);
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_reclassified_by_user_id_fkey" FOREIGN KEY ("reclassified_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "complaints"
  ADD CONSTRAINT "complaints_reclassified_ck" CHECK (
        (reclassified_at IS NULL) = (reclassification_reason IS NULL)),
  ADD CONSTRAINT "complaints_settlement_window_ck" CHECK (
        (settlement_offered_at IS NULL) = (settlement_expires_at IS NULL)
    AND (settlement_expires_at IS NULL OR settlement_expires_at > settlement_offered_at)
    AND NOT (settlement_accepted_at IS NOT NULL AND settlement_rejected_at IS NOT NULL));

-- -----------------------------------------------------------------------------
-- Correo transaccional
-- -----------------------------------------------------------------------------
ALTER TABLE "outbox_events" ADD COLUMN "dedupe_key" VARCHAR(160);
CREATE UNIQUE INDEX "outbox_events_dedupe_key_key" ON "outbox_events"("dedupe_key");

CREATE TABLE "email_deliveries" (
    "id" UUID NOT NULL,
    "outbox_event_id" UUID NOT NULL,
    "template" VARCHAR(60) NOT NULL,
    "status" "email_delivery_status" NOT NULL,
    "message_id" VARCHAR(200) NOT NULL,
    "recipient_hash" BYTEA NOT NULL,
    "transport_ref" VARCHAR(300),
    "sent_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_deliveries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "email_deliveries_outbox_event_id_template_key" ON "email_deliveries"("outbox_event_id", "template");
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_outbox_event_id_fkey" FOREIGN KEY ("outbox_event_id") REFERENCES "outbox_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TRIGGER email_deliveries_append_only_trg BEFORE UPDATE OR DELETE ON email_deliveries
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- -----------------------------------------------------------------------------
-- Protección de datos: consentimientos v2, aceptaciones legales y ARCO
-- -----------------------------------------------------------------------------
ALTER TABLE "consents" ADD COLUMN "anonymous_id" UUID,
ADD COLUMN "locale" "locale",
ADD COLUMN "method" "consent_method" NOT NULL DEFAULT 'checkbox',
ADD COLUMN "subject_email_hash" BYTEA,
ADD COLUMN "text_hash" CHAR(64),
ALTER COLUMN "customer_id" DROP NOT NULL;
ALTER TABLE "consents"
  ADD CONSTRAINT "consents_subject_ck" CHECK (num_nonnulls(customer_id, subject_email_hash, anonymous_id) >= 1),
  ADD CONSTRAINT "consents_subject_email_hash_len_ck" CHECK (subject_email_hash IS NULL OR octet_length(subject_email_hash) = 32),
  ADD CONSTRAINT "consents_text_hash_ck" CHECK (text_hash IS NULL OR text_hash ~ '^[0-9a-f]{64}$'),
  -- Las finalidades obsoletas ya no se escriben (son acuses/aceptaciones -> legal_acceptances).
  ADD CONSTRAINT "consents_purpose_v2_ck" CHECK (purpose NOT IN ('privacy_policy', 'terms_and_conditions', 'marketing'));
CREATE INDEX "consents_subject_email_hash_purpose_created_at_idx" ON "consents"("subject_email_hash", "purpose", "created_at" DESC);
CREATE INDEX "consents_anonymous_id_purpose_created_at_idx" ON "consents"("anonymous_id", "purpose", "created_at" DESC);

CREATE TABLE "legal_acceptances" (
    "id" UUID NOT NULL,
    "customer_id" UUID,
    "booking_id" UUID,
    "subject_email_hash" BYTEA NOT NULL,
    "document" "legal_document" NOT NULL,
    "document_version" VARCHAR(40) NOT NULL,
    "text_hash" CHAR(64),
    "locale" "locale",
    "ip" INET,
    "user_agent" VARCHAR(400),
    "source" VARCHAR(40) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "legal_acceptances_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "legal_acceptances_subject_email_hash_len_ck" CHECK (octet_length(subject_email_hash) = 32),
    CONSTRAINT "legal_acceptances_text_hash_ck" CHECK (text_hash IS NULL OR text_hash ~ '^[0-9a-f]{64}$')
);
CREATE INDEX "legal_acceptances_customer_id_document_created_at_idx" ON "legal_acceptances"("customer_id", "document", "created_at" DESC);
CREATE INDEX "legal_acceptances_booking_id_idx" ON "legal_acceptances"("booking_id");
CREATE INDEX "legal_acceptances_subject_email_hash_document_idx" ON "legal_acceptances"("subject_email_hash", "document");
ALTER TABLE "legal_acceptances" ADD CONSTRAINT "legal_acceptances_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "legal_acceptances" ADD CONSTRAINT "legal_acceptances_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TRIGGER legal_acceptances_append_only_trg BEFORE UPDATE OR DELETE ON legal_acceptances
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TABLE "data_subject_requests" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "type" "data_subject_request_type" NOT NULL,
    "status" "data_subject_request_status" NOT NULL DEFAULT 'received',
    "subject_name" VARCHAR(200) NOT NULL,
    "subject_email" VARCHAR(254) NOT NULL,
    "subject_email_hash" BYTEA NOT NULL,
    "customer_id" UUID,
    "channel" VARCHAR(20) NOT NULL,
    "detail" TEXT NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL,
    "due_at" TIMESTAMPTZ(6) NOT NULL,
    "extended_at" TIMESTAMPTZ(6),
    "extension_reason" VARCHAR(1000),
    "response_text" TEXT,
    "responded_at" TIMESTAMPTZ(6),
    "responded_by_user_id" UUID,
    "created_by_user_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "data_subject_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "data_subject_requests_code_ck" CHECK (code ~ '^ARCO-[0-9]{4}-[0-9]{6,}$'),
    CONSTRAINT "data_subject_requests_email_lower_ck" CHECK (subject_email = lower(subject_email)),
    CONSTRAINT "data_subject_requests_due_ck" CHECK (due_at > received_at),
    CONSTRAINT "data_subject_requests_extension_ck" CHECK ((extended_at IS NULL) = (extension_reason IS NULL)),
    CONSTRAINT "data_subject_requests_info_not_extendable_ck" CHECK (type <> 'information' OR extended_at IS NULL),
    CONSTRAINT "data_subject_requests_answered_ck" CHECK (
          status NOT IN ('answered', 'rejected') OR (response_text IS NOT NULL AND responded_at IS NOT NULL)),
    CONSTRAINT "data_subject_requests_channel_ck" CHECK (channel IN ('email', 'web', 'office', 'phone', 'letter'))
);
CREATE UNIQUE INDEX "data_subject_requests_code_key" ON "data_subject_requests"("code");
CREATE INDEX "data_subject_requests_status_due_at_idx" ON "data_subject_requests"("status", "due_at");
CREATE INDEX "data_subject_requests_subject_email_hash_idx" ON "data_subject_requests"("subject_email_hash");
ALTER TABLE "data_subject_requests" ADD CONSTRAINT "data_subject_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "data_subject_requests" ADD CONSTRAINT "data_subject_requests_responded_by_user_id_fkey" FOREIGN KEY ("responded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- Las solicitudes ARCO son evidencia de cumplimiento: no se borran.
CREATE TRIGGER data_subject_requests_no_delete_trg BEFORE DELETE ON data_subject_requests
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
