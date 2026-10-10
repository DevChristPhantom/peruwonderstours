-- Sprint 3 funcional (brain/wiki/concepts/auditoria-funcional-sprint3.md), parte backend:
--  * access_tokens: enlaces mágicos de un solo uso (reserva, reclamo, login de cliente) y sesiones
--    opacas (acceso a reserva/reclamo desde otro dispositivo, "Mis reservas"). Solo SHA-256 del token.
--  * i18n: translation_status en traducciones; slug por idioma en destinos y categorías.
--  * Contenido: portada y versión en destinos/categorías; tags y versión en blog; moderación de
--    testimonios; contact_messages (formulario de contacto).
--  * Pagos: anulación de pagos manuales con contra-asiento (solo admin, ADR-0003) y transiciones de
--    retroceso de la reserva que solo usa la anulación.
-- Generada con `prisma migrate diff` y revisada: se quitó el drift conocido (índices parciales /
-- SQL-only que Prisma no modela: invoices_created_at_idx, payment_events_received_at_idx,
-- payments_one_active_per_booking_key, tour_translations_search_vector_idx,
-- travelers_one_lead_per_booking_key y el default de departures.start_time).
-- Reverso: DROP TABLE access_tokens, contact_messages; DROP de las columnas añadidas; restaurar
-- payments_one_succeeded_deposit_or_full_key sin "voided_at IS NULL", booking_status_transition_allowed()
-- y audit_allowed_columns() de 20261009000100_h06_audit_allowlist.

-- AlterTable
ALTER TABLE "blog_post_translations" ADD COLUMN     "translation_status" VARCHAR(40);

-- AlterTable
ALTER TABLE "blog_posts" ADD COLUMN     "tags" VARCHAR(60)[] DEFAULT ARRAY[]::VARCHAR(60)[],
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "cover_storage_key" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "category_translations" ADD COLUMN     "slug" VARCHAR(120),
ADD COLUMN     "translation_status" VARCHAR(40);

-- AlterTable
ALTER TABLE "destination_translations" ADD COLUMN     "slug" VARCHAR(160),
ADD COLUMN     "translation_status" VARCHAR(40);

-- AlterTable
ALTER TABLE "destinations" ADD COLUMN     "cover_storage_key" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "is_reversal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "void_reason" VARCHAR(500),
ADD COLUMN     "voided_at" TIMESTAMPTZ(6),
ADD COLUMN     "voided_by_user_id" UUID;

-- AlterTable
ALTER TABLE "testimonials" ADD COLUMN     "is_featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "moderated_at" TIMESTAMPTZ(6),
ADD COLUMN     "moderation_note" VARCHAR(500),
ADD COLUMN     "privacy_notice_version" VARCHAR(40),
ADD COLUMN     "travel_date" DATE;

