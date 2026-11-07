-- The email history entries come from the mail tables (MKS-7). The sender and
-- the webhook wrote EMAIL_SENT, EMAIL_FAILED and EMAIL_BOUNCED themselves,
-- next to the record, and each had to skip a mail with no order. From here
-- they write the record alone: sent_emails, failed_emails, the bounce stamped
-- on sent_emails. A trigger on the record writes the order's history entry
-- for a mail about an order — in the same transaction, so the record and its
-- entry can no longer part — and a mail with no order has no entry because
-- the trigger's condition says so. The bounce trigger also flags the
-- customer's address, the other thing a bounce means for an order.
--
-- The entries' meta is the one the functions wrote, so the History tab reads
-- them as before.

-- ── sent_emails: the bounce in full ──────────────────────────────────────────
-- The provider's category and status code went only into the history entry's
-- meta; the trigger reads them from the record, so the record carries them.

ALTER TABLE "public"."sent_emails"
    ADD COLUMN "bounce_classification" "text",
    ADD COLUMN "bounce_status_code" "text";

COMMENT ON COLUMN "public"."sent_emails"."bounce_classification" IS
    'The provider''s category of the bounce (e.g. an invalid recipient); NULL unless it bounced, or the provider sent none.';

COMMENT ON COLUMN "public"."sent_emails"."bounce_status_code" IS
    'The receiving server''s enhanced status code of the bounce (e.g. 5.1.1); NULL unless it bounced, or the provider sent none.';

-- ── EMAIL_SENT ───────────────────────────────────────────────────────────────

/**
 * The order's EMAIL_SENT entry for a sent mail about an order. Runs as the
 * owner, so the entry passes the history guard as the sender's did.
 *
 * @trigger AFTER INSERT ON sent_emails (per row), when the mail has an order
 */
CREATE OR REPLACE FUNCTION "public"."fn_sent_email_history"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
BEGIN
  INSERT INTO public.history (order_id, product_id, event_type, user_id, meta)
  VALUES (
    NEW.order_id, NEW.product_id, 'EMAIL_SENT', NULL,
    jsonb_build_object(
      'template', NEW.template, 'recipient', NEW.recipient, 'subject', NEW.subject,
      'provider_id', NEW.provider_id, 'sent_email_id', NEW.id
    )
  );
  RETURN NULL;
END;
$$;

ALTER FUNCTION "public"."fn_sent_email_history"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_sent_email_history"() FROM PUBLIC;

CREATE TRIGGER "trg_sent_email_history"
    AFTER INSERT ON "public"."sent_emails"
    FOR EACH ROW
    WHEN (NEW."order_id" IS NOT NULL)
    EXECUTE FUNCTION "public"."fn_sent_email_history"();

-- ── EMAIL_FAILED ─────────────────────────────────────────────────────────────

/**
 * The order's EMAIL_FAILED entry for a given-up mail about an order.
 *
 * @trigger AFTER INSERT ON failed_emails (per row), when the mail has an order
 */
CREATE OR REPLACE FUNCTION "public"."fn_failed_email_history"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
BEGIN
  INSERT INTO public.history (order_id, product_id, event_type, user_id, meta)
  VALUES (
    NEW.order_id, NEW.product_id, 'EMAIL_FAILED', NULL,
    jsonb_build_object(
      'template', NEW.template, 'reason', NEW.reason, 'recipient', NEW.recipient,
      'error', NEW.error, 'attempts', NEW.attempts
    )
  );
  RETURN NULL;
END;
$$;

ALTER FUNCTION "public"."fn_failed_email_history"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_failed_email_history"() FROM PUBLIC;

CREATE TRIGGER "trg_failed_email_history"
    AFTER INSERT ON "public"."failed_emails"
    FOR EACH ROW
    WHEN (NEW."order_id" IS NOT NULL)
    EXECUTE FUNCTION "public"."fn_failed_email_history"();

-- ── EMAIL_BOUNCED ────────────────────────────────────────────────────────────

/**
 * What a bounce of a mail about an order means for the order: its
 * EMAIL_BOUNCED entry, and the customer's address flagged when the mail went
 * to it. A customer who has changed address since the mail went out is not
 * flagged for the old one — fn_clear_customer_email_bounce says the same
 * thing from the other side. Fires once per mail: only the stamp that takes
 * bounced_at from NULL, so a report delivered twice writes nothing twice.
 *
 * @trigger AFTER UPDATE OF bounced_at ON sent_emails (per row), when the mail first bounces and has an order
 */
CREATE OR REPLACE FUNCTION "public"."fn_sent_email_bounced"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
BEGIN
  INSERT INTO public.history (order_id, product_id, event_type, user_id, meta)
  VALUES (
    NEW.order_id, NEW.product_id, 'EMAIL_BOUNCED', NULL,
    jsonb_build_object(
      'template', NEW.template, 'recipient', NEW.recipient, 'reason', NEW.bounce_reason,
      'bounce_classification', NEW.bounce_classification, 'bounce_status_code', NEW.bounce_status_code,
      'sent_email_id', NEW.id, 'provider_id', NEW.provider_id
    )
  );

  UPDATE public.customers c
  SET email_bounced_at = NEW.bounced_at
  FROM public.orders o
  WHERE o.id = NEW.order_id
    AND c.id = o.customer_id
    AND lower(c.email) = lower(NEW.recipient);

  RETURN NULL;
END;
$$;

ALTER FUNCTION "public"."fn_sent_email_bounced"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_sent_email_bounced"() FROM PUBLIC;

CREATE TRIGGER "trg_sent_email_bounced"
    AFTER UPDATE OF "bounced_at" ON "public"."sent_emails"
    FOR EACH ROW
    WHEN (OLD."bounced_at" IS NULL AND NEW."bounced_at" IS NOT NULL AND NEW."order_id" IS NOT NULL)
    EXECUTE FUNCTION "public"."fn_sent_email_bounced"();
