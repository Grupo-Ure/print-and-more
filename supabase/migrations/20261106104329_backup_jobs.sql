-- 20261106104329_backup_jobs.sql — the record of every backup and its hand-over
--
-- BACKUP_RUNTIME.md, WP1. One row per backup ever made, kept forever: what
-- the file is, whether it is waiting, taken or delivered, by which machine,
-- when. The running copies of the app organise the delivery among
-- themselves; this table referees:
--   * record_backup_job        the dump workflow's last step (service role)
--   * claim_backup_job         one atomic update; the first claim wins, a
--                              claim holds for backup_settings.lease_minutes
--   * report_backup_delivered  the claim's holder, with the file's fingerprint
--   * report_backup_failed     the claim's holder; the job is free again
--   * fn_backup_job_roll_call  a broadcast on the private `backups` channel
--                              whenever a job becomes free
-- The table has no write policies and no write grants for the app: those four
-- functions are the only writers. Nothing deletes a row.
--
-- The `backups` bucket holds each dump until it has reached the shop. Its
-- files are encrypted, so every signed-in user may read them (the delivering
-- copy creates a signed URL for its job's file); only the service role writes.

-- ── backup_jobs ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "public"."backup_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    -- The ISO week the dump covers, e.g. 2026-W45.
    "period" "text" NOT NULL,
    -- The file in the backups bucket; unique, so the purge of one job's copy
    -- can never take another job's file.
    "storage_path" "text" NOT NULL,
    "size_bytes" bigint NOT NULL,
    -- SHA-256, hex, of the encrypted file.
    "sha256" "text" NOT NULL,
    "state" "text" DEFAULT 'WAITING' NOT NULL,
    -- The current or last claim.
    "claimed_by_session" "uuid",
    "claimed_by_machine" "text",
    "claimed_at" timestamp with time zone,
    "lease_until" timestamp with time zone,
    -- Failed deliveries, and why the last one failed.
    "attempts" integer DEFAULT 0 NOT NULL,
    "last_error" "text",
    -- The proof of delivery.
    "delivered_at" timestamp with time zone,
    "delivered_by_machine" "text",
    "delivered_sha256" "text",
    -- When the roll was last called for this job; stamped by the roll call.
    "announced_at" timestamp with time zone,
    -- When the holding copy was deleted from the bucket.
    "purged_at" timestamp with time zone,
    CONSTRAINT "backup_jobs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "backup_jobs_storage_path_key" UNIQUE ("storage_path"),
    CONSTRAINT "backup_jobs_state_check" CHECK (("state" IN ('WAITING', 'TAKEN', 'DELIVERED'))),
    CONSTRAINT "backup_jobs_period_check" CHECK (("period" ~ '^[0-9]{4}-W[0-9]{2}$')),
    CONSTRAINT "backup_jobs_size_bytes_check" CHECK (("size_bytes" > 0)),
    CONSTRAINT "backup_jobs_sha256_check" CHECK (("sha256" ~ '^[0-9a-f]{64}$')),
    -- A taken job has a holder and a lease; a delivered one has its proof.
    CONSTRAINT "backup_jobs_taken_check" CHECK (
        "state" <> 'TAKEN'
        OR ("claimed_by_session" IS NOT NULL AND "claimed_by_machine" IS NOT NULL
            AND "claimed_at" IS NOT NULL AND "lease_until" IS NOT NULL)
    ),
    CONSTRAINT "backup_jobs_delivered_check" CHECK (
        "state" <> 'DELIVERED'
        OR ("delivered_at" IS NOT NULL AND "delivered_by_machine" IS NOT NULL AND "delivered_sha256" IS NOT NULL)
    )
);

ALTER TABLE "public"."backup_jobs" OWNER TO "postgres";

CREATE INDEX "backup_jobs_created_at_idx" ON "public"."backup_jobs" USING "btree" ("created_at" DESC);

COMMENT ON TABLE "public"."backup_jobs" IS
    'One row per backup ever made, kept forever: the encrypted dump in the backups bucket and its hand-over to the shop folder. Written only through record_backup_job, claim_backup_job, report_backup_delivered and report_backup_failed.';

COMMENT ON COLUMN "public"."backup_jobs"."period" IS
    'The ISO week the dump covers, e.g. 2026-W45.';

COMMENT ON COLUMN "public"."backup_jobs"."state" IS
    'WAITING: free to be claimed. TAKEN: a running copy of the app holds it until lease_until. DELIVERED: in the shop folder, with the fingerprint read back.';

COMMENT ON COLUMN "public"."backup_jobs"."lease_until" IS
    'Until when the current claim holds; past it, the job may be claimed again. now() plus backup_settings.lease_minutes at the time of the claim.';

