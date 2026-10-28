-- 20261021152639_customer_approval_settings.sql — the customer approval's settings
--
-- CUSTOMER_APPROVAL.md, WP0. The two values the approval workflow reads, as
-- one row the shop edits in Settings → Customer approval:
--   expiry_days     how long a request's link stays valid; stamped onto the
--                   request when it is created
--   retention_days  how long the proof copies are kept after the order is
--                   billed; read when the purge runs
--
-- Each column is typed, NOT NULL and checked, with its default, so a reader
-- selects it and needs no fallback.

-- ── customer_approval_settings ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "public"."customer_approval_settings" (
    -- Always true: a primary key that can hold one value keeps the table at one row.
    "id" boolean DEFAULT true NOT NULL,
    "expiry_days" integer DEFAULT 14 NOT NULL,
    "retention_days" integer DEFAULT 1095 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "customer_approval_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "customer_approval_settings_single_row_check" CHECK ("id"),
    -- Zero days would expire a request the moment it is sent, or purge a
    -- proof the day the order is billed.
    CONSTRAINT "customer_approval_settings_expiry_days_check" CHECK (("expiry_days" >= 1)),
    CONSTRAINT "customer_approval_settings_retention_days_check" CHECK (("retention_days" >= 1))
);

ALTER TABLE "public"."customer_approval_settings" OWNER TO "postgres";

COMMENT ON TABLE "public"."customer_approval_settings" IS
    'The customer approval workflow''s settings: exactly one row, edited in Settings → Customer approval.';

COMMENT ON COLUMN "public"."customer_approval_settings"."expiry_days" IS
    'Days a customer''s approval link stays valid; stamped onto each request when it is sent.';

COMMENT ON COLUMN "public"."customer_approval_settings"."retention_days" IS
    'Days the approval proof copies are kept after the order is billed.';

-- Everyone reads (the request dialog will name the expiry); only admins change
-- a setting. Nobody inserts or deletes: the one row always exists.
CREATE POLICY "Employees: read" ON "public"."customer_approval_settings"
    FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Admins: update" ON "public"."customer_approval_settings"
    FOR UPDATE TO "authenticated"
    USING ("public"."current_user_role"() IN ('ADMIN', 'SUPER_ADMIN'))
    WITH CHECK ("public"."current_user_role"() IN ('ADMIN', 'SUPER_ADMIN'));

ALTER TABLE "public"."customer_approval_settings" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."customer_approval_settings" FROM "anon";

GRANT SELECT, UPDATE ON TABLE "public"."customer_approval_settings" TO "authenticated";

GRANT ALL ON TABLE "public"."customer_approval_settings" TO "service_role";

-- ── updated_at ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION "public"."fn_customer_approval_settings_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" = ''
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."fn_customer_approval_settings_touch_updated_at"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_customer_approval_settings_touch_updated_at"() FROM PUBLIC;

CREATE TRIGGER "trg_customer_approval_settings_touch_updated_at"
    BEFORE UPDATE ON "public"."customer_approval_settings"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."fn_customer_approval_settings_touch_updated_at"();

-- ── The row ──────────────────────────────────────────────────────────────────
-- The column defaults are the shipped values: 14 days decided 2026-10-08;
-- 3 years the client's answer of 2026-10-21.

INSERT INTO "public"."customer_approval_settings" DEFAULT VALUES
ON CONFLICT ("id") DO NOTHING;
