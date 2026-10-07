-- =============================================================================
-- Reverso de constraints.sql (orden inverso). Prisma no genera "down": aplicar como
-- migración manual (prisma migrate diff / db execute) si hay que revertir.
-- =============================================================================

-- 10. Auditoría
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bookings', 'booking_items', 'payments', 'customers', 'travelers',
                           'complaints', 'invoices', 'users', 'rates']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_audit_trg', t);
  END LOOP;
END $$;
DROP FUNCTION IF EXISTS audit_row_change();
DROP FUNCTION IF EXISTS audit_redact(jsonb);

-- 9. Append-only / conservación legal
DROP TRIGGER IF EXISTS complaints_freeze_answer_trg ON complaints;
DROP FUNCTION IF EXISTS complaints_freeze_answer();
DROP TRIGGER IF EXISTS payments_no_delete_trg ON payments;
DROP TRIGGER IF EXISTS bookings_no_delete_trg ON bookings;
DROP TRIGGER IF EXISTS invoices_no_delete_trg ON invoices;
DROP TRIGGER IF EXISTS complaints_no_delete_trg ON complaints;
DROP TRIGGER IF EXISTS consents_append_only_trg ON consents;
DROP TRIGGER IF EXISTS booking_status_history_append_only_trg ON booking_status_history;
DROP TRIGGER IF EXISTS audit_log_no_truncate_trg ON audit_log;
DROP TRIGGER IF EXISTS audit_log_append_only_trg ON audit_log;
DROP FUNCTION IF EXISTS forbid_mutation();

-- 8. Contenido
ALTER TABLE outbox_events DROP CONSTRAINT IF EXISTS outbox_events_attempts_ck;
ALTER TABLE testimonials
  DROP CONSTRAINT IF EXISTS testimonials_rating_ck,
  DROP CONSTRAINT IF EXISTS testimonials_approved_ck;

-- 7. Legal
ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_series_ck,
  DROP CONSTRAINT IF EXISTS invoices_number_ck,
  DROP CONSTRAINT IF EXISTS invoices_currency_ck,
  DROP CONSTRAINT IF EXISTS invoices_amounts_ck,
  DROP CONSTRAINT IF EXISTS invoices_total_math_ck,
  DROP CONSTRAINT IF EXISTS invoices_factura_ruc_ck,
  DROP CONSTRAINT IF EXISTS invoices_credit_note_ck;
ALTER TABLE complaints
  DROP CONSTRAINT IF EXISTS complaints_sequence_ck,
  DROP CONSTRAINT IF EXISTS complaints_code_ck,
  DROP CONSTRAINT IF EXISTS complaints_year_ck,
  DROP CONSTRAINT IF EXISTS complaints_claimed_ck,
  DROP CONSTRAINT IF EXISTS complaints_minor_ck,
  DROP CONSTRAINT IF EXISTS complaints_answered_ck,
  DROP CONSTRAINT IF EXISTS complaints_response_after_ck,
  DROP CONSTRAINT IF EXISTS complaints_due_after_ck,
  DROP CONSTRAINT IF EXISTS complaints_email_lower_ck;
DROP FUNCTION IF EXISTS next_document_number(sequence_scope, int, text);
ALTER TABLE document_sequences
  DROP CONSTRAINT IF EXISTS document_sequences_value_ck,
  DROP CONSTRAINT IF EXISTS document_sequences_year_ck;

-- 6. Clientes y auth
ALTER TABLE auth_sessions
  DROP CONSTRAINT IF EXISTS auth_sessions_subject_ck,
  DROP CONSTRAINT IF EXISTS auth_sessions_expiry_ck;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_lower_ck;
ALTER TABLE customers
  DROP CONSTRAINT IF EXISTS customers_email_lower_ck,
  DROP CONSTRAINT IF EXISTS customers_email_format_ck,
  DROP CONSTRAINT IF EXISTS customers_country_ck;

-- 5. Pagos
ALTER TABLE payment_events DROP CONSTRAINT IF EXISTS payment_events_attempts_ck;
ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_amount_ck,
  DROP CONSTRAINT IF EXISTS payments_currency_ck,
  DROP CONSTRAINT IF EXISTS payments_exchange_rate_ck,
  DROP CONSTRAINT IF EXISTS payments_refund_parent_ck,
  DROP CONSTRAINT IF EXISTS payments_succeeded_at_ck,
  DROP CONSTRAINT IF EXISTS payments_manual_method_ck,
  DROP CONSTRAINT IF EXISTS payments_provider_id_ck;

-- 4. Reservas
DROP TRIGGER IF EXISTS bookings_status_guard_trg ON bookings;
DROP FUNCTION IF EXISTS bookings_status_guard();
DROP FUNCTION IF EXISTS booking_status_transition_allowed(booking_status, booking_status);
DROP INDEX IF EXISTS travelers_one_lead_per_booking_key;
ALTER TABLE travelers
  DROP CONSTRAINT IF EXISTS travelers_document_pair_ck,
  DROP CONSTRAINT IF EXISTS travelers_nationality_ck;
ALTER TABLE booking_item_lines
  DROP CONSTRAINT IF EXISTS booking_item_lines_quantity_ck,
  DROP CONSTRAINT IF EXISTS booking_item_lines_amounts_ck,
  DROP CONSTRAINT IF EXISTS booking_item_lines_math_ck;
