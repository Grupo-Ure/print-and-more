-- 20261119160819_everyday_history.sql — the everyday changes are recorded by the database
--
-- TRANSACTION_RECORD.md, WP3 (decisions 3, 4, 5, 8). Until now the app wrote
-- the entry for an everyday change itself, as a second request after the
-- change, best effort. From here a trigger on the changed table writes it,
-- in the transaction of the change, through fn_write_history: whoever
-- changes the row — the app, a database function, a direct query — the
-- entry is written, or the change does not happen.
--
-- | Table             | Recorded                                                     |
-- |-------------------|--------------------------------------------------------------|
-- | orders            | created; deadline, delivery, priority, payment method; the   |
-- |                   | billing note; archived; processing started, billed, closed   |
-- |                   | as cash, reopened (finished: WP2)                            |
-- | products          | own deadline, delivery, priority; assignee; cancelled; done  |
-- | files             | added to an order; renamed; role changed                     |
-- | product_files     | a file linked to a product                                   |
-- | product_time_logs | time logged                                                  |
-- | customers         | created; any field changed but the bounce flag               |
--
-- What an entry keeps (decision 8): a creation its full content in
-- meta.after, a value change meta.field / meta.previous / meta.next, a
-- cancellation the full content as it stood in meta.before.
--
-- cancel_order cancels an order's products and archives it in one
-- transaction, so the entries it causes share one action id.
--
-- Two functions stop writing an entry of their own, since a trigger now
-- records what they change: fn_assign_stage_default_assignee (the products
-- trigger records the handover as ASSIGNEE_CHANGED) and duplicate_order (the
-- orders trigger records the copy as ORDER_CREATED).
--
-- Not here: PRODUCT_CREATED / PRODUCT_UPDATED stay the client's until
-- save_product (WP4); a product's insert is not recorded by a trigger, since
-- its child rows are written after it.

-- ── orders ───────────────────────────────────────────────────────────────────

/**
 * Records an order's creation: ORDER_CREATED with the order's full content
 * as created (meta.after) — a new order from the dialog and a copy made by
 * duplicate_order alike.
 *
 * @trigger AFTER INSERT ON orders (per row)
 */
CREATE OR REPLACE FUNCTION "public"."fn_record_order_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
BEGIN
  PERFORM public.fn_write_history(
    'ORDER_CREATED',
    jsonb_build_object('order_id', NEW.id),
    jsonb_build_object('after', public.fn_order_snapshot(NEW.id))
  );
  RETURN NULL;
END;
$$;

ALTER FUNCTION "public"."fn_record_order_created"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_record_order_created"() FROM PUBLIC;

CREATE TRIGGER "trg_record_order_created"
    AFTER INSERT ON "public"."orders"
    FOR EACH ROW EXECUTE FUNCTION "public"."fn_record_order_created"();

/**
 * Records a change to an order's terms and its archiving:
 *   - deadline, delivery, priority, payment_method → SETTINGS_CHANGED, one
 *     entry per changed field;
 *   - billing_note → ORDER_BILLING_NOTE_CHANGED;
 *   - is_archived false → true → ORDER_ARCHIVED (by hand, by the cancel, by
 *     the billing — each shares the action id of what caused it).
 * Unarchiving is not a transaction on the list and writes nothing. The
 * status is recorded by fn_record_order_status_change.
 *
 * Plain AFTER UPDATE with a WHEN on the old and new row rather than UPDATE OF
 * a column list, which would miss a column a BEFORE trigger changed.
 *
 * @trigger AFTER UPDATE ON orders (per row), when a recorded column changes
 */
CREATE OR REPLACE FUNCTION "public"."fn_record_order_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
DECLARE
  v_old    jsonb := to_jsonb(OLD);
  v_new    jsonb := to_jsonb(NEW);
  v_links  jsonb := jsonb_build_object('order_id', NEW.id);
  v_field  text;
