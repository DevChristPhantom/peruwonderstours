-- Sprint 3: los testimonios heredados del sitio viejo (origin legacy_site, p. ej. reseñas públicas de
-- TripAdvisor) se aprueban sin la casilla de consentimiento del formulario web; los enviados por la web
-- (origin web) siguen exigiendo publish_consent. Sustituye testimonials_approved_ck y la regla
-- redundante testimonials_web_consent_ck de 20261009000500. Migración SQL pura (sin cambios de schema.prisma).
-- Reverso: restaurar CHECK (status <> 'approved' OR (publish_consent AND approved_at IS NOT NULL)).
ALTER TABLE "testimonials" DROP CONSTRAINT "testimonials_web_consent_ck";
ALTER TABLE "testimonials" DROP CONSTRAINT "testimonials_approved_ck";
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_approved_ck" CHECK (
  status <> 'approved' OR (approved_at IS NOT NULL AND (publish_consent OR origin <> 'web')));
