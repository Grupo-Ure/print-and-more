-- 20261013194145_email_bounces.sql — delivery reports on the sent record, the bounced address on the customer
--
-- EMAIL.md, WP5. Hours after a mail went out, the provider reports what became
-- of it: delivered, bounced, or marked as spam. The `email-webhook` function
-- receives the report and marks the sent mail's record with it. A bounce is
-- also an entry on the order's history and a flag on the customer's address,
-- so whoever opens the order sees that mail to it does not arrive. Nothing is
-- retried: the address is the problem, and a person corrects it on the
-- customer — which is what clears the flag.
--
-- The webhook writes with the service role; the app only reads these columns.

-- ── sent_emails: what the provider reported ──────────────────────────────────
-- Each report sets its own column; a mail can be delivered and still be
-- reported as spam later. The reason is Resend's wording of the bounce.

ALTER TABLE "public"."sent_emails"
    ADD COLUMN "delivered_at" timestamp with time zone,
    ADD COLUMN "bounced_at" timestamp with time zone,
    ADD COLUMN "bounce_reason" "text",
    ADD COLUMN "complained_at" timestamp with time zone;

COMMENT ON COLUMN "public"."sent_emails"."delivered_at" IS
    'When the provider reported the mail delivered; NULL until it does, or if it never does.';

COMMENT ON COLUMN "public"."sent_emails"."bounced_at" IS
    'When the provider reported the mail bounced; NULL unless it did. A bounce is never retried.';

COMMENT ON COLUMN "public"."sent_emails"."bounce_reason" IS
    'The provider''s wording of the bounce, as shown on the order.';

COMMENT ON COLUMN "public"."sent_emails"."complained_at" IS
    'When the provider reported the recipient marked the mail as spam; NULL unless they did.';

-- The webhook finds the record by the provider's id of the mail.
CREATE INDEX "sent_emails_provider_id_idx" ON "public"."sent_emails" USING "btree" ("provider_id");

-- ── History event ────────────────────────────────────────────────────────────
-- Written by the webhook, with no acting user, on the order the mail was about.

ALTER TYPE "public"."history_event" ADD VALUE IF NOT EXISTS 'EMAIL_BOUNCED';

-- ── customers.email_bounced_at ───────────────────────────────────────────────
-- Set by the webhook when a mail to the customer's current address bounces;
-- cleared by the trigger below the moment the address is changed. Not part of
-- the product's completeness: it is a flag on the customer, nothing more.

ALTER TABLE "public"."customers"
    ADD COLUMN "email_bounced_at" timestamp with time zone;

COMMENT ON COLUMN "public"."customers"."email_bounced_at" IS
    'When a mail to the current email address last bounced; NULL once the address is changed.';

/**
 * A changed address is a new address: whatever bounced was the old one. Runs
 * before an update that touches `email`, so the flag never outlives the
 * address it was raised for — whether the app, the webhook or an operator
 * writes the row.
 */
CREATE OR REPLACE FUNCTION "public"."fn_clear_customer_email_bounce"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" = ''
    AS $$
BEGIN
  IF OLD.email IS DISTINCT FROM NEW.email THEN
    NEW.email_bounced_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."fn_clear_customer_email_bounce"() OWNER TO "postgres";

CREATE OR REPLACE TRIGGER "trg_clear_customer_email_bounce"
    BEFORE UPDATE OF "email" ON "public"."customers"
    FOR EACH ROW EXECUTE FUNCTION "public"."fn_clear_customer_email_bounce"();
