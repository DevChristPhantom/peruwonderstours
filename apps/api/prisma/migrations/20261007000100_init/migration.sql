-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "locale" AS ENUM ('es', 'en');

-- CreateEnum
CREATE TYPE "publication_status" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "tour_type" AS ENUM ('tour', 'package', 'transfer');

-- CreateEnum
CREATE TYPE "difficulty" AS ENUM ('easy', 'moderate', 'challenging', 'extreme');

-- CreateEnum
CREATE TYPE "media_kind" AS ENUM ('image', 'video');

-- CreateEnum
CREATE TYPE "pax_type" AS ENUM ('adult', 'child', 'student', 'senior');

-- CreateEnum
CREATE TYPE "residency" AS ENUM ('national', 'foreign');

-- CreateEnum
CREATE TYPE "cart_status" AS ENUM ('active', 'converted', 'abandoned', 'expired');

-- CreateEnum
CREATE TYPE "hold_status" AS ENUM ('active', 'converted', 'released', 'expired');

-- CreateEnum
CREATE TYPE "booking_status" AS ENUM ('pending', 'held', 'confirmed', 'partially_paid', 'paid', 'cancelled', 'refunded', 'completed');

-- CreateEnum
CREATE TYPE "booking_item_status" AS ENUM ('active', 'cancelled');

-- CreateEnum
CREATE TYPE "booking_source" AS ENUM ('web', 'admin', 'agent');

-- CreateEnum
CREATE TYPE "payment_option" AS ENUM ('deposit', 'full');

-- CreateEnum
CREATE TYPE "payment_kind" AS ENUM ('deposit', 'balance', 'full', 'refund');