BEGIN
  FOREACH v_field IN ARRAY ARRAY['deadline', 'delivery', 'priority', 'payment_method'] LOOP
    IF v_new->v_field IS DISTINCT FROM v_old->v_field THEN
      PERFORM public.fn_write_history(
        'SETTINGS_CHANGED',
        v_links,
        jsonb_build_object('field', v_field, 'previous', v_old->v_field, 'next', v_new->v_field)
      );
    END IF;
  END LOOP;

  IF NEW.billing_note IS DISTINCT FROM OLD.billing_note THEN
    PERFORM public.fn_write_history(
      'ORDER_BILLING_NOTE_CHANGED',
      v_links,
      jsonb_build_object('field', 'billing_note', 'previous', OLD.billing_note, 'next', NEW.billing_note)
    );
  END IF;

  IF NEW.is_archived AND NOT OLD.is_archived THEN
    PERFORM public.fn_write_history('ORDER_ARCHIVED', v_links);
  END IF;

  RETURN NULL;
END;
$$;

ALTER FUNCTION "public"."fn_record_order_change"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_record_order_change"() FROM PUBLIC;

CREATE TRIGGER "trg_record_order_change"
    AFTER UPDATE ON "public"."orders"
    FOR EACH ROW
    WHEN (OLD."deadline" IS DISTINCT FROM NEW."deadline"
          OR OLD."delivery" IS DISTINCT FROM NEW."delivery"
          OR OLD."priority" IS DISTINCT FROM NEW."priority"
          OR OLD."payment_method" IS DISTINCT FROM NEW."payment_method"
          OR OLD."billing_note" IS DISTINCT FROM NEW."billing_note"
          OR (NEW."is_archived" AND NOT OLD."is_archived"))
    EXECUTE FUNCTION "public"."fn_record_order_change"();

/**
 * Records an order's lifecycle step, one event per transition:
 *   QUOTE → IN_PROGRESS        PROCESSING_STARTED
 *   IN_PROGRESS → FINISHED     ORDER_FINISHED (by hand or fn_finish_order_if_done)
 *   FINISHED → BILLED          ORDER_BILLED
 *   IN_PROGRESS → BILLED       ORDER_CLOSED_CASH
 *   FINISHED → IN_PROGRESS     ORDER_REOPENED
 * These are the five steps the app makes; no other transition is a
 * transaction on the list, and none writes an entry.
 *
 * @trigger AFTER UPDATE OF status ON orders (per row), when the status changes
 */
CREATE OR REPLACE FUNCTION "public"."fn_record_order_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
DECLARE
  v_event public.history_event;
BEGIN
  v_event := CASE
    WHEN OLD.status = 'QUOTE' AND NEW.status = 'IN_PROGRESS' THEN 'PROCESSING_STARTED'
    WHEN OLD.status = 'IN_PROGRESS' AND NEW.status = 'FINISHED' THEN 'ORDER_FINISHED'
    WHEN OLD.status = 'FINISHED' AND NEW.status = 'BILLED' THEN 'ORDER_BILLED'
    WHEN OLD.status = 'IN_PROGRESS' AND NEW.status = 'BILLED' THEN 'ORDER_CLOSED_CASH'
    WHEN OLD.status = 'FINISHED' AND NEW.status = 'IN_PROGRESS' THEN 'ORDER_REOPENED'
  END;
  IF v_event IS NOT NULL THEN
    PERFORM public.fn_write_history(v_event, jsonb_build_object('order_id', NEW.id));
  END IF;
  RETURN NULL;
END;
$$;

-- ── products ─────────────────────────────────────────────────────────────────

/**
 * Records a change to a product's workflow columns:
 *   - deadline, delivery, priority (the product's own overrides; null =
 *     inherit the order's) → SETTINGS_CHANGED, one entry per changed field;
 *   - assignee_id → ASSIGNEE_CHANGED, by hand or the stage's default
 *     (fn_assign_stage_default_assignee, a BEFORE trigger — hence no UPDATE
 *     OF column list here, which would miss its change). The names are kept
 *     beside the ids, so the entry reads the same once a user is renamed;
 *   - is_cancelled false → true → PRODUCT_CANCELLED with the product's full
 *     content as it stood (meta.before).
 * The status is recorded by fn_record_product_status_change.
 *
 * @trigger AFTER UPDATE ON products (per row), when a recorded column changes
 */
