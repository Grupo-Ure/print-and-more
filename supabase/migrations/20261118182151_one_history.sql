-- 20261118182151_one_history.sql — one history, written by one function
--
-- TRANSACTION_RECORD.md, WP0 (decisions 1, 5, 8, 9, 12). Every entry lives
-- in `history`, whatever it concerns: it links to the records it is about —
-- an order and product, a customer, a file, a stock item — and has at least
-- one link. Every link restricts the deletion of what it points at; what may
-- still be deleted takes its entries along first (fn_forget_history), so a
-- deletion writes no entry and leaves none behind. The entries of one action
-- share an action id. fn_write_history is the one writer every trigger and
-- function calls from here on; the client keeps inserting until WP7.
--
-- What is recorded does not change in this package, except that a deletion
-- is no longer an entry: PRODUCT_DELETED, FILE_REMOVED and TIME_LOG_DELETED
-- are written by nothing from here on and the entries written with them go.

-- ── history: the links ───────────────────────────────────────────────────────

ALTER TABLE "public"."history"
    ALTER COLUMN "order_id" DROP NOT NULL,
    ADD COLUMN "customer_id" "uuid",
    ADD COLUMN "file_id" "uuid",
    ADD COLUMN "stamp_model_id" "uuid",
    ADD COLUMN "textile_variant_id" "uuid",
    ADD COLUMN "action_id" "uuid";

COMMENT ON COLUMN "public"."history"."order_id" IS
    'The order the entry concerns; empty for an entry about a customer or a stock item alone. Read by every employee when set, by admins only when not.';

COMMENT ON COLUMN "public"."history"."customer_id" IS
    'The customer the entry concerns (CUSTOMER_CREATED, CUSTOMER_UPDATED).';

COMMENT ON COLUMN "public"."history"."file_id" IS
    'The file the entry concerns (FILE_ADDED, FILE_RENAMED, FILE_ROLE_CHANGED).';

COMMENT ON COLUMN "public"."history"."stamp_model_id" IS
    'The stamp model whose stock the entry changed (STOCK_BOOKED, STOCK_AUTO_DEDUCTED).';

COMMENT ON COLUMN "public"."history"."textile_variant_id" IS
    'The textile variant whose stock the entry changed (STOCK_BOOKED, STOCK_AUTO_DEDUCTED).';

COMMENT ON COLUMN "public"."history"."action_id" IS
    'Shared by every entry written in one transaction: one call from the app is one action. Set by fn_write_history; empty on entries written before it and on the client''s.';

-- Every link restricts: no record with an entry is deleted, and no link is
-- emptied by a deletion. user_id and product_id were SET NULL.
ALTER TABLE "public"."history"
    DROP CONSTRAINT "history_person_id_fkey",
    ADD CONSTRAINT "history_person_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT,
    DROP CONSTRAINT "history_product_id_fkey",
    ADD CONSTRAINT "history_product_id_fkey"
        FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT,
    ADD CONSTRAINT "history_customer_id_fkey"
        FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE RESTRICT,
    ADD CONSTRAINT "history_file_id_fkey"
        FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE RESTRICT,
    ADD CONSTRAINT "history_stamp_model_id_fkey"
        FOREIGN KEY ("stamp_model_id") REFERENCES "public"."stamp_models"("id") ON DELETE RESTRICT,
    ADD CONSTRAINT "history_textile_variant_id_fkey"
        FOREIGN KEY ("textile_variant_id") REFERENCES "public"."textile_variants"("id") ON DELETE RESTRICT,
    ADD CONSTRAINT "history_has_a_link_check"
        CHECK ("num_nonnulls"("order_id", "product_id", "customer_id", "file_id", "stamp_model_id", "textile_variant_id") >= 1);

CREATE INDEX "idx_history_customer_id" ON "public"."history" USING "btree" ("customer_id");

CREATE INDEX "idx_history_file_id" ON "public"."history" USING "btree" ("file_id");

CREATE INDEX "idx_history_stamp_model_id" ON "public"."history" USING "btree" ("stamp_model_id");

CREATE INDEX "idx_history_textile_variant_id" ON "public"."history" USING "btree" ("textile_variant_id");

CREATE INDEX "idx_history_action_id" ON "public"."history" USING "btree" ("action_id");

-- The global page pages by (created_at, id); the composite covers what the
-- single-column index did.
DROP INDEX "public"."idx_history_created_at";

CREATE INDEX "idx_history_created_at_id" ON "public"."history" USING "btree" ("created_at", "id");

-- ── Read access (decision 12) ────────────────────────────────────────────────
-- An employee reads the entries of an order; an entry with no order — a
-- customer's, a stock booking — is an admin's to read, on the global page.

DROP POLICY "Employees: read" ON "public"."history";

