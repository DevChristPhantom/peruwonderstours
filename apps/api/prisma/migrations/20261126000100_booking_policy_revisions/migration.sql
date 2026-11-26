CREATE TABLE "booking_policy_revisions" ("revision" INTEGER PRIMARY KEY, "version" VARCHAR(40) NOT NULL UNIQUE, "translations" JSONB NOT NULL, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "created_by" UUID NOT NULL, CONSTRAINT "booking_policy_revision_positive" CHECK ("revision" > 0));
CREATE FUNCTION prevent_booking_policy_revision_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Policy revisions are immutable'; END $$;
CREATE TRIGGER booking_policy_revision_immutable BEFORE UPDATE OR DELETE ON booking_policy_revisions FOR EACH ROW EXECUTE FUNCTION prevent_booking_policy_revision_change();

ALTER TABLE bookings ADD COLUMN policy_acceptance_snapshot JSONB;
