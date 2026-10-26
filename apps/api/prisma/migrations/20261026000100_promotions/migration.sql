-- Eventos y campañas destacadas (sección «Lo más relevante» y anuncio emergente de la home).
-- CreateTable
CREATE TABLE "promotions" (
    "id" UUID NOT NULL,
    "status" "publication_status" NOT NULL DEFAULT 'draft',
    "starts_at" TIMESTAMPTZ(6),
    "ends_at" TIMESTAMPTZ(6),
    "event_starts_on" DATE,
    "event_ends_on" DATE,
    "cover_storage_key" TEXT,
    "cta_kind" VARCHAR(20) NOT NULL DEFAULT 'whatsapp',
    "tour_id" UUID,
    "cta_path" VARCHAR(300),
    "show_popup" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_translations" (
    "id" UUID NOT NULL,
    "promotion_id" UUID NOT NULL,
    "locale" "locale" NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "eyebrow" VARCHAR(80),
    "summary" VARCHAR(400) NOT NULL,
    "cta_label" VARCHAR(60),
    "whatsapp_message" VARCHAR(300),
    "translation_status" VARCHAR(40),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "promotion_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "promotions_status_sort_order_idx" ON "promotions"("status", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_translations_promotion_id_locale_key" ON "promotion_translations"("promotion_id", "locale");

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "tours"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_translations" ADD CONSTRAINT "promotion_translations_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Reglas que la base garantiza aunque falle la validación de la aplicación.
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_cta_kind_check" CHECK ("cta_kind" IN ('tour', 'page', 'whatsapp'));
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_window_check" CHECK ("starts_at" IS NULL OR "ends_at" IS NULL OR "ends_at" > "starts_at");
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_event_dates_check" CHECK ("event_starts_on" IS NULL OR "event_ends_on" IS NULL OR "event_ends_on" >= "event_starts_on");
-- Solo rutas internas del sitio: nunca URLs externas (evita redirecciones abiertas desde un anuncio).
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_cta_path_check" CHECK ("cta_path" IS NULL OR ("cta_path" ~ '^/[a-z0-9/_-]*$' AND "cta_path" NOT LIKE '//%'));