CREATE OR REPLACE FUNCTION "public"."fn_record_product_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
DECLARE
  v_old    jsonb := to_jsonb(OLD);
  v_new    jsonb := to_jsonb(NEW);
  v_links  jsonb := jsonb_build_object('order_id', NEW.order_id, 'product_id', NEW.id);
  v_field  text;
BEGIN
  FOREACH v_field IN ARRAY ARRAY['deadline', 'delivery', 'priority'] LOOP
    IF v_new->v_field IS DISTINCT FROM v_old->v_field THEN
      PERFORM public.fn_write_history(
        'SETTINGS_CHANGED',
        v_links,
        jsonb_build_object('field', v_field, 'previous', v_old->v_field, 'next', v_new->v_field)
      );
    END IF;
  END LOOP;

  IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
    PERFORM public.fn_write_history(
      'ASSIGNEE_CHANGED',
      v_links,
      jsonb_build_object(
        'field', 'assignee_id',
        'previous', OLD.assignee_id,
        'next', NEW.assignee_id,
        'previous_name', (SELECT u.name FROM public.users u WHERE u.id = OLD.assignee_id),
        'next_name', (SELECT u.name FROM public.users u WHERE u.id = NEW.assignee_id)
      )
    );
  END IF;

  IF NEW.is_cancelled AND NOT OLD.is_cancelled THEN
    PERFORM public.fn_write_history(
      'PRODUCT_CANCELLED',
      v_links,
      jsonb_build_object('before', public.fn_product_snapshot(NEW.id))
    );
  END IF;

  RETURN NULL;
END;
$$;

ALTER FUNCTION "public"."fn_record_product_change"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_record_product_change"() FROM PUBLIC;

CREATE TRIGGER "trg_record_product_change"
    AFTER UPDATE ON "public"."products"
    FOR EACH ROW
    WHEN (OLD."deadline" IS DISTINCT FROM NEW."deadline"
          OR OLD."delivery" IS DISTINCT FROM NEW."delivery"
          OR OLD."priority" IS DISTINCT FROM NEW."priority"
          OR OLD."assignee_id" IS DISTINCT FROM NEW."assignee_id"
          OR (NEW."is_cancelled" AND NOT OLD."is_cancelled"))
    EXECUTE FUNCTION "public"."fn_record_product_change"();

/**
 * Records a product's status step that no function records itself:
 *   IN_SETUP → PREPRESS        PREPRESS_READY (only ever automatic)
 *   IN_PRODUCTION → PREPRESS   RETURNED_TO_PREPRESS (only ever manual)
 *   → DONE                     MARKED_DONE
 * Into IN_PRODUCTION and into or out of AWAITING_APPROVAL are recorded by
 * the functions that make them (decision 6); the retraction PREPRESS →
 * IN_SETUP is not a transaction on the list.
 *
 * @trigger AFTER UPDATE OF status ON products (per row), when the status changes
 */
CREATE OR REPLACE FUNCTION "public"."fn_record_product_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
DECLARE
  v_event public.history_event;
BEGIN
  v_event := CASE
    WHEN OLD.status = 'IN_SETUP' AND NEW.status = 'PREPRESS' THEN 'PREPRESS_READY'
    WHEN OLD.status = 'IN_PRODUCTION' AND NEW.status = 'PREPRESS' THEN 'RETURNED_TO_PREPRESS'
    WHEN NEW.status = 'DONE' THEN 'MARKED_DONE'
  END;
  IF v_event IS NOT NULL THEN
    PERFORM public.fn_write_history(
      v_event,
      jsonb_build_object('order_id', NEW.order_id, 'product_id', NEW.id)
    );
  END IF;
  RETURN NULL;
END;
$$;

/**
 * Hands a product entering PREPRESS or IN_PRODUCTION to its department's
 * default assignee for that stage, whoever held it before; without a default
 * the assignee stays. Writes no entry: fn_record_product_change records the
 * assignee change it makes, in the same transaction as the step that caused
 * it.
 *
 * @trigger BEFORE UPDATE OF status ON products (per row), when the status changes
 */