CREATE POLICY "Employees: read" ON "public"."history"
    FOR SELECT TO "authenticated"
    USING (
      "order_id" IS NOT NULL
      OR "public"."current_user_role"() IN ('ADMIN'::"public"."user_role", 'SUPER_ADMIN'::"public"."user_role")
    );

-- ── A deletion is not an entry (decision 9) ──────────────────────────────────
-- The migration runs as the owner, whom fn_refuse_history_change lets through.

DELETE FROM "public"."history"
WHERE "event_type" IN ('PRODUCT_DELETED', 'FILE_REMOVED', 'TIME_LOG_DELETED');

-- ── fn_write_history ─────────────────────────────────────────────────────────

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

-- ── Snapshot helpers (decision 8) ────────────────────────────────────────────
-- "Full content" is a snapshot of the record, taken by the writer at that
-- moment and stored as JSON, so that it keeps the data as it was even after
-- the tables it came from change. Nothing calls them yet: PRODUCT_CREATED and
-- PRODUCT_UPDATED come with save_product (WP4), ORDER_CREATED and the cancel
-- with the triggers and cancel_order (WP3).

/**
 * The child table of a product type — the SQL mirror of CHILD_TABLE_BY_TYPE
 * in src/types/product.ts. NULL for TEXTILE_GARMENT, whose children are the
 * garment lines and designs, and for a type it does not know.
 */
CREATE OR REPLACE FUNCTION "public"."fn_child_table_for_type"("p_type" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" = ''
    AS $$
  SELECT CASE p_type
    -- CopyShop
    WHEN 'POSTER' THEN 'poster_products'
    WHEN 'CARD_FLYER' THEN 'card_flyer_products'
    WHEN 'FOLDED_FLYER' THEN 'folded_flyer_products'
    WHEN 'BROCHURE' THEN 'brochure_products'
    WHEN 'BUSINESS_CARD' THEN 'business_card_products'
    WHEN 'BINDING' THEN 'binding_products'
    WHEN 'PRINTOUT' THEN 'printout_products'
    -- Stamp
    WHEN 'TRODAT_PRINTY' THEN 'trodat_printy_products'
    WHEN 'WOODEN_STAMP' THEN 'wooden_stamp_products'
    WHEN 'STAND_STAMP' THEN 'stand_stamp_products'
    WHEN 'DATE_STAMP' THEN 'date_stamp_products'
    WHEN 'OTHER_STAMP' THEN 'other_stamp_products'
    WHEN 'STAMP_PLATE' THEN 'stamp_plate_products'
    WHEN 'REFILL_INK' THEN 'refill_ink_products'
    WHEN 'INK_PAD' THEN 'ink_pad_products'
    WHEN 'TRODAT_PAD' THEN 'trodat_pad_products'
    -- LFP
    WHEN 'STICKER' THEN 'sticker_products'
    WHEN 'SIGN_UV' THEN 'sign_uv_products'
    WHEN 'SIGN_FOIL' THEN 'sign_foil_products'
    WHEN 'FOIL_PLOTTER' THEN 'foil_plotter_products'
    WHEN 'BANNER' THEN 'banner_products'
    WHEN 'ROLLUP' THEN 'rollup_products'
    WHEN 'VEHICLE_LETTERING' THEN 'vehicle_lettering_products'
    WHEN 'OTHER_LFP' THEN 'other_lfp_products'
    -- Laser
    WHEN 'SIGN' THEN 'sign_products'
    WHEN 'TROPHY_PLATE' THEN 'trophy_plate_products'
    WHEN 'NAME_TAG' THEN 'name_tag_products'
    WHEN 'GIFT_ITEM' THEN 'gift_item_products'
    WHEN 'OTHER_LASER' THEN 'other_laser_products'
    -- Other
    WHEN 'OTHER' THEN 'other_products'
  END;
$$;

ALTER FUNCTION "public"."fn_child_table_for_type"("text") OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_child_table_for_type"("text") FROM PUBLIC, "anon";

GRANT EXECUTE ON FUNCTION "public"."fn_child_table_for_type"("text") TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."fn_child_table_for_type"("text") TO "service_role";

/**
 * A product's full content at this moment: its spec columns on `products`
 * (product_number, department, type, quantity, notes, sort_order) and, under
 * `spec`, its typed child row without product_id — or, for a textile batch,
 * its `garments` and `designs`. The workflow columns (status, assignee, the
 * settings overrides) are not the spec and are recorded by their own entries.
 *
 * @raises when the product does not exist or its type has no child table.
 */
CREATE OR REPLACE FUNCTION "public"."fn_product_snapshot"("p_product_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" = ''
    AS $$
DECLARE
  parent       RECORD;
  child_table  text;
  child        jsonb;
  snapshot     jsonb;
BEGIN
  SELECT p.product_number, p.department, p.type, p.quantity, p.notes, p.sort_order
  INTO parent
  FROM public.products p
  WHERE p.id = p_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'fn_product_snapshot: product % does not exist', p_product_id;
  END IF;

  snapshot := jsonb_build_object(
    'product_number', parent.product_number,
    'department', parent.department,
    'type', parent.type,
    'quantity', parent.quantity,
    'notes', parent.notes,
    'sort_order', parent.sort_order
  );

  IF parent.type = 'TEXTILE_GARMENT' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(g) - 'product_id' ORDER BY g.sort_order, g.created_at, g.id), '[]'::jsonb)
    INTO child
    FROM public.textile_garments g
    WHERE g.product_id = p_product_id;
    snapshot := snapshot || jsonb_build_object('garments', child);

    SELECT COALESCE(jsonb_agg(to_jsonb(d) - 'product_id' ORDER BY d.created_at, d.id), '[]'::jsonb)
    INTO child
    FROM public.textile_designs d
    WHERE d.product_id = p_product_id;
    snapshot := snapshot || jsonb_build_object('designs', child);
  ELSE
    child_table := public.fn_child_table_for_type(parent.type);
    IF child_table IS NULL THEN
      RAISE EXCEPTION 'fn_product_snapshot: type % has no child table', parent.type;
    END IF;

    EXECUTE format('SELECT to_jsonb(c) - ''product_id'' FROM public.%I c WHERE c.product_id = $1', child_table)
    INTO child
    USING p_product_id;
    snapshot := snapshot || jsonb_build_object('spec', COALESCE(child, '{}'::jsonb));
  END IF;

  RETURN snapshot;