ALTER TABLE booking_items
  DROP CONSTRAINT IF EXISTS booking_items_subtotal_ck,
  DROP CONSTRAINT IF EXISTS booking_items_pax_ck,
  DROP CONSTRAINT IF EXISTS booking_items_currency_ck;
ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_code_format_ck,
  DROP CONSTRAINT IF EXISTS bookings_currency_ck,
  DROP CONSTRAINT IF EXISTS bookings_amounts_nonneg_ck,
  DROP CONSTRAINT IF EXISTS bookings_total_math_ck,
  DROP CONSTRAINT IF EXISTS bookings_deposit_split_ck,
  DROP CONSTRAINT IF EXISTS bookings_deposit_percent_ck,
  DROP CONSTRAINT IF EXISTS bookings_full_option_ck,
  DROP CONSTRAINT IF EXISTS bookings_balance_due_ck,
  DROP CONSTRAINT IF EXISTS bookings_paid_le_total_ck,
  DROP CONSTRAINT IF EXISTS bookings_refunded_le_paid_ck,
  DROP CONSTRAINT IF EXISTS bookings_service_dates_ck,
  DROP CONSTRAINT IF EXISTS bookings_held_expiry_ck,
  DROP CONSTRAINT IF EXISTS bookings_partial_paid_ck,
  DROP CONSTRAINT IF EXISTS bookings_paid_ck,
  DROP CONSTRAINT IF EXISTS bookings_cancelled_at_ck,
  DROP CONSTRAINT IF EXISTS bookings_completed_at_ck;

-- 3. Carrito
ALTER TABLE inventory_holds
  DROP CONSTRAINT IF EXISTS inventory_holds_quantity_ck,
  DROP CONSTRAINT IF EXISTS inventory_holds_owner_ck,
  DROP CONSTRAINT IF EXISTS inventory_holds_released_ck;
ALTER TABLE cart_item_lines
  DROP CONSTRAINT IF EXISTS cart_item_lines_quantity_ck,
  DROP CONSTRAINT IF EXISTS cart_item_lines_amounts_ck,
  DROP CONSTRAINT IF EXISTS cart_item_lines_math_ck;
ALTER TABLE cart_items
  DROP CONSTRAINT IF EXISTS cart_items_subtotal_ck,
  DROP CONSTRAINT IF EXISTS cart_items_currency_ck;
ALTER TABLE carts
  DROP CONSTRAINT IF EXISTS carts_currency_ck,
  DROP CONSTRAINT IF EXISTS carts_token_hash_len_ck;

-- 2. Precios e inventario
ALTER TABLE exchange_rates
  DROP CONSTRAINT IF EXISTS exchange_rates_rate_ck,
  DROP CONSTRAINT IF EXISTS exchange_rates_pair_ck;
ALTER TABLE departures
  DROP CONSTRAINT IF EXISTS departures_capacity_ck,
  DROP CONSTRAINT IF EXISTS departures_counters_ck,
  DROP CONSTRAINT IF EXISTS departures_no_overbooking_ck,
  DROP CONSTRAINT IF EXISTS departures_version_ck;
ALTER TABLE rates
  DROP CONSTRAINT IF EXISTS rates_amount_ck,
  DROP CONSTRAINT IF EXISTS rates_currency_ck,
  DROP CONSTRAINT IF EXISTS rates_validity_ck,
  DROP CONSTRAINT IF EXISTS rates_group_ck,
  DROP CONSTRAINT IF EXISTS rates_no_overlap_ex;
ALTER TABLE seasons DROP CONSTRAINT IF EXISTS seasons_dates_ck;

-- 1. Catálogo y búsqueda
DROP TRIGGER IF EXISTS blog_post_translations_search_trg ON blog_post_translations;
DROP FUNCTION IF EXISTS blog_post_translations_search_refresh();
DROP INDEX IF EXISTS tour_translations_search_vector_idx;
DROP TRIGGER IF EXISTS tour_translations_search_trg ON tour_translations;
DROP FUNCTION IF EXISTS tour_translations_search_refresh();
ALTER TABLE blog_post_translations DROP CONSTRAINT IF EXISTS blog_post_translations_slug_format_ck;
ALTER TABLE legacy_redirects
  DROP CONSTRAINT IF EXISTS legacy_redirects_status_ck,
  DROP CONSTRAINT IF EXISTS legacy_redirects_not_loop_ck,
  DROP CONSTRAINT IF EXISTS legacy_redirects_from_normalized_ck,
  DROP CONSTRAINT IF EXISTS legacy_redirects_hits_ck;
ALTER TABLE tour_media DROP CONSTRAINT IF EXISTS tour_media_dimensions_ck;
ALTER TABLE tour_translations
  DROP CONSTRAINT IF EXISTS tour_translations_slug_format_ck,
  DROP CONSTRAINT IF EXISTS tour_translations_itinerary_array_ck,
  DROP CONSTRAINT IF EXISTS tour_translations_faqs_array_ck;
ALTER TABLE tours
  DROP CONSTRAINT IF EXISTS tours_slug_format_ck,
  DROP CONSTRAINT IF EXISTS tours_pax_ck,
  DROP CONSTRAINT IF EXISTS tours_duration_nonneg_ck,
  DROP CONSTRAINT IF EXISTS tours_duration_by_type_ck,
  DROP CONSTRAINT IF EXISTS tours_deposit_override_ck,
  DROP CONSTRAINT IF EXISTS tours_cutoff_ck,
  DROP CONSTRAINT IF EXISTS tours_published_at_ck;
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_slug_format_ck;
ALTER TABLE destinations
  DROP CONSTRAINT IF EXISTS destinations_slug_format_ck,
  DROP CONSTRAINT IF EXISTS destinations_latitude_ck,
  DROP CONSTRAINT IF EXISTS destinations_longitude_ck,
  DROP CONSTRAINT IF EXISTS destinations_not_self_parent_ck;

DROP FUNCTION IF EXISTS is_supported_currency(char);
