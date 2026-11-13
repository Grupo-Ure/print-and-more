-- 20261110161824_backup_retention.sql — old backups leave the shop folder
--
-- BACKUP_RUNTIME.md, WP8. A delivered dump stays in the shop folder until
-- its keep has run out; deleting it then is ours. Nothing schedules a
-- deletion. Whether a dump is due is derived from its row every time it is
-- asked:
--   * weekly_retention_days     how long a dump is kept after it was made
--   * monthly_retention_years   how long its month's last dump is kept instead
-- list_backups_due_for_removal is that rule, in one place. fn_backup_upkeep
-- reads it and calls the roll (`remove` on the `backups` channel) while a
-- dump is due; a running copy of the app that reaches the folder reads it
-- too, deletes each file and reports it with report_backup_removed. The row
-- stays, as every backup's row does, with when and by which machine its
-- file was deleted.

-- ── backup_settings ──────────────────────────────────────────────────────────

ALTER TABLE "public"."backup_settings"
    ADD COLUMN "weekly_retention_days" integer DEFAULT 90 NOT NULL,
    ADD COLUMN "monthly_retention_years" integer DEFAULT 10 NOT NULL,
    ADD CONSTRAINT "backup_settings_weekly_retention_days_check" CHECK (("weekly_retention_days" >= 1)),
    ADD CONSTRAINT "backup_settings_monthly_retention_years_check" CHECK (("monthly_retention_years" >= 1));

COMMENT ON COLUMN "public"."backup_settings"."weekly_retention_days" IS
    'Days after a backup was made before its file is deleted from the shop folder, unless it is the last backup of its month.';

COMMENT ON COLUMN "public"."backup_settings"."monthly_retention_years" IS
    'Years after the last backup of a month was made before its file is deleted from the shop folder.';

-- ── backup_jobs ──────────────────────────────────────────────────────────────

ALTER TABLE "public"."backup_jobs"
    -- When the roll was last called to delete this job's file from the shop folder.
    ADD COLUMN "removal_announced_at" timestamp with time zone,
    -- When the file was deleted from the shop folder, and by which machine.
    ADD COLUMN "removed_at" timestamp with time zone,
    ADD COLUMN "removed_by_machine" "text",
    -- Only a delivered job has a file in the shop folder to delete.
    ADD CONSTRAINT "backup_jobs_removed_check" CHECK (
        "removed_at" IS NULL
        OR ("state" = 'DELIVERED' AND "removed_by_machine" IS NOT NULL)
    );

COMMENT ON TABLE "public"."backup_jobs" IS
    'One row per backup ever made, kept forever: the encrypted dump in the backups bucket, its hand-over to the shop folder and its deletion there once its keep has run out. Written only through record_backup_job, claim_backup_job, report_backup_delivered, report_backup_failed and report_backup_removed.';

COMMENT ON COLUMN "public"."backup_jobs"."removed_at" IS
    'When the file was deleted from the shop folder, its keep having run out. The row stays.';

-- ── list_backups_due_for_removal ─────────────────────────────────────────────

/**
 * The retention rule of the shop folder: every delivered job whose file is
 * still there and whose keep has run out, oldest first, judged now.
 *
 *   * A job is kept for weekly_retention_days from the day it was made.
 *   * The last job of a calendar month — no later delivered job was made in
 *     the same month, in the shop's time zone — is kept for
 *     monthly_retention_years instead.
 *   * The newest delivered job is never listed, however old.
 *
 * Nothing is stored about a job being due: a changed setting applies to
 * every job at the next call. INVOKER rights; every signed-in user may read
 * both tables.
 */
CREATE OR REPLACE FUNCTION "public"."list_backups_due_for_removal"() RETURNS SETOF "public"."backup_jobs"
    LANGUAGE "sql" STABLE
    SET "search_path" = ''
    AS $$
  SELECT j.*
  FROM public.backup_jobs j
  CROSS JOIN public.backup_settings s
  WHERE j.state = 'DELIVERED'
    AND j.removed_at IS NULL
    AND j.created_at < (
      SELECT max(newest.created_at) FROM public.backup_jobs newest WHERE newest.state = 'DELIVERED'
    )
    AND j.created_at < now() - CASE
      WHEN EXISTS (
        SELECT 1 FROM public.backup_jobs later
        WHERE later.state = 'DELIVERED'
          AND later.created_at > j.created_at
          AND date_trunc('month', later.created_at AT TIME ZONE 'Europe/Berlin')
              = date_trunc('month', j.created_at AT TIME ZONE 'Europe/Berlin')
      ) THEN make_interval(days => s.weekly_retention_days)
      ELSE make_interval(years => s.monthly_retention_years)
    END
  ORDER BY j.created_at;
$$;

ALTER FUNCTION "public"."list_backups_due_for_removal"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."list_backups_due_for_removal"() FROM PUBLIC, "anon";

GRANT EXECUTE ON FUNCTION "public"."list_backups_due_for_removal"() TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."list_backups_due_for_removal"() TO "service_role";

-- ── report_backup_removed ────────────────────────────────────────────────────

/**
 * Records that a job's file is gone from the shop folder: removed_at and the
 * machine that deleted it. Accepted only for a job the retention rule lists,
 * so a file inside its keep is never recorded as deleted. A job already
 * recorded keeps its first stamp — two copies of the app deleting the same
 * file at once both succeed, and the first report is the record.
 */
