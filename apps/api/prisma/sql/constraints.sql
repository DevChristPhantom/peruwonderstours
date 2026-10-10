-- =============================================================================
-- Peru Wonders Tours — integridad que Prisma no modela (PostgreSQL 16)
-- Aplicar DESPUÉS de la migración `init`:
--   pnpm prisma migrate dev --create-only --name db_constraints  -> pegar este archivo
--   pnpm prisma migrate dev
-- Reverso: constraints.down.sql
-- Prisma ignora CHECK, EXCLUDE, triggers y funciones (no los borra en migraciones
-- futuras). El índice GIN sobre search_vector sí puede aparecer como "drift":
-- revisar siempre el SQL generado con --create-only antes de aplicarlo.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0. Dominios reutilizables (vía CHECK por tabla)
-- -----------------------------------------------------------------------------
-- Monedas admitidas en el MVP. Ampliar aquí (y en la app) si se agrega otra.
CREATE OR REPLACE FUNCTION is_supported_currency(c char(3))
RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$ SELECT c IN ('PEN', 'USD') $$;

-- -----------------------------------------------------------------------------
-- 1. CATÁLOGO
-- -----------------------------------------------------------------------------
ALTER TABLE destinations
  ADD CONSTRAINT destinations_slug_format_ck CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  ADD CONSTRAINT destinations_latitude_ck   CHECK (latitude  BETWEEN -90  AND 90),
  ADD CONSTRAINT destinations_longitude_ck  CHECK (longitude BETWEEN -180 AND 180),
  ADD CONSTRAINT destinations_not_self_parent_ck CHECK (parent_id IS DISTINCT FROM id);

ALTER TABLE categories
  ADD CONSTRAINT categories_slug_format_ck CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

ALTER TABLE tours
  ADD CONSTRAINT tours_slug_format_ck CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  ADD CONSTRAINT tours_pax_ck CHECK (min_pax >= 1 AND (max_pax IS NULL OR max_pax >= min_pax)),
  ADD CONSTRAINT tours_duration_nonneg_ck CHECK (
        coalesce(duration_days, 0) >= 0 AND coalesce(duration_nights, 0) >= 0
    AND coalesce(duration_hours, 0) >= 0),
  -- Paquete: días/noches. Tour/traslado: horas o días.
  ADD CONSTRAINT tours_duration_by_type_ck CHECK (
        (type = 'package' AND duration_days >= 1 AND duration_nights IS NOT NULL
                          AND duration_nights BETWEEN duration_days - 1 AND duration_days)
     OR (type IN ('tour', 'transfer') AND (duration_hours > 0 OR duration_days >= 1))),
  ADD CONSTRAINT tours_deposit_override_ck CHECK (
        deposit_percent_override IS NULL OR deposit_percent_override BETWEEN 1 AND 100),
  ADD CONSTRAINT tours_cutoff_ck CHECK (booking_cutoff_hours >= 0),
  ADD CONSTRAINT tours_published_at_ck CHECK (status <> 'published' OR published_at IS NOT NULL);

ALTER TABLE tour_translations
  ADD CONSTRAINT tour_translations_slug_format_ck CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  ADD CONSTRAINT tour_translations_itinerary_array_ck CHECK (jsonb_typeof(itinerary) = 'array'),
  ADD CONSTRAINT tour_translations_faqs_array_ck CHECK (jsonb_typeof(faqs) = 'array');

ALTER TABLE tour_media
  ADD CONSTRAINT tour_media_dimensions_ck CHECK (
        (width IS NULL OR width > 0) AND (height IS NULL OR height > 0));

ALTER TABLE legacy_redirects
  ADD CONSTRAINT legacy_redirects_status_ck CHECK (status_code IN (301, 302, 307, 308)),
  ADD CONSTRAINT legacy_redirects_not_loop_ck CHECK (from_path <> to_path),
  ADD CONSTRAINT legacy_redirects_from_normalized_ck CHECK (
        from_path = lower(from_path) AND from_path LIKE '/%'),
  ADD CONSTRAINT legacy_redirects_hits_ck CHECK (hits >= 0);

ALTER TABLE blog_post_translations
  ADD CONSTRAINT blog_post_translations_slug_format_ck CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- Búsqueda: search_text (trigram, índice GIN declarado en Prisma) y search_vector (FTS).
