-- Mails without an order (MKS-7, the backup runtime's alert mails being the
-- first). The email runtime recorded every mail against an order: queue_email
-- refused a message without one, sent_emails.order_id was NOT NULL, and a
-- mail the sender gave up on existed only as an EMAIL_FAILED entry on the
-- order's history. From here a mail may have no order: the sent and the
-- failed mails each have a table, history stays the record of an order, and
-- an order-less mail is recorded in the tables alone. The vault note
-- "Email runtime" ("Mails without an order") is the requirement.

-- ── sent_emails: the order is optional ───────────────────────────────────────

ALTER TABLE "public"."sent_emails" ALTER COLUMN "order_id" DROP NOT NULL;

COMMENT ON TABLE "public"."sent_emails" IS
    'Every mail the sender got accepted by the provider, as it went out (rendered subject and bodies). Written once by the sender; the app only reads it. order_id is NULL for a mail about the system rather than an order.';

-- ── failed_emails: the mails the sender gave up on ───────────────────────────

-- One row per message the sender archived without sending because it could
-- not be sent: a template it does not know, a template without its settings
-- row, a wording that does not render, a lookup or the provider refusing it
-- for the last allowed time. The shape of sent_emails as far as a failed mail
-- has one; `recipient` is NULL where the failure came before it was looked up.
-- `queue_msg_id` is unique for the same reason as on sent_emails: one record
-- per message. A mail archived unsent because it was no longer wanted, or
-- switched off, or its order gone, is not a failure and has no row.

CREATE TABLE IF NOT EXISTS "public"."failed_emails" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "queue_msg_id" bigint NOT NULL,
    "template" "text" NOT NULL,
    "order_id" "uuid",
    "product_id" "uuid",
    "recipient" "text",
    "reason" "text" NOT NULL,
    "error" "text",
    "attempts" integer NOT NULL,
    "failed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "failed_emails_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "failed_emails_queue_msg_id_unique" UNIQUE ("queue_msg_id"),
    CONSTRAINT "failed_emails_reason_check" CHECK ("reason" IN ('unknown_template', 'no_settings_row', 'render_failed', 'resolve_failed', 'provider_refused')),
    CONSTRAINT "failed_emails_attempts_check" CHECK ("attempts" >= 1),
    CONSTRAINT "failed_emails_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE,
    CONSTRAINT "failed_emails_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."failed_emails" OWNER TO "postgres";

CREATE INDEX "failed_emails_order_id_idx" ON "public"."failed_emails" USING "btree" ("order_id");

COMMENT ON TABLE "public"."failed_emails" IS
    'Every mail the sender gave up on, with why. Written once by the sender; the app only reads it. order_id is NULL for a mail about the system rather than an order.';

COMMENT ON COLUMN "public"."failed_emails"."reason" IS
    'What stopped the mail: unknown_template, no_settings_row, render_failed (the wording names a slot the data lacks), resolve_failed (looking the data up failed on the last allowed attempt), provider_refused (the provider refused it on the last allowed attempt).';

COMMENT ON COLUMN "public"."failed_emails"."attempts" IS
    'The claims the message had when it was given up: 1 when the sender gave it up at once, the allowed maximum after retries.';

-- Everyone reads; nobody but the sender (service role) writes.
CREATE POLICY "Employees: read" ON "public"."failed_emails"
    FOR SELECT TO "authenticated" USING (true);

ALTER TABLE "public"."failed_emails" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."failed_emails" FROM "anon", "authenticated";

GRANT SELECT ON TABLE "public"."failed_emails" TO "authenticated";

-- ── queue_email: the order is optional ───────────────────────────────────────

/**
 * Queues one mail request. The one way anything puts a message on the queue:
 * triggers call it in the same write as the action that implies the mail, a
 * scheduled job calls it for a mail about the system, and a manual send from
 * the app would be the app calling it. Wraps pgmq.send so no caller names the
 * queue or shapes the payload, and returns NULL without queuing when the
 * template is switched off in email_settings.
 *
 * `order_id` is the order the mail is about, or NULL for a mail about the
 * system (a backup notice), which is then recorded in sent_emails or
 * failed_emails alone and never on a history. `context` holds only what
 * cannot be looked up again at send time (a link token, the sequence number of
 * a repeat). `delay_seconds` is how long the message stays invisible before a
 * sender may claim it; left NULL, it is the template's
 * email_settings.delay_days (none without a row).
 *
 * @returns the queue message id, or NULL when the template is disabled.
 */
CREATE OR REPLACE FUNCTION "public"."queue_email"(
    "template" "text",
    "order_id" "uuid",
    "product_id" "uuid" DEFAULT NULL,
    "context" "jsonb" DEFAULT '{}'::"jsonb",
    "delay_seconds" integer DEFAULT NULL
) RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
DECLARE
  queued_msg_id bigint;
  setting_is_enabled boolean;
  setting_delay_days smallint;
BEGIN
  IF queue_email.template IS NULL OR queue_email.template = '' THEN
    RAISE EXCEPTION 'queue_email: template is required';
  END IF;

  -- No row leaves both NULL: enabled, no delay.
  SELECT s.is_enabled, s.delay_days
  INTO setting_is_enabled, setting_delay_days
  FROM public.email_settings s
  WHERE s.template = queue_email.template;

  IF setting_is_enabled IS FALSE THEN
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
    GREATEST(COALESCE(queue_email.delay_seconds, COALESCE(setting_delay_days, 0) * 86400), 0)
  ) INTO queued_msg_id;

  RETURN queued_msg_id;
END;
$$;
