-- 20261013161807_queue_email_settings_delay.sql — queue_email takes a mail's delay from Settings
--
-- EMAIL.md, WP4. The shop edits a delayed mail's timing in Settings → Emails
-- (`email_settings`). For the edit to reach the queue, the one function that
-- queues a mail reads the delay itself: a caller that passes no delay gets the
-- template's `delay_days`, so no trigger has to look the setting up, and a
-- changed delay applies to every mail queued afterwards. A mail already
-- waiting keeps the due time it was queued with.
--
-- A caller that passes a delay keeps it — the sender queuing a repeat passes
-- `repeat_days`, and a mail that must go at once passes 0.
--
-- Both day columns are capped at a year: the delay reaches pgmq.send in
-- seconds, as an integer, which a smallint count of days could overflow.
-- No row holds more today; no feature has added one yet.

-- ── email_settings: a year at most ───────────────────────────────────────────

ALTER TABLE "public"."email_settings"
    ADD CONSTRAINT "email_settings_delay_days_max_check" CHECK (("delay_days" <= 365));

ALTER TABLE "public"."email_settings"
    ADD CONSTRAINT "email_settings_repeat_days_max_check" CHECK (("repeat_days" <= 365));

-- ── queue_email ──────────────────────────────────────────────────────────────
-- Same signature; `delay_seconds` now defaults to NULL, meaning "the
-- template's delay from email_settings". Owner and grants carry over.

/**
 * Queues one mail request. The one way anything puts a message on the queue:
 * triggers call it in the same write as the action that implies the mail, and
 * a manual send from the app would be the app calling it. Wraps pgmq.send so
 * no caller names the queue or shapes the payload, and returns NULL without
 * queuing when the template is switched off in email_settings.
 *
 * `context` holds only what cannot be looked up again at send time (a link
 * token, the sequence number of a repeat). `delay_seconds` is how long the
 * message stays invisible before a sender may claim it; left NULL, it is the
 * template's email_settings.delay_days (none without a row).
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
  IF queue_email.order_id IS NULL THEN
    RAISE EXCEPTION 'queue_email: order_id is required';
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
