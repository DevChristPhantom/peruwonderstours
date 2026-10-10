-- Sprint 3: origen de los testimonios. Los del sitio viejo (data/seed/testimonials.json) ya eran
-- públicos: se cargan aprobados con origin = 'legacy_site' y su fuente; los nuevos del formulario
-- web exigen consentimiento de publicación (publish_consent) y moderación previa.
-- Generada con `prisma migrate diff` (sin drift: solo estas columnas).
-- Reverso: ALTER TABLE testimonials DROP COLUMN origin, DROP COLUMN source, DROP COLUMN source_url;
ALTER TABLE "testimonials" ADD COLUMN     "origin" VARCHAR(20) NOT NULL DEFAULT 'web',
ADD COLUMN     "source" VARCHAR(60),
ADD COLUMN     "source_url" VARCHAR(500);

ALTER TABLE "testimonials"
  ADD CONSTRAINT "testimonials_origin_ck" CHECK (origin IN ('web', 'legacy_site', 'admin')),
  -- Un testimonio enviado por la web solo se publica con consentimiento del autor.
  ADD CONSTRAINT "testimonials_web_consent_ck" CHECK (origin <> 'web' OR status <> 'approved' OR publish_consent);
