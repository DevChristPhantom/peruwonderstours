-- Sprint 1 (E8): Libro de Reclamaciones virtual según brain/wiki/normativa/libro-de-reclamaciones.md
-- (Ley 29571 arts. 150-152, Ley 32495, D.S. 011-2011-PCM y modificatorias, Anexo I D.S. 101-2022-PCM).
-- La tabla complaints estaba vacía al crear esta migración (columnas NOT NULL sin default).
-- Reverso: DROP TABLE business_holidays; ALTER TABLE complaints DROP COLUMN (las agregadas abajo)
--          y DROP CONSTRAINT de los CHECK nuevos; restaurar complaints_minor_ck original;
--          DROP TYPE complaint_channel, complaint_response_channel.

-- CreateEnum
CREATE TYPE "complaint_response_channel" AS ENUM ('email', 'letter');

-- CreateEnum
CREATE TYPE "complaint_channel" AS ENUM ('web', 'backup_book', 'office_assisted');

-- AlterTable
ALTER TABLE "complaints" ADD COLUMN     "access_token_hash" CHAR(64),
ADD COLUMN     "acknowledgment_delivery_ref" VARCHAR(200),
ADD COLUMN     "backup_sheet_number" VARCHAR(40),
ADD COLUMN     "channel" "complaint_channel" NOT NULL DEFAULT 'web',
ADD COLUMN     "conformity_accepted_at" TIMESTAMPTZ(6),
ADD COLUMN     "conformity_text_version" VARCHAR(40),
ADD COLUMN     "declared_type" "complaint_type",
ADD COLUMN     "establishment_address" VARCHAR(300) NOT NULL,
ADD COLUMN     "establishment_code" VARCHAR(20) NOT NULL,
ADD COLUMN     "guardian_address" VARCHAR(300),
ADD COLUMN     "guardian_email" VARCHAR(254),
ADD COLUMN     "guardian_phone_enc" BYTEA,
ADD COLUMN     "pdf_sha256" CHAR(64),
ADD COLUMN     "privacy_notice_version" VARCHAR(40),
ADD COLUMN     "provider_legal_name" VARCHAR(200) NOT NULL,
ADD COLUMN     "provider_ruc" VARCHAR(20) NOT NULL,
ADD COLUMN     "response_channel" "complaint_response_channel" NOT NULL DEFAULT 'email',
ADD COLUMN     "response_delivery_ref" VARCHAR(200),
ADD COLUMN     "response_sent_at" TIMESTAMPTZ(6),
ADD COLUMN     "settlement_acceptance_evidence" TEXT,
ADD COLUMN     "settlement_accepted_at" TIMESTAMPTZ(6),
ADD COLUMN     "settlement_offer_text" TEXT,
ADD COLUMN     "settlement_offered_at" TIMESTAMPTZ(6),
ADD COLUMN     "transcribed_at" TIMESTAMPTZ(6),
ALTER COLUMN "consumer_address" SET NOT NULL;