CREATE OR REPLACE FUNCTION tour_translations_search_refresh()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  cfg regconfig := CASE NEW.locale WHEN 'en' THEN 'en_unaccent'::regconfig
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

CREATE TRIGGER tour_translations_search_trg
  BEFORE INSERT OR UPDATE OF title, summary, description, includes, locale
  ON tour_translations
  FOR EACH ROW EXECUTE FUNCTION tour_translations_search_refresh();

CREATE INDEX tour_translations_search_vector_idx
  ON tour_translations USING gin (search_vector);

CREATE OR REPLACE FUNCTION blog_post_translations_search_refresh()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_text := lower(immutable_unaccent(NEW.title || ' ' || coalesce(NEW.excerpt, '')));
  RETURN NEW;
END $$;

CREATE TRIGGER blog_post_translations_search_trg
  BEFORE INSERT OR UPDATE OF title, excerpt
  ON blog_post_translations
  FOR EACH ROW EXECUTE FUNCTION blog_post_translations_search_refresh();

-- -----------------------------------------------------------------------------
-- 2. PRECIOS E INVENTARIO
-- -----------------------------------------------------------------------------
ALTER TABLE seasons
  ADD CONSTRAINT seasons_dates_ck CHECK (end_date >= start_date);

ALTER TABLE rates
  ADD CONSTRAINT rates_amount_ck   CHECK (amount >= 0),
  ADD CONSTRAINT rates_currency_ck CHECK (is_supported_currency(currency)),
  ADD CONSTRAINT rates_validity_ck CHECK (valid_to >= valid_from),
  ADD CONSTRAINT rates_group_ck    CHECK (
        min_group_size >= 1 AND (max_group_size IS NULL OR max_group_size >= min_group_size)),
  -- Sin tarifas activas solapadas para la misma combinación (fecha y tamaño de grupo).
  ADD CONSTRAINT rates_no_overlap_ex EXCLUDE USING gist (
        tour_id WITH =,
        pax_type WITH =,
        residency WITH =,
        currency WITH =,
        (coalesce(season_id, '00000000-0000-0000-0000-000000000000'::uuid)) WITH =,
        daterange(valid_from, valid_to, '[]') WITH &&,
        int4range(min_group_size, coalesce(max_group_size, 32767), '[]') WITH &&
  ) WHERE (is_active AND deleted_at IS NULL);

ALTER TABLE departures
  ADD CONSTRAINT departures_capacity_ck CHECK (capacity >= 0),
  ADD CONSTRAINT departures_counters_ck CHECK (booked >= 0 AND held >= 0),
  -- Invariante central de inventario: nunca sobreventa.
  ADD CONSTRAINT departures_no_overbooking_ck CHECK (booked + held <= capacity),
  ADD CONSTRAINT departures_version_ck CHECK (version >= 0);

ALTER TABLE exchange_rates
  ADD CONSTRAINT exchange_rates_rate_ck CHECK (rate > 0),
  ADD CONSTRAINT exchange_rates_pair_ck CHECK (base_currency <> quote_currency);

-- -----------------------------------------------------------------------------
-- 3. CARRITO
-- -----------------------------------------------------------------------------
ALTER TABLE carts
  ADD CONSTRAINT carts_currency_ck CHECK (is_supported_currency(currency)),
  ADD CONSTRAINT carts_token_hash_len_ck CHECK (octet_length(token_hash) = 32);

ALTER TABLE cart_items
  ADD CONSTRAINT cart_items_subtotal_ck CHECK (subtotal_amount >= 0),
  ADD CONSTRAINT cart_items_currency_ck CHECK (is_supported_currency(currency));

ALTER TABLE cart_item_lines
  ADD CONSTRAINT cart_item_lines_quantity_ck CHECK (quantity > 0),
  ADD CONSTRAINT cart_item_lines_amounts_ck  CHECK (unit_amount >= 0 AND line_amount >= 0),
  ADD CONSTRAINT cart_item_lines_math_ck     CHECK (line_amount = unit_amount * quantity);

