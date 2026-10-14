DROP TEXT SEARCH CONFIGURATION IF EXISTS pt_unaccent;
-- Reverso de 00_extensions.sql (solo tras revertir constraints.sql e init).
DROP TEXT SEARCH CONFIGURATION IF EXISTS en_unaccent;
DROP TEXT SEARCH CONFIGURATION IF EXISTS es_unaccent;
DROP FUNCTION IF EXISTS uuid_generate_v7();
DROP FUNCTION IF EXISTS immutable_unaccent(text);
DROP EXTENSION IF EXISTS btree_gist;
DROP EXTENSION IF EXISTS unaccent;
DROP EXTENSION IF EXISTS pg_trgm;
