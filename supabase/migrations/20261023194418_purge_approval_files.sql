-- 20261023194418_purge_approval_files.sql — proof copies leave once the retention runs out
--
-- CUSTOMER_APPROVAL.md, WP7. The copies of an approval round's proofs sit in
-- the private approval-proofs bucket for the customer's page. They are kept
-- while the order is live — the rounds are the record of what was shown —
-- and removed once the order has been billed for longer than
-- customer_approval_settings.retention_days (vault note *Customer approval*).
--
-- Two parts:
--   * orders.billed_at, the moment the order was billed. Billing, not
--     finishing, starts the period: an admin can reopen a finished order, and
--     deriving the date from history would tie the purge to history rows
--     never being pruned. A trigger keeps it; the client never writes it.
--   * fn_purge_approval_files(), run daily: every file row of a closed round
--     on an order billed longer ago than the retention is stamped purged_at,
--     and its copy is deleted through the Storage API. Not by deleting rows
--     of storage.objects, which would leave the bytes in the backing store.
--
-- The customer's page already serves no purged file (WP3), and the Files
-- tab's requests table shows one as no longer held.

-- ── orders.billed_at ─────────────────────────────────────────────────────────

ALTER TABLE "public"."orders" ADD COLUMN "billed_at" timestamp with time zone;

COMMENT ON COLUMN "public"."orders"."billed_at" IS
    'When the order was billed; null while it is not. Kept by trg_order_billed_at. Starts the retention period of its approval proofs (fn_purge_approval_files).';

-- Orders billed before this migration: the date of the history entry that
-- billed them (Mark as invoiced, or Finish & close for a cash order), else
-- now — a missing entry keeps the copies longer, never shorter.
UPDATE "public"."orders" AS o
SET "billed_at" = coalesce(
    (SELECT max(h."created_at")
     FROM "public"."history" AS h
     WHERE h."order_id" = o."id"
       AND h."event_type" IN ('ORDER_BILLED', 'ORDER_CLOSED_CASH')),
    now()
)
WHERE o."status" = 'BILLED';

/**
 * Trigger: billed_at follows the status. Moving into BILLED stamps now();
 * any other status clears it. While the order stays billed the stamp stays,
 * whatever the client sends.
 *
 * Privileged roles may set the stamp of a billed order by hand: postgres /
 * supabase_admin for a correction, service_role for the e2e runner, which
 * seeds an order billed years ago. The app writes as `authenticated` and
 * cannot move it. INVOKER rights, so current_user is the caller.
 *
 * @trigger BEFORE INSERT OR UPDATE ON orders (per row)
 */
CREATE OR REPLACE FUNCTION "public"."fn_stamp_order_billed_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" = ''
    AS $$
BEGIN
  IF NEW.status <> 'BILLED' THEN
    NEW.billed_at := NULL;
  ELSIF TG_OP = 'INSERT' OR OLD.status <> 'BILLED' THEN
    NEW.billed_at := now();
  ELSIF current_user NOT IN ('postgres', 'supabase_admin', 'service_role') THEN
    NEW.billed_at := OLD.billed_at;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."fn_stamp_order_billed_at"() OWNER TO "postgres";

CREATE OR REPLACE TRIGGER "trg_order_billed_at"
    BEFORE INSERT OR UPDATE ON "public"."orders"
    FOR EACH ROW EXECUTE FUNCTION "public"."fn_stamp_order_billed_at"();

-- ── fn_purge_approval_files ──────────────────────────────────────────────────

/**
 * Removes the proof copies the retention no longer covers: the file rows of
 * every closed round on an order billed more than retention_days ago, not yet
 * purged. Each is stamped purged_at, and the copies are deleted through the
 * Storage API's bulk delete — `DELETE <project_url>/storage/v1/object/
 * approval-proofs` with `{ "prefixes": [...] }`, at most 1000 paths a call —
 * with the service-role key. URL and key come from the Vault, as drain_emails
 * reads them; without them (a fresh or reset database) the run does nothing
 * and stamps nothing, so a later run with them catches up.
 *
 * pg_net sends the calls after the transaction commits and the run does not
 * wait for the answers: a delete that fails leaves its copy in the bucket
 * with the row stamped, and the page serves it no more either way. Storage
 * answers a path that is already gone with nothing, so a call is safe to
 * repeat by hand.
 *
 * Owned by postgres with definer rights so it may read the Vault. The daily
 * cron job is its caller; the service role may call it too (the e2e suite
 * runs it on demand).
 *
 * @returns how many file rows it stamped.
 */
CREATE OR REPLACE FUNCTION "public"."fn_purge_approval_files"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
DECLARE
  project_url text;
  service_role_key text;
  paths text[];
  batch_start integer;
BEGIN
  SELECT nullif(decrypted_secret, '') INTO project_url
  FROM vault.decrypted_secrets WHERE name = 'project_url';
  SELECT nullif(decrypted_secret, '') INTO service_role_key
  FROM vault.decrypted_secrets WHERE name = 'service_role_key';

  IF project_url IS NULL OR service_role_key IS NULL THEN
    RETURN 0;
  END IF;

  WITH due AS (
    SELECT f.request_id, f.file_id
    FROM public.product_approval_request_files AS f
    JOIN public.product_approval_requests AS r ON r.id = f.request_id
    JOIN public.products AS p ON p.id = r.product_id
    JOIN public.orders AS o ON o.id = p.order_id
    CROSS JOIN public.customer_approval_settings AS s
    WHERE f.purged_at IS NULL
      AND r.status <> 'PENDING'
      AND o.billed_at < now() - make_interval(days => s.retention_days)
    FOR UPDATE OF f
  ), stamped AS (
    UPDATE public.product_approval_request_files AS f
    SET purged_at = now()
    FROM due
    WHERE f.request_id = due.request_id
      AND f.file_id = due.file_id
    RETURNING f.storage_path
  )
  SELECT coalesce(array_agg(storage_path), '{}') INTO paths FROM stamped;

  FOR batch_start IN 1 .. coalesce(array_length(paths, 1), 0) BY 1000 LOOP
    PERFORM net.http_delete(
      url := project_url || '/storage/v1/object/approval-proofs',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key,
        'apikey', service_role_key
      ),
      body := jsonb_build_object('prefixes', to_jsonb(paths[batch_start : batch_start + 999])),
      timeout_milliseconds := 25000
    );
  END LOOP;

  RETURN coalesce(array_length(paths, 1), 0);
END;
$$;

ALTER FUNCTION "public"."fn_purge_approval_files"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_purge_approval_files"() FROM PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."fn_purge_approval_files"() TO "service_role";

-- ── The daily run ────────────────────────────────────────────────────────────
-- 04:00 UTC, while nobody works in the app. Scheduling under an existing name
-- replaces the job, so re-running this is harmless.

SELECT "cron"."schedule"('purge_approval_files', '0 4 * * *', 'SELECT public.fn_purge_approval_files()');
