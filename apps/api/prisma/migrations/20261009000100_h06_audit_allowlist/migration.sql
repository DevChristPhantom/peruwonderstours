-- Endurecimiento H-06 (brain/wiki/concepts/revision-seguridad-sprint2.md): audit_log es append-only y
-- guardaba PII no listada en la "denylist" de audit_redact (dirección y correo del apoderado, IP,
-- textos libres de reclamos y reservas). Se cambia a una ALLOWLIST de columnas por tabla: solo se
-- copian al log columnas operativas sin datos personales; el resto solo aparece en changed_fields.
-- Además se limpian las filas YA escritas (se desactiva temporalmente el trigger append-only
-- dentro de esta migración; requiere ser dueño de la tabla).
-- Reverso: restaurar audit_redact(jsonb) y audit_row_change() de 20261007000200_db_constraints
-- (los datos limpiados no se recuperan, a propósito).

CREATE OR REPLACE FUNCTION audit_allowed_columns(t text)
RETURNS text[] LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE t
    WHEN 'bookings' THEN ARRAY['id','code','customer_id','cart_id','status','source','locale','currency','subtotal_amount',
      'discount_amount','total_amount','payment_option','deposit_percent','deposit_amount','balance_amount','balance_due_at',
      'paid_amount','refunded_amount','refund_due_amount','hold_expires_at','first_service_date','last_service_date',
      'cancellation_policy_version','terms_version','created_by_user_id','confirmed_at','cancelled_at','completed_at',
      'created_at','deleted_at','version']
    WHEN 'booking_items' THEN ARRAY['id','booking_id','tour_id','departure_id','travel_date','status','pax_count',
      'subtotal_amount','currency','created_at']
    WHEN 'payments' THEN ARRAY['id','booking_id','kind','provider','method','status','amount','currency','exchange_rate',
      'booking_currency_amount','provider_payment_id','parent_payment_id','failure_code','recorded_by_user_id',
      'succeeded_at','created_at']
    WHEN 'customers' THEN ARRAY['id','country','preferred_locale','email_verified_at','anonymized_at','created_at','deleted_at']
    WHEN 'travelers' THEN ARRAY['id','booking_id','booking_item_id','is_lead','pax_type','residency','nationality',
      'document_type','anonymized_at','created_at','deleted_at']
    WHEN 'complaints' THEN ARRAY['id','year','sequence','code','type','declared_type','status','channel',
      'backup_sheet_number','transcribed_at','booking_id','provider_ruc','establishment_code','consumer_doc_type',
      'is_minor','good_type','claimed_amount','claimed_currency','response_channel','conformity_accepted_at',
      'conformity_text_version','privacy_notice_version','responded_at','responded_by_user_id','response_sent_at',
      'response_delivery_ref','response_due_at','original_response_due_at','settlement_offered_at',
      'settlement_expires_at','settlement_accepted_at','settlement_rejected_at','reclassified_at',
      'reclassified_by_user_id','acknowledgment_sent_at','acknowledgment_delivery_ref','pdf_sha256',
      'submitted_at','created_at']
    WHEN 'invoices' THEN ARRAY['id','booking_id','payment_id','doc_type','series','number','issue_date',
      'receiver_doc_type','currency','taxable_amount','exempt_amount','igv_amount','total_amount','exchange_rate',
      'sunat_status','sunat_response_code','related_invoice_id','created_at']
    WHEN 'users' THEN ARRAY['id','role','status','mfa_enabled_at','failed_login_count','locked_until',
      'last_failed_login_at','password_changed_at','must_change_password','last_login_at','version','created_at','deleted_at']
    WHEN 'rates' THEN ARRAY['id','tour_id','season_id','pax_type','residency','currency','amount','valid_from','valid_to',
      'min_group_size','max_group_size','is_active','version','created_at','deleted_at']
    WHEN 'tours' THEN ARRAY['id','slug','code','type','status','category_id','duration_days','duration_nights',
      'duration_hours','min_pax','max_pax','difficulty','booking_cutoff_hours','deposit_percent_override',
      'requires_traveler_document','uses_inventory','is_featured','cancellation_policy_code','published_at','version',
      'updated_by_user_id','created_at','deleted_at']
    WHEN 'seasons' THEN ARRAY['id','code','name','start_date','end_date','priority','version','created_at']
    ELSE ARRAY[]::text[]
  END
$$;

-- Allowlist por tabla (tabla desconocida => objeto vacío).
CREATE OR REPLACE FUNCTION audit_redact(t text, j jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN j IS NULL THEN NULL ELSE coalesce(jsonb_object_agg(k, v), '{}'::jsonb) END
    FROM jsonb_each(coalesce(j, '{}'::jsonb)) AS e(k, v)
   WHERE k = ANY (audit_allowed_columns(t))
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
      RETURN NULL;
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
    audit_redact(TG_TABLE_NAME, v_old),
    audit_redact(TG_TABLE_NAME, v_new),
    left(nullif(current_setting('app.request_id', true), ''), 64),
    nullif(current_setting('app.client_ip', true), '')::inet
  );
  RETURN NULL;
END $$;

-- Limpieza de filas existentes.
ALTER TABLE audit_log DISABLE TRIGGER audit_log_append_only_trg;

-- (1) Filas de los triggers de fila: se re-filtran con la allowlist.
UPDATE audit_log
   SET before = audit_redact(entity_type, before),
       after  = audit_redact(entity_type, after)
 WHERE action IN ('INSERT', 'UPDATE', 'DELETE')
   AND entity_type IN ('bookings', 'booking_items', 'payments', 'customers', 'travelers', 'complaints',
                       'invoices', 'users', 'rates', 'tours', 'seasons');

-- (2) Acciones de aplicación con texto libre (motivos y notas pueden contener datos personales).
UPDATE audit_log
   SET after = (after - 'reason' - 'note' - 'overrideReason') ||
               CASE WHEN after ? 'override' AND jsonb_typeof(after -> 'override') = 'object'
                    THEN jsonb_build_object('override', (after -> 'override') - 'reason') ELSE '{}'::jsonb END
 WHERE action IN ('BOOKING_CANCELLED', 'COMPLAINT_SETTLEMENT_REJECTED')
   AND after IS NOT NULL;

ALTER TABLE audit_log ENABLE TRIGGER audit_log_append_only_trg;

-- La versión anterior (denylist) queda sin uso.
DROP FUNCTION IF EXISTS audit_redact(jsonb);