ALTER TABLE inventory_holds
  ADD CONSTRAINT inventory_holds_quantity_ck CHECK (quantity > 0),
  ADD CONSTRAINT inventory_holds_owner_ck    CHECK (num_nonnulls(cart_item_id, booking_item_id) >= 1),
  ADD CONSTRAINT inventory_holds_released_ck CHECK (
        (status IN ('released', 'expired')) = (released_at IS NOT NULL));

-- -----------------------------------------------------------------------------
-- 4. RESERVAS Y ADELANTO 50 %
-- -----------------------------------------------------------------------------
ALTER TABLE bookings
  ADD CONSTRAINT bookings_code_format_ck CHECK (code ~ '^PWT-[0-9]{4}-[0-9]{6,}$'),
  ADD CONSTRAINT bookings_currency_ck    CHECK (is_supported_currency(currency)),
  ADD CONSTRAINT bookings_amounts_nonneg_ck CHECK (
        subtotal_amount >= 0 AND discount_amount >= 0 AND total_amount >= 0
    AND deposit_amount >= 0 AND balance_amount >= 0
    AND paid_amount >= 0 AND refunded_amount >= 0),
  ADD CONSTRAINT bookings_total_math_ck   CHECK (total_amount = subtotal_amount - discount_amount),
  -- Regla del plan de pago: adelanto + saldo = total.
  ADD CONSTRAINT bookings_deposit_split_ck CHECK (deposit_amount + balance_amount = total_amount),
  ADD CONSTRAINT bookings_deposit_percent_ck CHECK (deposit_percent BETWEEN 1 AND 100),
  -- Pago total: sin saldo.
  ADD CONSTRAINT bookings_full_option_ck CHECK (
        payment_option <> 'full' OR (deposit_percent = 100 AND balance_amount = 0 AND balance_due_at IS NULL)),
  -- Con adelanto y saldo pendiente, debe existir fecha límite del saldo.
  ADD CONSTRAINT bookings_balance_due_ck CHECK (
        payment_option <> 'deposit' OR balance_amount = 0 OR balance_due_at IS NOT NULL),
  ADD CONSTRAINT bookings_paid_le_total_ck     CHECK (paid_amount <= total_amount),
  ADD CONSTRAINT bookings_refunded_le_paid_ck  CHECK (refunded_amount <= paid_amount),
  ADD CONSTRAINT bookings_service_dates_ck     CHECK (last_service_date >= first_service_date),
  -- Coherencia estado <-> datos.
  ADD CONSTRAINT bookings_held_expiry_ck   CHECK (status <> 'held' OR hold_expires_at IS NOT NULL),
  ADD CONSTRAINT bookings_partial_paid_ck  CHECK (
        status <> 'partially_paid' OR (paid_amount >= deposit_amount AND paid_amount < total_amount)),
  ADD CONSTRAINT bookings_paid_ck          CHECK (status <> 'paid' OR paid_amount = total_amount),
  ADD CONSTRAINT bookings_cancelled_at_ck  CHECK (
        status NOT IN ('cancelled', 'refunded') OR cancelled_at IS NOT NULL),
  ADD CONSTRAINT bookings_completed_at_ck  CHECK (status <> 'completed' OR completed_at IS NOT NULL);

ALTER TABLE booking_items
  ADD CONSTRAINT booking_items_subtotal_ck CHECK (subtotal_amount >= 0),
  ADD CONSTRAINT booking_items_pax_ck      CHECK (pax_count > 0),
  ADD CONSTRAINT booking_items_currency_ck CHECK (is_supported_currency(currency));

ALTER TABLE booking_item_lines
  ADD CONSTRAINT booking_item_lines_quantity_ck CHECK (quantity > 0),
  ADD CONSTRAINT booking_item_lines_amounts_ck  CHECK (unit_amount >= 0 AND line_amount >= 0),
  ADD CONSTRAINT booking_item_lines_math_ck     CHECK (line_amount = unit_amount * quantity);

ALTER TABLE travelers
  ADD CONSTRAINT travelers_document_pair_ck CHECK (
        (document_number_enc IS NULL) = (document_type IS NULL)
    AND (document_number_enc IS NULL) = (document_hash IS NULL)),
  ADD CONSTRAINT travelers_nationality_ck CHECK (nationality IS NULL OR nationality ~ '^[A-Z]{2}$');

