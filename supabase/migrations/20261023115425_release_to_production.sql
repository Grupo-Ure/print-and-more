-- 20261023115425_release_to_production.sql — every release gate in the database
--
-- CUSTOMER_APPROVAL.md, WP5, decision 9. Until now a release to production was
-- a direct status update from the client: the products table lets any
-- employee write `status`, and completeness, stock and the approval were
-- checked in the app only, so one HTTP request could skip all three. From here
-- the only ways into IN_PRODUCTION from the client are two functions, each one
-- transaction that decides whether the release is allowed and carries it out:
--
--   * release_to_production(product_id) — for everyone: the product in
--     PREPRESS, complete, in stock, and its newest approval round (if any)
--     approved; books the deductions, moves the product, writes
--     PRODUCTION_READY_SET.
--   * force_release_to_production(product_id, reason) — admins only, a reason
--     required: the product in setup or pre-press, never while it waits for
--     the customer; skips completeness, stock and the approval, books with the
--     shortage allowed, writes EMERGENCY_TRIGGERED with the reason.
--
-- Two functions because a status update carries only column values: the
-- database cannot tell a forced release from a plain one, or receive a reason,
-- unless the intent is its own call.
--
-- fn_refuse_direct_release makes sure nothing reaches IN_PRODUCTION or
-- AWAITING_APPROVAL around them: written by `authenticated` directly, either
-- status is refused, on insert as on update. The two functions,
-- create_approval_request and fn_approval_request_closed run as the owner and
-- pass, as the existing lock guards' actor check lets them.
--
-- book_production_deductions is no longer the client's to call: the release
-- functions and the closing trigger book through it. It stays callable on its
-- own, so it now refuses `allow_shortage = true` from anyone but an admin — a
-- shortage booked past what is there is the force release's privilege. The
-- closing trigger books an approval with the shortage allowed whoever settles
-- it (an employee, or the customer through the service role), so a call from
-- inside a trigger is exempt.
--
-- Revoking EXECUTE from `authenticated` instead was the stronger option, and
-- was dropped: a call to a function the caller may not execute crashes the
-- local Supabase Postgres (signal 11, the whole cluster restarts), so a test
-- that it is refused would take the e2e stack down.

-- ── book_production_deductions: the shortage is an admin's ──────────────────

/**
 * Books a release's stock deductions: one row-locked conditional decrement
 * and AUTO_DEDUCTION movement per target, in one transaction. A shortage
 * aborts the whole booking with INSUFFICIENT_STOCK (the short targets as the
 * detail) unless `allow_shortage`, which floors a short target at zero and
 * records what was actually taken. Body as in 20261022090608; the admin check
 * on `allow_shortage` is new.
 *
 * @raises when `allow_shortage` is asked for outside a trigger by someone who is not an admin.
 */