-- Integridad de la hoja (lo que Prisma no modela).
ALTER TABLE "complaints" DROP CONSTRAINT "complaints_minor_ck";
ALTER TABLE "complaints"
  -- Menor de edad: datos completos de padre, madre o representante (art. 5; Anexo I).
  ADD CONSTRAINT "complaints_minor_ck" CHECK (
        NOT is_minor
     OR (guardian_name IS NOT NULL AND guardian_address IS NOT NULL
         AND guardian_phone_enc IS NOT NULL AND guardian_email IS NOT NULL)),
  ADD CONSTRAINT "complaints_guardian_email_lower_ck" CHECK (guardian_email IS NULL OR guardian_email = lower(guardian_email)),
  ADD CONSTRAINT "complaints_provider_ck" CHECK (
        length(btrim(provider_legal_name)) > 0 AND length(btrim(provider_ruc)) > 0
    AND length(btrim(establishment_address)) > 0 AND length(btrim(establishment_code)) > 0),
  -- Libro virtual: la conformidad sustituye la firma (casilla + fecha/hora + versión del texto).
  ADD CONSTRAINT "complaints_conformity_ck" CHECK (
        channel <> 'web' OR (conformity_accepted_at IS NOT NULL AND conformity_text_version IS NOT NULL)),
  -- Libro de respaldo: número de hoja física y fecha de transcripción (art. 4-A).
  ADD CONSTRAINT "complaints_backup_ck" CHECK (
        channel <> 'backup_book' OR (backup_sheet_number IS NOT NULL AND transcribed_at IS NOT NULL)),
  ADD CONSTRAINT "complaints_response_sent_ck" CHECK (
        response_sent_at IS NULL OR (responded_at IS NOT NULL AND response_sent_at >= responded_at)),
  ADD CONSTRAINT "complaints_settlement_ck" CHECK (
        (settlement_accepted_at IS NULL OR (settlement_offered_at IS NOT NULL AND settlement_accepted_at >= settlement_offered_at))
    AND (settlement_offered_at IS NULL OR settlement_offer_text IS NOT NULL)
    AND (status <> 'settled' OR (settlement_accepted_at IS NOT NULL AND settlement_acceptance_evidence IS NOT NULL))),
  ADD CONSTRAINT "complaints_pdf_sha256_ck" CHECK (pdf_sha256 IS NULL OR pdf_sha256 ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "complaints_access_token_hash_ck" CHECK (access_token_hash IS NULL OR access_token_hash ~ '^[0-9a-f]{64}$');

-- CreateTable
CREATE TABLE "business_holidays" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "holiday_date" DATE NOT NULL,
    "scope" VARCHAR(10) NOT NULL DEFAULT 'national',
    "name" VARCHAR(120) NOT NULL,
    "source" VARCHAR(300),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "business_holidays_holiday_date_scope_key" ON "business_holidays"("holiday_date", "scope");

ALTER TABLE "business_holidays"
  ADD CONSTRAINT "business_holidays_scope_ck" CHECK (scope = 'national' OR scope ~ '^PE-[A-Z]{3}$');

-- Feriados nacionales 2026-2027 (régimen laboral privado). [A VALIDAR CON ASESOR LEGAL]
-- Mismo listado que src/modules/complaints/infrastructure/peru-national-holidays.ts (modo memoria).
-- Los días no laborables que declare el Ejecutivo se agregan con nuevas filas.
INSERT INTO "business_holidays" ("holiday_date", "scope", "name", "source") VALUES
  ('2026-01-01', 'national', 'Año Nuevo', 'D. Leg. 713, art. 6 [A VALIDAR]'),
  ('2026-04-02', 'national', 'Jueves Santo', 'D. Leg. 713, art. 6 [A VALIDAR]'),
  ('2026-04-03', 'national', 'Viernes Santo', 'D. Leg. 713, art. 6 [A VALIDAR]'),
  ('2026-05-01', 'national', 'Día del Trabajo', 'D. Leg. 713, art. 6 [A VALIDAR]'),
  ('2026-06-07', 'national', 'Batalla de Arica y Día de la Bandera', '[A VALIDAR]'),
  ('2026-06-29', 'national', 'San Pedro y San Pablo', 'D. Leg. 713, art. 6 [A VALIDAR]'),
  ('2026-07-23', 'national', 'Día de la Fuerza Aérea del Perú', '[A VALIDAR]'),
  ('2026-07-28', 'national', 'Fiestas Patrias', 'D. Leg. 713, art. 6 [A VALIDAR]'),
  ('2026-07-29', 'national', 'Fiestas Patrias', 'D. Leg. 713, art. 6 [A VALIDAR]'),
  ('2026-08-06', 'national', 'Batalla de Junín', '[A VALIDAR]'),
  ('2026-08-30', 'national', 'Santa Rosa de Lima', 'D. Leg. 713, art. 6 [A VALIDAR]'),
  ('2026-10-08', 'national', 'Combate de Angamos', 'D. Leg. 713, art. 6 [A VALIDAR]'),
  ('2026-11-01', 'national', 'Todos los Santos', 'D. Leg. 713, art. 6 [A VALIDAR]'),
  ('2026-12-08', 'national', 'Inmaculada Concepción', 'D. Leg. 713, art. 6 [A VALIDAR]'),
  ('2026-12-09', 'national', 'Batalla de Ayacucho', '[A VALIDAR]'),
  ('2026-12-25', 'national', 'Navidad', 'D. Leg. 713, art. 6 [A VALIDAR]'),
  ('2027-01-01', 'national', 'Año Nuevo', 'D. Leg. 713, art. 6 [A VALIDAR]'),
  ('2027-03-25', 'national', 'Jueves Santo', 'D. Leg. 713, art. 6 [A VALIDAR]'),
  ('2027-03-26', 'national', 'Viernes Santo', 'D. Leg. 713, art. 6 [A VALIDAR]'),
  ('2027-05-01', 'national', 'Día del Trabajo', 'D. Leg. 713, art. 6 [A VALIDAR]'),
  ('2027-06-07', 'national', 'Batalla de Arica y Día de la Bandera', '[A VALIDAR]'),
  ('2027-06-29', 'national', 'San Pedro y San Pablo', 'D. Leg. 713, art. 6 [A VALIDAR]'),
  ('2027-07-23', 'national', 'Día de la Fuerza Aérea del Perú', '[A VALIDAR]'),
  ('2027-07-28', 'national', 'Fiestas Patrias', 'D. Leg. 713, art. 6 [A VALIDAR]'),
  ('2027-07-29', 'national', 'Fiestas Patrias', 'D. Leg. 713, art. 6 [A VALIDAR]'),
  ('2027-08-06', 'national', 'Batalla de Junín', '[A VALIDAR]'),
  ('2027-08-30', 'national', 'Santa Rosa de Lima', 'D. Leg. 713, art. 6 [A VALIDAR]'),
  ('2027-10-08', 'national', 'Combate de Angamos', 'D. Leg. 713, art. 6 [A VALIDAR]'),
  ('2027-11-01', 'national', 'Todos los Santos', 'D. Leg. 713, art. 6 [A VALIDAR]'),
  ('2027-12-08', 'national', 'Inmaculada Concepción', 'D. Leg. 713, art. 6 [A VALIDAR]'),
  ('2027-12-09', 'national', 'Batalla de Ayacucho', '[A VALIDAR]'),
  ('2027-12-25', 'national', 'Navidad', 'D. Leg. 713, art. 6 [A VALIDAR]')
ON CONFLICT ("holiday_date", "scope") DO NOTHING;
