-- 20261120154223_stock_record.sql — the history is the only record of stock
--
-- TRANSACTION_RECORD.md, WP5 (decision 11). Until now a manual booking was two
-- requests from the stock pages — the new stock, computed in the app, then a
-- movement row — and a release's automatic deduction wrote a movement row of
-- its own; neither left a history entry. From here a stock number changes only
-- together with its entry, in one transaction:
--
-- | Route                                   | Entry               |
-- |-----------------------------------------|---------------------|
-- | book_stock (admins, the stock pages)    | STOCK_BOOKED        |
-- | release_to_production,                  | STOCK_AUTO_DEDUCTED |
-- | force_release_to_production,            | per item, linked to |
-- | fn_approval_request_closed (approved)   | the product         |
--
-- | Function                      | Role                                     |
-- |-------------------------------|------------------------------------------|
-- | fn_available_stock            | the one definition of what may be used:  |
-- |                               | the stock, less a variant's samples      |
-- | book_stock                    | a manual booking                         |
-- | fn_book_production_deductions | books a release's deductions; takes the  |
-- |                               | place of book_production_deductions      |
--
-- book_production_deductions goes. It was granted to every employee, so an
-- app login could take stock without a release; its one job is now an
-- internal function no app role may execute, and the three routes above
-- call that. The release functions and the closing trigger are redefined
-- with their bodies as 20261118182153_history_writers left them, the call
-- renamed.
--
-- The stock master data — stamp models, ink colours, the textile catalog — is
-- read by every employee and written by admins only. The `stock` column is
-- written by nobody with an app login, admins included: a guard refuses it,
-- so a new item starts at the column's default of zero and its first stock is
-- a booking. The movement tables are converted into entries and dropped.

-- ── fn_available_stock ───────────────────────────────────────────────────────

/**
 * What of an item's stock may be used: a stamp model's stock, a textile
 * variant's stock less its declared samples (samples are never sold or
 * consumed by a release). `p_kind` is 'STAMP' (stamp_models) or 'TEXTILE'
 * (textile_variants), the deduction targets' vocabulary. Read by book_stock
 * and by the release's booking, so the two never disagree; a caller that
 * changes the stock locks the row first.
 *
 * @returns NULL when the item does not exist.
 * @raises on an unknown kind.
 */
