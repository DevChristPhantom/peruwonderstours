-- Sprint 2: valores nuevos de enums existentes. Migración aislada: un valor nuevo de enum no
-- puede usarse en la misma transacción en que se agrega (CHECK/índices de la siguiente).
-- Reverso: PostgreSQL no permite DROP VALUE (habría que recrear el tipo; no previsto).
-- Finalidades de consentimiento v2 (brain/wiki/normativa/proteccion-de-datos.md §2.3 y §3).
-- `privacy_policy`, `terms_and_conditions` y `marketing` quedan OBSOLETOS (no se escriben más).
ALTER TYPE "consent_purpose" ADD VALUE IF NOT EXISTS 'marketing_email';
ALTER TYPE "consent_purpose" ADD VALUE IF NOT EXISTS 'marketing_whatsapp';
ALTER TYPE "consent_purpose" ADD VALUE IF NOT EXISTS 'advertising_cookies';
ALTER TYPE "consent_purpose" ADD VALUE IF NOT EXISTS 'personalization';
ALTER TYPE "consent_purpose" ADD VALUE IF NOT EXISTS 'sensitive_data_health';
ALTER TYPE "consent_purpose" ADD VALUE IF NOT EXISTS 'testimonial_publication';

-- Correlativo de solicitudes ARCO (ARCO-AAAA-NNNNNN).
ALTER TYPE "sequence_scope" ADD VALUE IF NOT EXISTS 'data_subject_request';
