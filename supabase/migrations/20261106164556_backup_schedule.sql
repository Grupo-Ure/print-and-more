-- 20261106164556_backup_schedule.sql — starting backups, re-announcing, purging
--
-- BACKUP_RUNTIME.md, WP5. The database is the backup runtime's only clock,
-- with two pg_cron jobs on two beats:
--   * fn_start_due_backup  daily: asks GitHub to run the backup workflow when
--                          the newest backup is older than dump_interval_days.
--                          A run ends within the hour, so the next day's check
--                          always sees whether it recorded its job; one that
--                          failed is simply started again the next day.
--   * fn_backup_upkeep     every five minutes: calls the roll again for a job
--                          still free after reannounce_minutes, and deletes
--                          the online copy of a job delivered longer ago than
--                          holding_retention_days.
-- Both read backup_settings at the moment of use. While `enabled` is off,
-- nothing is started or announced; delivered copies are still purged.

-- ── fn_start_due_backup ──────────────────────────────────────────────────────

/**
 * Starts the backup workflow when a backup is due: no job yet, or the newest
 * one created more than dump_interval_days ago. The start is a
 * `workflow_dispatch` POST to GitHub through pg_net, with the token the Vault
 * holds as `github_backup_token`; pg_net sends it after the transaction
 * commits, and its answer lands in net._http_response for whoever wants to
 * read a failed start afterwards. Without a token (a fresh, local or CI
 * database) nothing is sent, so only the hosted project ever calls out.
 *
 * Owned by postgres with definer rights so it may read the Vault. The daily
 * cron job is its caller; the service role may call it too (the e2e suite
 * runs it on demand).
 *
 * @returns what it decided: 'disabled', 'not_due', 'no_token' or 'started'.
 */
CREATE OR REPLACE FUNCTION "public"."fn_start_due_backup"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
DECLARE
  settings public.backup_settings;
  newest timestamptz;
  token text;
BEGIN
  SELECT * INTO settings FROM public.backup_settings;
  IF NOT settings.enabled THEN
    RETURN 'disabled';
  END IF;

  SELECT max(j.created_at) INTO newest FROM public.backup_jobs j;
  IF newest IS NOT NULL AND newest >= now() - make_interval(days => settings.dump_interval_days) THEN
    RETURN 'not_due';
  END IF;

  SELECT nullif(decrypted_secret, '') INTO token
  FROM vault.decrypted_secrets WHERE name = 'github_backup_token';
  IF token IS NULL THEN
    RETURN 'no_token';
  END IF;

  PERFORM net.http_post(
    url := 'https://api.github.com/repos/Grupo-Ure/print-and-more/actions/workflows/backup.yml/dispatches',
    headers := jsonb_build_object(
      'Accept', 'application/vnd.github+json',
      'Authorization', 'Bearer ' || token,
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'print-and-more-backup'
    ),
    body := '{"ref":"main"}'::jsonb,
    timeout_milliseconds := 25000
  );
  RETURN 'started';
END;
$$;

ALTER FUNCTION "public"."fn_start_due_backup"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_start_due_backup"() FROM PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."fn_start_due_backup"() TO "service_role";

-- ── fn_backup_upkeep ─────────────────────────────────────────────────────────

/**
 * The five-minute upkeep of the backups:
 *
 *   Re-announce   every job still free — waiting, or taken with its lease run
 *                 out — whose roll was last called more than
 *                 reannounce_minutes ago gets the roll called again, as
 *                 fn_backup_job_roll_call does on insert, and announced_at
 *                 stamped. Skipped while `enabled` is off.
 *   Purge         every delivered job whose delivery lies more than
 *                 holding_retention_days back and whose copy is still held is
 *                 stamped purged_at, and the copies are deleted through the
 *                 Storage API's bulk delete — the shape of
 *                 fn_purge_approval_files, with project URL and service-role
 *                 key from the Vault. Without them (a fresh or reset
 *                 database) nothing is purged or stamped, so a later run with
 *                 them catches up. pg_net sends the deletes after the commit.
 *
 * Owned by postgres with definer rights so it may read the Vault. The
 * five-minute cron job is its caller; the service role may call it too (the
 * e2e suite runs it on demand).
 */
CREATE OR REPLACE FUNCTION "public"."fn_backup_upkeep"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
DECLARE
  settings public.backup_settings;
  job record;
  project_url text;
  service_role_key text;
  paths text[];
  batch_start integer;
BEGIN
  SELECT * INTO settings FROM public.backup_settings;

  -- ── Re-announce ────────────────────────────────────────────────────────────
  IF settings.enabled THEN
    FOR job IN
      UPDATE public.backup_jobs j
      SET announced_at = now()
      WHERE (j.state = 'WAITING' OR (j.state = 'TAKEN' AND j.lease_until < now()))
        AND (j.announced_at IS NULL
             OR j.announced_at < now() - make_interval(mins => settings.reannounce_minutes))
      RETURNING j.id, j.period
    LOOP
      PERFORM realtime.send(
        jsonb_build_object('job_id', job.id, 'period', job.period),
        'roll-call',
        'backups',
        true
      );
    END LOOP;
  END IF;

  -- ── Purge ──────────────────────────────────────────────────────────────────
  SELECT nullif(decrypted_secret, '') INTO project_url
  FROM vault.decrypted_secrets WHERE name = 'project_url';
  SELECT nullif(decrypted_secret, '') INTO service_role_key
  FROM vault.decrypted_secrets WHERE name = 'service_role_key';
  IF project_url IS NULL OR service_role_key IS NULL THEN
    RETURN;
  END IF;

  WITH stamped AS (
    UPDATE public.backup_jobs j
    SET purged_at = now()
    WHERE j.state = 'DELIVERED'
      AND j.purged_at IS NULL
      AND j.delivered_at < now() - make_interval(days => settings.holding_retention_days)
    RETURNING j.storage_path
  )
  SELECT coalesce(array_agg(storage_path), '{}') INTO paths FROM stamped;

  FOR batch_start IN 1 .. coalesce(array_length(paths, 1), 0) BY 1000 LOOP
    PERFORM net.http_delete(
      url := project_url || '/storage/v1/object/backups',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key,
        'apikey', service_role_key
      ),
      body := jsonb_build_object('prefixes', to_jsonb(paths[batch_start : batch_start + 999])),
      timeout_milliseconds := 25000
    );
  END LOOP;
END;
$$;

ALTER FUNCTION "public"."fn_backup_upkeep"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_backup_upkeep"() FROM PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."fn_backup_upkeep"() TO "service_role";

-- ── The two cron jobs ────────────────────────────────────────────────────────
-- The start at 03:00 UTC, while nobody works in the app; the upkeep every
-- five minutes. Scheduling under an existing name replaces the job, so
-- re-running this is harmless.

SELECT "cron"."schedule"('start_due_backup', '0 3 * * *', 'SELECT public.fn_start_due_backup()');

SELECT "cron"."schedule"('backup_upkeep', '*/5 * * * *', 'SELECT public.fn_backup_upkeep()');
