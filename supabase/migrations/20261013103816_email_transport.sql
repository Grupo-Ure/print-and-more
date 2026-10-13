-- 20261013103816_email_transport.sql — the email queue, the sent record, and the drain cron
--
-- EMAIL.md, WP2. The email system's database half: the queue a trigger drops a
-- mail request into, the settings that can switch a template off, the record
-- of every mail that went out, the functions the sender and the app reach the
-- queue through, and the cron job that wakes the sender every ten seconds.
-- How the whole system behaves is the vault note `Email runtime`.
--
-- The queue is Supabase Queues (pgmq): one queue, `email_outbox`. pgmq owns
-- the message table, the message id, the visibility time and the read count;
-- nothing here reimplements scheduling or retrying. The `pgmq` schema is not
-- exposed to the Data API — every path to the queue is one of the SECURITY
-- DEFINER functions below, and the two the sender uses (claim, archive) and
-- the operator's lever (reschedule) are executable by the service role only.
--
-- A message is the request, not the mail: `{ template, order_id, product_id,
-- context }`. Recipient and wording are resolved by the sender when the
-- message is claimed, so a mail queued days ago goes out with today's data.
--
-- Nothing in the database calls out except the cron job, and the URL and key
-- it calls with come from Vault at run time — no address of a deployed
-- function is written into a migration. A database whose Vault lacks the two
-- entries runs a job that finds no secret and calls nothing.

-- ── Extensions ───────────────────────────────────────────────────────────────
-- pg_cron and pgmq pin their own schema (pg_catalog, pgmq); pg_net goes where
-- Supabase puts every extension.

CREATE EXTENSION IF NOT EXISTS "pg_cron";

CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pgmq";

SELECT "pgmq"."create"('email_outbox');

-- ── History events ───────────────────────────────────────────────────────────
-- Written by the sender, with no acting user (history.user_id is nullable).
-- EMAIL_BOUNCED arrives with the webhook (WP5).

ALTER TYPE "public"."history_event" ADD VALUE IF NOT EXISTS 'EMAIL_SENT';

ALTER TYPE "public"."history_event" ADD VALUE IF NOT EXISTS 'EMAIL_FAILED';

-- ── email_settings ───────────────────────────────────────────────────────────
-- One row per template that the shop may switch off or whose timing it may
-- change (Settings → Emails, WP4). A template without a row is enabled and
-- immediate. The row is added by the migration of the feature that owns the
-- template; `queue_email` reads `is_enabled`, the trigger that queues a
-- delayed mail reads `delay_days`, and the sender reads `repeat_days` /
-- `max_sends` after a send to queue the repeat.

CREATE TABLE IF NOT EXISTS "public"."email_settings" (
    "template" "text" NOT NULL,
    "is_enabled" boolean DEFAULT true NOT NULL,
    "delay_days" smallint DEFAULT 0 NOT NULL,
    "repeat_days" smallint,
    "max_sends" smallint DEFAULT 1 NOT NULL,
    CONSTRAINT "email_settings_pkey" PRIMARY KEY ("template"),
    CONSTRAINT "email_settings_delay_days_check" CHECK (("delay_days" >= 0)),
    CONSTRAINT "email_settings_repeat_days_check" CHECK (("repeat_days" IS NULL) OR ("repeat_days" > 0)),
    CONSTRAINT "email_settings_max_sends_check" CHECK (("max_sends" >= 1))
);

ALTER TABLE "public"."email_settings" OWNER TO "postgres";

COMMENT ON TABLE "public"."email_settings" IS
    'Per-template switches the shop controls: on/off, the delay before the first send, the repeat interval and the maximum number of sends. A template without a row is enabled and immediate.';

COMMENT ON COLUMN "public"."email_settings"."repeat_days" IS
    'Days between repeats of the same mail; NULL means it is sent once.';