CREATE OR REPLACE FUNCTION "public"."fn_assign_stage_default_assignee"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" = ''
    AS $$
DECLARE
  default_user uuid;
BEGIN
  IF NEW.status NOT IN ('PREPRESS', 'IN_PRODUCTION') THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO default_user
  FROM public.department_default_assignees
  WHERE department = NEW.department AND status = NEW.status;

  IF default_user IS NULL OR default_user IS NOT DISTINCT FROM OLD.assignee_id THEN
    RETURN NEW;
  END IF;

  NEW.assignee_id := default_user;
  RETURN NEW;
END;
$$;

-- ── files ────────────────────────────────────────────────────────────────────

/**
 * Records a file linked to an order: FILE_ADDED, linked to the file (and so
 * to its order), with the file's full row as created — its path included —
 * in meta.after.
 *
 * @trigger AFTER INSERT ON files (per row)
 */
CREATE OR REPLACE FUNCTION "public"."fn_record_file_added"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
BEGIN
  PERFORM public.fn_write_history(
    'FILE_ADDED',
    jsonb_build_object('order_id', NEW.order_id, 'file_id', NEW.id),
    jsonb_build_object('after', to_jsonb(NEW))
  );
  RETURN NULL;
END;
$$;

ALTER FUNCTION "public"."fn_record_file_added"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_record_file_added"() FROM PUBLIC;

CREATE TRIGGER "trg_record_file_added"
    AFTER INSERT ON "public"."files"
    FOR EACH ROW EXECUTE FUNCTION "public"."fn_record_file_added"();

/**
 * Records a file renamed (FILE_RENAMED) or its role changed
 * (FILE_ROLE_CHANGED), each with the field's previous and next value; a role
 * change names the file as well.
 *
 * @trigger AFTER UPDATE ON files (per row), when display_name or role changes
 */
CREATE OR REPLACE FUNCTION "public"."fn_record_file_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
DECLARE
  v_links jsonb := jsonb_build_object('order_id', NEW.order_id, 'file_id', NEW.id);
BEGIN
  IF NEW.display_name IS DISTINCT FROM OLD.display_name THEN
    PERFORM public.fn_write_history(
      'FILE_RENAMED',
      v_links,
      jsonb_build_object('field', 'display_name', 'previous', OLD.display_name, 'next', NEW.display_name)
    );
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    PERFORM public.fn_write_history(
      'FILE_ROLE_CHANGED',
      v_links,
      jsonb_build_object('field', 'role', 'previous', OLD.role, 'next', NEW.role, 'display_name', NEW.display_name)
    );
  END IF;

  RETURN NULL;
END;
$$;

ALTER FUNCTION "public"."fn_record_file_change"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_record_file_change"() FROM PUBLIC;

CREATE TRIGGER "trg_record_file_change"
    AFTER UPDATE ON "public"."files"
    FOR EACH ROW
    WHEN (OLD."display_name" IS DISTINCT FROM NEW."display_name"
          OR OLD."role" IS DISTINCT FROM NEW."role")
    EXECUTE FUNCTION "public"."fn_record_file_change"();

/**
 * Records a file linked to a product: FILE_ADDED linked to the product and
 * the file, with the file's name and path. fn_forget_history finds it by the
 * pair when the link is deleted.
 *
 * @trigger AFTER INSERT ON product_files (per row)
 */
CREATE OR REPLACE FUNCTION "public"."fn_record_product_file_added"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
BEGIN
  PERFORM public.fn_write_history(
    'FILE_ADDED',
    jsonb_build_object('product_id', NEW.product_id, 'file_id', NEW.file_id),
    (SELECT jsonb_build_object('display_name', f.display_name, 'path', f.path)
     FROM public.files f WHERE f.id = NEW.file_id)
  );
  RETURN NULL;
END;
$$;

ALTER FUNCTION "public"."fn_record_product_file_added"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_record_product_file_added"() FROM PUBLIC;