-- Un solo viajero titular por reserva.
CREATE UNIQUE INDEX travelers_one_lead_per_booking_key
  ON travelers (booking_id) WHERE is_lead AND deleted_at IS NULL;

-- Máquina de estados de la reserva (ver brain/wiki/concepts/modelo-de-datos.md).
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

-- Valida la transición y registra el historial automáticamente.
-- La app fija el contexto por transacción:
--   SET LOCAL app.actor_type = 'customer'; SET LOCAL app.actor_id = '<uuid>';
--   SET LOCAL app.status_reason = '...';   SET LOCAL app.request_id = '...';
CREATE OR REPLACE FUNCTION bookings_status_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_actor_type actor_type := coalesce(nullif(current_setting('app.actor_type', true), ''), 'system')::actor_type;
  v_actor_id   uuid       := nullif(current_setting('app.actor_id', true), '')::uuid;
  v_reason     text       := nullif(current_setting('app.status_reason', true), '');
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status = OLD.status THEN
      RETURN NEW;
    END IF;
    IF NOT booking_status_transition_allowed(OLD.status, NEW.status) THEN
      RAISE EXCEPTION 'Transición de reserva no permitida: % -> % (booking %)',
        OLD.status, NEW.status, OLD.code USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  INSERT INTO booking_status_history (id, booking_id, from_status, to_status, reason, actor_type, actor_id, created_at)
  VALUES (uuid_generate_v7(), NEW.id,
          CASE WHEN TG_OP = 'UPDATE' THEN OLD.status END,
          NEW.status, left(v_reason, 500), v_actor_type, v_actor_id, now());
  RETURN NEW;
END $$;

CREATE TRIGGER bookings_status_guard_trg
  AFTER INSERT OR UPDATE OF status ON bookings
  FOR EACH ROW EXECUTE FUNCTION bookings_status_guard();

-- -----------------------------------------------------------------------------
-- 5. PAGOS
-- -----------------------------------------------------------------------------
ALTER TABLE payments
  ADD CONSTRAINT payments_amount_ck          CHECK (amount > 0 AND booking_currency_amount > 0),
  ADD CONSTRAINT payments_currency_ck        CHECK (is_supported_currency(currency)),
  ADD CONSTRAINT payments_exchange_rate_ck   CHECK (exchange_rate IS NULL OR exchange_rate > 0),
  ADD CONSTRAINT payments_refund_parent_ck   CHECK ((kind = 'refund') = (parent_payment_id IS NOT NULL)),
  ADD CONSTRAINT payments_succeeded_at_ck    CHECK ((status = 'succeeded') = (succeeded_at IS NOT NULL)),
  ADD CONSTRAINT payments_manual_method_ck   CHECK (
        provider <> 'manual' OR (method IN ('cash', 'bank_transfer') AND recorded_by_user_id IS NOT NULL)),
  -- Pagos en línea confirmados siempre traen ID del proveedor (conciliación).
  ADD CONSTRAINT payments_provider_id_ck     CHECK (
        provider = 'manual' OR status NOT IN ('succeeded', 'authorized') OR provider_payment_id IS NOT NULL);

ALTER TABLE payment_events
  ADD CONSTRAINT payment_events_attempts_ck CHECK (attempts >= 0);

-- -----------------------------------------------------------------------------
-- 6. CLIENTES Y AUTH
-- -----------------------------------------------------------------------------
ALTER TABLE customers
  ADD CONSTRAINT customers_email_lower_ck  CHECK (email = lower(email)),
  ADD CONSTRAINT customers_email_format_ck CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  ADD CONSTRAINT customers_country_ck      CHECK (country IS NULL OR country ~ '^[A-Z]{2}$');

ALTER TABLE users
  ADD CONSTRAINT users_email_lower_ck  CHECK (email = lower(email));

ALTER TABLE auth_sessions
  ADD CONSTRAINT auth_sessions_subject_ck CHECK (num_nonnulls(customer_id, user_id) = 1),
  ADD CONSTRAINT auth_sessions_expiry_ck  CHECK (expires_at > created_at);

-- -----------------------------------------------------------------------------
-- 7. LEGAL
-- -----------------------------------------------------------------------------
ALTER TABLE document_sequences
  ADD CONSTRAINT document_sequences_value_ck CHECK (last_value >= 0),
  ADD CONSTRAINT document_sequences_year_ck  CHECK (year = 0 OR year BETWEEN 2024 AND 2200);