-- Everyone reads (the order's email panel shows what is on); only admins change the switches.
CREATE POLICY "Employees: read" ON "public"."email_settings"
    FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Admins: write" ON "public"."email_settings"
    FOR ALL TO "authenticated"
    USING ("public"."current_user_role"() IN ('ADMIN', 'SUPER_ADMIN'))
    WITH CHECK ("public"."current_user_role"() IN ('ADMIN', 'SUPER_ADMIN'));

ALTER TABLE "public"."email_settings" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."email_settings" FROM "anon";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."email_settings" TO "authenticated";

GRANT ALL ON TABLE "public"."email_settings" TO "service_role";

-- ── sent_emails ──────────────────────────────────────────────────────────────
-- The record of what went out: written once by the sender, the moment the
-- provider accepts the mail. It holds the rendered mail itself — business
-- correspondence the shop keeps for years, which a later template change must
-- not alter — plus the provider's id for the delivery reports (WP5).
-- `queue_msg_id` is unique: a resend after a crash that happened after the
-- provider accepted the mail cannot write a second row. Nothing in this table
-- is pending.

CREATE TABLE IF NOT EXISTS "public"."sent_emails" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "queue_msg_id" bigint NOT NULL,
    "template" "text" NOT NULL,
    "order_id" "uuid" NOT NULL,
    "product_id" "uuid",
    "recipient" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "body_html" "text" NOT NULL,
    "body_text" "text" NOT NULL,
    "provider_id" "text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sent_emails_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sent_emails_queue_msg_id_unique" UNIQUE ("queue_msg_id"),
    CONSTRAINT "sent_emails_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE,
    CONSTRAINT "sent_emails_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."sent_emails" OWNER TO "postgres";

CREATE INDEX "sent_emails_order_id_idx" ON "public"."sent_emails" USING "btree" ("order_id");

COMMENT ON TABLE "public"."sent_emails" IS
    'Every mail the sender got accepted by the provider, as it went out (rendered subject and bodies). Written once by the sender; the app only reads it.';

COMMENT ON COLUMN "public"."sent_emails"."provider_id" IS
    'The id the provider assigned to the mail; ''dry-run'' when the sender ran with EMAIL_DRY_RUN=true.';

-- Everyone reads; nobody but the sender (service role) writes.
CREATE POLICY "Employees: read" ON "public"."sent_emails"
    FOR SELECT TO "authenticated" USING (true);

ALTER TABLE "public"."sent_emails" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."sent_emails" FROM "anon", "authenticated";

GRANT SELECT ON TABLE "public"."sent_emails" TO "authenticated";

GRANT ALL ON TABLE "public"."sent_emails" TO "service_role";

-- ── queue_email ──────────────────────────────────────────────────────────────

/**
 * Queues one mail request. The one way anything puts a message on the queue:
 * triggers call it in the same write as the action that implies the mail, and
 * a manual send from the app would be the app calling it. Wraps pgmq.send so
 * no caller names the queue or shapes the payload, and returns NULL without
 * queuing when the template is switched off in email_settings.
 *
 * `context` holds only what cannot be looked up again at send time (a link
 * token, the sequence number of a repeat). `delay_seconds` is how long the
 * message stays invisible before a sender may claim it; a trigger that queues
 * a delayed mail takes it from email_settings.delay_days.
 *
 * @returns the queue message id, or NULL when the template is disabled.
 */
CREATE OR REPLACE FUNCTION "public"."queue_email"(
    "template" "text",
    "order_id" "uuid",
    "product_id" "uuid" DEFAULT NULL,
    "context" "jsonb" DEFAULT '{}'::"jsonb",
    "delay_seconds" integer DEFAULT 0
) RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
DECLARE
  queued_msg_id bigint;
BEGIN
  IF queue_email.template IS NULL OR queue_email.template = '' THEN
    RAISE EXCEPTION 'queue_email: template is required';
  END IF;
  IF queue_email.order_id IS NULL THEN
    RAISE EXCEPTION 'queue_email: order_id is required';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.email_settings s
    WHERE s.template = queue_email.template AND NOT s.is_enabled
  ) THEN
    RETURN NULL;
  END IF;

  SELECT pgmq.send(
    'email_outbox',
    jsonb_build_object(
      'template', queue_email.template,
      'order_id', queue_email.order_id,
      'product_id', queue_email.product_id,
      'context', COALESCE(queue_email.context, '{}'::jsonb)
    ),
    GREATEST(COALESCE(queue_email.delay_seconds, 0), 0)
  ) INTO queued_msg_id;

  RETURN queued_msg_id;
END;
$$;

ALTER FUNCTION "public"."queue_email"("text", "uuid", "uuid", "jsonb", integer) OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."queue_email"("text", "uuid", "uuid", "jsonb", integer) FROM PUBLIC, "anon";

GRANT EXECUTE ON FUNCTION "public"."queue_email"("text", "uuid", "uuid", "jsonb", integer) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."queue_email"("text", "uuid", "uuid", "jsonb", integer) TO "service_role";

-- ── The sender's two calls: claim and archive ────────────────────────────────

/**
 * Claims up to `batch_size` due messages for the sender: each one becomes
 * invisible to every other claim for `visibility_seconds` and its read count
 * goes up by one. A message the sender never archives comes back by itself
 * when the time lapses. Service role only — the drain is the only caller.
 */
CREATE OR REPLACE FUNCTION "public"."claim_emails"("visibility_seconds" integer, "batch_size" integer)
RETURNS TABLE (
    "msg_id" bigint,
    "read_ct" integer,
    "enqueued_at" timestamp with time zone,
    "vt" timestamp with time zone,
    "message" "jsonb"
)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
  SELECT r.msg_id, r.read_ct, r.enqueued_at, r.vt, r.message
  FROM pgmq.read('email_outbox', claim_emails.visibility_seconds, claim_emails.batch_size) AS r;