CREATE TRIGGER "trg_record_product_file_added"
    AFTER INSERT ON "public"."product_files"
    FOR EACH ROW EXECUTE FUNCTION "public"."fn_record_product_file_added"();

-- ── product_time_logs ────────────────────────────────────────────────────────

/**
 * Records worked time: TIME_LOGGED on the product, with the log's id (which
 * fn_forget_history finds it by), the minutes, and the user the time is
 * attributed to — by id and by name. The entry's own user is whoever wrote
 * the log, an admin logging on someone's behalf included.
 *
 * @trigger AFTER INSERT ON product_time_logs (per row)
 */
CREATE OR REPLACE FUNCTION "public"."fn_record_time_logged"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
BEGIN
  PERFORM public.fn_write_history(
    'TIME_LOGGED',
    jsonb_build_object('product_id', NEW.product_id),
    jsonb_build_object(
      'time_log_id', NEW.id,
      'minutes', NEW.minutes,
      'user_id', NEW.user_id,
      'user_name', (SELECT u.name FROM public.users u WHERE u.id = NEW.user_id)
    )
  );
  RETURN NULL;
END;
$$;

ALTER FUNCTION "public"."fn_record_time_logged"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_record_time_logged"() FROM PUBLIC;

CREATE TRIGGER "trg_record_time_logged"
    AFTER INSERT ON "public"."product_time_logs"
    FOR EACH ROW EXECUTE FUNCTION "public"."fn_record_time_logged"();

-- ── customers ────────────────────────────────────────────────────────────────
-- A customer's entries link to the customer alone: no order, so they are an
-- admin's to read (the global history page, WP8).

/**
 * Records a customer's creation: CUSTOMER_CREATED with the row as created
 * (meta.after).
 *
 * @trigger AFTER INSERT ON customers (per row)
 */
CREATE OR REPLACE FUNCTION "public"."fn_record_customer_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
BEGIN
  PERFORM public.fn_write_history(
    'CUSTOMER_CREATED',
    jsonb_build_object('customer_id', NEW.id),
    jsonb_build_object('after', to_jsonb(NEW))
  );
  RETURN NULL;
END;
$$;

ALTER FUNCTION "public"."fn_record_customer_created"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_record_customer_created"() FROM PUBLIC;

CREATE TRIGGER "trg_record_customer_created"
    AFTER INSERT ON "public"."customers"
    FOR EACH ROW EXECUTE FUNCTION "public"."fn_record_customer_created"();

/**
 * Records a change to a customer: CUSTOMER_UPDATED, one entry per changed
 * field, with its previous and next value. email_bounced_at is not the
 * customer's data but the mail provider's report about it (set by
 * email-webhook, cleared when the address changes) and writes nothing. The
 * fields are read off the row, so a column added later is recorded without
 * touching this function.
 *
 * @trigger AFTER UPDATE ON customers (per row), when the row changes
 */
CREATE OR REPLACE FUNCTION "public"."fn_record_customer_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
DECLARE
  v_old    jsonb := to_jsonb(OLD);
  v_new    jsonb := to_jsonb(NEW);
  v_field  text;
BEGIN
  FOR v_field IN
    SELECT key FROM jsonb_object_keys(v_new) AS key
    WHERE key <> 'email_bounced_at'
      AND v_new->key IS DISTINCT FROM v_old->key
    ORDER BY key
  LOOP
    PERFORM public.fn_write_history(
      'CUSTOMER_UPDATED',
      jsonb_build_object('customer_id', NEW.id),
      jsonb_build_object('field', v_field, 'previous', v_old->v_field, 'next', v_new->v_field)
    );
  END LOOP;
  RETURN NULL;
END;
$$;

ALTER FUNCTION "public"."fn_record_customer_change"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_record_customer_change"() FROM PUBLIC;

CREATE TRIGGER "trg_record_customer_change"
    AFTER UPDATE ON "public"."customers"
    FOR EACH ROW
    WHEN (OLD.* IS DISTINCT FROM NEW.*)
    EXECUTE FUNCTION "public"."fn_record_customer_change"();

