-- 20261106094723_backup_settings.sql — the backup runtime's settings
--
-- BACKUP_RUNTIME.md, WP0. Every interval and threshold the backup runtime
-- reads, as one row the shop edits in Settings → Backups:
--   enabled                    off pauses dumps and announcements; delivery
--                              of a job already waiting still runs
--   dump_interval_days         start a dump when the newest job is older
--   lease_minutes              how long a claim on a job holds; stamped onto
--                              the job when it is claimed
--   reannounce_minutes         call the roll again for a job still free
--   holding_retention_days     delete the holding copy this long after delivery
--   undelivered_alert_days     mail when a job has waited this long
--   missing_backup_alert_days  mail when no new job has appeared for this long
--   share_server, share_name,
--   share_folder               the app's folder on the shop's share; while
--                              any is empty no machine takes part
--
-- A typed table rather than key/value rows: the cron tick reads it in SQL.
-- Each number is NOT NULL and checked, with its default, so a reader selects
-- it and needs no fallback.

-- ── backup_settings ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "public"."backup_settings" (
    -- Always true: a primary key that can hold one value keeps the table at one row.
    "id" boolean DEFAULT true NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "dump_interval_days" integer DEFAULT 7 NOT NULL,
    "lease_minutes" integer DEFAULT 30 NOT NULL,
    "reannounce_minutes" integer DEFAULT 30 NOT NULL,
    "holding_retention_days" integer DEFAULT 3 NOT NULL,
    "undelivered_alert_days" integer DEFAULT 2 NOT NULL,
    "missing_backup_alert_days" integer DEFAULT 8 NOT NULL,
    "share_server" text,
    "share_name" text,
    "share_folder" text,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "backup_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "backup_settings_single_row_check" CHECK ("id"),
    -- Zero would dump on every tick, drop a claim the moment it is made, or
    -- alert on a job the moment it appears.
    CONSTRAINT "backup_settings_dump_interval_days_check" CHECK (("dump_interval_days" >= 1)),
    CONSTRAINT "backup_settings_lease_minutes_check" CHECK (("lease_minutes" >= 1)),
    CONSTRAINT "backup_settings_reannounce_minutes_check" CHECK (("reannounce_minutes" >= 1)),
    CONSTRAINT "backup_settings_holding_retention_days_check" CHECK (("holding_retention_days" >= 1)),
    CONSTRAINT "backup_settings_undelivered_alert_days_check" CHECK (("undelivered_alert_days" >= 1)),
    CONSTRAINT "backup_settings_missing_backup_alert_days_check" CHECK (("missing_backup_alert_days" >= 1)),
    -- An unset part of the folder is NULL, never a blank string, so "empty" has one spelling.
    CONSTRAINT "backup_settings_share_server_check" CHECK (("btrim"("share_server") <> '')),
    CONSTRAINT "backup_settings_share_name_check" CHECK (("btrim"("share_name") <> '')),
    CONSTRAINT "backup_settings_share_folder_check" CHECK (("btrim"("share_folder") <> ''))
);

ALTER TABLE "public"."backup_settings" OWNER TO "postgres";

COMMENT ON TABLE "public"."backup_settings" IS
    'The backup runtime''s settings: exactly one row, edited in Settings → Backups.';

COMMENT ON COLUMN "public"."backup_settings"."enabled" IS
    'Off pauses dumps and announcements; delivery of a job already waiting still runs.';

COMMENT ON COLUMN "public"."backup_settings"."dump_interval_days" IS
    'Days after the newest backup job before the next dump is started.';

COMMENT ON COLUMN "public"."backup_settings"."lease_minutes" IS
    'Minutes a claim on a backup job holds; stamped onto the job when it is claimed.';

COMMENT ON COLUMN "public"."backup_settings"."reannounce_minutes" IS
    'Minutes a backup job may stay free before the roll is called for it again.';

COMMENT ON COLUMN "public"."backup_settings"."holding_retention_days" IS
    'Days after delivery before the holding copy in the backups bucket is deleted.';

COMMENT ON COLUMN "public"."backup_settings"."undelivered_alert_days" IS
    'Days a backup job may wait undelivered before an alert mail is sent.';

COMMENT ON COLUMN "public"."backup_settings"."missing_backup_alert_days" IS
    'Days without a new backup job before an alert mail is sent.';

COMMENT ON COLUMN "public"."backup_settings"."share_server" IS
    'The server of the shop''s share (Windows: \\<server>\<share>\<folder>); NULL means no machine takes part.';

COMMENT ON COLUMN "public"."backup_settings"."share_name" IS
    'The share on that server; on a Mac, matched against the mounted volumes. NULL means no machine takes part.';

COMMENT ON COLUMN "public"."backup_settings"."share_folder" IS
    'The app''s folder inside the share; backups go in its Backups subfolder. NULL means no machine takes part.';

-- Everyone reads (every running copy resolves the folder from it); only admins
-- change a setting. Nobody inserts or deletes: the one row always exists.
CREATE POLICY "Employees: read" ON "public"."backup_settings"
    FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Admins: update" ON "public"."backup_settings"
    FOR UPDATE TO "authenticated"
    USING ("public"."current_user_role"() IN ('ADMIN', 'SUPER_ADMIN'))
    WITH CHECK ("public"."current_user_role"() IN ('ADMIN', 'SUPER_ADMIN'));

ALTER TABLE "public"."backup_settings" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."backup_settings" FROM "anon";

GRANT SELECT, UPDATE ON TABLE "public"."backup_settings" TO "authenticated";

GRANT ALL ON TABLE "public"."backup_settings" TO "service_role";

-- ── updated_at ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION "public"."fn_backup_settings_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" = ''
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."fn_backup_settings_touch_updated_at"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_backup_settings_touch_updated_at"() FROM PUBLIC;

CREATE TRIGGER "trg_backup_settings_touch_updated_at"
    BEFORE UPDATE ON "public"."backup_settings"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."fn_backup_settings_touch_updated_at"();

-- ── The row ──────────────────────────────────────────────────────────────────
-- The column defaults are the shipped values. The folder ships empty, so a
-- fresh database (local, CI) has no machine taking part; the shop's values
-- (Server, Server A-Z, Print And More) are entered in Settings.

INSERT INTO "public"."backup_settings" DEFAULT VALUES
ON CONFLICT ("id") DO NOTHING;
