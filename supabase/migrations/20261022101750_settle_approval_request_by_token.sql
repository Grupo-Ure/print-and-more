-- 20261022101750_settle_approval_request_by_token.sql — the customer's answer
--
-- CUSTOMER_APPROVAL.md, WP3. The fourth writer of product_approval_requests:
-- the customer's decision on the approval page, posted to the
-- customer-approval edge function, which calls this with the service role.
-- The page has no session; the link's token is the whole authentication, so
-- the request is found by the token's hash, the way create_approval_request
-- stored it.
--
-- Like the other writers it changes the request's status and nothing else;
-- fn_approval_request_closed does what an approval or a request for changes
-- implies for the product, the stock, the history and the mail.

/**
 * Records the customer's answer from the approval page. Moves the PENDING
 * request the token belongs to to APPROVED or CHANGES_REQUESTED, with the
 * customer's note and the caller's IP and user agent for the record;
 * settled_by stays null, which is how the history and the decided mail tell
 * the page's answers from an employee's.
 *
 * Refuses: an unknown token (SQLSTATE P0002); a decision other than the two;
 * a request for changes without a note, as settle_approval_request does; a
 * request that is no longer PENDING; a request past its expiry the expiry run
 * has not closed yet — the link stops working at expires_at, not at the next
 * run. The edge function reads the request again after a refusal and shows
 * the customer what stands.
 *
 * @returns the request's id.
 */
CREATE OR REPLACE FUNCTION "public"."settle_approval_request_by_token"(
    "token" "text",
    "decision" "public"."approval_request_status",
    "note" "text" DEFAULT NULL,
    "ip" "text" DEFAULT NULL,
    "user_agent" "text" DEFAULT NULL
) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
DECLARE
  request     RECORD;
  clean_note  text := NULLIF(btrim(settle_approval_request_by_token.note), '');
BEGIN
  IF settle_approval_request_by_token.decision NOT IN ('APPROVED', 'CHANGES_REQUESTED') THEN
    RAISE EXCEPTION 'settle_approval_request_by_token: the decision must be APPROVED or CHANGES_REQUESTED';
  END IF;
  IF settle_approval_request_by_token.decision = 'CHANGES_REQUESTED' AND clean_note IS NULL THEN
    RAISE EXCEPTION 'settle_approval_request_by_token: a request for changes needs a note';
  END IF;

  SELECT r.id, r.status, r.expires_at
  INTO request
  FROM public.product_approval_requests r
  WHERE r.token_hash = encode(sha256(convert_to(COALESCE(settle_approval_request_by_token.token, ''), 'UTF8')), 'hex')
  FOR UPDATE;

  IF request.id IS NULL THEN
    RAISE EXCEPTION 'settle_approval_request_by_token: no request has this token'
      USING ERRCODE = 'P0002';
  END IF;
  IF request.status <> 'PENDING' THEN
    RAISE EXCEPTION 'settle_approval_request_by_token: request % is % and no longer pending', request.id, request.status;
  END IF;
  IF request.expires_at <= now() THEN
    RAISE EXCEPTION 'settle_approval_request_by_token: request % expired at %', request.id, request.expires_at;
  END IF;

  UPDATE public.product_approval_requests
  SET status = settle_approval_request_by_token.decision,
      note = clean_note,
      responded_at = now(),
      responded_ip = NULLIF(btrim(settle_approval_request_by_token.ip), ''),
      responded_user_agent = NULLIF(btrim(settle_approval_request_by_token.user_agent), '')
  WHERE id = request.id;

  RETURN request.id;
END;
$$;

ALTER FUNCTION "public"."settle_approval_request_by_token"("text", "public"."approval_request_status", "text", "text", "text") OWNER TO "postgres";

-- The customer-approval edge function is the one caller, with the service
-- role; the key never leaves Supabase. Nobody signed in calls it — an
-- employee settles through settle_approval_request.
REVOKE ALL ON FUNCTION "public"."settle_approval_request_by_token"("text", "public"."approval_request_status", "text", "text", "text") FROM PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."settle_approval_request_by_token"("text", "public"."approval_request_status", "text", "text", "text") TO "service_role";

COMMENT ON TABLE "public"."product_approval_requests" IS
    'One round of asking the customer to approve a proof: the files, the message, one private link (as the SHA-256 of its token), one expiry, one decision. A rework is a new row with the next round; the old one stays. Written only through create_approval_request, settle_approval_request, withdraw_approval_request, settle_approval_request_by_token and, later, the expiry cron.';
