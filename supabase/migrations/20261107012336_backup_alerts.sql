-- 20261107012336_backup_alerts.sql — the two overdue-backup mails
--
-- BACKUP_RUNTIME.md, WP7. Two situations warrant a mail:
--   * backup-undelivered  a backup was made but has not reached the shop
--                         folder for undelivered_alert_days
--   * backup-missing      no new backup has been made for
--                         missing_backup_alert_days
-- fn_backup_upkeep (WP5) judges both on every five-minute run. While one
-- holds and its mail has not been queued yet on the shop's calendar day, it
-- queues one message to the shop and one to the developers, with no order
-- (the template reads the address from EMAIL_SHOP_TO or EMAIL_DEVELOPER_TO),
-- and writes a backup_alerts row per message. Those rows are what "already
-- queued today" is read from. Each mail's row in Settings → Emails lands here
-- with its default wording.

-- ── backup_alerts ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "public"."backup_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template" "text" NOT NULL,
    -- Who the message is for; the sender resolves the address from the
    -- function's secrets.
    "recipient" "text" NOT NULL,
    -- The message queue_email queued; its sent_emails or failed_emails row
    -- carries the same id once the sender is done with it.
    "queue_msg_id" bigint NOT NULL,
    "queued_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "backup_alerts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "backup_alerts_template_check" CHECK ("template" IN ('backup-undelivered', 'backup-missing')),
    CONSTRAINT "backup_alerts_recipient_check" CHECK ("recipient" IN ('SHOP', 'DEVELOPER'))
);

ALTER TABLE "public"."backup_alerts" OWNER TO "postgres";

COMMENT ON TABLE "public"."backup_alerts" IS
    'One row per overdue-backup mail fn_backup_upkeep queued: which mail, for whom, and when. The upkeep reads it to queue each mail at most once a day. Written by the upkeep only; the app does not read it.';

CREATE INDEX IF NOT EXISTS "backup_alerts_template_queued_at_idx"
    ON "public"."backup_alerts" USING "btree" ("template", "queued_at");

ALTER TABLE "public"."backup_alerts" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."backup_alerts" FROM "anon", "authenticated";

GRANT ALL ON TABLE "public"."backup_alerts" TO "service_role";

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
END;
$$;

ALTER FUNCTION "public"."fn_backup_upkeep"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_backup_upkeep"() FROM PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."fn_backup_upkeep"() TO "service_role";

-- ── The two mails' rows in Settings → Emails ─────────────────────────────────
-- Default wording; the shop edits it in Settings → Emails. Both go out at
-- once: the upkeep already waited the threshold.

INSERT INTO "public"."email_settings" ("template", "subject", "body", "placeholders")
VALUES (
    'backup-undelivered',
    'Backup {{period}} has not reached the shop folder',
    E'The backup of week {{period}}, made on {{madeAt}}, has been waiting for {{waitedDays}} days and has not reached the shop folder yet. Failed deliveries so far: {{attempts}}.\n\nA backup is brought in by any computer running Print And More that can reach the shop folder. Please open the app on a computer in the shop and check Settings → Backups, "This computer", to see whether it reaches the folder.',
    ARRAY['period', 'madeAt', 'waitedDays', 'attempts']
), (
    'backup-missing',
    'No new backup for {{daysSince}} days',
    E'The newest backup is of week {{lastPeriod}}, made on {{lastMadeAt}}, {{daysSince}} days ago. A new one should have been made by now.\n\nBackups are made online, without any computer in the shop, so there is nothing to do at the shop. The developers receive this mail as well and will look into it.',
    ARRAY['lastPeriod', 'lastMadeAt', 'daysSince']
)
ON CONFLICT ("template") DO NOTHING;
