-- 20261118182153_history_writers.sql — the database's writers move onto fn_write_history
--
-- TRANSACTION_RECORD.md, WP0. Every function that inserted into `history`
-- itself now calls the one writer (20261118182151_one_history), so its
-- entries carry an action id and completed links; its event and meta are
-- unchanged, so the History tab reads them as before. Redefined here, each
-- with its body as it stood, the insert replaced:
--
--   release_to_production, force_release_to_production
--                                       20261023115425_release_to_production
--   create_approval_request, fn_approval_request_closed
--                                       20261022090608_customer_approval_requests
--   fn_sent_email_history, fn_failed_email_history, fn_sent_email_bounced
--                                       20261106233908_email_history_triggers
--
-- settle_approval_request and withdraw_approval_request write no entry of
-- their own (fn_approval_request_closed does, on the round's close). The two
-- remaining direct writers lose their inserts with their own packages:
-- fn_assign_stage_default_assignee (WP3, the products trigger records the
-- handover) and duplicate_order (WP4, a copy is recorded as a new order).
-- Owners and grants are kept by CREATE OR REPLACE.

-- ── release_to_production ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION "public"."release_to_production"("product_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
DECLARE
  actor          uuid := auth.uid();
  product        RECORD;
  newest_status  public.approval_request_status;
  deductions     jsonb;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'release_to_production: a signed-in user is required';
  END IF;

  SELECT p.id, p.order_id, p.status, p.is_cancelled, p.deadline,
         o.order_number, o.status AS order_status, o.deadline AS order_deadline
  INTO product
  FROM public.products p
  JOIN public.orders o ON o.id = p.order_id
  WHERE p.id = release_to_production.product_id
  FOR UPDATE OF p;

  IF product.id IS NULL THEN
    RAISE EXCEPTION 'release_to_production: product % does not exist', release_to_production.product_id;
  END IF;
  IF product.is_cancelled THEN
    RAISE EXCEPTION 'release_to_production: product % is cancelled', product.id;
  END IF;
  IF product.status <> 'PREPRESS' THEN
    RAISE EXCEPTION 'release_to_production: product % is % and must be in PREPRESS', product.id, product.status;
  END IF;
  IF product.order_status = 'QUOTE' THEN
    RAISE EXCEPTION 'release_to_production: order % is still a quote', product.order_id;
  END IF;
  IF COALESCE(product.deadline, product.order_deadline) IS NULL THEN
    RAISE EXCEPTION 'release_to_production: product % has no deadline', product.id;
  END IF;

  SELECT r.status INTO newest_status
  FROM public.product_approval_requests r
  WHERE r.product_id = product.id
  ORDER BY r.round DESC
  LIMIT 1;

  IF newest_status IS NOT NULL AND newest_status <> 'APPROVED' THEN
    RAISE EXCEPTION 'release_to_production: the newest approval round of product % is %', product.id, newest_status;
  END IF;

  deductions := public.fn_production_deductions(product.id);
  IF jsonb_array_length(deductions) > 0 THEN
    PERFORM public.book_production_deductions(
      deductions,
      'Automatic on production release ' || product.order_number,
      false
    );
  END IF;

  -- As the owner, past fn_refuse_direct_release.
  UPDATE public.products SET status = 'IN_PRODUCTION' WHERE id = product.id;

  PERFORM public.fn_write_history(
    'PRODUCTION_READY_SET',
    jsonb_build_object('order_id', product.order_id, 'product_id', product.id)
  );
END;
$$;

-- ── force_release_to_production ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION "public"."force_release_to_production"("product_id" "uuid", "reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
DECLARE
  actor         uuid := auth.uid();
  clean_reason  text := NULLIF(btrim(force_release_to_production.reason), '');
  product       RECORD;
  deductions    jsonb;
  booking       jsonb := jsonb_build_object('ok', true, 'shortages', '[]'::jsonb);
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'force_release_to_production: a signed-in user is required';
  END IF;
  IF public.current_user_role() IS DISTINCT FROM 'ADMIN'
     AND public.current_user_role() IS DISTINCT FROM 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'force_release_to_production: only an admin may force a release';
  END IF;
  IF clean_reason IS NULL THEN
    RAISE EXCEPTION 'force_release_to_production: a reason is required';
  END IF;

  SELECT p.id, p.order_id, p.status, p.is_cancelled, o.order_number, o.status AS order_status
  INTO product
  FROM public.products p
  JOIN public.orders o ON o.id = p.order_id
  WHERE p.id = force_release_to_production.product_id
  FOR UPDATE OF p;

  IF product.id IS NULL THEN
    RAISE EXCEPTION 'force_release_to_production: product % does not exist', force_release_to_production.product_id;
  END IF;
  IF product.is_cancelled THEN
    RAISE EXCEPTION 'force_release_to_production: product % is cancelled', product.id;
  END IF;
  IF product.status NOT IN ('IN_SETUP', 'PREPRESS') THEN
    RAISE EXCEPTION 'force_release_to_production: product % is % and must be in IN_SETUP or PREPRESS', product.id, product.status;
  END IF;
  IF product.order_status = 'QUOTE' THEN
    RAISE EXCEPTION 'force_release_to_production: order % is still a quote', product.order_id;
  END IF;

  deductions := public.fn_production_deductions(product.id);
  IF jsonb_array_length(deductions) > 0 THEN
    booking := public.book_production_deductions(
      deductions,
      'Automatic on production release ' || product.order_number,
      true
    );
  END IF;

  -- As the owner, past fn_refuse_direct_release.
  UPDATE public.products SET status = 'IN_PRODUCTION' WHERE id = product.id;

  PERFORM public.fn_write_history(
    'EMERGENCY_TRIGGERED',
    jsonb_build_object('order_id', product.order_id, 'product_id', product.id),
    jsonb_build_object('shortages', booking->'shortages'),
    clean_reason
  );
END;
$$;

-- ── create_approval_request ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION "public"."create_approval_request"(
    "request_id" "uuid",
    "product_id" "uuid",
    "file_ids" "uuid"[],
    "storage_paths" "text"[],
    "message" "text" DEFAULT NULL,
    "mailed" boolean DEFAULT true
) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
DECLARE
  actor           uuid := auth.uid();
  product         RECORD;
  customer_email  text;
  next_round      smallint;
  token           text;
  valid_days      integer;
  expiry          timestamp with time zone;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'create_approval_request: a signed-in user is required';
  END IF;
  IF create_approval_request.request_id IS NULL OR create_approval_request.product_id IS NULL THEN
    RAISE EXCEPTION 'create_approval_request: request_id and product_id are required';
  END IF;
  IF COALESCE(cardinality(create_approval_request.file_ids), 0) = 0 THEN
    RAISE EXCEPTION 'create_approval_request: at least one file is required';
  END IF;
  IF COALESCE(cardinality(create_approval_request.storage_paths), 0) <> cardinality(create_approval_request.file_ids) THEN
    RAISE EXCEPTION 'create_approval_request: one storage path per file is required';
  END IF;

  SELECT p.id, p.order_id, p.status, p.is_cancelled
  INTO product
  FROM public.products p
  WHERE p.id = create_approval_request.product_id
  FOR UPDATE;

  IF product.id IS NULL THEN
    RAISE EXCEPTION 'create_approval_request: product % does not exist', create_approval_request.product_id;
  END IF;
  IF product.is_cancelled THEN
    RAISE EXCEPTION 'create_approval_request: product % is cancelled', product.id;
  END IF;
  IF product.status <> 'PREPRESS' THEN
    RAISE EXCEPTION 'create_approval_request: product % is % and must be in PREPRESS', product.id, product.status;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.product_approval_requests r
    WHERE r.product_id = product.id AND r.status = 'PENDING'
  ) THEN
    RAISE EXCEPTION 'create_approval_request: product % already has a pending request', product.id;
  END IF;

  IF create_approval_request.mailed THEN
    SELECT c.email INTO customer_email
    FROM public.orders o
    JOIN public.customers c ON c.id = o.customer_id
    WHERE o.id = product.order_id;

    IF customer_email IS NULL OR btrim(customer_email) = '' THEN
      RAISE EXCEPTION 'create_approval_request: the customer of order % has no email address', product.order_id;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(create_approval_request.file_ids) AS wanted(file_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.files f WHERE f.id = wanted.file_id AND f.order_id = product.order_id
    )
  ) THEN
    RAISE EXCEPTION 'create_approval_request: every file must belong to order %', product.order_id;
  END IF;

  SELECT COALESCE(MAX(r.round), 0) + 1 INTO next_round
  FROM public.product_approval_requests r
  WHERE r.product_id = product.id;

  SELECT s.expiry_days INTO valid_days
  FROM public.customer_approval_settings s
  WHERE s.id;
  expiry := now() + make_interval(days => COALESCE(valid_days, 14));

  token := encode(extensions.gen_random_bytes(32), 'hex');

  INSERT INTO public.product_approval_requests (
    id, product_id, round, message, token_hash, status, mailed, expires_at, requested_by
  ) VALUES (
    create_approval_request.request_id,
    product.id,
    next_round,
    NULLIF(btrim(create_approval_request.message), ''),
    encode(sha256(convert_to(token, 'UTF8')), 'hex'),
    'PENDING',
    create_approval_request.mailed,
    expiry,
    actor
  );

  INSERT INTO public.product_approval_request_files (request_id, file_id, storage_path)
  SELECT create_approval_request.request_id, wanted.file_id, wanted.storage_path
  FROM unnest(create_approval_request.file_ids, create_approval_request.storage_paths) AS wanted(file_id, storage_path);

  -- As the owner, past the lock guards and fn_refuse_awaiting_without_request
  -- (the PENDING row above is what it looks for).
  UPDATE public.products SET status = 'AWAITING_APPROVAL' WHERE id = product.id;

  PERFORM public.fn_write_history(
    'CUSTOMER_APPROVAL_REQUESTED',
    jsonb_build_object('order_id', product.order_id, 'product_id', product.id),
    jsonb_build_object(
      'request_id', create_approval_request.request_id,
      'round', next_round,
      'file_ids', to_jsonb(create_approval_request.file_ids),
      'mailed', create_approval_request.mailed
    )
  );

  IF create_approval_request.mailed THEN
    PERFORM public.queue_email(
      'approval-request',
      product.order_id,
      product.id,
      jsonb_build_object('request_id', create_approval_request.request_id, 'token', token)
    );
  END IF;

  RETURN create_approval_request.request_id;
END;
$$;

-- ── fn_approval_request_closed ───────────────────────────────────────────────
-- The writer takes who did it from auth.uid(), which is the settling
-- employee's session or nothing (the customer's page, the daily expiry) — the
-- same as the NEW.settled_by the insert wrote; `by` in meta stays as well.