-- ── cancel_order ─────────────────────────────────────────────────────────────

/**
 * Cancels an order: every product not yet cancelled is cancelled and the
 * order archived, in one transaction — both happen or neither does. Writes
 * CANCELLED with the order's full content as it stood (meta.before); the
 * triggers add a PRODUCT_CANCELLED per product and the ORDER_ARCHIVED, all
 * under the cancel's action id.
 *
 * Runs as the owner, which the guards let through, so it refuses what they
 * refuse a direct write: a billed order (its status is final and the app
 * offers no cancel), and a finished order that still has a product to cancel
 * (a closed order's products keep is_cancelled). A signed-in session is
 * required: the function is for the app, as delete_quote is.
 *
 * @raises when there is no session, the order does not exist, it is billed,
 *   or it is finished with a product not yet cancelled.
 */
CREATE OR REPLACE FUNCTION "public"."cancel_order"("p_order_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
DECLARE
  v_status public.order_status;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'cancel_order requires a signed-in user';
  END IF;

  SELECT o.status INTO v_status
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Order (%) does not exist', p_order_id;
  END IF;

  IF v_status = 'BILLED' THEN
    RAISE EXCEPTION 'Order (%) has been billed and cannot be cancelled', p_order_id;
  END IF;

  IF v_status = 'FINISHED'
     AND EXISTS (SELECT 1 FROM public.products p WHERE p.order_id = p_order_id AND NOT p.is_cancelled) THEN
    RAISE EXCEPTION
      'Order (%) is finished; its products are part of the record and cannot be cancelled',
      p_order_id;
  END IF;

  PERFORM public.fn_write_history(
    'CANCELLED',
    jsonb_build_object('order_id', p_order_id),
    jsonb_build_object('before', public.fn_order_snapshot(p_order_id))
  );

  UPDATE public.products SET is_cancelled = true
  WHERE order_id = p_order_id AND NOT is_cancelled;

  UPDATE public.orders SET is_archived = true
  WHERE id = p_order_id AND NOT is_archived;
END;
$$;

ALTER FUNCTION "public"."cancel_order"("uuid") OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."cancel_order"("uuid") FROM PUBLIC, "anon";

GRANT EXECUTE ON FUNCTION "public"."cancel_order"("uuid") TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."cancel_order"("uuid") TO "service_role";

-- ── duplicate_order ──────────────────────────────────────────────────────────
-- Its body as it stood (20260930120014_duplicate_order), less the
-- ORDER_CREATED insert at its end: the orders trigger records the copy as it
-- records any new order, under the signed-in user and the call's action id.
-- The product_files trigger records each copied file link. Each copied
-- product's PRODUCT_CREATED follows with save_product's recorder (WP4), which
-- also drops the now unused created_by_user_id parameter.

/**
 * Clone an existing order into a new quote. The whole function body runs as
 * a single transaction, so any failure rolls the entire clone back.
 *
 * Copies the source order's customer into a new order with status QUOTE, then
 * clones each selected product (status reset to IN_SETUP, unassigned, a fresh
 * product_number from the trigger), its typed child, its product_files links
 * and, for TEXTILE, the batch's garment lines and designs. Writes no entry of
 * its own: the triggers record the new order and its file links.
 * SECURITY DEFINER.
 *
 * @param source_order_id      order to clone
 * @param new_priority         priority for the new order
 * @param new_delivery         delivery type for the new order
 * @param new_deadline         deadline for the new order
 * @param selected_product_ids which of the source products to copy
 * @param created_by_user_id   unused; the entries name the signed-in user
 * @returns the new order's id
 */
CREATE OR REPLACE FUNCTION "public"."duplicate_order"("source_order_id" "uuid", "new_priority" "public"."priority_type", "new_delivery" "public"."delivery_type", "new_deadline" "date", "selected_product_ids" "uuid"[], "created_by_user_id" "uuid") RETURNS "uuid"
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
  END LOOP;

  RETURN new_order_id;
END;
$$;
