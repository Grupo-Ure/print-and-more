-- 20261023184558_expire_approval_requests.sql — a request nobody answered expires
--
-- CUSTOMER_APPROVAL.md, WP6. The last writer of product_approval_requests:
-- once a day, every request still PENDING past its expires_at is closed as
-- EXPIRED. Like the other writers it changes the request's status and
-- nothing else; fn_approval_request_closed (WP2) already carries the EXPIRED
-- branch — the product back to pre-press, the history entry, and the
-- approval-expired mail to the shop, whose row in Settings → Emails lands
-- here with its default wording.
--
-- The customer's page does not wait for this run: the edge function treats a
-- pending request past expires_at as expired the moment it is (WP3). The run
-- is what moves the product and tells the shop.

-- ── fn_expire_approval_requests ──────────────────────────────────────────────

/**
 * Closes every PENDING request whose link has run out as EXPIRED, stamping
 * responded_at. Everything that follows on the product is
 * fn_approval_request_closed's, row by row, in this one statement's
 * transaction. settled_by stays null: nobody decided.
 *
 * Owned by postgres with definer rights, so the closing trigger moves the
 * waiting product past the lock guards. The daily cron job is its caller;
 * the service role may call it too (the e2e suite runs it on demand).
 *
 * @returns how many requests it expired.
 */
CREATE OR REPLACE FUNCTION "public"."fn_expire_approval_requests"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
DECLARE
  expired integer;
BEGIN
  UPDATE public.product_approval_requests
  SET status = 'EXPIRED',
      responded_at = now()
  WHERE status = 'PENDING'
    AND expires_at < now();

  GET DIAGNOSTICS expired = ROW_COUNT;
  RETURN expired;
END;
$$;

ALTER FUNCTION "public"."fn_expire_approval_requests"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_expire_approval_requests"() FROM PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."fn_expire_approval_requests"() TO "service_role";

COMMENT ON TABLE "public"."product_approval_requests" IS
    'One round of asking the customer to approve a proof: the files, the message, one private link (as the SHA-256 of its token), one expiry, one decision. A rework is a new row with the next round; the old one stays. Written only through create_approval_request, settle_approval_request, withdraw_approval_request, settle_approval_request_by_token and the daily fn_expire_approval_requests.';

-- ── The expired mail's row in Settings → Emails ──────────────────────────────
-- Default wording; the shop edits it in Settings → Emails. The link that
-- opens the order in the app is a fixed element of the template.

INSERT INTO "public"."email_settings" ("template", "subject", "body", "placeholders")
VALUES (
    'approval-expired',
    'No answer to the approval request for {{productNumber}}',
    E'The approval request for {{productLabel}} ({{productNumber}}) of order {{orderNumber}}, customer {{customerName}}, was sent on {{sentAt}} and expired after {{waitedDays}} days without an answer.\n\nThe product is back in pre-press. Please decide whether to remind the customer and send a new round, or release it another way.',
    ARRAY['customerName', 'orderNumber', 'productNumber', 'productLabel', 'sentAt', 'waitedDays']
)
ON CONFLICT ("template") DO NOTHING;

-- ── The daily run ────────────────────────────────────────────────────────────
-- 05:00 UTC, before the shop opens, so the expired mails are waiting in the
-- morning. Scheduling under an existing name replaces the job, so re-running
-- this is harmless.

SELECT "cron"."schedule"('expire_approval_requests', '0 5 * * *', 'SELECT public.fn_expire_approval_requests()');