$$;

ALTER FUNCTION "public"."claim_emails"(integer, integer) OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."claim_emails"(integer, integer) FROM PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."claim_emails"(integer, integer) TO "service_role";

/**
 * Takes a message off the queue for good — sent, given up on, or no longer
 * needed. The archive keeps it; it is never claimed again. Returns false when
 * no such message is on the queue. Service role only.
 */
CREATE OR REPLACE FUNCTION "public"."archive_email"("msg_id" bigint) RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
  SELECT pgmq.archive('email_outbox', archive_email.msg_id);
$$;

ALTER FUNCTION "public"."archive_email"(bigint) OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."archive_email"(bigint) FROM PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."archive_email"(bigint) TO "service_role";

/**
 * Moves a queued message's due time to `delay_seconds` from now — the lever
 * for making a waiting or a claimed message due at once instead of waiting
 * for its delay or its visibility timeout. Returns false when no such message
 * is on the queue. Service role only; the e2e suite uses it in place of
 * waiting, and an operator may.
 */
CREATE OR REPLACE FUNCTION "public"."reschedule_email"("msg_id" bigint, "delay_seconds" integer) RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM pgmq.set_vt('email_outbox', reschedule_email.msg_id, GREATEST(reschedule_email.delay_seconds, 0))
  );
$$;

ALTER FUNCTION "public"."reschedule_email"(bigint, integer) OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."reschedule_email"(bigint, integer) FROM PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."reschedule_email"(bigint, integer) TO "service_role";

-- ── list_queued_emails ───────────────────────────────────────────────────────

/**
 * The mails still to go for one order: what the order's email panel lists
 * (WP3) and what the e2e suite reads the queue through. `due_at` is when a
 * sender may next claim the message — its delay, or, for a claimed message,
 * the end of its visibility timeout. Typed rows over the pgmq table, so the
 * app never touches the pgmq schema.
 */
CREATE OR REPLACE FUNCTION "public"."list_queued_emails"("order_id" "uuid")
RETURNS TABLE (
    "msg_id" bigint,
    "template" "text",
    "product_id" "uuid",
    "due_at" timestamp with time zone,
    "attempts" integer,
    "queued_at" timestamp with time zone
)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" = ''
    AS $$
  SELECT
    q.msg_id,
    q.message->>'template',
    (q.message->>'product_id')::uuid,
    q.vt,
    q.read_ct,
    q.enqueued_at
  FROM pgmq.q_email_outbox AS q
  WHERE q.message->>'order_id' = list_queued_emails.order_id::text
  ORDER BY q.vt, q.msg_id;
$$;

ALTER FUNCTION "public"."list_queued_emails"("uuid") OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."list_queued_emails"("uuid") FROM PUBLIC, "anon";

GRANT EXECUTE ON FUNCTION "public"."list_queued_emails"("uuid") TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."list_queued_emails"("uuid") TO "service_role";

-- ── The drain cron ───────────────────────────────────────────────────────────

/**
 * The cron job's body: wakes the sender when something is due. Cheap when
 * nothing is — one index lookup on the queue table — and silent when the
 * Vault lacks `project_url` or `service_role_key` (a fresh or reset database),
 * so a database without them runs a job that calls nothing.
 *
 * The call is `POST <project_url>/functions/v1/send-email` with the
 * service-role key as the bearer token and `{"action":"drain"}` as the body;
 * pg_net performs it asynchronously, the job does not wait for the response.
 * Owned by postgres with definer rights so it may read the Vault; nobody but
 * the scheduler calls it.
 */
CREATE OR REPLACE FUNCTION "public"."drain_emails"() RETURNS void
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
DECLARE
  project_url text;
  service_role_key text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pgmq.q_email_outbox WHERE vt <= now()) THEN
    RETURN;
  END IF;

  SELECT decrypted_secret INTO project_url
  FROM vault.decrypted_secrets WHERE name = 'project_url';
  SELECT decrypted_secret INTO service_role_key
  FROM vault.decrypted_secrets WHERE name = 'service_role_key';

  IF project_url IS NULL OR service_role_key IS NULL THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := project_url || '/functions/v1/send-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := '{"action":"drain"}'::jsonb,
    timeout_milliseconds := 25000
  );
END;
$$;

ALTER FUNCTION "public"."drain_emails"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."drain_emails"() FROM PUBLIC, "anon", "authenticated", "service_role";

-- Every ten seconds; pg_cron's second-level schedule. Scheduling under an
-- existing name replaces the job, so re-running this is harmless.
SELECT "cron"."schedule"('drain_emails', '10 seconds', 'SELECT public.drain_emails()');
