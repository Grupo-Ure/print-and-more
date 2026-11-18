-- 20261111201102_start_record.sql — every start of the backup is recorded
--
-- BACKUP_RUNTIME.md, WP9 (decision 11). fn_start_due_backup asks GitHub to
-- run the backup workflow; backup_dispatches keeps one row per such start, so
-- a start still under way holds back the next, whoever calls the start and
-- however often. A start is open until its run records its backup
-- (record_backup_job, given the start's id) or reports that it failed
-- (report_backup_dispatch_failed); one that does neither stops holding back
-- the next after start_wait_minutes. backup_jobs is left as it is: one
-- row per dump that exists.

-- ── backup_settings ──────────────────────────────────────────────────────────

ALTER TABLE "public"."backup_settings"
    ADD COLUMN "start_wait_minutes" integer DEFAULT 120 NOT NULL,
    ADD CONSTRAINT "backup_settings_start_wait_minutes_check" CHECK (("start_wait_minutes" >= 1));

COMMENT ON COLUMN "public"."backup_settings"."start_wait_minutes" IS
    'Minutes a start of the backup holds back the next while its run has neither recorded a backup nor reported a failure; above the workflow''s 60-minute limit.';

-- ── backup_dispatches ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "public"."backup_dispatches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    -- When fn_start_due_backup sent the start.
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    -- The backup the run recorded; empty until then.
    "job_id" "uuid",
    -- The run's report that it failed, and why.
    "failed_at" timestamp with time zone,
    "error" "text",
    CONSTRAINT "backup_dispatches_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "backup_dispatches_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."backup_jobs"("id"),
    -- A start ends one way: with a backup or with a failure, never both.
    CONSTRAINT "backup_dispatches_outcome_check" CHECK (("job_id" IS NULL) OR ("failed_at" IS NULL)),
    CONSTRAINT "backup_dispatches_failure_check" CHECK ((("failed_at" IS NULL) = ("error" IS NULL)))
);

ALTER TABLE "public"."backup_dispatches" OWNER TO "postgres";

COMMENT ON TABLE "public"."backup_dispatches" IS
    'One row per start of the backup workflow, kept forever. Written only through fn_start_due_backup, record_backup_job and report_backup_dispatch_failed.';

CREATE POLICY "Employees: read" ON "public"."backup_dispatches"
    FOR SELECT TO "authenticated" USING (true);

ALTER TABLE "public"."backup_dispatches" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."backup_dispatches" FROM "anon";

GRANT SELECT ON TABLE "public"."backup_dispatches" TO "authenticated";

GRANT ALL ON TABLE "public"."backup_dispatches" TO "service_role";

-- ── record_backup_job ────────────────────────────────────────────────────────
-- Declared again with the start it came from. The four-argument version goes
-- first: beside it, a call with four named arguments would match both.

DROP FUNCTION IF EXISTS "public"."record_backup_job"("text", "text", bigint, "text");

/**
 * Records a dump the workflow has uploaded: the dump workflow's last step,
 * with the service-role key. The insert calls the roll.
 *
 * Given the start that led to it, the job is linked onto that start, which
 * closes it — but only while the start has no backup yet. The dump is
 * recorded either way: it is already uploaded, and a backup that exists is
 * never left unrecorded for the sake of the start's bookkeeping. A run
 * started by hand on GitHub has no start and passes none.
 *
 * INVOKER rights and no grant to the app: current_user is the caller, and
 * anyone but the service role (or the owner, for a correction) is refused.
 */
CREATE OR REPLACE FUNCTION "public"."record_backup_job"(
    "period" "text",
    "storage_path" "text",
    "size_bytes" bigint,
    "sha256" "text",
    "dispatch_id" "uuid" DEFAULT NULL
) RETURNS "public"."backup_jobs"
    LANGUAGE "plpgsql"
    SET "search_path" = ''
    AS $$
DECLARE
  recorded public.backup_jobs;
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin', 'service_role') THEN
    RAISE EXCEPTION 'record_backup_job: only the dump workflow records a backup';
  END IF;

  INSERT INTO public.backup_jobs (period, storage_path, size_bytes, sha256)
  VALUES (record_backup_job.period, record_backup_job.storage_path, record_backup_job.size_bytes, record_backup_job.sha256)
  RETURNING * INTO recorded;

  IF record_backup_job.dispatch_id IS NOT NULL THEN
    UPDATE public.backup_dispatches d
    SET job_id = recorded.id
    WHERE d.id = record_backup_job.dispatch_id
      AND d.job_id IS NULL
      AND d.failed_at IS NULL;
  END IF;

  RETURN recorded;
END;
$$;

ALTER FUNCTION "public"."record_backup_job"("text", "text", bigint, "text", "uuid") OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."record_backup_job"("text", "text", bigint, "text", "uuid") FROM PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."record_backup_job"("text", "text", bigint, "text", "uuid") TO "service_role";