COMMENT ON COLUMN "public"."backup_jobs"."attempts" IS
    'Deliveries reported as failed.';

-- Every signed-in user reads (Settings → Backups, and each running copy
-- looking for a free job). Nobody writes directly.
CREATE POLICY "Employees: read" ON "public"."backup_jobs"
    FOR SELECT TO "authenticated" USING (true);

ALTER TABLE "public"."backup_jobs" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."backup_jobs" FROM "anon";

GRANT SELECT ON TABLE "public"."backup_jobs" TO "authenticated";

GRANT ALL ON TABLE "public"."backup_jobs" TO "service_role";

-- ── The roll call ────────────────────────────────────────────────────────────

/**
 * Calls the roll for a job that has become free: a broadcast on the private
 * `backups` channel, which every running copy of the app listens to, and
 * announced_at stamped. Fires on insert and on every return to WAITING (a
 * failed delivery); the re-announcement of a job still free after a while is
 * the cron tick's (WP5).
 *
 * realtime.send writes to realtime.messages in this transaction, so a job
 * whose write rolls back is never announced. DEFINER rights, so the service
 * role's insert and the app's report reach the channel alike.
 *
 * @trigger BEFORE INSERT OR UPDATE OF state ON backup_jobs (per row)
 */
CREATE OR REPLACE FUNCTION "public"."fn_backup_job_roll_call"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
BEGIN
  IF NEW.state = 'WAITING' AND (TG_OP = 'INSERT' OR OLD.state <> 'WAITING') THEN
    NEW.announced_at := now();
    PERFORM realtime.send(
      jsonb_build_object('job_id', NEW.id, 'period', NEW.period),
      'roll-call',
      'backups',
      true
    );
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."fn_backup_job_roll_call"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_backup_job_roll_call"() FROM PUBLIC;

CREATE TRIGGER "trg_backup_job_roll_call"
    BEFORE INSERT OR UPDATE OF "state" ON "public"."backup_jobs"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."fn_backup_job_roll_call"();

-- The private channel: every signed-in user may listen; nobody may send on it
-- from a client (there is no INSERT policy), so a roll call is always ours.
CREATE POLICY "Backups channel: employees receive" ON "realtime"."messages"
    FOR SELECT TO "authenticated"
    USING (
        "realtime"."topic"() = 'backups'
        AND "extension" = 'broadcast'
    );

-- ── record_backup_job ────────────────────────────────────────────────────────

/**
 * Records a dump the workflow has uploaded: the dump workflow's last step,
 * with the service-role key. The insert calls the roll.
 *
 * INVOKER rights and no grant to the app: current_user is the caller, and
 * anyone but the service role (or the owner, for a correction) is refused.
 */