CREATE OR REPLACE FUNCTION "public"."fn_approval_request_closed"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
DECLARE
  product       RECORD;
  by_whom       text;
  file_ids      jsonb;
  deductions    jsonb;
  booking       jsonb := jsonb_build_object('ok', true, 'shortages', '[]'::jsonb);
  links         jsonb;
BEGIN
  by_whom := COALESCE(NEW.settled_by::text, 'CUSTOMER');

  SELECT p.id, p.order_id, o.order_number
  INTO product
  FROM public.products p
  JOIN public.orders o ON o.id = p.order_id
  WHERE p.id = NEW.product_id
  FOR UPDATE OF p;

  links := jsonb_build_object('order_id', product.order_id, 'product_id', product.id);

  SELECT COALESCE(jsonb_agg(f.file_id), '[]'::jsonb) INTO file_ids
  FROM public.product_approval_request_files f
  WHERE f.request_id = NEW.id;

  IF NEW.status = 'APPROVED' THEN
    deductions := public.fn_production_deductions(product.id);
    IF jsonb_array_length(deductions) > 0 THEN
      booking := public.book_production_deductions(
        deductions,
        'Automatic on production release ' || product.order_number,
        true
      );
    END IF;

    UPDATE public.products
    SET status = 'IN_PRODUCTION', approved_request_id = NEW.id
    WHERE id = product.id;

    PERFORM public.fn_write_history(
      'CUSTOMER_APPROVAL_GRANTED',
      links,
      jsonb_build_object(
        'request_id', NEW.id, 'round', NEW.round, 'by', by_whom, 'note', NEW.note,
        'file_ids', file_ids, 'shortages', booking->'shortages'
      )
    );
    PERFORM public.fn_write_history(
      'PRODUCTION_READY_SET',
      links,
      jsonb_build_object('automatic', true, 'request_id', NEW.id)
    );

    PERFORM public.queue_email('approval-decided', product.order_id, product.id, jsonb_build_object('request_id', NEW.id));

  ELSIF NEW.status = 'CHANGES_REQUESTED' THEN
    UPDATE public.products SET status = 'PREPRESS' WHERE id = product.id;

    PERFORM public.fn_write_history(
      'CUSTOMER_APPROVAL_CHANGES_REQUESTED',
      links,
      jsonb_build_object('request_id', NEW.id, 'round', NEW.round, 'by', by_whom, 'note', NEW.note)
    );

    PERFORM public.queue_email('approval-decided', product.order_id, product.id, jsonb_build_object('request_id', NEW.id));

  ELSIF NEW.status = 'EXPIRED' THEN
    UPDATE public.products SET status = 'PREPRESS' WHERE id = product.id;

    PERFORM public.fn_write_history(
      'CUSTOMER_APPROVAL_EXPIRED',
      links,
      jsonb_build_object('request_id', NEW.id, 'round', NEW.round)
    );

    PERFORM public.queue_email('approval-expired', product.order_id, product.id, jsonb_build_object('request_id', NEW.id));

  ELSIF NEW.status = 'WITHDRAWN' THEN
    UPDATE public.products SET status = 'PREPRESS' WHERE id = product.id;

    PERFORM public.fn_write_history(
      'CUSTOMER_APPROVAL_WITHDRAWN',
      links,
      jsonb_build_object('request_id', NEW.id, 'round', NEW.round, 'by', by_whom)
    );

    IF NEW.mailed THEN
      PERFORM public.queue_email('approval-withdrawn', product.order_id, product.id, jsonb_build_object('request_id', NEW.id));
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