CREATE OR REPLACE FUNCTION "public"."book_production_deductions"("deductions" "jsonb", "note" "text", "allow_shortage" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
DECLARE
  item        RECORD;
  prev_stock  INTEGER;
  deducted    INTEGER;
  shortages   JSONB := '[]'::JSONB;
BEGIN
  IF allow_shortage
     AND pg_trigger_depth() = 0
     AND public.current_user_role() IS DISTINCT FROM 'ADMIN'
     AND public.current_user_role() IS DISTINCT FROM 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'book_production_deductions: only an admin may book past a shortage';
  END IF;

  FOR item IN
    SELECT
      d->>'target'              AS target,
      (d->>'id')::uuid          AS id,
      (d->>'quantity')::integer AS quantity
    FROM jsonb_array_elements(deductions) AS d
    ORDER BY d->>'target', d->>'id'
  LOOP
    IF item.target NOT IN ('STAMP', 'TEXTILE') THEN
      RAISE EXCEPTION 'unknown deduction target %', item.target;
    END IF;
    IF item.quantity IS NULL OR item.quantity < 1 THEN
      RAISE EXCEPTION 'invalid deduction quantity for %', item.id;
    END IF;

    IF item.target = 'STAMP' THEN
      SELECT stock INTO prev_stock FROM public.stamp_models WHERE id = item.id FOR UPDATE;
    ELSE
      -- prev_stock holds the *available* amount: declared samples are excluded
      SELECT stock - sample_stock INTO prev_stock FROM public.textile_variants WHERE id = item.id FOR UPDATE;
    END IF;

    IF prev_stock IS NULL OR prev_stock < item.quantity THEN
      shortages := shortages || jsonb_build_object(
        'target', item.target,
        'id', item.id,
        'required', item.quantity,
        'available', COALESCE(prev_stock, 0)
      );
    END IF;

    -- Missing row: nothing to deduct. Under allow_shortage = false any update
    -- is rolled back by the shortage exception below, so deducting the full
    -- quantity here is safe either way.
    CONTINUE WHEN prev_stock IS NULL;

    deducted := LEAST(prev_stock, item.quantity);
    CONTINUE WHEN deducted = 0;

    IF item.target = 'STAMP' THEN
      UPDATE public.stamp_models SET stock = prev_stock - deducted WHERE id = item.id;
      INSERT INTO public.stamp_stock_movements (model_id, quantity, type, note, user_id)
      VALUES (item.id, deducted, 'AUTO_DEDUCTION', note, auth.uid());
    ELSE
      -- relative decrement: physical pieces leave, the sample count stays
      UPDATE public.textile_variants SET stock = stock - deducted WHERE id = item.id;
      INSERT INTO public.textile_stock_movements (variant_id, quantity, type, note, user_id)
      VALUES (item.id, deducted, 'AUTO_DEDUCTION', note, auth.uid());
    END IF;
  END LOOP;

  IF NOT allow_shortage AND jsonb_array_length(shortages) > 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK' USING DETAIL = shortages::text;
  END IF;

  RETURN jsonb_build_object('ok', true, 'shortages', shortages);
END;
$$;

-- ── release_to_production ────────────────────────────────────────────────────

/**
 * Releases a product to production: the one way a plain release reaches
 * IN_PRODUCTION. One transaction — the gates, the stock booking, the status
 * and the history entry commit together or not at all.
 *
 * Refuses: no signed-in user; a product that is cancelled or not in PREPRESS
 * (a waiting product included — the request closing is its only way out); an
 * order still a QUOTE; no effective deadline (the product's own, else the
 * order's — isProductComplete in src/lib/productShared.ts); a newest approval
 * round that is not APPROVED (changes requested, expired or withdrawn — the
 * latest round decides, an older approval does not count for a reworked
 * proof); stock short of what fn_production_deductions lists, raised by
 * book_production_deductions as INSUFFICIENT_STOCK with the short targets as
 * the error's detail, so nothing is booked.
 *
 * A product never asked about has no round and is released as it always was;
 * one sent back to pre-press from production after an approval books at the
 * click.
 */
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

  INSERT INTO public.history (order_id, product_id, event_type, user_id)
  VALUES (product.order_id, product.id, 'PRODUCTION_READY_SET', actor);
END;
$$;

ALTER FUNCTION "public"."release_to_production"("uuid") OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."release_to_production"("uuid") FROM PUBLIC, "anon";

GRANT EXECUTE ON FUNCTION "public"."release_to_production"("uuid") TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."release_to_production"("uuid") TO "service_role";

-- ── force_release_to_production ──────────────────────────────────────────────

/**
 * An admin's override: puts a product into production past the gates a
 * plain release checks — completeness, stock, and a newest approval round
 * that came back without an approval. One transaction, as the plain release.
 *
 * Refuses: no signed-in admin; a blank reason; a cancelled product; a product
 * not in IN_SETUP or PREPRESS — a waiting product included, so a round the
 * customer still has open is never overridden; an order still a QUOTE (no
 * product leaves setup while its order is one).
 *
 * Stock is booked with the shortage allowed: a short target is floored at zero
 * and its movement records what was actually taken. The EMERGENCY_TRIGGERED
 * entry carries the reason, and the short targets in its meta.
 */
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

  INSERT INTO public.history (order_id, product_id, event_type, user_id, reason, meta)
  VALUES (
    product.order_id, product.id, 'EMERGENCY_TRIGGERED', actor, clean_reason,
    jsonb_build_object('shortages', booking->'shortages')
  );
END;
$$;

ALTER FUNCTION "public"."force_release_to_production"("uuid", "text") OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."force_release_to_production"("uuid", "text") FROM PUBLIC, "anon";

GRANT EXECUTE ON FUNCTION "public"."force_release_to_production"("uuid", "text") TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."force_release_to_production"("uuid", "text") TO "service_role";

-- ── fn_refuse_direct_release ─────────────────────────────────────────────────

/**
 * Trigger guard: nothing written by the app reaches IN_PRODUCTION or
 * AWAITING_APPROVAL except through the functions that own those moves —
 * release_to_production, force_release_to_production, create_approval_request
 * and fn_approval_request_closed, which run as the owner and pass. Covers an
 * insert as well as an update, so a product cannot be created already
 * released. The app's direct status writes (setup ↔ pre-press, done, back to
 * pre-press) are untouched.
 *
 * Privileged roles are exempt as in the lock guards: postgres / supabase_admin
 * run the seed and the functions above, service_role is the e2e runner.
 *
 * @trigger BEFORE INSERT OR UPDATE OF status ON products (per row)
 * @raises when `authenticated` writes IN_PRODUCTION or AWAITING_APPROVAL itself.
 */
CREATE OR REPLACE FUNCTION "public"."fn_refuse_direct_release"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" = ''
    AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'IN_PRODUCTION' THEN
    RAISE EXCEPTION
      'Product (%) can only be released to production through release_to_production or force_release_to_production',
      NEW.id;
  END IF;

  IF NEW.status = 'AWAITING_APPROVAL' THEN
    RAISE EXCEPTION
      'Product (%) can only await approval through create_approval_request',
      NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."fn_refuse_direct_release"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_refuse_direct_release"() FROM PUBLIC;

CREATE TRIGGER "trg_refuse_direct_release"
    BEFORE INSERT OR UPDATE OF "status" ON "public"."products"
    FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_direct_release"();
