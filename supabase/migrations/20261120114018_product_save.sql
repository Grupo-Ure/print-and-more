-- 20261120114018_product_save.sql — a product is saved by one database function
--
-- TRANSACTION_RECORD.md, WP4 (decisions 4, 8). Until now the app saved a
-- product in several requests — the parent row, then its typed child row or a
-- textile batch's lines and designs — and wrote the PRODUCT_CREATED /
-- PRODUCT_UPDATED entry afterwards, best effort, with the type and the
-- quantity only. From here save_product does all of it in one transaction:
-- the parent, the children and the entry, which keeps the product's full
-- content (meta.after on a create, meta.before and meta.after on a change).
--
-- | Function                    | Role                                           |
-- |-----------------------------|------------------------------------------------|
-- | save_product                | the app's one way to create a product or       |
-- |                             | change its specification                       |
-- | fn_insert_product_rows      | writes rows handed over as JSON into a child   |
-- |                             | table                                          |
-- | fn_record_product_created   | the one definition of a creation entry, shared |
-- |                             | with duplicate_order                           |
-- | fn_product_snapshot_comparable | a snapshot less what a save renews by itself |
--
-- The guards follow (decision 4): an app role no longer inserts a product,
-- writes its spec columns or touches a child table directly. The two guards
-- of 20261008175931, which refused those writes for a released product only,
-- are replaced by two that refuse them whatever the status; save_product
-- runs as the owner, whom they let through, and checks the locks itself.
--
-- duplicate_order loses the created_by_user_id parameter it stopped using in
-- WP3 and records each copied product through fn_record_product_created.

-- ── Writing child rows ───────────────────────────────────────────────────────

/**
 * Inserts the rows of a JSON array into one of a product's child tables —
 * a typed child table, textile_garments or textile_designs — each with the
 * given product_id. The columns written are the keys the rows carry, so a
 * column a row leaves out takes its default, and a key that is no column of
 * the table fails the insert. id, product_id and created_at are never taken
 * from the rows.
 *
 * Not executable by an app role: it takes a table name, and its one caller is
 * save_product.
 *
 * @raises when a key is not a column of the table, or a value does not fit it.
 */
CREATE OR REPLACE FUNCTION "public"."fn_insert_product_rows"(
    "p_table" "text",
    "p_product_id" "uuid",
    "p_rows" "jsonb"
) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = "public", "pg_temp"
    AS $$
DECLARE
  v_columns text;
BEGIN
  IF jsonb_array_length(p_rows) = 0 THEN
    RETURN;
  END IF;

  SELECT string_agg(format('%I', keys.key), ', ' ORDER BY keys.key)
  INTO v_columns
  FROM (
    SELECT DISTINCT row_key.key
    FROM jsonb_array_elements(p_rows) AS element
    CROSS JOIN LATERAL jsonb_object_keys(element) AS row_key(key)
    WHERE row_key.key NOT IN ('id', 'product_id', 'created_at')
  ) AS keys;

  IF v_columns IS NULL THEN
    EXECUTE format(
      'INSERT INTO public.%I (product_id) SELECT $1 FROM jsonb_array_elements($2)',
      p_table
    ) USING p_product_id, p_rows;
  ELSE
    EXECUTE format(
      'INSERT INTO public.%1$I (product_id, %2$s) SELECT $1, %2$s FROM jsonb_populate_recordset(NULL::public.%1$I, $2)',
      p_table, v_columns
    ) USING p_product_id, p_rows;
  END IF;
END;
$$;

ALTER FUNCTION "public"."fn_insert_product_rows"("text", "uuid", "jsonb") OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_insert_product_rows"("text", "uuid", "jsonb") FROM PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."fn_insert_product_rows"("text", "uuid", "jsonb") TO "service_role";

-- ── The entries ──────────────────────────────────────────────────────────────

/**
 * Writes PRODUCT_CREATED with the product's full content (meta.after). Called
 * once the product is complete, its child rows included: by save_product, and
 * by duplicate_order for each copy. A trigger on `products` could not write
 * it, since the child rows follow the parent's insert.
 *
 * @raises when the product does not exist.
 */