CREATE OR REPLACE FUNCTION "public"."report_backup_removed"(
    "job_id" "uuid",
    "machine" "text"
) RETURNS "public"."backup_jobs"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
DECLARE
  job public.backup_jobs;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'report_backup_removed: a signed-in user is required';
  END IF;
  IF btrim(coalesce(report_backup_removed.machine, '')) = '' THEN
    RAISE EXCEPTION 'report_backup_removed: a machine name is required';
  END IF;

  SELECT * INTO job
  FROM public.backup_jobs j
  WHERE j.id = report_backup_removed.job_id
  FOR UPDATE;

  IF job.id IS NULL THEN
    RAISE EXCEPTION 'report_backup_removed: backup job % does not exist', report_backup_removed.job_id;
  END IF;
  IF job.removed_at IS NOT NULL THEN
    RETURN job;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.list_backups_due_for_removal() due WHERE due.id = report_backup_removed.job_id
  ) THEN
    RAISE EXCEPTION 'report_backup_removed: backup job % is not due to leave the shop folder', report_backup_removed.job_id;
  END IF;

  UPDATE public.backup_jobs j
  SET removed_at = now(),
      removed_by_machine = report_backup_removed.machine
  WHERE j.id = report_backup_removed.job_id
  RETURNING * INTO job;

  RETURN job;
END;
$$;

ALTER FUNCTION "public"."report_backup_removed"("uuid", "text") OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."report_backup_removed"("uuid", "text") FROM PUBLIC, "anon";

GRANT EXECUTE ON FUNCTION "public"."report_backup_removed"("uuid", "text") TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."report_backup_removed"("uuid", "text") TO "service_role";

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
 *   Alerts        backup-undelivered while a job not yet delivered was made
 *                 more than undelivered_alert_days ago; backup-missing while
 *                 the newest job was made more than missing_backup_alert_days
 *                 ago — not while `enabled` is off, when no backup is due,
 *                 and not before the first backup, which has no date to count
 *                 from. A mail that holds and has no backup_alerts row from
 *                 today, in the shop's time zone, is queued once to the shop
 *                 and once to the developers, with no order. queue_email
 *                 queues nothing for a mail switched off in Settings, and
 *                 then nothing is recorded either. Runs that overlap take
 *                 turns on an advisory lock, so a day never gets two.
 *   Removal       while list_backups_due_for_removal holds a job whose
 *                 removal roll was last called more than reannounce_minutes
 *                 ago, or never, `remove` is broadcast once on the `backups`
 *                 channel and removal_announced_at stamped on every listed
 *                 job. The running copies of the app read the list
 *                 themselves; the broadcast only wakes them. Runs while
 *                 `enabled` is off, as the purge does: switching backups off
 *                 pauses new ones, not the deletion of old ones.
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
  newest timestamptz;
  due_alerts text[] := '{}';
  alert_template text;
  alert_recipient text;
  queued_msg_id bigint;
  shop_today date := (now() AT TIME ZONE 'Europe/Berlin')::date;
  due_for_removal uuid[];
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

  IF project_url IS NOT NULL AND service_role_key IS NOT NULL THEN
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
  END IF;

  -- ── Alerts ─────────────────────────────────────────────────────────────────
  PERFORM pg_advisory_xact_lock(hashtext('public.fn_backup_upkeep/alerts'));

  IF EXISTS (
    SELECT 1 FROM public.backup_jobs j
    WHERE j.state <> 'DELIVERED'
      AND j.created_at < now() - make_interval(days => settings.undelivered_alert_days)
  ) THEN
    due_alerts := array_append(due_alerts, 'backup-undelivered');
  END IF;

  IF settings.enabled THEN
    SELECT max(j.created_at) INTO newest FROM public.backup_jobs j;
    IF newest < now() - make_interval(days => settings.missing_backup_alert_days) THEN
      due_alerts := array_append(due_alerts, 'backup-missing');
    END IF;
  END IF;

  FOREACH alert_template IN ARRAY due_alerts LOOP
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.backup_alerts a
      WHERE a.template = alert_template
        AND (a.queued_at AT TIME ZONE 'Europe/Berlin')::date = shop_today
    );
    FOREACH alert_recipient IN ARRAY ARRAY['SHOP', 'DEVELOPER'] LOOP
      queued_msg_id := public.queue_email(
        alert_template,
        NULL::uuid,
        NULL::uuid,
        jsonb_build_object('recipient', alert_recipient)
      );
      IF queued_msg_id IS NOT NULL THEN
        INSERT INTO public.backup_alerts (template, recipient, queue_msg_id)
        VALUES (alert_template, alert_recipient, queued_msg_id);
      END IF;
    END LOOP;
  END LOOP;

  -- ── Removal ────────────────────────────────────────────────────────────────
  -- Behind the alerts' advisory lock, so overlapping runs broadcast once.
  SELECT coalesce(array_agg(due.id), '{}') INTO due_for_removal
  FROM public.list_backups_due_for_removal() due;

  IF EXISTS (
    SELECT 1 FROM public.backup_jobs j
    WHERE j.id = ANY (due_for_removal)
      AND (j.removal_announced_at IS NULL
           OR j.removal_announced_at < now() - make_interval(mins => settings.reannounce_minutes))
  ) THEN
    UPDATE public.backup_jobs j
    SET removal_announced_at = now()
    WHERE j.id = ANY (due_for_removal);

    PERFORM realtime.send(
      jsonb_build_object('count', cardinality(due_for_removal)),
      'remove',
      'backups',
      true
    );
  END IF;
END;
$$;

ALTER FUNCTION "public"."fn_backup_upkeep"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_backup_upkeep"() FROM PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."fn_backup_upkeep"() TO "service_role";