-- ── The mail triggers ────────────────────────────────────────────────────────
-- A mail is sent and reported with the service-role key, so auth.uid() is
-- null and the entries stay without a person, as they were.

CREATE OR REPLACE FUNCTION "public"."fn_sent_email_history"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
BEGIN
  PERFORM public.fn_write_history(
    'EMAIL_SENT',
    jsonb_build_object('order_id', NEW.order_id, 'product_id', NEW.product_id),
    jsonb_build_object(
      'template', NEW.template, 'recipient', NEW.recipient, 'subject', NEW.subject,
      'provider_id', NEW.provider_id, 'sent_email_id', NEW.id
    )
  );
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."fn_failed_email_history"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
BEGIN
  PERFORM public.fn_write_history(
    'EMAIL_FAILED',
    jsonb_build_object('order_id', NEW.order_id, 'product_id', NEW.product_id),
    jsonb_build_object(
      'template', NEW.template, 'reason', NEW.reason, 'recipient', NEW.recipient,
      'error', NEW.error, 'attempts', NEW.attempts
    )
  );
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."fn_sent_email_bounced"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
BEGIN
  PERFORM public.fn_write_history(
    'EMAIL_BOUNCED',
    jsonb_build_object('order_id', NEW.order_id, 'product_id', NEW.product_id),
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
