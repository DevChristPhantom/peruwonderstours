DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'pt_unaccent') THEN
  CREATE TEXT SEARCH CONFIGURATION pt_unaccent (COPY = pg_catalog.portuguese);
  ALTER TEXT SEARCH CONFIGURATION pt_unaccent ALTER MAPPING FOR hword, hword_part, word WITH unaccent, portuguese_stem;
 END IF;
END $$;

CREATE OR REPLACE FUNCTION tour_translations_search_refresh()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  cfg regconfig := CASE NEW.locale WHEN 'pt' THEN 'pt_unaccent'::regconfig WHEN 'en' THEN 'en_unaccent'::regconfig
                                   ELSE 'es_unaccent'::regconfig END;
BEGIN
  NEW.search_text := lower(immutable_unaccent(NEW.title || ' ' || NEW.summary));
  NEW.search_vector :=
       setweight(to_tsvector(cfg, coalesce(NEW.title, '')), 'A')
    || setweight(to_tsvector(cfg, coalesce(NEW.summary, '')), 'B')
    || setweight(to_tsvector(cfg, coalesce(NEW.description, '')), 'C')
    || setweight(to_tsvector(cfg, coalesce(array_to_string(NEW.includes, ' '), '')), 'D');
  RETURN NEW;
END $$;