-- Siguiente correlativo sin huecos (bloquea la fila hasta el COMMIT de la transacción).
-- Uso: SELECT next_document_number('complaint', 2026);  SELECT next_document_number('invoice', 0, 'B001');
CREATE OR REPLACE FUNCTION next_document_number(p_scope sequence_scope, p_year int, p_series text DEFAULT '-')
RETURNS int LANGUAGE plpgsql AS $$
DECLARE v int;
BEGIN
  INSERT INTO document_sequences (scope, year, series, last_value, updated_at)
  VALUES (p_scope, p_year, p_series, 1, now())
  ON CONFLICT (scope, year, series)
  DO UPDATE SET last_value = document_sequences.last_value + 1, updated_at = now()
  RETURNING last_value INTO v;
  RETURN v;
END $$;

ALTER TABLE complaints
  ADD CONSTRAINT complaints_sequence_ck   CHECK (sequence > 0),
  ADD CONSTRAINT complaints_code_ck       CHECK (code = 'LR-' || year || '-' || lpad(sequence::text, 6, '0')),
  ADD CONSTRAINT complaints_year_ck       CHECK (year = extract(year FROM submitted_at AT TIME ZONE 'America/Lima')),
  ADD CONSTRAINT complaints_claimed_ck    CHECK (
        (claimed_amount IS NULL AND claimed_currency IS NULL)
     OR (claimed_amount >= 0 AND is_supported_currency(claimed_currency))),
  ADD CONSTRAINT complaints_minor_ck      CHECK (NOT is_minor OR guardian_name IS NOT NULL),
  ADD CONSTRAINT complaints_answered_ck   CHECK (
        status NOT IN ('answered', 'closed') OR (response_text IS NOT NULL AND responded_at IS NOT NULL)),
  ADD CONSTRAINT complaints_response_after_ck CHECK (responded_at IS NULL OR responded_at >= submitted_at),
  ADD CONSTRAINT complaints_due_after_ck  CHECK (response_due_at > submitted_at),
  ADD CONSTRAINT complaints_email_lower_ck CHECK (consumer_email = lower(consumer_email));

ALTER TABLE invoices
  ADD CONSTRAINT invoices_series_ck CHECK (
        (doc_type = 'boleta'       AND series ~ '^B[A-Z0-9]{3}$')
     OR (doc_type = 'factura'      AND series ~ '^F[A-Z0-9]{3}$')
     OR (doc_type = 'nota_credito' AND series ~ '^[BF][A-Z0-9]{3}$')),
  ADD CONSTRAINT invoices_number_ck   CHECK (number BETWEEN 1 AND 99999999),
  ADD CONSTRAINT invoices_currency_ck CHECK (is_supported_currency(currency)),
  ADD CONSTRAINT invoices_amounts_ck  CHECK (
        taxable_amount >= 0 AND exempt_amount >= 0 AND igv_amount >= 0 AND total_amount >= 0),
  ADD CONSTRAINT invoices_total_math_ck CHECK (taxable_amount + exempt_amount + igv_amount = total_amount),
  ADD CONSTRAINT invoices_factura_ruc_ck CHECK (doc_type <> 'factura' OR receiver_doc_type = 'ruc'),
  ADD CONSTRAINT invoices_credit_note_ck CHECK ((doc_type = 'nota_credito') = (related_invoice_id IS NOT NULL));

-- -----------------------------------------------------------------------------
-- 8. CONTENIDO
-- -----------------------------------------------------------------------------
ALTER TABLE testimonials
  ADD CONSTRAINT testimonials_rating_ck   CHECK (rating BETWEEN 1 AND 5),
  ADD CONSTRAINT testimonials_approved_ck CHECK (
        status <> 'approved' OR (approved_at IS NOT NULL AND (publish_consent OR origin <> 'web')));

ALTER TABLE outbox_events
  ADD CONSTRAINT outbox_events_attempts_ck CHECK (attempts >= 0);

-- -----------------------------------------------------------------------------
-- 9. APPEND-ONLY Y CONSERVACIÓN LEGAL
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION forbid_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% es append-only: % no permitido', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END $$;

