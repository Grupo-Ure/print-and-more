-- 20261119142336_prepress_ready_event.sql — one event for entering pre-press
--
-- TRANSACTION_RECORD.md, WP2 (decisions 7, 13, 14). Entering pre-press from
-- setup is automatic only from this package on, so it is one event,
-- PREPRESS_READY: PREPRESS_READY_AUTO takes that name, and
-- PREPRESS_READY_MANUAL goes. The manual return from production is
-- RETURNED_TO_PREPRESS (added in 20261118182150_transaction_record_events).
--
-- Postgres cannot drop an enum value, so the type is rebuilt: the old one is
-- renamed aside, the new one created without PREPRESS_READY_MANUAL, the
-- column converted — every entry written with either pre-press event becomes
-- PREPRESS_READY — and the old type dropped. The conversion rewrites the
-- table without firing row triggers, so fn_refuse_history_change does not
-- see it; the app is pre-launch and holds no record to keep apart.
--
-- What depends on the type is the history column and fn_write_history's
-- signature. The writer is dropped with the old type and created again
-- exactly as 20261118182151_one_history defined it, with its grants. Its
-- callers name the event as a string literal in PL/pgSQL, resolved when they
-- run, so none of them needs redefining.

ALTER TYPE "public"."history_event" RENAME TO "history_event_old";

CREATE TYPE "public"."history_event" AS ENUM (
    'ORDER_CREATED',
    'PROCESSING_STARTED',
    'PREPRESS_READY',
    'PRODUCTION_READY_SET',
    'MARKED_DONE',
    'EMERGENCY_TRIGGERED',
    'CUSTOMER_APPROVAL_ACTIVATED',
    'CUSTOMER_APPROVAL_DEACTIVATED',
    'CUSTOMER_APPROVAL_GRANTED',
    'CUSTOMER_APPROVAL_EXPIRED',
    'CUSTOMER_APPROVAL_BYPASSED',
    'ROLLED_BACK',
    'CANCELLED',
    'ERP_EXPORTED',
    'ASSIGNEE_CHANGED',
    'ORDER_FINISHED',
    'ORDER_REOPENED',
    'ORDER_BILLED',
    'ORDER_CLOSED_CASH',
    'ORDER_ARCHIVED',
    'TIME_LOGGED',
    'TIME_LOG_DELETED',
    'SETTINGS_CHANGED',
    'PRODUCT_CREATED',
    'PRODUCT_UPDATED',
    'PRODUCT_CANCELLED',
    'PRODUCT_DELETED',
    'FILE_ADDED',
    'FILE_REMOVED',
    'EMAIL_SENT',
    'EMAIL_FAILED',
    'EMAIL_BOUNCED',
    'CUSTOMER_APPROVAL_REQUESTED',
    'CUSTOMER_APPROVAL_CHANGES_REQUESTED',
    'CUSTOMER_APPROVAL_WITHDRAWN',
    'CUSTOMER_CREATED',
    'CUSTOMER_UPDATED',
    'FILE_RENAMED',
    'FILE_ROLE_CHANGED',
    'ORDER_BILLING_NOTE_CHANGED',
    'STOCK_BOOKED',
    'STOCK_AUTO_DEDUCTED',
    'RETURNED_TO_PREPRESS'
);

ALTER TYPE "public"."history_event" OWNER TO "postgres";

ALTER TABLE "public"."history"
    ALTER COLUMN "event_type" TYPE "public"."history_event"
    USING (
      CASE "event_type"::"text"
        WHEN 'PREPRESS_READY_AUTO' THEN 'PREPRESS_READY'
        WHEN 'PREPRESS_READY_MANUAL' THEN 'PREPRESS_READY'
        ELSE "event_type"::"text"
      END
    )::"public"."history_event";

DROP FUNCTION "public"."fn_write_history"("public"."history_event_old", "jsonb", "jsonb", "text");

DROP TYPE "public"."history_event_old";

-- ── fn_write_history, as 20261118182151_one_history defined it ───────────────

/**
 * The one writer of history. Fills in who (auth.uid(); null where there is
 * no session — the cron jobs, the mail sender, the customer's page), the
 * action id, and the links a caller left implicit — a product's order, a
 * file's order — so that the order's History tab and the employee read rule
 * find every entry about a product or a file through order_id. A caller
 * passes the most specific link it has, as `links`:
 *
 *   {"order_id": …, "product_id": …, "customer_id": …, "file_id": …,
 *    "stamp_model_id": …, "textile_variant_id": …}
 *
 * The action id is created by the first entry of a transaction and kept in a
 * setting that lasts for that transaction only (set_config(…, true)); every
 * later entry of the same transaction reuses it. One call from the app is one
 * transaction, so the entries of one action — a cancel and the products it
 * cancels, a release and the assignee it hands over — share the id, and two
 * separate actions never do.
 *
 * Runs as the owner: it writes where the caller may not, and it stays that
 * way once the client loses INSERT (WP7). Not executable by an app role —
 * every caller is a trigger or a function that runs as the owner itself.
 *
 * @returns the id of the entry written.
 */
CREATE OR REPLACE FUNCTION "public"."fn_write_history"(
    "p_event" "public"."history_event",
    "p_links" "jsonb",
    "p_meta" "jsonb" DEFAULT NULL,
    "p_reason" "text" DEFAULT NULL
) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
DECLARE
  v_links               jsonb := COALESCE(p_links, '{}'::jsonb);
  v_order_id            uuid := (v_links->>'order_id')::uuid;
  v_product_id          uuid := (v_links->>'product_id')::uuid;
  v_customer_id         uuid := (v_links->>'customer_id')::uuid;
  v_file_id             uuid := (v_links->>'file_id')::uuid;
  v_stamp_model_id      uuid := (v_links->>'stamp_model_id')::uuid;
  v_textile_variant_id  uuid := (v_links->>'textile_variant_id')::uuid;
  v_action_id           uuid;
  v_entry_id            uuid;
BEGIN
  IF v_order_id IS NULL AND v_product_id IS NOT NULL THEN
    SELECT p.order_id INTO v_order_id FROM public.products p WHERE p.id = v_product_id;
  END IF;
  IF v_order_id IS NULL AND v_file_id IS NOT NULL THEN
    SELECT f.order_id INTO v_order_id FROM public.files f WHERE f.id = v_file_id;
  END IF;

  v_action_id := NULLIF(current_setting('pam.action_id', true), '')::uuid;
  IF v_action_id IS NULL THEN
    v_action_id := gen_random_uuid();
    PERFORM set_config('pam.action_id', v_action_id::text, true);
  END IF;

  INSERT INTO public.history (
    order_id, product_id, customer_id, file_id, stamp_model_id, textile_variant_id,
    event_type, user_id, reason, meta, action_id
  ) VALUES (
    v_order_id, v_product_id, v_customer_id, v_file_id, v_stamp_model_id, v_textile_variant_id,
    p_event, auth.uid(), p_reason, p_meta, v_action_id
  )
  RETURNING id INTO v_entry_id;

  RETURN v_entry_id;
END;
$$;

ALTER FUNCTION "public"."fn_write_history"("public"."history_event", "jsonb", "jsonb", "text") OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_write_history"("public"."history_event", "jsonb", "jsonb", "text") FROM PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."fn_write_history"("public"."history_event", "jsonb", "jsonb", "text") TO "service_role";