-- AlterTable
ALTER TABLE "tour_translations" ADD COLUMN     "translation_status" VARCHAR(40);

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "phone_enc" BYTEA,
    "subject" VARCHAR(150) NOT NULL,
    "message" TEXT NOT NULL,
    "tour_slug" VARCHAR(160),
    "locale" "locale" NOT NULL DEFAULT 'es',
    "status" VARCHAR(20) NOT NULL DEFAULT 'new',
    "privacy_notice_version" VARCHAR(40) NOT NULL,
    "answered_at" TIMESTAMPTZ(6),
    "answered_by_user_id" UUID,
    "archived_at" TIMESTAMPTZ(6),
    "internal_note" VARCHAR(2000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_tokens" (
    "id" UUID NOT NULL,
    "purpose" VARCHAR(40) NOT NULL,
    "subject_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "locale" "locale" NOT NULL DEFAULT 'es',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "last_used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contact_messages_status_created_at_idx" ON "contact_messages"("status", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "access_tokens_token_hash_key" ON "access_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "access_tokens_subject_id_purpose_idx" ON "access_tokens"("subject_id", "purpose");

-- CreateIndex
CREATE INDEX "access_tokens_expires_at_idx" ON "access_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "category_translations_locale_slug_key" ON "category_translations"("locale", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "destination_translations_locale_slug_key" ON "destination_translations"("locale", "slug");

-- CreateIndex
CREATE INDEX "payments_provider_succeeded_at_idx" ON "payments"("provider", "succeeded_at");

-- Un pago anulado deja de contar como "el" adelanto/pago total exitoso (se puede registrar el correcto).
DROP INDEX "payments_one_succeeded_deposit_or_full_key";
CREATE UNIQUE INDEX "payments_one_succeeded_deposit_or_full_key" ON "payments"("booking_id", "status") WHERE (status = 'succeeded' AND kind IN ('deposit','full') AND voided_at IS NULL);

-- ---------------------------------------------------------------------------
-- Reglas SQL (Prisma no las modela)
-- ---------------------------------------------------------------------------
ALTER TABLE "access_tokens"
  ADD CONSTRAINT "access_tokens_purpose_ck" CHECK (purpose IN ('booking_link', 'booking_session', 'complaint_link',
                                                              'complaint_session', 'customer_login_link', 'customer_session')),
  ADD CONSTRAINT "access_tokens_hash_ck" CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "access_tokens_expiry_ck" CHECK (expires_at > created_at);

ALTER TABLE "contact_messages"
  ADD CONSTRAINT "contact_messages_status_ck" CHECK (status IN ('new', 'answered', 'archived')),
  ADD CONSTRAINT "contact_messages_email_ck" CHECK (email = lower(email)),
  ADD CONSTRAINT "contact_messages_message_len_ck" CHECK (char_length(message) BETWEEN 1 AND 5000);

ALTER TABLE "testimonials"
  ADD CONSTRAINT "testimonials_featured_ck" CHECK (NOT is_featured OR status = 'approved');

ALTER TABLE "destinations" ADD CONSTRAINT "destinations_version_ck" CHECK (version >= 0);
ALTER TABLE "categories" ADD CONSTRAINT "categories_version_ck" CHECK (version >= 0);
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_version_ck" CHECK (version >= 0);

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_void_ck" CHECK ((voided_at IS NULL) = (voided_by_user_id IS NULL) AND (voided_at IS NULL) = (void_reason IS NULL)),
  ADD CONSTRAINT "payments_void_only_succeeded_ck" CHECK (voided_at IS NULL OR (status = 'succeeded' AND kind <> 'refund')),
  ADD CONSTRAINT "payments_reversal_ck" CHECK (NOT is_reversal OR (kind = 'refund' AND status = 'succeeded'));

-- Retrocesos de estado que solo produce la anulación de un pago manual (el total pagado baja).
-- Mantener en sincronía con BOOKING_STATUS_TRANSITIONS (booking-status.ts) y prisma/sql/constraints.sql.
CREATE OR REPLACE FUNCTION booking_status_transition_allowed(f booking_status, t booking_status)
RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT f = t OR (f, t) IN (
    ('pending',        'held'),
    ('pending',        'confirmed'),
    ('pending',        'cancelled'),
    ('held',           'partially_paid'),
    ('held',           'paid'),
    ('held',           'confirmed'),
    ('held',           'cancelled'),
    ('confirmed',      'partially_paid'),
    ('confirmed',      'paid'),
    ('confirmed',      'cancelled'),
    ('partially_paid', 'paid'),
    ('partially_paid', 'confirmed'),
    ('partially_paid', 'cancelled'),
    ('paid',           'partially_paid'),
    ('paid',           'confirmed'),
    ('paid',           'completed'),
    ('paid',           'cancelled'),
    ('cancelled',      'refunded'),
    ('completed',      'refunded')
  )
$$;

-- Auditoría de fila: las columnas de anulación entran a la allowlist (void_reason es texto libre: no).
CREATE OR REPLACE FUNCTION audit_allowed_columns(t text)
RETURNS text[] LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE t
    WHEN 'bookings' THEN ARRAY['id','code','customer_id','cart_id','status','source','locale','currency','subtotal_amount',
      'discount_amount','total_amount','payment_option','deposit_percent','deposit_amount','balance_amount','balance_due_at',
      'paid_amount','refunded_amount','refund_due_amount','hold_expires_at','first_service_date','last_service_date',
      'cancellation_policy_version','terms_version','created_by_user_id','confirmed_at','cancelled_at','completed_at',
      'created_at','deleted_at','version']
    WHEN 'booking_items' THEN ARRAY['id','booking_id','tour_id','departure_id','travel_date','status','pax_count',
      'subtotal_amount','currency','created_at']
    WHEN 'payments' THEN ARRAY['id','booking_id','kind','provider','method','status','amount','currency','exchange_rate',
      'booking_currency_amount','provider_payment_id','parent_payment_id','failure_code','recorded_by_user_id',
      'succeeded_at','created_at','voided_at','voided_by_user_id','is_reversal']
    WHEN 'customers' THEN ARRAY['id','country','preferred_locale','email_verified_at','anonymized_at','created_at','deleted_at']
    WHEN 'travelers' THEN ARRAY['id','booking_id','booking_item_id','is_lead','pax_type','residency','nationality',
      'document_type','anonymized_at','created_at','deleted_at']
    WHEN 'complaints' THEN ARRAY['id','year','sequence','code','type','declared_type','status','channel',
      'backup_sheet_number','transcribed_at','booking_id','provider_ruc','establishment_code','consumer_doc_type',
      'is_minor','good_type','claimed_amount','claimed_currency','response_channel','conformity_accepted_at',
      'conformity_text_version','privacy_notice_version','responded_at','responded_by_user_id','response_sent_at',
      'response_delivery_ref','response_due_at','original_response_due_at','settlement_offered_at',
      'settlement_expires_at','settlement_accepted_at','settlement_rejected_at','reclassified_at',
      'reclassified_by_user_id','acknowledgment_sent_at','acknowledgment_delivery_ref','pdf_sha256',
      'submitted_at','created_at']
    WHEN 'invoices' THEN ARRAY['id','booking_id','payment_id','doc_type','series','number','issue_date',
      'receiver_doc_type','currency','taxable_amount','exempt_amount','igv_amount','total_amount','exchange_rate',
      'sunat_status','sunat_response_code','related_invoice_id','created_at']
    WHEN 'users' THEN ARRAY['id','role','status','mfa_enabled_at','failed_login_count','locked_until',
      'last_failed_login_at','password_changed_at','must_change_password','last_login_at','version','created_at','deleted_at']
    WHEN 'rates' THEN ARRAY['id','tour_id','season_id','pax_type','residency','currency','amount','valid_from','valid_to',
      'min_group_size','max_group_size','is_active','version','created_at','deleted_at']
    WHEN 'tours' THEN ARRAY['id','slug','code','type','status','category_id','duration_days','duration_nights',
      'duration_hours','min_pax','max_pax','difficulty','booking_cutoff_hours','deposit_percent_override',
      'requires_traveler_document','uses_inventory','is_featured','cancellation_policy_code','published_at','version',
      'updated_by_user_id','created_at','deleted_at']
    WHEN 'seasons' THEN ARRAY['id','code','name','start_date','end_date','priority','version','created_at']
    ELSE ARRAY[]::text[]
  END
$$;