END;
$$;

ALTER FUNCTION "public"."fn_product_snapshot"("uuid") OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_product_snapshot"("uuid") FROM PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."fn_product_snapshot"("uuid") TO "service_role";

/**
 * An order's full content at this moment: every column of its row, the
 * customer's name, and its products' ids, numbers, departments and types.
 *
 * @raises when the order does not exist.
 */
CREATE OR REPLACE FUNCTION "public"."fn_order_snapshot"("p_order_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" = ''
    AS $$
DECLARE
  snapshot jsonb;
BEGIN
  SELECT to_jsonb(o) || jsonb_build_object(
    'customer_name', c.name,
    'products', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('id', p.id, 'product_number', p.product_number, 'department', p.department, 'type', p.type)
        ORDER BY p.sort_order, p.product_number
      )
      FROM public.products p
      WHERE p.order_id = o.id
    ), '[]'::jsonb)
  )
  INTO snapshot
  FROM public.orders o
  JOIN public.customers c ON c.id = o.customer_id
  WHERE o.id = p_order_id;

  IF snapshot IS NULL THEN
    RAISE EXCEPTION 'fn_order_snapshot: order % does not exist', p_order_id;
  END IF;

  RETURN snapshot;
END;
$$;

ALTER FUNCTION "public"."fn_order_snapshot"("uuid") OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_order_snapshot"("uuid") FROM PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."fn_order_snapshot"("uuid") TO "service_role";

-- ── fn_forget_history (decision 9) ───────────────────────────────────────────

/**
 * An entry lives exactly as long as its record. What may be deleted — a
 * product in setup, a file, a file's link to a product, a time log — takes
 * its entries along: a product's and a file's by their link, a file link's
 * FILE_ADDED by its product and file, a time log's TIME_LOGGED by
 * meta.time_log_id. The deletion itself writes no entry. A row deleted with
 * its parent (a product's links and time logs, a file's links) runs this too
 * and finds its entries already gone.
 *
 * Runs as the owner, whom fn_refuse_history_change lets through; the RESTRICT
 * link then finds nothing left pointing at the row. The lock guards of these
 * tables fire on the same event: whichever runs first, a refusal aborts the
 * statement and the entries stay.
 *
 * @trigger BEFORE DELETE ON products, files, product_files, product_time_logs (per row)
 */
CREATE OR REPLACE FUNCTION "public"."fn_forget_history"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'products' THEN
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

ALTER FUNCTION "public"."fn_forget_history"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_forget_history"() FROM PUBLIC;

CREATE TRIGGER "trg_forget_history"
    BEFORE DELETE ON "public"."products"
    FOR EACH ROW EXECUTE FUNCTION "public"."fn_forget_history"();

CREATE TRIGGER "trg_forget_history"
    BEFORE DELETE ON "public"."files"
    FOR EACH ROW EXECUTE FUNCTION "public"."fn_forget_history"();

CREATE TRIGGER "trg_forget_history"
    BEFORE DELETE ON "public"."product_files"
    FOR EACH ROW EXECUTE FUNCTION "public"."fn_forget_history"();

CREATE TRIGGER "trg_forget_history"
    BEFORE DELETE ON "public"."product_time_logs"
    FOR EACH ROW EXECUTE FUNCTION "public"."fn_forget_history"();