-- ── report_backup_dispatch_failed ────────────────────────────────────────────

/**
 * Records that the run of a start failed: the workflow's last step, run only
 * when an earlier step failed, with the service-role key. Accepted only for a
 * start that has neither a backup nor a failure yet; its age does not matter.
 * The next daily start then sends a new one.
 *
 * INVOKER rights and no grant to the app, as record_backup_job.
 */
CREATE OR REPLACE FUNCTION "public"."report_backup_dispatch_failed"(
    "dispatch_id" "uuid",
    "reason" "text"
) RETURNS "public"."backup_dispatches"
    LANGUAGE "plpgsql"
    SET "search_path" = ''
    AS $$
DECLARE
  reported public.backup_dispatches;
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin', 'service_role') THEN
    RAISE EXCEPTION 'report_backup_dispatch_failed: only the dump workflow reports its run';
  END IF;
  IF btrim(coalesce(report_backup_dispatch_failed.reason, '')) = '' THEN
    RAISE EXCEPTION 'report_backup_dispatch_failed: a reason is required';
  END IF;

  UPDATE public.backup_dispatches d
  SET failed_at = now(),
      error = report_backup_dispatch_failed.reason
  WHERE d.id = report_backup_dispatch_failed.dispatch_id
    AND d.job_id IS NULL
    AND d.failed_at IS NULL
  RETURNING * INTO reported;

  IF reported.id IS NULL THEN
    RAISE EXCEPTION 'report_backup_dispatch_failed: start % is not open', report_backup_dispatch_failed.dispatch_id;
  END IF;

  RETURN reported;
END;
$$;

ALTER FUNCTION "public"."report_backup_dispatch_failed"("uuid", "text") OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."report_backup_dispatch_failed"("uuid", "text") FROM PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."report_backup_dispatch_failed"("uuid", "text") TO "service_role";

-- ── fn_start_due_backup ──────────────────────────────────────────────────────

/**
 * Starts the backup workflow when a backup is due — no job yet, or the newest
 * one created more than dump_interval_days ago — and no start is open: one
 * with neither a backup nor a failure, sent less than
 * start_wait_minutes ago. Calls take turns on an advisory lock, so two
 * at once cannot both find no open start.
 *
 * The open start is looked for before the token, so a database without one
 * still answers it. With a token, the start is recorded in backup_dispatches
 * and sent as a `workflow_dispatch` POST to GitHub through pg_net, its id as
 * the input `dispatch_id`; pg_net sends it after the transaction commits, and
 * its answer lands in net._http_response. Without a token (a fresh, local or
 * CI database) nothing is sent or recorded, so only the hosted project ever
 * calls out.
 *
 * Owned by postgres with definer rights so it may read the Vault. The daily
 * cron job is its caller; the service role may call it too (the e2e suite
 * runs it on demand).
 *
 * @returns what it decided: 'disabled', 'not_due', 'already_started',
 *          'no_token' or 'started'.
 */
CREATE OR REPLACE FUNCTION "public"."fn_start_due_backup"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
DECLARE
  settings public.backup_settings;
  newest timestamptz;
  token text;
  dispatch public.backup_dispatches;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('public.fn_start_due_backup'));

  SELECT * INTO settings FROM public.backup_settings;
  IF NOT settings.enabled THEN
    RETURN 'disabled';
  END IF;

  SELECT max(j.created_at) INTO newest FROM public.backup_jobs j;
  IF newest IS NOT NULL AND newest >= now() - make_interval(days => settings.dump_interval_days) THEN
    RETURN 'not_due';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.backup_dispatches d
    WHERE d.job_id IS NULL
      AND d.failed_at IS NULL
      AND d.requested_at > now() - make_interval(mins => settings.start_wait_minutes)
  ) THEN
    RETURN 'already_started';
  END IF;

  SELECT nullif(decrypted_secret, '') INTO token
  FROM vault.decrypted_secrets WHERE name = 'github_backup_token';
  IF token IS NULL THEN
    RETURN 'no_token';
  END IF;

  INSERT INTO public.backup_dispatches DEFAULT VALUES RETURNING * INTO dispatch;

  PERFORM net.http_post(
    url := 'https://api.github.com/repos/Grupo-Ure/print-and-more/actions/workflows/backup.yml/dispatches',
    headers := jsonb_build_object(
      'Accept', 'application/vnd.github+json',
      'Authorization', 'Bearer ' || token,
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'print-and-more-backup'
    ),
    body := jsonb_build_object('ref', 'main', 'inputs', jsonb_build_object('dispatch_id', dispatch.id::text)),
    timeout_milliseconds := 25000
  );
  RETURN 'started';
END;
$$;

ALTER FUNCTION "public"."fn_start_due_backup"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_start_due_backup"() FROM PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."fn_start_due_backup"() TO "service_role";