CREATE OR REPLACE FUNCTION "public"."record_backup_job"(
    "period" "text",
    "storage_path" "text",
    "size_bytes" bigint,
    "sha256" "text"
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

  RETURN recorded;
END;
$$;

ALTER FUNCTION "public"."record_backup_job"("text", "text", bigint, "text") OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."record_backup_job"("text", "text", bigint, "text") FROM PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."record_backup_job"("text", "text", bigint, "text") TO "service_role";

-- ── claim_backup_job ─────────────────────────────────────────────────────────

/**
 * Claims a job for one running copy of the app: one atomic update that takes
 * a waiting job, or a taken one whose lease has run out. The first claim
 * wins; every other gets no row back. The lease is backup_settings'
 * lease_minutes from now, stamped onto the job.
 *
 * A row back means the caller holds the job until lease_until and may
 * deliver it; it then reports, with the same session id, either way.
 */
CREATE OR REPLACE FUNCTION "public"."claim_backup_job"(
    "job_id" "uuid",
    "session_id" "uuid",
    "machine" "text"
) RETURNS SETOF "public"."backup_jobs"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'claim_backup_job: a signed-in user is required';
  END IF;
  IF claim_backup_job.session_id IS NULL OR btrim(coalesce(claim_backup_job.machine, '')) = '' THEN
    RAISE EXCEPTION 'claim_backup_job: a session id and a machine name are required';
  END IF;

  RETURN QUERY
  UPDATE public.backup_jobs j
  SET state = 'TAKEN',
      claimed_by_session = claim_backup_job.session_id,
      claimed_by_machine = claim_backup_job.machine,
      claimed_at = now(),
      lease_until = now() + make_interval(mins => (SELECT s.lease_minutes FROM public.backup_settings s))
  WHERE j.id = claim_backup_job.job_id
    AND (j.state = 'WAITING' OR (j.state = 'TAKEN' AND j.lease_until < now()))
  RETURNING j.*;
END;
$$;

ALTER FUNCTION "public"."claim_backup_job"("uuid", "uuid", "text") OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."claim_backup_job"("uuid", "uuid", "text") FROM PUBLIC, "anon";

GRANT EXECUTE ON FUNCTION "public"."claim_backup_job"("uuid", "uuid", "text") TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."claim_backup_job"("uuid", "uuid", "text") TO "service_role";

-- ── report_backup_delivered ──────────────────────────────────────────────────

/**
 * Records that a job's file is in the shop folder. Accepted only from the
 * session that holds the claim, and only with the fingerprint the delivering
 * copy read back from the written file matching the recorded one. A lease
 * that ran out while the file was being written still counts, as long as no
 * other copy has claimed the job since.
 */
CREATE OR REPLACE FUNCTION "public"."report_backup_delivered"(
    "job_id" "uuid",
    "session_id" "uuid",
    "sha256" "text"
) RETURNS "public"."backup_jobs"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
DECLARE
  job public.backup_jobs;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'report_backup_delivered: a signed-in user is required';
  END IF;

  SELECT * INTO job
  FROM public.backup_jobs j
  WHERE j.id = report_backup_delivered.job_id
  FOR UPDATE;

  IF job.id IS NULL THEN
    RAISE EXCEPTION 'report_backup_delivered: backup job % does not exist', report_backup_delivered.job_id;
  END IF;
  IF job.state <> 'TAKEN' OR job.claimed_by_session IS DISTINCT FROM report_backup_delivered.session_id THEN
    RAISE EXCEPTION 'report_backup_delivered: backup job % is not held by this session', report_backup_delivered.job_id;
  END IF;
  IF lower(report_backup_delivered.sha256) IS DISTINCT FROM job.sha256 THEN
    RAISE EXCEPTION 'report_backup_delivered: the delivered file of backup job % does not match its fingerprint', report_backup_delivered.job_id;
  END IF;

  UPDATE public.backup_jobs j
  SET state = 'DELIVERED',
      delivered_at = now(),
      delivered_by_machine = job.claimed_by_machine,
      delivered_sha256 = lower(report_backup_delivered.sha256)
  WHERE j.id = report_backup_delivered.job_id
  RETURNING * INTO job;

  RETURN job;
END;
$$;

ALTER FUNCTION "public"."report_backup_delivered"("uuid", "uuid", "text") OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."report_backup_delivered"("uuid", "uuid", "text") FROM PUBLIC, "anon";

GRANT EXECUTE ON FUNCTION "public"."report_backup_delivered"("uuid", "uuid", "text") TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."report_backup_delivered"("uuid", "uuid", "text") TO "service_role";

-- ── report_backup_failed ─────────────────────────────────────────────────────

/**
 * Gives a job back after a failed delivery: WAITING again, the attempt
 * counted, the reason kept. Accepted only from the session that holds the
 * claim. The return to WAITING calls the roll, so another copy can try.
 */
CREATE OR REPLACE FUNCTION "public"."report_backup_failed"(
    "job_id" "uuid",
    "session_id" "uuid",
    "reason" "text"
) RETURNS "public"."backup_jobs"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
DECLARE
  job public.backup_jobs;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'report_backup_failed: a signed-in user is required';
  END IF;

  UPDATE public.backup_jobs j
  SET state = 'WAITING',
      attempts = j.attempts + 1,
      last_error = report_backup_failed.reason
  WHERE j.id = report_backup_failed.job_id
    AND j.state = 'TAKEN'
    AND j.claimed_by_session = report_backup_failed.session_id
  RETURNING * INTO job;

  IF job.id IS NULL THEN
    RAISE EXCEPTION 'report_backup_failed: backup job % is not held by this session', report_backup_failed.job_id;
  END IF;

  RETURN job;
END;
$$;

ALTER FUNCTION "public"."report_backup_failed"("uuid", "uuid", "text") OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."report_backup_failed"("uuid", "uuid", "text") FROM PUBLIC, "anon";

GRANT EXECUTE ON FUNCTION "public"."report_backup_failed"("uuid", "uuid", "text") TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."report_backup_failed"("uuid", "uuid", "text") TO "service_role";

-- ── The backups bucket ───────────────────────────────────────────────────────
-- Private: files are reached through signed URLs. Every signed-in user may
-- read, which createSignedUrl needs; the files are age-encrypted to a key only
-- the shop holds. No write policy: the dump workflow uploads with the service
-- role, and the purge (WP5) deletes with it.

INSERT INTO "storage"."buckets" ("id", "name", "public")
VALUES ('backups', 'backups', false)
ON CONFLICT ("id") DO NOTHING;

CREATE POLICY "Backups: employees read" ON "storage"."objects"
    FOR SELECT TO "authenticated"
    USING ("bucket_id" = 'backups');
