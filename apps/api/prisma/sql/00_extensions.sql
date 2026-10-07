-- =============================================================================
-- Migración 0: extensiones y funciones base. Debe aplicarse ANTES de la migración
-- `init` generada por Prisma (el índice GIN gin_trgm_ops necesita pg_trgm).
--   pnpm prisma migrate dev --create-only --name extensions   -> pegar este archivo
-- Reverso: 00_extensions.down.sql
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- similitud trigram (búsqueda tolerante a typos)
CREATE EXTENSION IF NOT EXISTS unaccent;    -- "Cuzco" ~ "Cúzco", "Huacachina" ~ "Huácachina"
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- EXCLUDE con igualdad + rango (rates)

-- unaccent() es STABLE (depende del diccionario configurable); para usarla en índices
-- y columnas generadas se envuelve en una función IMMUTABLE con diccionario explícito.
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

-- Configuración FTS en español sin tildes: "machu picchu" encuentra "Machú Picchu".
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'es_unaccent') THEN
    CREATE TEXT SEARCH CONFIGURATION es_unaccent (COPY = pg_catalog.spanish);
    ALTER TEXT SEARCH CONFIGURATION es_unaccent
      ALTER MAPPING FOR hword, hword_part, word WITH unaccent, spanish_stem;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'en_unaccent') THEN
    CREATE TEXT SEARCH CONFIGURATION en_unaccent (COPY = pg_catalog.english);
    ALTER TEXT SEARCH CONFIGURATION en_unaccent
      ALTER MAPPING FOR hword, hword_part, word WITH unaccent, english_stem;
  END IF;
END $$;

-- UUID v7 en el servidor (PG16 no trae uuidv7(); llega en PG18). La app genera los ids
-- con Prisma uuid(7); esta función la usan los triggers (historial, auditoría).
-- 48 bits de milisegundos Unix + versión 7 + bits aleatorios de gen_random_uuid().
CREATE OR REPLACE FUNCTION uuid_generate_v7()
RETURNS uuid LANGUAGE plpgsql VOLATILE PARALLEL SAFE AS $$
DECLARE
  v  bytea  := uuid_send(gen_random_uuid());
  ms bigint := floor(extract(epoch FROM clock_timestamp()) * 1000);
BEGIN
  v := overlay(v PLACING substring(int8send(ms) FROM 3) FROM 1 FOR 6);
  v := set_byte(v, 6, (get_byte(v, 6) & 15) | 112);   -- nibble de versión = 7
  RETURN encode(v, 'hex')::uuid;                       -- variante RFC 9562 heredada de v4
END $$;