-- CreateEnum
CREATE TYPE "payment_provider" AS ENUM ('izipay', 'niubiz', 'mercadopago', 'culqi', 'manual');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('card', 'yape', 'plin', 'pagoefectivo', 'bank_transfer', 'cash');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('pending', 'requires_action', 'authorized', 'succeeded', 'failed', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "event_processing_status" AS ENUM ('received', 'processed', 'ignored', 'failed');

-- CreateEnum
CREATE TYPE "actor_type" AS ENUM ('system', 'customer', 'user', 'webhook');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('admin', 'operator', 'agent');

-- CreateEnum
CREATE TYPE "account_status" AS ENUM ('active', 'suspended', 'disabled');

-- CreateEnum
CREATE TYPE "document_type" AS ENUM ('dni', 'ce', 'passport', 'ruc', 'other');

-- CreateEnum
CREATE TYPE "consent_purpose" AS ENUM ('privacy_policy', 'terms_and_conditions', 'marketing', 'international_transfer', 'analytics_cookies');

-- CreateEnum
CREATE TYPE "complaint_type" AS ENUM ('reclamo', 'queja');

-- CreateEnum
CREATE TYPE "complaint_status" AS ENUM ('received', 'in_review', 'answered', 'closed');

-- CreateEnum
CREATE TYPE "contracted_good_type" AS ENUM ('product', 'service');

-- CreateEnum
CREATE TYPE "invoice_doc_type" AS ENUM ('boleta', 'factura', 'nota_credito');

-- CreateEnum
CREATE TYPE "sunat_status" AS ENUM ('pending', 'sent', 'accepted', 'accepted_with_observations', 'rejected', 'voided');

-- CreateEnum
CREATE TYPE "moderation_status" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "sequence_scope" AS ENUM ('booking', 'complaint', 'invoice');

-- CreateTable
CREATE TABLE "destinations" (
    "id" UUID NOT NULL,
    "parent_id" UUID,
    "slug" VARCHAR(160) NOT NULL,
    "region_code" VARCHAR(10),
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "status" "publication_status" NOT NULL DEFAULT 'draft',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "destinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "destination_translations" (
    "id" UUID NOT NULL,
    "destination_id" UUID NOT NULL,
    "locale" "locale" NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "seo_title" VARCHAR(70),
    "seo_description" VARCHAR(170),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "destination_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_translations" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "locale" "locale" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "category_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tours" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "type" "tour_type" NOT NULL,
    "status" "publication_status" NOT NULL DEFAULT 'draft',
    "category_id" UUID,
    "duration_days" SMALLINT,
    "duration_nights" SMALLINT,
    "duration_hours" DECIMAL(4,1),
    "min_pax" SMALLINT NOT NULL DEFAULT 1,
    "max_pax" SMALLINT,
    "difficulty" "difficulty",
    "languages" VARCHAR(5)[] DEFAULT ARRAY[]::VARCHAR(5)[],
    "booking_cutoff_hours" INTEGER NOT NULL DEFAULT 24,
    "deposit_percent_override" SMALLINT,
    "requires_traveler_document" BOOLEAN NOT NULL DEFAULT false,
    "uses_inventory" BOOLEAN NOT NULL DEFAULT true,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "cancellation_policy_code" VARCHAR(40),
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "tours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_translations" (
    "id" UUID NOT NULL,
    "tour_id" UUID NOT NULL,
    "locale" "locale" NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "summary" VARCHAR(600) NOT NULL,
    "description" TEXT,
    "itinerary" JSONB NOT NULL DEFAULT '[]',
    "includes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "not_included" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommendations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "faqs" JSONB NOT NULL DEFAULT '[]',
    "important_notes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "policies" TEXT,
    "meeting_point" TEXT,
    "seo_title" VARCHAR(70),
    "seo_description" VARCHAR(170),
    "search_text" TEXT,
    "search_vector" tsvector,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tour_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_media" (
    "id" UUID NOT NULL,
    "tour_id" UUID NOT NULL,
    "kind" "media_kind" NOT NULL DEFAULT 'image',
    "storage_key" TEXT NOT NULL,
    "alt_es" VARCHAR(250),
    "alt_en" VARCHAR(250),
    "width" INTEGER,
    "height" INTEGER,
    "is_cover" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tour_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_destinations" (
    "tour_id" UUID NOT NULL,
    "destination_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tour_destinations_pkey" PRIMARY KEY ("tour_id","destination_id")
);

-- CreateTable
CREATE TABLE "legacy_redirects" (
    "id" UUID NOT NULL,
    "from_path" VARCHAR(500) NOT NULL,
    "to_path" VARCHAR(500) NOT NULL,
    "status_code" SMALLINT NOT NULL DEFAULT 301,
    "hits" BIGINT NOT NULL DEFAULT 0,
    "last_hit_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "legacy_redirects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "priority" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rates" (
    "id" UUID NOT NULL,
    "tour_id" UUID NOT NULL,
    "season_id" UUID,
    "pax_type" "pax_type" NOT NULL,
    "residency" "residency" NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "amount" BIGINT NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE NOT NULL,
    "min_group_size" SMALLINT NOT NULL DEFAULT 1,
    "max_group_size" SMALLINT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departures" (
    "id" UUID NOT NULL,
    "tour_id" UUID NOT NULL,
    "departure_date" DATE NOT NULL,
    "start_time" TIME(0) NOT NULL DEFAULT '00:00:00'::time,
    "capacity" INTEGER NOT NULL,
    "booked" INTEGER NOT NULL DEFAULT 0,
    "held" INTEGER NOT NULL DEFAULT 0,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "departures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" UUID NOT NULL,
    "rate_date" DATE NOT NULL,
    "base_currency" CHAR(3) NOT NULL,
    "quote_currency" CHAR(3) NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "source" VARCHAR(40) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" UUID NOT NULL,
    "token_hash" BYTEA NOT NULL,
    "customer_id" UUID,
    "currency" CHAR(3) NOT NULL,
    "locale" "locale" NOT NULL DEFAULT 'es',
    "status" "cart_status" NOT NULL DEFAULT 'active',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" UUID NOT NULL,
    "cart_id" UUID NOT NULL,
    "tour_id" UUID NOT NULL,
    "departure_id" UUID,
    "travel_date" DATE NOT NULL,
    "subtotal_amount" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "price_locked_until" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_item_lines" (
    "id" UUID NOT NULL,
    "cart_item_id" UUID NOT NULL,
    "rate_id" UUID,
    "pax_type" "pax_type" NOT NULL,
    "residency" "residency" NOT NULL,
    "quantity" SMALLINT NOT NULL,
    "unit_amount" BIGINT NOT NULL,
    "line_amount" BIGINT NOT NULL,

    CONSTRAINT "cart_item_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_holds" (
    "id" UUID NOT NULL,
    "departure_id" UUID NOT NULL,
    "cart_item_id" UUID,
    "booking_item_id" UUID,
    "quantity" SMALLINT NOT NULL,
    "status" "hold_status" NOT NULL DEFAULT 'active',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "released_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inventory_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "customer_id" UUID NOT NULL,
    "cart_id" UUID,
    "status" "booking_status" NOT NULL DEFAULT 'pending',
    "source" "booking_source" NOT NULL DEFAULT 'web',
    "locale" "locale" NOT NULL DEFAULT 'es',
    "currency" CHAR(3) NOT NULL,
    "subtotal_amount" BIGINT NOT NULL,
    "discount_amount" BIGINT NOT NULL DEFAULT 0,
    "total_amount" BIGINT NOT NULL,
    "payment_option" "payment_option" NOT NULL DEFAULT 'deposit',
    "deposit_percent" SMALLINT NOT NULL DEFAULT 50,
    "deposit_amount" BIGINT NOT NULL,
    "balance_amount" BIGINT NOT NULL,
    "balance_due_at" TIMESTAMPTZ(6),
    "paid_amount" BIGINT NOT NULL DEFAULT 0,
    "refunded_amount" BIGINT NOT NULL DEFAULT 0,
    "hold_expires_at" TIMESTAMPTZ(6),
    "first_service_date" DATE NOT NULL,
    "last_service_date" DATE NOT NULL,
    "cancellation_policy_version" VARCHAR(40) NOT NULL,
    "terms_version" VARCHAR(40) NOT NULL,
    "customer_notes" VARCHAR(2000),
    "internal_notes" TEXT,
    "created_by_user_id" UUID,
    "confirmed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "cancellation_reason" VARCHAR(500),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_items" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "tour_id" UUID NOT NULL,
    "departure_id" UUID,
    "travel_date" DATE NOT NULL,
    "status" "booking_item_status" NOT NULL DEFAULT 'active',
    "tour_title" VARCHAR(200) NOT NULL,
    "pax_count" SMALLINT NOT NULL,
    "subtotal_amount" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "pickup_location" VARCHAR(300),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "booking_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_item_lines" (
    "id" UUID NOT NULL,
    "booking_item_id" UUID NOT NULL,
    "rate_id" UUID,
    "pax_type" "pax_type" NOT NULL,
    "residency" "residency" NOT NULL,
    "quantity" SMALLINT NOT NULL,
    "unit_amount" BIGINT NOT NULL,
    "line_amount" BIGINT NOT NULL,

    CONSTRAINT "booking_item_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travelers" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "booking_item_id" UUID,
    "is_lead" BOOLEAN NOT NULL DEFAULT false,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "pax_type" "pax_type" NOT NULL,
    "residency" "residency" NOT NULL,
    "nationality" CHAR(2),
    "birth_date" DATE,
    "document_type" "document_type",
    "document_number_enc" BYTEA,
    "document_hash" BYTEA,
    "phone_enc" BYTEA,
    "special_needs_enc" BYTEA,
    "anonymized_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "travelers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_status_history" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "from_status" "booking_status",
    "to_status" "booking_status" NOT NULL,
    "reason" VARCHAR(500),
    "actor_type" "actor_type" NOT NULL,
    "actor_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "kind" "payment_kind" NOT NULL,
    "provider" "payment_provider" NOT NULL,
    "method" "payment_method",
    "status" "payment_status" NOT NULL DEFAULT 'pending',
    "amount" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "exchange_rate" DECIMAL(18,8),
    "booking_currency_amount" BIGINT NOT NULL,
    "provider_payment_id" VARCHAR(120),
    "idempotency_key" VARCHAR(100) NOT NULL,
    "parent_payment_id" UUID,
    "failure_code" VARCHAR(80),
    "failure_message" VARCHAR(500),
    "raw" JSONB,
    "recorded_by_user_id" UUID,
    "succeeded_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" UUID NOT NULL,
    "provider" "payment_provider" NOT NULL,
    "event_id" VARCHAR(160) NOT NULL,
    "event_type" VARCHAR(80) NOT NULL,
    "payment_id" UUID,
    "signature_valid" BOOLEAN NOT NULL,
    "payload" JSONB NOT NULL,
    "processing_status" "event_processing_status" NOT NULL DEFAULT 'received',
    "attempts" SMALLINT NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "phone_enc" BYTEA,
    "country" CHAR(2),
    "preferred_locale" "locale" NOT NULL DEFAULT 'es',
    "password_hash" TEXT,
    "email_verified_at" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "anonymized_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "full_name" VARCHAR(160) NOT NULL,
    "role" "user_role" NOT NULL,
    "status" "account_status" NOT NULL DEFAULT 'active',
    "password_hash" TEXT NOT NULL,
    "mfa_secret_enc" BYTEA,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "customer_id" UUID,
    "user_id" UUID,
    "token_hash" BYTEA NOT NULL,
    "family_id" UUID NOT NULL,
    "replaced_by_id" UUID,
    "ip" INET,
    "user_agent" VARCHAR(400),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "purpose" "consent_purpose" NOT NULL,
    "policy_version" VARCHAR(40) NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "ip" INET,
    "user_agent" VARCHAR(400),
    "source" VARCHAR(40) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_sequences" (
    "scope" "sequence_scope" NOT NULL,
    "year" SMALLINT NOT NULL,
    "series" VARCHAR(4) NOT NULL DEFAULT '-',
    "last_value" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("scope","year","series")
);

-- CreateTable
CREATE TABLE "complaints" (
    "id" UUID NOT NULL,
    "year" SMALLINT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "type" "complaint_type" NOT NULL,
    "status" "complaint_status" NOT NULL DEFAULT 'received',
    "booking_id" UUID,
    "consumer_name" VARCHAR(200) NOT NULL,
    "consumer_doc_type" "document_type" NOT NULL,
    "consumer_doc_enc" BYTEA NOT NULL,
    "consumer_doc_hash" BYTEA NOT NULL,
    "consumer_address" VARCHAR(300),
    "consumer_email" VARCHAR(254) NOT NULL,
    "consumer_phone_enc" BYTEA,
    "is_minor" BOOLEAN NOT NULL DEFAULT false,
    "guardian_name" VARCHAR(200),
    "good_type" "contracted_good_type" NOT NULL DEFAULT 'service',
    "good_description" VARCHAR(500) NOT NULL,
    "claimed_amount" BIGINT,
    "claimed_currency" CHAR(3),
    "detail" TEXT NOT NULL,
    "consumer_request" TEXT NOT NULL,
    "response_text" TEXT,
    "responded_at" TIMESTAMPTZ(6),
    "responded_by_user_id" UUID,
    "response_due_at" TIMESTAMPTZ(6) NOT NULL,
    "acknowledgment_sent_at" TIMESTAMPTZ(6),
    "ip" INET,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "payment_id" UUID,
    "doc_type" "invoice_doc_type" NOT NULL,
    "series" VARCHAR(4) NOT NULL,
    "number" INTEGER NOT NULL,
    "issue_date" DATE NOT NULL,
    "receiver_doc_type" "document_type" NOT NULL,
    "receiver_doc_enc" BYTEA NOT NULL,
    "receiver_name" VARCHAR(200) NOT NULL,
    "receiver_address" VARCHAR(300),
    "currency" CHAR(3) NOT NULL,
    "taxable_amount" BIGINT NOT NULL,
    "exempt_amount" BIGINT NOT NULL DEFAULT 0,
    "igv_amount" BIGINT NOT NULL,
    "total_amount" BIGINT NOT NULL,
    "exchange_rate" DECIMAL(18,8),
    "sunat_status" "sunat_status" NOT NULL DEFAULT 'pending',
    "sunat_response_code" VARCHAR(10),
    "sunat_message" VARCHAR(500),
    "digest_value" VARCHAR(100),
    "xml_storage_key" TEXT,
    "cdr_storage_key" TEXT,
    "pdf_storage_key" TEXT,
    "related_invoice_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" UUID NOT NULL,
    "author_user_id" UUID,
    "status" "publication_status" NOT NULL DEFAULT 'draft',
    "cover_storage_key" TEXT,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_post_translations" (
    "id" UUID NOT NULL,
    "blog_post_id" UUID NOT NULL,
    "locale" "locale" NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "excerpt" VARCHAR(400),
    "body" TEXT NOT NULL,
    "seo_title" VARCHAR(70),
    "seo_description" VARCHAR(170),
    "search_text" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "blog_post_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "testimonials" (
    "id" UUID NOT NULL,
    "customer_id" UUID,
    "tour_id" UUID,
    "author_name" VARCHAR(120) NOT NULL,
    "author_country" CHAR(2),
    "locale" "locale" NOT NULL DEFAULT 'es',
    "rating" SMALLINT NOT NULL,
    "body" VARCHAR(3000) NOT NULL,
    "publish_consent" BOOLEAN NOT NULL DEFAULT false,
    "status" "moderation_status" NOT NULL DEFAULT 'pending',
    "approved_by_user_id" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_type" "actor_type" NOT NULL,
    "actor_id" UUID,
    "entity_type" VARCHAR(60) NOT NULL,
    "entity_id" UUID,
    "action" VARCHAR(40) NOT NULL,
    "changed_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "before" JSONB,
    "after" JSONB,
    "request_id" VARCHAR(64),
    "ip" INET,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "aggregate_type" VARCHAR(60) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "event_type" VARCHAR(80) NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" SMALLINT NOT NULL DEFAULT 0,
    "available_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(6),
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "destinations_slug_key" ON "destinations"("slug");

-- CreateIndex
CREATE INDEX "destinations_parent_id_idx" ON "destinations"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "destination_translations_destination_id_locale_key" ON "destination_translations"("destination_id", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "category_translations_category_id_locale_key" ON "category_translations"("category_id", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "tours_slug_key" ON "tours"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tours_code_key" ON "tours"("code");

-- CreateIndex
CREATE INDEX "tours_category_id_status_idx" ON "tours"("category_id", "status") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "tours_status_is_featured_idx" ON "tours"("status", "is_featured");

-- CreateIndex
CREATE INDEX "tour_translations_search_text_idx" ON "tour_translations" USING GIN ("search_text" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "tour_translations_tour_id_locale_key" ON "tour_translations"("tour_id", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "tour_translations_locale_slug_key" ON "tour_translations"("locale", "slug");

-- CreateIndex
CREATE INDEX "tour_media_tour_id_sort_order_idx" ON "tour_media"("tour_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "tour_media_one_cover_per_tour_key" ON "tour_media"("tour_id", "is_cover") WHERE (is_cover);

-- CreateIndex
CREATE INDEX "tour_destinations_destination_id_idx" ON "tour_destinations"("destination_id");

-- CreateIndex
CREATE UNIQUE INDEX "tour_destinations_one_primary_key" ON "tour_destinations"("tour_id", "is_primary") WHERE (is_primary);

-- CreateIndex
CREATE UNIQUE INDEX "legacy_redirects_from_path_key" ON "legacy_redirects"("from_path");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_code_key" ON "seasons"("code");

-- CreateIndex
CREATE INDEX "seasons_start_date_end_date_idx" ON "seasons"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "rates_tour_id_currency_residency_valid_from_valid_to_idx" ON "rates"("tour_id", "currency", "residency", "valid_from", "valid_to") WHERE (is_active AND deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "rates_season_id_idx" ON "rates"("season_id");

-- CreateIndex
CREATE INDEX "departures_departure_date_tour_id_idx" ON "departures"("departure_date", "tour_id") WHERE (NOT is_closed);

-- CreateIndex
CREATE UNIQUE INDEX "departures_tour_id_departure_date_start_time_key" ON "departures"("tour_id", "departure_date", "start_time");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_rate_date_base_currency_quote_currency_sourc_key" ON "exchange_rates"("rate_date", "base_currency", "quote_currency", "source");

-- CreateIndex
CREATE UNIQUE INDEX "carts_token_hash_key" ON "carts"("token_hash");

-- CreateIndex
CREATE INDEX "carts_expires_at_idx" ON "carts"("expires_at") WHERE (status = 'active');

-- CreateIndex
CREATE UNIQUE INDEX "carts_one_active_per_customer_key" ON "carts"("customer_id", "status") WHERE (status = 'active' AND customer_id IS NOT NULL);

-- CreateIndex
CREATE INDEX "cart_items_cart_id_idx" ON "cart_items"("cart_id");

-- CreateIndex
CREATE INDEX "cart_items_departure_id_idx" ON "cart_items"("departure_id");

-- CreateIndex
CREATE UNIQUE INDEX "cart_item_lines_cart_item_id_pax_type_residency_key" ON "cart_item_lines"("cart_item_id", "pax_type", "residency");

-- CreateIndex
CREATE INDEX "inventory_holds_expires_at_idx" ON "inventory_holds"("expires_at") WHERE (status = 'active');

-- CreateIndex
CREATE INDEX "inventory_holds_departure_id_status_idx" ON "inventory_holds"("departure_id", "status");

-- CreateIndex
CREATE INDEX "inventory_holds_cart_item_id_idx" ON "inventory_holds"("cart_item_id");

-- CreateIndex
CREATE INDEX "inventory_holds_booking_item_id_idx" ON "inventory_holds"("booking_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_code_key" ON "bookings"("code");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_cart_id_key" ON "bookings"("cart_id");

-- CreateIndex
CREATE INDEX "bookings_customer_id_created_at_idx" ON "bookings"("customer_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "bookings_status_created_at_idx" ON "bookings"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "bookings_balance_due_at_idx" ON "bookings"("balance_due_at") WHERE (status = 'partially_paid');

-- CreateIndex
CREATE INDEX "bookings_hold_expires_at_idx" ON "bookings"("hold_expires_at") WHERE (status = 'held');

-- CreateIndex
CREATE INDEX "bookings_first_service_date_idx" ON "bookings"("first_service_date");

-- CreateIndex
CREATE INDEX "booking_items_booking_id_idx" ON "booking_items"("booking_id");

-- CreateIndex
CREATE INDEX "booking_items_departure_id_idx" ON "booking_items"("departure_id");

-- CreateIndex
CREATE INDEX "booking_items_tour_id_travel_date_idx" ON "booking_items"("tour_id", "travel_date");

-- CreateIndex
CREATE UNIQUE INDEX "booking_item_lines_booking_item_id_pax_type_residency_key" ON "booking_item_lines"("booking_item_id", "pax_type", "residency");

-- CreateIndex
CREATE INDEX "travelers_booking_id_idx" ON "travelers"("booking_id");

-- CreateIndex
CREATE INDEX "travelers_booking_item_id_idx" ON "travelers"("booking_item_id");

-- CreateIndex
CREATE INDEX "travelers_document_hash_idx" ON "travelers"("document_hash");

-- CreateIndex
CREATE INDEX "booking_status_history_booking_id_created_at_idx" ON "booking_status_history"("booking_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "payments_booking_id_created_at_idx" ON "payments"("booking_id", "created_at");

-- CreateIndex
CREATE INDEX "payments_status_created_at_idx" ON "payments"("status", "created_at");

-- CreateIndex
CREATE INDEX "payments_parent_payment_id_idx" ON "payments"("parent_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_provider_payment_id_key" ON "payments"("provider", "provider_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_one_succeeded_deposit_or_full_key" ON "payments"("booking_id", "status") WHERE (status = 'succeeded' AND kind IN ('deposit','full'));

-- CreateIndex
CREATE INDEX "payment_events_payment_id_idx" ON "payment_events"("payment_id");

-- CreateIndex
CREATE INDEX "payment_events_received_at_idx" ON "payment_events"("received_at") WHERE (processing_status IN ('received','failed'));

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_provider_event_id_key" ON "payment_events"("provider", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_token_hash_key" ON "auth_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "auth_sessions_customer_id_idx" ON "auth_sessions"("customer_id") WHERE (revoked_at IS NULL);

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id") WHERE (revoked_at IS NULL);

-- CreateIndex
CREATE INDEX "auth_sessions_family_id_idx" ON "auth_sessions"("family_id");

-- CreateIndex
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "consents_customer_id_purpose_created_at_idx" ON "consents"("customer_id", "purpose", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "complaints_code_key" ON "complaints"("code");

-- CreateIndex
CREATE INDEX "complaints_status_response_due_at_idx" ON "complaints"("status", "response_due_at");

-- CreateIndex
CREATE INDEX "complaints_booking_id_idx" ON "complaints"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "complaints_year_sequence_key" ON "complaints"("year", "sequence");

-- CreateIndex
CREATE INDEX "invoices_booking_id_idx" ON "invoices"("booking_id");

-- CreateIndex
CREATE INDEX "invoices_payment_id_idx" ON "invoices"("payment_id");

-- CreateIndex
CREATE INDEX "invoices_created_at_idx" ON "invoices"("created_at") WHERE (sunat_status IN ('pending','sent'));

-- CreateIndex
CREATE UNIQUE INDEX "invoices_doc_type_series_number_key" ON "invoices"("doc_type", "series", "number");

-- CreateIndex
CREATE INDEX "blog_posts_status_published_at_idx" ON "blog_posts"("status", "published_at" DESC);

-- CreateIndex
CREATE INDEX "blog_post_translations_search_text_idx" ON "blog_post_translations" USING GIN ("search_text" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "blog_post_translations_blog_post_id_locale_key" ON "blog_post_translations"("blog_post_id", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "blog_post_translations_locale_slug_key" ON "blog_post_translations"("locale", "slug");

-- CreateIndex
CREATE INDEX "testimonials_tour_id_status_idx" ON "testimonials"("tour_id", "status");

-- CreateIndex
CREATE INDEX "testimonials_status_created_at_idx" ON "testimonials"("status", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_occurred_at_idx" ON "audit_log"("entity_type", "entity_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_log_actor_id_occurred_at_idx" ON "audit_log"("actor_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_log_occurred_at_idx" ON "audit_log"("occurred_at");

-- CreateIndex
CREATE INDEX "outbox_events_available_at_idx" ON "outbox_events"("available_at") WHERE (published_at IS NULL);

-- AddForeignKey
ALTER TABLE "destinations" ADD CONSTRAINT "destinations_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "destination_translations" ADD CONSTRAINT "destination_translations_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_translations" ADD CONSTRAINT "category_translations_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tours" ADD CONSTRAINT "tours_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_translations" ADD CONSTRAINT "tour_translations_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_media" ADD CONSTRAINT "tour_media_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_destinations" ADD CONSTRAINT "tour_destinations_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_destinations" ADD CONSTRAINT "tour_destinations_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rates" ADD CONSTRAINT "rates_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "tours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rates" ADD CONSTRAINT "rates_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departures" ADD CONSTRAINT "departures_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "tours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "tours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_departure_id_fkey" FOREIGN KEY ("departure_id") REFERENCES "departures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_item_lines" ADD CONSTRAINT "cart_item_lines_cart_item_id_fkey" FOREIGN KEY ("cart_item_id") REFERENCES "cart_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_holds" ADD CONSTRAINT "inventory_holds_departure_id_fkey" FOREIGN KEY ("departure_id") REFERENCES "departures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_holds" ADD CONSTRAINT "inventory_holds_cart_item_id_fkey" FOREIGN KEY ("cart_item_id") REFERENCES "cart_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_holds" ADD CONSTRAINT "inventory_holds_booking_item_id_fkey" FOREIGN KEY ("booking_item_id") REFERENCES "booking_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "tours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_departure_id_fkey" FOREIGN KEY ("departure_id") REFERENCES "departures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_item_lines" ADD CONSTRAINT "booking_item_lines_booking_item_id_fkey" FOREIGN KEY ("booking_item_id") REFERENCES "booking_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travelers" ADD CONSTRAINT "travelers_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travelers" ADD CONSTRAINT "travelers_booking_item_id_fkey" FOREIGN KEY ("booking_item_id") REFERENCES "booking_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_parent_payment_id_fkey" FOREIGN KEY ("parent_payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_responded_by_user_id_fkey" FOREIGN KEY ("responded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_related_invoice_id_fkey" FOREIGN KEY ("related_invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_post_translations" ADD CONSTRAINT "blog_post_translations_blog_post_id_fkey" FOREIGN KEY ("blog_post_id") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "tours"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