CREATE TRIGGER audit_log_append_only_trg
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER audit_log_no_truncate_trg
  BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER booking_status_history_append_only_trg
  BEFORE UPDATE OR DELETE ON booking_status_history
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER consents_append_only_trg
  BEFORE UPDATE OR DELETE ON consents
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- Reclamaciones, comprobantes, reservas y pagos: nunca DELETE físico (conservación legal).
CREATE TRIGGER complaints_no_delete_trg BEFORE DELETE ON complaints
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER invoices_no_delete_trg   BEFORE DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER bookings_no_delete_trg   BEFORE DELETE ON bookings
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER payments_no_delete_trg   BEFORE DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- Una reclamación respondida no se puede reescribir (solo pasar a closed).
CREATE OR REPLACE FUNCTION complaints_freeze_answer()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('answered', 'closed') AND (
       NEW.response_text IS DISTINCT FROM OLD.response_text
    OR NEW.detail IS DISTINCT FROM OLD.detail
    OR NEW.consumer_request IS DISTINCT FROM OLD.consumer_request
    OR NEW.sequence <> OLD.sequence OR NEW.year <> OLD.year) THEN
    RAISE EXCEPTION 'Reclamación % ya respondida: contenido inmutable', OLD.code
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER complaints_freeze_answer_trg
  BEFORE UPDATE ON complaints
  FOR EACH ROW EXECUTE FUNCTION complaints_freeze_answer();

-- -----------------------------------------------------------------------------
-- 10. AUDITORÍA AUTOMÁTICA (reservas, pagos, datos personales, legal)
-- -----------------------------------------------------------------------------
-- Columnas cifradas/secretas y PII directa nunca se copian al log: solo su nombre en
-- changed_fields. Así anonimizar (ARCO) un cliente/viajero no deja copias en audit_log,
-- que es append-only.
CREATE OR REPLACE FUNCTION audit_redact(j jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN j IS NULL THEN NULL ELSE coalesce(jsonb_object_agg(k, v), '{}'::jsonb) END
    FROM jsonb_each(coalesce(j, '{}'::jsonb)) AS e(k, v)
   WHERE k !~ '(_enc|_hash)$'
     AND k NOT IN ('password_hash', 'raw', 'payload',
                   'first_name', 'last_name', 'full_name', 'email', 'birth_date',
                   'consumer_name', 'consumer_email', 'consumer_address', 'guardian_name',
                   'receiver_name', 'receiver_address', 'detail', 'consumer_request',
                   'customer_notes')
$$;

CREATE OR REPLACE FUNCTION audit_row_change()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_old jsonb := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
  v_new jsonb := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;
  v_changed text[];
BEGIN
  IF TG_OP = 'UPDATE' THEN
    SELECT coalesce(array_agg(n.key ORDER BY n.key), '{}')
      INTO v_changed
      FROM jsonb_each(v_new) n
     WHERE n.key <> 'updated_at' AND n.value IS DISTINCT FROM v_old -> n.key;
    IF cardinality(v_changed) = 0 THEN
      RETURN NULL;  -- UPDATE sin cambios reales
    END IF;
  END IF;

  INSERT INTO audit_log (id, occurred_at, actor_type, actor_id, entity_type, entity_id,
                         action, changed_fields, before, after, request_id, ip)
  VALUES (
    uuid_generate_v7(), now(),
    coalesce(nullif(current_setting('app.actor_type', true), ''), 'system')::actor_type,
    nullif(current_setting('app.actor_id', true), '')::uuid,
    TG_TABLE_NAME,
    coalesce(v_new ->> 'id', v_old ->> 'id')::uuid,
    TG_OP,
    coalesce(v_changed, '{}'),
    audit_redact(v_old),
    audit_redact(v_new),
    left(nullif(current_setting('app.request_id', true), ''), 64),
    nullif(current_setting('app.client_ip', true), '')::inet
  );
  RETURN NULL;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bookings', 'booking_items', 'payments', 'customers', 'travelers',
                           'complaints', 'invoices', 'users', 'rates']
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %I
         FOR EACH ROW EXECUTE FUNCTION audit_row_change()', t || '_audit_trg', t);
  END LOOP;
END $$;