CREATE OR REPLACE FUNCTION "public"."fn_available_stock"("p_kind" "text", "p_item_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" STABLE
    SET "search_path" = ''
    AS $$
DECLARE
  available integer;
BEGIN
  IF p_kind = 'STAMP' THEN
    SELECT m.stock INTO available FROM public.stamp_models m WHERE m.id = p_item_id;
  ELSIF p_kind = 'TEXTILE' THEN
    SELECT v.stock - v.sample_stock INTO available FROM public.textile_variants v WHERE v.id = p_item_id;
  ELSE
    RAISE EXCEPTION 'fn_available_stock: unknown kind %', p_kind;
  END IF;
  RETURN available;
END;
$$;

ALTER FUNCTION "public"."fn_available_stock"("text", "uuid") OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_available_stock"("text", "uuid") FROM PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."fn_available_stock"("text", "uuid") TO "service_role";

-- ── book_stock ───────────────────────────────────────────────────────────────

/**
 * A manual stock booking from the stock pages: goods in (INBOUND) or out
 * (OUTBOUND) of a stamp model or textile variant. One transaction — the item
 * is locked, the new stock computed and written, and STOCK_BOOKED written
 * through the writer, linked to the item, with the direction, the quantity,
 * the stock before and after, and the note. A new item's first stock is
 * booked through it as well.
 *
 * Admins only: it runs as the owner, past RLS, so it checks the role itself.
 *
 * @returns the item's new stock.
 * @raises when the caller is not a signed-in admin; on an unknown kind or
 *   direction; on a quantity below one; when the item does not exist; when an
 *   outbound booking exceeds the available stock (fn_available_stock).
 */
CREATE OR REPLACE FUNCTION "public"."book_stock"(
    "p_kind" "text",
    "p_item_id" "uuid",
    "p_type" "text",
    "p_quantity" integer,
    "p_note" "text" DEFAULT NULL
) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
DECLARE
  stock_before  integer;
  stock_after   integer;
  available     integer;
  links         jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'book_stock: a signed-in user is required';
  END IF;
  IF public.current_user_role() IS DISTINCT FROM 'ADMIN'
     AND public.current_user_role() IS DISTINCT FROM 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'book_stock: only an admin may book stock';
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('STAMP', 'TEXTILE') THEN
    RAISE EXCEPTION 'book_stock: unknown kind %', p_kind;
  END IF;
  IF p_type IS NULL OR p_type NOT IN ('INBOUND', 'OUTBOUND') THEN
    RAISE EXCEPTION 'book_stock: unknown booking type %', p_type;
  END IF;
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'book_stock: the quantity must be at least 1';
  END IF;

  IF p_kind = 'STAMP' THEN
    SELECT m.stock INTO stock_before FROM public.stamp_models m WHERE m.id = p_item_id FOR UPDATE;
    links := jsonb_build_object('stamp_model_id', p_item_id);
  ELSE
    SELECT v.stock INTO stock_before FROM public.textile_variants v WHERE v.id = p_item_id FOR UPDATE;
    links := jsonb_build_object('textile_variant_id', p_item_id);
  END IF;

  IF stock_before IS NULL THEN
    RAISE EXCEPTION 'book_stock: % item % does not exist', p_kind, p_item_id;
  END IF;

  IF p_type = 'OUTBOUND' THEN
    available := public.fn_available_stock(p_kind, p_item_id);
    IF p_quantity > available THEN
      RAISE EXCEPTION 'Quantity exceeds available stock (% available)', available;
    END IF;
    stock_after := stock_before - p_quantity;
  ELSE
    stock_after := stock_before + p_quantity;
  END IF;

  -- As the owner, past fn_refuse_direct_stock_write.
  IF p_kind = 'STAMP' THEN
    UPDATE public.stamp_models SET stock = stock_after WHERE id = p_item_id;
  ELSE
    UPDATE public.textile_variants SET stock = stock_after WHERE id = p_item_id;
  END IF;

  PERFORM public.fn_write_history(
    'STOCK_BOOKED',
    links,
    jsonb_build_object(
      'direction', p_type,
      'quantity', p_quantity,
      'stock_before', stock_before,
      'stock_after', stock_after,
      'note', NULLIF(btrim(p_note), '')
    )
  );

  RETURN stock_after;
END;
$$;

ALTER FUNCTION "public"."book_stock"("text", "uuid", "text", integer, "text") OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."book_stock"("text", "uuid", "text", integer, "text") FROM PUBLIC, "anon";

GRANT EXECUTE ON FUNCTION "public"."book_stock"("text", "uuid", "text", integer, "text") TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."book_stock"("text", "uuid", "text", integer, "text") TO "service_role";

-- ── fn_book_production_deductions ────────────────────────────────────────────

/**
 * Books a release's stock deductions, as fn_production_deductions lists them
 * ([{target, id, quantity, product_id, line_id?}]): per target one row-locked
 * decrement and one STOCK_AUTO_DEDUCTED entry, linked to the item and to the
 * product that used it, with the quantity taken, the stock before and after,
 * the note, and a textile batch's line. Targets are locked in a stable order,
 * so two releases at the same moment wait for each other instead of losing
 * an update. What may be taken is fn_available_stock: a variant's samples
 * stay.
 *
 * `p_allow_shortage` false (a plain release): a target short of its quantity,
 * or missing, aborts the whole booking with INSUFFICIENT_STOCK and the short
 * targets as the error's detail. True (a force release, an approval): a short
 * target is floored at what is available and its entry records what was
 * actually taken; a target with nothing to take writes no entry.
 *
 * Not executable by an app role: its callers — release_to_production,
 * force_release_to_production, fn_approval_request_closed — run as the owner.
 * Body as book_production_deductions had it, with the entry in place of the
 * movement row; the admin check on the shortage went with the app's access.
 *
 * @returns {"ok": true, "shortages": [...]}.
 */
CREATE OR REPLACE FUNCTION "public"."fn_book_production_deductions"(
    "p_deductions" "jsonb",
    "p_note" "text",
    "p_allow_shortage" boolean
) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
DECLARE
  item          RECORD;
  stock_before  integer;
  available     integer;
  deducted      integer;
  links         jsonb;
  shortages     jsonb := '[]'::jsonb;
BEGIN
  FOR item IN
    SELECT
      d->>'target'                AS target,
      (d->>'id')::uuid            AS id,
      (d->>'quantity')::integer   AS quantity,
      (d->>'product_id')::uuid    AS product_id,
      (d->>'line_id')::uuid       AS line_id
    FROM jsonb_array_elements(p_deductions) AS d
    ORDER BY d->>'target', d->>'id'
  LOOP
    IF item.target IS NULL OR item.target NOT IN ('STAMP', 'TEXTILE') THEN
      RAISE EXCEPTION 'unknown deduction target %', item.target;
    END IF;
    IF item.quantity IS NULL OR item.quantity < 1 THEN
      RAISE EXCEPTION 'invalid deduction quantity for %', item.id;
    END IF;

    IF item.target = 'STAMP' THEN
      SELECT m.stock INTO stock_before FROM public.stamp_models m WHERE m.id = item.id FOR UPDATE;
      links := jsonb_build_object('stamp_model_id', item.id);
    ELSE
      SELECT v.stock INTO stock_before FROM public.textile_variants v WHERE v.id = item.id FOR UPDATE;
      links := jsonb_build_object('textile_variant_id', item.id);
    END IF;
    available := public.fn_available_stock(item.target, item.id);

    IF available IS NULL OR available < item.quantity THEN
      shortages := shortages || jsonb_build_object(
        'target', item.target,
        'id', item.id,
        'required', item.quantity,
        'available', COALESCE(available, 0)
      );
    END IF;

    -- Missing row: nothing to deduct. Without the shortage allowed, the
    -- exception below rolls back every deduction already made.
    CONTINUE WHEN available IS NULL;

    deducted := LEAST(available, item.quantity);
    CONTINUE WHEN deducted <= 0;

    -- As the owner, past fn_refuse_direct_stock_write. Relative: physical
    -- pieces leave, a variant's sample count stays.
    IF item.target = 'STAMP' THEN
      UPDATE public.stamp_models SET stock = stock - deducted WHERE id = item.id;
    ELSE
      UPDATE public.textile_variants SET stock = stock - deducted WHERE id = item.id;
    END IF;

    PERFORM public.fn_write_history(
      'STOCK_AUTO_DEDUCTED',
      links || jsonb_build_object('product_id', item.product_id),
      jsonb_strip_nulls(jsonb_build_object(
        'direction', 'OUTBOUND',
        'quantity', deducted,
        'stock_before', stock_before,
        'stock_after', stock_before - deducted,
        'note', p_note,
        'line_id', item.line_id
      ))
    );
  END LOOP;

  IF NOT p_allow_shortage AND jsonb_array_length(shortages) > 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK' USING DETAIL = shortages::text;
  END IF;

  RETURN jsonb_build_object('ok', true, 'shortages', shortages);
END;
$$;

ALTER FUNCTION "public"."fn_book_production_deductions"("jsonb", "text", boolean) OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_book_production_deductions"("jsonb", "text", boolean) FROM PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."fn_book_production_deductions"("jsonb", "text", boolean) TO "service_role";

-- ── The three routes call it ─────────────────────────────────────────────────

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
    PERFORM public.fn_book_production_deductions(
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
    booking := public.fn_book_production_deductions(
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
      booking := public.fn_book_production_deductions(
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

DROP FUNCTION "public"."book_production_deductions"("jsonb", "text", boolean);

-- ── fn_refuse_direct_stock_write ─────────────────────────────────────────────

/**
 * Trigger guard: nobody with an app login writes `stock` on a stamp model or
 * textile variant, admins included. A new item is inserted at zero (the
 * column's default) and its stock changes through book_stock or a release's
 * deduction, which run as the owner and pass. A guard rather than a revoked
 * column privilege: the tables are granted whole, and a column cannot be
 * carved out of a table grant without listing every other column — which a
 * column added later would then have to join.
 *
 * Privileged roles are exempt as in the other guards: postgres /
 * supabase_admin run the seed and the functions above, service_role is the
 * e2e runner.
 *
 * @trigger BEFORE INSERT OR UPDATE OF stock ON stamp_models, textile_variants (per row)
 * @raises when an app role inserts an item with stock, or changes its stock.
 */
CREATE OR REPLACE FUNCTION "public"."fn_refuse_direct_stock_write"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" = ''
    AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.stock <> 0 THEN
    RAISE EXCEPTION 'A new stock item starts at zero; its stock is booked through book_stock';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.stock IS DISTINCT FROM OLD.stock THEN
    RAISE EXCEPTION
      'The stock of % (%) changes through book_stock or a release, not by a direct update',
      TG_TABLE_NAME, OLD.id;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."fn_refuse_direct_stock_write"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_refuse_direct_stock_write"() FROM PUBLIC;

CREATE TRIGGER "trg_refuse_direct_stock_write"
    BEFORE INSERT OR UPDATE OF "stock" ON "public"."stamp_models"
    FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_direct_stock_write"();

CREATE TRIGGER "trg_refuse_direct_stock_write"
    BEFORE INSERT OR UPDATE OF "stock" ON "public"."textile_variants"
    FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_direct_stock_write"();

-- ── Access to the stock master data ──────────────────────────────────────────
-- Read by every employee (the product forms pick models and variants from
-- it), written by admins only — what the admin-only stock pages assume.

DROP POLICY "Employees: full access" ON "public"."stamp_models";
DROP POLICY "Employees: full access" ON "public"."stamp_ink_colors";
DROP POLICY "Employees: full access" ON "public"."textile_brands";
DROP POLICY "Employees: full access" ON "public"."textile_models";
DROP POLICY "Employees: full access" ON "public"."textile_variants";

CREATE POLICY "Employees: read" ON "public"."stamp_models"
    FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "Admins: write" ON "public"."stamp_models"
    FOR ALL TO "authenticated"
    USING ("public"."current_user_role"() IN ('ADMIN'::"public"."user_role", 'SUPER_ADMIN'::"public"."user_role"))
    WITH CHECK ("public"."current_user_role"() IN ('ADMIN'::"public"."user_role", 'SUPER_ADMIN'::"public"."user_role"));

CREATE POLICY "Employees: read" ON "public"."stamp_ink_colors"
    FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "Admins: write" ON "public"."stamp_ink_colors"
    FOR ALL TO "authenticated"
    USING ("public"."current_user_role"() IN ('ADMIN'::"public"."user_role", 'SUPER_ADMIN'::"public"."user_role"))
    WITH CHECK ("public"."current_user_role"() IN ('ADMIN'::"public"."user_role", 'SUPER_ADMIN'::"public"."user_role"));

CREATE POLICY "Employees: read" ON "public"."textile_brands"
    FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "Admins: write" ON "public"."textile_brands"
    FOR ALL TO "authenticated"
    USING ("public"."current_user_role"() IN ('ADMIN'::"public"."user_role", 'SUPER_ADMIN'::"public"."user_role"))
    WITH CHECK ("public"."current_user_role"() IN ('ADMIN'::"public"."user_role", 'SUPER_ADMIN'::"public"."user_role"));

CREATE POLICY "Employees: read" ON "public"."textile_models"
    FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "Admins: write" ON "public"."textile_models"
    FOR ALL TO "authenticated"
    USING ("public"."current_user_role"() IN ('ADMIN'::"public"."user_role", 'SUPER_ADMIN'::"public"."user_role"))
    WITH CHECK ("public"."current_user_role"() IN ('ADMIN'::"public"."user_role", 'SUPER_ADMIN'::"public"."user_role"));

CREATE POLICY "Employees: read" ON "public"."textile_variants"
    FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "Admins: write" ON "public"."textile_variants"
    FOR ALL TO "authenticated"
    USING ("public"."current_user_role"() IN ('ADMIN'::"public"."user_role", 'SUPER_ADMIN'::"public"."user_role"))
    WITH CHECK ("public"."current_user_role"() IN ('ADMIN'::"public"."user_role", 'SUPER_ADMIN'::"public"."user_role"));

-- ── A product that took stock is not forgotten ───────────────────────────────

/**
 * As 20261118182151_one_history defined it, with one rule more: a product
 * whose release took stock is refused deletion. Its STOCK_AUTO_DEDUCTED
 * entries are what explains the item's stock, and forgetting them with the
 * product would leave the number unexplained. Such a product is in setup
 * only after it went back from production and lost what made it ready.
 *
 * @trigger BEFORE DELETE ON products, files, product_files, product_time_logs (per row)
 * @raises when a product with stock deductions is deleted.
 */
CREATE OR REPLACE FUNCTION "public"."fn_forget_history"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'products' THEN
      IF EXISTS (
        SELECT 1 FROM public.history h
        WHERE h.product_id = OLD.id AND h.event_type = 'STOCK_AUTO_DEDUCTED'
      ) THEN
        RAISE EXCEPTION 'Product (%) has taken stock and cannot be deleted', OLD.id;
      END IF;
      DELETE FROM public.history h WHERE h.product_id = OLD.id;
    WHEN 'files' THEN
      DELETE FROM public.history h WHERE h.file_id = OLD.id;
    WHEN 'product_files' THEN
      DELETE FROM public.history h
      WHERE h.event_type = 'FILE_ADDED' AND h.product_id = OLD.product_id AND h.file_id = OLD.file_id;
    WHEN 'product_time_logs' THEN
      DELETE FROM public.history h
      WHERE h.event_type = 'TIME_LOGGED' AND h.meta->>'time_log_id' = OLD.id::text;
    ELSE
      RAISE EXCEPTION 'fn_forget_history: no rule for table %', TG_TABLE_NAME;
  END CASE;
  RETURN OLD;
END;
$$;

-- ── The movement tables become entries ───────────────────────────────────────
-- Each row keeps its user, time, quantity and note; a manual booking becomes
-- STOCK_BOOKED, an automatic deduction STOCK_AUTO_DEDUCTED. The stock before
-- and after was never stored, and a deduction's product was not either — its
-- note names the order — so neither is invented. The entries carry no action
-- id, as no entry written before the writer does. Inserted as the owner.

INSERT INTO "public"."history" (stamp_model_id, event_type, user_id, meta, created_at)
SELECT
  m.model_id,
  CASE m.type WHEN 'AUTO_DEDUCTION' THEN 'STOCK_AUTO_DEDUCTED' ELSE 'STOCK_BOOKED' END::"public"."history_event",
  m.user_id,
  jsonb_strip_nulls(jsonb_build_object(
    'direction', CASE m.type WHEN 'INBOUND' THEN 'INBOUND' ELSE 'OUTBOUND' END,
    'quantity', m.quantity,
    'note', m.note
  )),
  m.created_at
FROM "public"."stamp_stock_movements" m;

INSERT INTO "public"."history" (textile_variant_id, event_type, user_id, meta, created_at)
SELECT
  m.variant_id,
  CASE m.type WHEN 'AUTO_DEDUCTION' THEN 'STOCK_AUTO_DEDUCTED' ELSE 'STOCK_BOOKED' END::"public"."history_event",
  m.user_id,
  jsonb_strip_nulls(jsonb_build_object(
    'direction', CASE m.type WHEN 'INBOUND' THEN 'INBOUND' ELSE 'OUTBOUND' END,
    'quantity', m.quantity,
    'note', m.note
  )),
  m.created_at
FROM "public"."textile_stock_movements" m;

DROP TABLE "public"."stamp_stock_movements";

DROP TABLE "public"."textile_stock_movements";