CREATE OR REPLACE FUNCTION "public"."fn_record_product_created"("p_product_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
BEGIN
  PERFORM public.fn_write_history(
    'PRODUCT_CREATED',
    jsonb_build_object('product_id', p_product_id),
    jsonb_build_object('after', public.fn_product_snapshot(p_product_id))
  );
END;
$$;

ALTER FUNCTION "public"."fn_record_product_created"("uuid") OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_record_product_created"("uuid") FROM PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."fn_record_product_created"("uuid") TO "service_role";

/**
 * A product snapshot less what a save renews by itself: a textile batch's
 * lines and designs are written anew on every save, so each gets a new id
 * and created_at, and rows written together have no order of their own. Two
 * snapshots that differ only in that are the same specification;
 * save_product compares through this to tell whether a save changed
 * anything. The entry keeps the snapshot as taken.
 */
CREATE OR REPLACE FUNCTION "public"."fn_product_snapshot_comparable"("p_snapshot" "jsonb") RETURNS "jsonb"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" = ''
    AS $$
  SELECT p_snapshot
    || CASE WHEN p_snapshot ? 'garments' THEN jsonb_build_object('garments', COALESCE((
         SELECT jsonb_agg(line.content ORDER BY line.content::text)
         FROM (
           SELECT element - 'id' - 'created_at' AS content
           FROM jsonb_array_elements(p_snapshot->'garments') AS element
         ) AS line
       ), '[]'::jsonb)) ELSE '{}'::jsonb END
    || CASE WHEN p_snapshot ? 'designs' THEN jsonb_build_object('designs', COALESCE((
         SELECT jsonb_agg(design.content ORDER BY design.content::text)
         FROM (
           SELECT element - 'id' - 'created_at' AS content
           FROM jsonb_array_elements(p_snapshot->'designs') AS element
         ) AS design
       ), '[]'::jsonb)) ELSE '{}'::jsonb END;
$$;

ALTER FUNCTION "public"."fn_product_snapshot_comparable"("jsonb") OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_product_snapshot_comparable"("jsonb") FROM PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."fn_product_snapshot_comparable"("jsonb") TO "service_role";

-- ── save_product ─────────────────────────────────────────────────────────────

/**
 * Creates a product or changes its specification, in one transaction: the
 * parent row, its children and the history entry are written together or
 * not at all.
 *
 *   p_product   {"id"?, "order_id", "department", "type", "quantity",
 *               "notes", "sort_order"} — without an id the product is
 *               created; with one, its type, quantity, notes and sort_order
 *               are written (order_id and department are the product's own
 *               and are not changed).
 *   p_child     the typed child row of a single-child type, without
 *               product_id. Null for a textile batch.
 *   p_garments  a textile batch's garment lines, p_designs its designs —
 *               arrays of rows without id and product_id. Null for every
 *               other type.
 *
 * The specification is saved as a whole (decision 8): the children are
 * replaced by what is handed in, and a change of type moves the product to
 * the new type's child table. A create writes PRODUCT_CREATED with the full
 * content; a change writes PRODUCT_UPDATED with the content before and after,
 * and nothing when the save changed nothing. The client validates the form
 * with the type's Zod schema and maps it to rows; this takes the mapped rows,
 * and the tables' own constraints hold as for any write.
 *
 * Runs as the owner, whom the guards let through, so it refuses what they
 * refuse a direct write: a product on a finished or billed order, and one
 * awaiting approval, in production or done. A signed-in session is required:
 * the function is for the app, as cancel_order is.
 *
 * Its search_path names `public` where the other functions of this stream
 * leave it empty: the triggers of the base schema that fire on the inserts
 * it makes (fn_generate_product_number, fn_check_product_type) name their
 * tables unqualified and set no path of their own, so they resolve them
 * through the caller's. Everything written here is schema-qualified all the
 * same. fn_insert_product_rows carries the same path for the same reason.
 *
 * @returns the product's id.
 * @raises when there is no session, the type is unknown, the rows do not fit
 *   the type, the order or product does not exist, the order is closed, or
 *   the product's specification is locked.
 */
CREATE OR REPLACE FUNCTION "public"."save_product"(
    "p_product" "jsonb",
    "p_child" "jsonb" DEFAULT NULL,
    "p_garments" "jsonb" DEFAULT NULL,
    "p_designs" "jsonb" DEFAULT NULL
) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = "public", "pg_temp"
    AS $$
DECLARE
  v_product_id    uuid := (p_product->>'id')::uuid;
  v_type          text := p_product->>'type';
  v_is_textile    boolean;
  v_child_table   text;
  v_child         jsonb := NULLIF(p_child, 'null'::jsonb);
  v_garments      jsonb := NULLIF(p_garments, 'null'::jsonb);
  v_designs       jsonb := NULLIF(p_designs, 'null'::jsonb);
  v_order_id      uuid;
  v_order_status  public.order_status;
  v_current       RECORD;
  v_before        jsonb;
  v_after         jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'save_product requires a signed-in user';
  END IF;

  IF v_type IS NULL THEN
    RAISE EXCEPTION 'save_product: the product has no type';
  END IF;

  v_is_textile := v_type = 'TEXTILE_GARMENT';
  v_child_table := public.fn_child_table_for_type(v_type);

  IF v_is_textile THEN
    v_garments := COALESCE(v_garments, '[]'::jsonb);
    v_designs := COALESCE(v_designs, '[]'::jsonb);
    IF v_child IS NOT NULL
       OR jsonb_typeof(v_garments) <> 'array'
       OR jsonb_typeof(v_designs) <> 'array' THEN
      RAISE EXCEPTION 'save_product: a textile batch takes garment lines and designs, not a child row';
    END IF;
  ELSIF v_child_table IS NULL THEN
    RAISE EXCEPTION 'save_product: unknown product type %', v_type;
  ELSIF v_child IS NULL
        OR jsonb_typeof(v_child) <> 'object'
        OR v_garments IS NOT NULL
        OR v_designs IS NOT NULL THEN
    RAISE EXCEPTION 'save_product: a % product takes one child row, not garment lines or designs', v_type;
  END IF;

  IF v_product_id IS NULL THEN
    -- Create.
    v_order_id := (p_product->>'order_id')::uuid;

    SELECT o.status INTO v_order_status
    FROM public.orders o
    WHERE o.id = v_order_id
    FOR UPDATE;

    IF v_order_status IS NULL THEN
      RAISE EXCEPTION 'Order (%) does not exist', v_order_id;
    END IF;

    IF v_order_status IN ('FINISHED', 'BILLED') THEN
      RAISE EXCEPTION 'Order (%) is closed (%); no product can be added', v_order_id, v_order_status;
    END IF;

    INSERT INTO public.products (order_id, department, type, quantity, notes, sort_order)
    VALUES (
      v_order_id,
      (p_product->>'department')::public.department,
      v_type,
      (p_product->>'quantity')::integer,
      p_product->>'notes',
      COALESCE((p_product->>'sort_order')::integer, 0)
    )
    RETURNING id INTO v_product_id;
  ELSE
    -- Change.
    SELECT p.order_id, p.type, p.status INTO v_current
    FROM public.products p
    WHERE p.id = v_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product (%) does not exist', v_product_id;
    END IF;

    IF v_current.status IN ('AWAITING_APPROVAL', 'IN_PRODUCTION', 'DONE') THEN
      RAISE EXCEPTION
        'Product (%) has been released (%); its specification is locked',
        v_product_id, v_current.status;
    END IF;

    IF public.fn_order_is_closed(v_current.order_id) THEN
      RAISE EXCEPTION
        'Product (%) belongs to a closed order; its specification is locked',
        v_product_id;
    END IF;

    v_before := public.fn_product_snapshot(v_product_id);

    UPDATE public.products p
    SET type = v_type,
        quantity = (p_product->>'quantity')::integer,
        notes = p_product->>'notes',
        sort_order = COALESCE((p_product->>'sort_order')::integer, p.sort_order)
    WHERE p.id = v_product_id;

    -- The children as they stood go, from the table of the type the product
    -- had; what was handed in replaces them below.
    IF v_current.type = 'TEXTILE_GARMENT' THEN
      DELETE FROM public.textile_garments g WHERE g.product_id = v_product_id;
      DELETE FROM public.textile_designs d WHERE d.product_id = v_product_id;
    ELSE
      EXECUTE format(
        'DELETE FROM public.%I c WHERE c.product_id = $1',
        public.fn_child_table_for_type(v_current.type)
      ) USING v_product_id;
    END IF;
  END IF;

  IF v_is_textile THEN
    PERFORM public.fn_insert_product_rows('textile_garments', v_product_id, v_garments);
    PERFORM public.fn_insert_product_rows('textile_designs', v_product_id, v_designs);
  ELSE
    PERFORM public.fn_insert_product_rows(v_child_table, v_product_id, jsonb_build_array(v_child));
  END IF;

  IF v_before IS NULL THEN
    PERFORM public.fn_record_product_created(v_product_id);
  ELSE
    v_after := public.fn_product_snapshot(v_product_id);
    IF public.fn_product_snapshot_comparable(v_after)
       IS DISTINCT FROM public.fn_product_snapshot_comparable(v_before) THEN
      PERFORM public.fn_write_history(
        'PRODUCT_UPDATED',
        jsonb_build_object('product_id', v_product_id),
        jsonb_build_object('before', v_before, 'after', v_after)
      );
    END IF;
  END IF;

  RETURN v_product_id;
END;
$$;

ALTER FUNCTION "public"."save_product"("jsonb", "jsonb", "jsonb", "jsonb") OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."save_product"("jsonb", "jsonb", "jsonb", "jsonb") FROM PUBLIC, "anon";

GRANT EXECUTE ON FUNCTION "public"."save_product"("jsonb", "jsonb", "jsonb", "jsonb") TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."save_product"("jsonb", "jsonb", "jsonb", "jsonb") TO "service_role";

-- ── Guards (decision 4) ──────────────────────────────────────────────────────
-- save_product is the only way an app role creates a product or writes its
-- specification. Both guards are BEFORE triggers with INVOKER rights, so that
-- current_user is the caller, and exempt the owner and service_role as every
-- guard does: the seed and the security-definer functions run as the owner,
-- service_role is the e2e runner. A product's delete cascades into its
-- children as the owner, so the removal rule stays the only say on that.

/**
 * Trigger guard: an app role neither inserts a product nor changes its spec
 * columns (department, type, quantity, notes) directly. sort_order is
 * ordering and the workflow columns have their own rules; both stay free.
 *
 * @trigger BEFORE INSERT OR UPDATE OF department, type, quantity, notes ON products (per row)
 * @raises on an insert by an app role; on an update by one that changes a spec column.
 */
CREATE OR REPLACE FUNCTION "public"."fn_refuse_direct_product_spec_write"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" = ''
    AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'A product is created through save_product, not by a direct insert';
  END IF;

  IF (NEW.department, NEW.type, NEW.quantity, NEW.notes)
     IS DISTINCT FROM (OLD.department, OLD.type, OLD.quantity, OLD.notes) THEN
    RAISE EXCEPTION
      'The specification of product (%) is written through save_product, not by a direct update',
      OLD.id;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."fn_refuse_direct_product_spec_write"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_refuse_direct_product_spec_write"() FROM PUBLIC;

/**
 * Trigger guard: an app role does not write a product's child rows directly —
 * the 30 typed child tables, textile_garments and textile_designs.
 *
 * @trigger BEFORE INSERT OR UPDATE OR DELETE ON each child table (per row)
 * @raises on any write by an app role.
 */
CREATE OR REPLACE FUNCTION "public"."fn_refuse_direct_product_child_write"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" = ''
    AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'The rows of % are written through save_product, not directly',
    TG_TABLE_NAME;
END;
$$;

ALTER FUNCTION "public"."fn_refuse_direct_product_child_write"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_refuse_direct_product_child_write"() FROM PUBLIC;

-- The new guards take the place of the released-product ones, table by table:
-- every table that carries the old child guard gets the new one.
DROP TRIGGER "trg_refuse_released_product_spec_change" ON "public"."products";

CREATE TRIGGER "trg_refuse_direct_product_spec_write"
    BEFORE INSERT OR UPDATE OF "department", "type", "quantity", "notes" ON "public"."products"
    FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_direct_product_spec_write"();

DO $$
DECLARE
  v_table regclass;
BEGIN
  FOR v_table IN
    SELECT t.tgrelid::regclass
    FROM pg_catalog.pg_trigger t
    WHERE t.tgname = 'trg_refuse_released_product_child_change'
      AND NOT t.tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER "trg_refuse_released_product_child_change" ON %s', v_table);
    EXECUTE format(
      'CREATE TRIGGER "trg_refuse_direct_product_child_write" '
      'BEFORE INSERT OR UPDATE OR DELETE ON %s '
      'FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_direct_product_child_write"()',
      v_table
    );
  END LOOP;
END;
$$;

DROP FUNCTION "public"."fn_refuse_released_product_spec_change"();

DROP FUNCTION "public"."fn_refuse_released_product_child_change"();

-- ── duplicate_order ──────────────────────────────────────────────────────────
-- Its body as it stood (20261119160819_everyday_history), with two changes:
-- the created_by_user_id parameter goes, unused since the orders trigger
-- records the copy under the signed-in user, and each copied product is
-- recorded through fn_record_product_created once its child rows are copied.

DROP FUNCTION "public"."duplicate_order"("uuid", "public"."priority_type", "public"."delivery_type", "date", "uuid"[], "uuid");

/**
 * Clone an existing order into a new quote. The whole function body runs as
 * a single transaction, so any failure rolls the entire clone back.
 *
 * Copies the source order's customer into a new order with status QUOTE, then
 * clones each selected product (status reset to IN_SETUP, unassigned, a fresh
 * product_number from the trigger), its typed child, its product_files links
 * and, for TEXTILE, the batch's garment lines and designs. A copy is a new
 * order and is recorded as one: the orders trigger writes ORDER_CREATED, the
 * product_files trigger a FILE_ADDED per copied link, and this function a
 * PRODUCT_CREATED per copied product, all under one action id.
 * SECURITY DEFINER.
 *
 * @param source_order_id      order to clone
 * @param new_priority         priority for the new order
 * @param new_delivery         delivery type for the new order
 * @param new_deadline         deadline for the new order
 * @param selected_product_ids which of the source products to copy
 * @returns the new order's id
 */
CREATE OR REPLACE FUNCTION "public"."duplicate_order"("source_order_id" "uuid", "new_priority" "public"."priority_type", "new_delivery" "public"."delivery_type", "new_deadline" "date", "selected_product_ids" "uuid"[]) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  source_customer_id    UUID;
  source_payment        public.payment_method;
  new_order_id          UUID;
  new_product_id        UUID;
  source_product        RECORD;
BEGIN
  -- Customer + payment method of the source order
  SELECT customer_id, payment_method INTO source_customer_id, source_payment FROM orders WHERE id = source_order_id;
  IF source_customer_id IS NULL THEN
    RAISE EXCEPTION 'customer_id missing on source order';
  END IF;

  -- New order
  INSERT INTO orders (customer_id, status, priority, delivery, deadline, payment_method)
  VALUES (source_customer_id, 'QUOTE', new_priority, new_delivery, new_deadline, source_payment)
  RETURNING id INTO new_order_id;

  -- Products (every department). Workflow state is not carried over: the copy
  -- starts in setup, unassigned, with no approval and its own number.
  FOR source_product IN
    SELECT * FROM products WHERE id = ANY(selected_product_ids) ORDER BY sort_order
  LOOP
        INSERT INTO products (order_id, department, type, status, quantity, notes, priority, delivery, sort_order)
        VALUES (new_order_id, source_product.department, source_product.type, 'IN_SETUP', source_product.quantity, source_product.notes, source_product.priority, source_product.delivery, source_product.sort_order)
        RETURNING id INTO new_product_id;

        -- Copy the typed child row (one arm per product type)
        CASE source_product.type
          WHEN 'POSTER' THEN
            INSERT INTO poster_products (product_id, format, width, height, material, laminate)
            SELECT new_product_id, format, width, height, material, laminate FROM poster_products WHERE product_id = source_product.id;
          WHEN 'CARD_FLYER' THEN
            INSERT INTO card_flyer_products (product_id, format, width, height, color_mode, full_bleed, production_path, cc_material, cc_material_other, offset_type, offset_weight, offset_finish, special_paper, special_paper_other, lamination_finish, lamination_sides, recycling_weight)
            SELECT new_product_id, format, width, height, color_mode, full_bleed, production_path, cc_material, cc_material_other, offset_type, offset_weight, offset_finish, special_paper, special_paper_other, lamination_finish, lamination_sides, recycling_weight FROM card_flyer_products WHERE product_id = source_product.id;
          WHEN 'FOLDED_FLYER' THEN
            INSERT INTO folded_flyer_products (product_id, format, width, height, color_mode, full_bleed, production_path, cc_material, cc_material_other, offset_type, offset_weight, offset_finish, special_paper, special_paper_other, lamination_finish, lamination_sides, recycling_weight, fold_type, page_count)
            SELECT new_product_id, format, width, height, color_mode, full_bleed, production_path, cc_material, cc_material_other, offset_type, offset_weight, offset_finish, special_paper, special_paper_other, lamination_finish, lamination_sides, recycling_weight, fold_type, page_count FROM folded_flyer_products WHERE product_id = source_product.id;
          WHEN 'BROCHURE' THEN
            INSERT INTO brochure_products (product_id, format, width, height, orientation, page_count, full_bleed, production_path, cover_material, cover_material_other, inner_material, inner_material_other, binding, cover_weight, cover_finish, inner_weight, inner_finish)
            SELECT new_product_id, format, width, height, orientation, page_count, full_bleed, production_path, cover_material, cover_material_other, inner_material, inner_material_other, binding, cover_weight, cover_finish, inner_weight, inner_finish FROM brochure_products WHERE product_id = source_product.id;
          WHEN 'BUSINESS_CARD' THEN
            INSERT INTO business_card_products (product_id, format, width, height, orientation, color_mode, material, film_laminated, multiloft_color, full_bleed)
            SELECT new_product_id, format, width, height, orientation, color_mode, material, film_laminated, multiloft_color, full_bleed FROM business_card_products WHERE product_id = source_product.id;
          WHEN 'BINDING' THEN
            INSERT INTO binding_products (product_id, format, width, height, orientation, material, material_other, color_mode, binding_type, binding_color, full_bleed, hardcover_print, hardcover_cover)
            SELECT new_product_id, format, width, height, orientation, material, material_other, color_mode, binding_type, binding_color, full_bleed, hardcover_print, hardcover_cover FROM binding_products WHERE product_id = source_product.id;
          WHEN 'PRINTOUT' THEN
            INSERT INTO printout_products (product_id, format, material, material_other, color_mode, punching, staple, laminate)
            SELECT new_product_id, format, material, material_other, color_mode, punching, staple, laminate FROM printout_products WHERE product_id = source_product.id;
          WHEN 'TRODAT_PRINTY' THEN
            INSERT INTO trodat_printy_products (product_id, model_id)
            SELECT new_product_id, model_id FROM trodat_printy_products WHERE product_id = source_product.id;
          WHEN 'WOODEN_STAMP' THEN
            INSERT INTO wooden_stamp_products (product_id, model_id)
            SELECT new_product_id, model_id FROM wooden_stamp_products WHERE product_id = source_product.id;
          WHEN 'STAND_STAMP' THEN
            INSERT INTO stand_stamp_products (product_id, width, height, color, color_other, description)
            SELECT new_product_id, width, height, color, color_other, description FROM stand_stamp_products WHERE product_id = source_product.id;
          WHEN 'DATE_STAMP' THEN
            INSERT INTO date_stamp_products (product_id, width, height, color, color_other, description)
            SELECT new_product_id, width, height, color, color_other, description FROM date_stamp_products WHERE product_id = source_product.id;
          WHEN 'OTHER_STAMP' THEN
            INSERT INTO other_stamp_products (product_id, width, height, color, color_other, description)
            SELECT new_product_id, width, height, color, color_other, description FROM other_stamp_products WHERE product_id = source_product.id;
          WHEN 'STAMP_PLATE' THEN
            INSERT INTO stamp_plate_products (product_id, width, height)
            SELECT new_product_id, width, height FROM stamp_plate_products WHERE product_id = source_product.id;
          WHEN 'REFILL_INK' THEN
            INSERT INTO refill_ink_products (product_id, color, ink_type)
            SELECT new_product_id, color, ink_type FROM refill_ink_products WHERE product_id = source_product.id;
          WHEN 'INK_PAD' THEN
            INSERT INTO ink_pad_products (product_id, pad_size, color)
            SELECT new_product_id, pad_size, color FROM ink_pad_products WHERE product_id = source_product.id;
          WHEN 'TRODAT_PAD' THEN
            INSERT INTO trodat_pad_products (product_id, pad_article_number, pad_variant_id, color)
            SELECT new_product_id, pad_article_number, pad_variant_id, color FROM trodat_pad_products WHERE product_id = source_product.id;
          WHEN 'STICKER' THEN
            INSERT INTO sticker_products (product_id, material, material_variant, contour_cut, laminate, output, width, height)
            SELECT new_product_id, material, material_variant, contour_cut, laminate, output, width, height FROM sticker_products WHERE product_id = source_product.id;
          WHEN 'SIGN_UV' THEN
            INSERT INTO sign_uv_products (product_id, material, print_side, acrylic_print_direction, width, height, round_corners, drill_holes, drill_hole_diameter, drill_hole_position)
            SELECT new_product_id, material, print_side, acrylic_print_direction, width, height, round_corners, drill_holes, drill_hole_diameter, drill_hole_position FROM sign_uv_products WHERE product_id = source_product.id;
          WHEN 'SIGN_FOIL' THEN
            INSERT INTO sign_foil_products (product_id, material, laminate, print_side, width, height, round_corners, drill_holes, drill_hole_diameter, drill_hole_position)
            SELECT new_product_id, material, laminate, print_side, width, height, round_corners, drill_holes, drill_hole_diameter, drill_hole_position FROM sign_foil_products WHERE product_id = source_product.id;
          WHEN 'FOIL_PLOTTER' THEN
            INSERT INTO foil_plotter_products (product_id, material, output, width, height)
            SELECT new_product_id, material, output, width, height FROM foil_plotter_products WHERE product_id = source_product.id;
          WHEN 'BANNER' THEN
            INSERT INTO banner_products (product_id, material, width, height, hem, hem_sides, eyelets, eyelet_detail)
            SELECT new_product_id, material, width, height, hem, hem_sides, eyelets, eyelet_detail FROM banner_products WHERE product_id = source_product.id;
          WHEN 'ROLLUP' THEN
            INSERT INTO rollup_products (product_id, material, rollup_system, rollup_width)
            SELECT new_product_id, material, rollup_system, rollup_width FROM rollup_products WHERE product_id = source_product.id;
          WHEN 'VEHICLE_LETTERING' THEN
            INSERT INTO vehicle_lettering_products (product_id, vehicle_make, vehicle_model, area_sides, area_front, area_rear, installation, existing_wrap, installation_date)
            SELECT new_product_id, vehicle_make, vehicle_model, area_sides, area_front, area_rear, installation, existing_wrap, installation_date FROM vehicle_lettering_products WHERE product_id = source_product.id;
          WHEN 'OTHER_LFP' THEN
            INSERT INTO other_lfp_products (product_id, description)
            SELECT new_product_id, description FROM other_lfp_products WHERE product_id = source_product.id;
          WHEN 'SIGN' THEN
            INSERT INTO sign_products (product_id, motif, material, material_other, width, height, round_corners, self_adhesive)
            SELECT new_product_id, motif, material, material_other, width, height, round_corners, self_adhesive FROM sign_products WHERE product_id = source_product.id;
          WHEN 'TROPHY_PLATE' THEN
            INSERT INTO trophy_plate_products (product_id, motif, material, material_other, width, height, round_corners, self_adhesive)
            SELECT new_product_id, motif, material, material_other, width, height, round_corners, self_adhesive FROM trophy_plate_products WHERE product_id = source_product.id;
          WHEN 'NAME_TAG' THEN
            INSERT INTO name_tag_products (product_id, motif, material, material_other, width, height, round_corners)
            SELECT new_product_id, motif, material, material_other, width, height, round_corners FROM name_tag_products WHERE product_id = source_product.id;
          WHEN 'GIFT_ITEM' THEN
            INSERT INTO gift_item_products (product_id, motif, material_free_text, origin)
            SELECT new_product_id, motif, material_free_text, origin FROM gift_item_products WHERE product_id = source_product.id;
          WHEN 'OTHER_LASER' THEN
            INSERT INTO other_laser_products (product_id, motif, material_free_text, origin, self_adhesive)
            SELECT new_product_id, motif, material_free_text, origin, self_adhesive FROM other_laser_products WHERE product_id = source_product.id;
          WHEN 'OTHER' THEN
            INSERT INTO other_products (product_id, description)
            SELECT new_product_id, description FROM other_products WHERE product_id = source_product.id;
          WHEN 'TEXTILE_GARMENT' THEN
            -- No 1:1 child: a textile batch's garment lines and designs are
            -- 1:n and are copied after this CASE.
            NULL;
        END CASE;

        -- Copy file assignments
        INSERT INTO product_files (product_id, file_id)
        SELECT new_product_id, file_id
        FROM product_files
        WHERE product_id = source_product.id;

        -- TEXTILE: the batch's garment lines and its designs, both per product.
        IF source_product.type = 'TEXTILE_GARMENT' THEN
          INSERT INTO textile_garments (product_id, origin, variant_id, garment_type, brand, model, color, size, quantity, sort_order)
          SELECT new_product_id, origin, variant_id, garment_type, brand, model, color, size, quantity, sort_order
          FROM textile_garments
          WHERE product_id = source_product.id;

          INSERT INTO textile_designs (product_id, type, content, color, font_class, font_name, file_id, placement, size, print_method)
          SELECT new_product_id, type, content, color, font_class, font_name, file_id, placement, size, print_method
          FROM textile_designs
          WHERE product_id = source_product.id;
        END IF;

        -- The copy is complete: record it, with its full content.
        PERFORM public.fn_record_product_created(new_product_id);
  END LOOP;

  RETURN new_order_id;
END;
$$;

ALTER FUNCTION "public"."duplicate_order"("uuid", "public"."priority_type", "public"."delivery_type", "date", "uuid"[]) OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."duplicate_order"("uuid", "public"."priority_type", "public"."delivery_type", "date", "uuid"[]) FROM PUBLIC, "anon";

GRANT EXECUTE ON FUNCTION "public"."duplicate_order"("uuid", "public"."priority_type", "public"."delivery_type", "date", "uuid"[]) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."duplicate_order"("uuid", "public"."priority_type", "public"."delivery_type", "date", "uuid"[]) TO "service_role";
