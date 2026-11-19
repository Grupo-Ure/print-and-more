-- 20261119142337_automatic_steps.sql — the automatic steps move into the database
--
-- TRANSACTION_RECORD.md, WP2 (decisions 13, 14). Setup ↔ pre-press and an
-- invoice order finishing were written by the app of whoever had the order on
-- screen (useStatusManager, useFinishOrderWhenAllProductsDone). From here on
-- triggers make them, in the transaction of the change that causes them, so
-- the entry names the user whose change it was and shares that change's
-- action id.
--
-- - fn_product_ready_for_prepress is the one condition for pre-press, the SQL
--   counterpart of the client's isReadyForPrepress.
-- - fn_apply_automatic_status moves a product between setup and pre-press
--   where the condition says so. It runs when an order's status, deadline or
--   customer changes, when a product is created or its deadline changes, when
--   a product comes back into pre-press from production or from an approval
--   round, and when a customer's name, email or phone changes.
-- - fn_finish_order_if_done finishes an invoice order whose products are all
--   done. It runs when a product becomes done, is cancelled or is deleted —
--   never as a standing watcher, so a reopened order stays open.
-- - fn_refuse_direct_release also refuses an app role's own move between
--   setup and pre-press: both directions are the database's.
-- - The status entries for these steps are written by triggers on the status
--   columns: PREPRESS_READY (setup → pre-press), RETURNED_TO_PREPRESS
--   (production → pre-press, the one manual way back) and ORDER_FINISHED (in
--   progress → finished, automatic or by the order's button). The retraction
--   pre-press → setup stays unrecorded; it is not a transaction on the list.

-- ── The condition ────────────────────────────────────────────────────────────

/**
 * Whether a product may be in pre-press: its order is past quote, its
 * effective deadline (its own, else the order's) is set, and the order's
 * customer has a name and an email or a phone. Text counts when it holds
 * something other than whitespace, as the client's trim() does. The client
 * mirrors it in isReadyForPrepress (src/lib/productShared.ts).
 *
 * Says nothing about the product's status or the order being closed; the
 * caller decides which products the condition applies to.
 */
CREATE OR REPLACE FUNCTION "public"."fn_product_ready_for_prepress"("p_product_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" = ''
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.products p
    JOIN public.orders o ON o.id = p.order_id
    JOIN public.customers c ON c.id = o.customer_id
    WHERE p.id = p_product_id
      AND o.status <> 'QUOTE'
      AND COALESCE(p.deadline, o.deadline) IS NOT NULL
      AND c.name ~ '\S'
      AND (c.email ~ '\S' OR c.phone ~ '\S')
  );
$$;

ALTER FUNCTION "public"."fn_product_ready_for_prepress"("uuid") OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_product_ready_for_prepress"("uuid") FROM PUBLIC, "anon";

GRANT EXECUTE ON FUNCTION "public"."fn_product_ready_for_prepress"("uuid") TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."fn_product_ready_for_prepress"("uuid") TO "service_role";

-- ── Setup ↔ pre-press ────────────────────────────────────────────────────────

/**
 * Moves each of the given products between setup and pre-press where the
 * condition differs from its status: promotes a ready product in setup,
 * retracts a product in pre-press that is no longer ready. Only open,
 * non-cancelled products in IN_SETUP or PREPRESS on an order that is not
 * closed are touched; every other id is skipped, so a caller may pass all
 * the products it has.
 *
 * Runs as the owner, which the status guards let through. The update it makes
 * fires the status triggers — the stage's default assignee
 * (fn_assign_stage_default_assignee) and the PREPRESS_READY entry — but not
 * the triggers that call this function again: those react to the deadline,
 * not to the status, or to a status coming from outside the setup/pre-press
 * band.
 */
CREATE OR REPLACE FUNCTION "public"."fn_apply_automatic_status"("p_product_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
DECLARE
  v_product  record;
  v_target   public.product_status;
BEGIN
  FOR v_product IN
    SELECT p.id, p.status
    FROM public.products p
    JOIN public.orders o ON o.id = p.order_id
    WHERE p.id = ANY (p_product_ids)
      AND NOT p.is_cancelled
      AND p.status IN ('IN_SETUP', 'PREPRESS')
      AND o.status NOT IN ('FINISHED', 'BILLED')
    ORDER BY p.id
    FOR UPDATE OF p
  LOOP
    v_target := CASE
      WHEN public.fn_product_ready_for_prepress(v_product.id) THEN 'PREPRESS'::public.product_status
      ELSE 'IN_SETUP'::public.product_status
    END;
    IF v_target <> v_product.status THEN
      UPDATE public.products SET status = v_target WHERE id = v_product.id;
    END IF;
  END LOOP;
END;
$$;

ALTER FUNCTION "public"."fn_apply_automatic_status"("uuid"[]) OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_apply_automatic_status"("uuid"[]) FROM PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."fn_apply_automatic_status"("uuid"[]) TO "service_role";

/**
 * An order's status, deadline or customer changed: re-check every product of
 * the order.
 *
 * @trigger AFTER UPDATE OF status, deadline, customer_id ON orders (per row)
 */
CREATE OR REPLACE FUNCTION "public"."fn_order_apply_automatic_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
BEGIN
  PERFORM public.fn_apply_automatic_status(
    ARRAY(SELECT p.id FROM public.products p WHERE p.order_id = NEW.id)
  );
  RETURN NULL;
END;
$$;

ALTER FUNCTION "public"."fn_order_apply_automatic_status"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_order_apply_automatic_status"() FROM PUBLIC;

CREATE TRIGGER "trg_order_apply_automatic_status"
    AFTER UPDATE OF "status", "deadline", "customer_id" ON "public"."orders"
    FOR EACH ROW
    WHEN (OLD."status" IS DISTINCT FROM NEW."status"
          OR OLD."deadline" IS DISTINCT FROM NEW."deadline"
          OR OLD."customer_id" IS DISTINCT FROM NEW."customer_id")
    EXECUTE FUNCTION "public"."fn_order_apply_automatic_status"();

/**
 * A product was created, its own deadline changed, or it came back into
 * pre-press from production or from an approval round: re-check it. The
 * return can land a product in pre-press that is not ready (one force
 * released without a deadline, say); it is retracted to setup as any other.
 *
 * @trigger AFTER INSERT ON products (per row);
 *          AFTER UPDATE OF deadline, status ON products (per row), when the
 *          deadline changes or the status enters PREPRESS from IN_PRODUCTION
 *          or AWAITING_APPROVAL
 */
CREATE OR REPLACE FUNCTION "public"."fn_product_apply_automatic_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
BEGIN
  PERFORM public.fn_apply_automatic_status(ARRAY[NEW.id]);
  RETURN NULL;
END;
$$;

ALTER FUNCTION "public"."fn_product_apply_automatic_status"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_product_apply_automatic_status"() FROM PUBLIC;

CREATE TRIGGER "trg_product_apply_automatic_status_on_insert"
    AFTER INSERT ON "public"."products"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."fn_product_apply_automatic_status"();

CREATE TRIGGER "trg_product_apply_automatic_status"
    AFTER UPDATE OF "deadline", "status" ON "public"."products"
    FOR EACH ROW
    WHEN (OLD."deadline" IS DISTINCT FROM NEW."deadline"
          OR (NEW."status" = 'PREPRESS' AND OLD."status" IN ('IN_PRODUCTION', 'AWAITING_APPROVAL')))
    EXECUTE FUNCTION "public"."fn_product_apply_automatic_status"();

/**
 * A customer's name, email or phone changed: re-check the products of every
 * open order of that customer.
 *
 * @trigger AFTER UPDATE OF name, email, phone ON customers (per row)
 */
CREATE OR REPLACE FUNCTION "public"."fn_customer_apply_automatic_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
BEGIN
  PERFORM public.fn_apply_automatic_status(
    ARRAY(
      SELECT p.id
      FROM public.products p
      JOIN public.orders o ON o.id = p.order_id
      WHERE o.customer_id = NEW.id
        AND o.status NOT IN ('FINISHED', 'BILLED')
    )
  );
  RETURN NULL;
END;
$$;

ALTER FUNCTION "public"."fn_customer_apply_automatic_status"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_customer_apply_automatic_status"() FROM PUBLIC;

CREATE TRIGGER "trg_customer_apply_automatic_status"
    AFTER UPDATE OF "name", "email", "phone" ON "public"."customers"
    FOR EACH ROW
    WHEN (OLD."name" IS DISTINCT FROM NEW."name"
          OR OLD."email" IS DISTINCT FROM NEW."email"
          OR OLD."phone" IS DISTINCT FROM NEW."phone")
    EXECUTE FUNCTION "public"."fn_customer_apply_automatic_status"();

-- ── The automatic finish ─────────────────────────────────────────────────────

/**
 * Finishes an in-progress invoice order whose non-cancelled products are all
 * done (at least one). A cash order never finishes by itself: its close
 * records the payment at the counter, which the last product being done says
 * nothing about.
 *
 * The order row is locked first, so two products of one order marked done at
 * the same moment cannot each see the other still open: the second waits for
 * the first to commit and then counts both.
 */
CREATE OR REPLACE FUNCTION "public"."fn_finish_order_if_done"("p_order_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
DECLARE
  v_order record;
BEGIN
  SELECT o.id, o.status, o.payment_method INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND OR v_order.status <> 'IN_PROGRESS' OR v_order.payment_method <> 'INVOICE' THEN
    RETURN;
  END IF;

  IF EXISTS (
       SELECT 1 FROM public.products p
       WHERE p.order_id = p_order_id AND NOT p.is_cancelled
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.products p
       WHERE p.order_id = p_order_id AND NOT p.is_cancelled AND p.status <> 'DONE'
     ) THEN
    UPDATE public.orders SET status = 'FINISHED' WHERE id = p_order_id;
  END IF;
END;
$$;

ALTER FUNCTION "public"."fn_finish_order_if_done"("uuid") OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_finish_order_if_done"("uuid") FROM PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."fn_finish_order_if_done"("uuid") TO "service_role";

/**
 * A product became done, was cancelled or was deleted: its order may be
 * finished now. A product deleted with its order (a quote's deletion) finds
 * the order gone or a quote, and nothing happens.
 *
 * @trigger AFTER UPDATE OF status, is_cancelled ON products (per row), when
 *          the status becomes DONE or the product is cancelled;
 *          AFTER DELETE ON products (per row)
 */
CREATE OR REPLACE FUNCTION "public"."fn_product_finish_order"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.fn_finish_order_if_done(OLD.order_id);
  ELSE
    PERFORM public.fn_finish_order_if_done(NEW.order_id);
  END IF;
  RETURN NULL;
END;
$$;

ALTER FUNCTION "public"."fn_product_finish_order"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_product_finish_order"() FROM PUBLIC;

CREATE TRIGGER "trg_product_finish_order"
    AFTER UPDATE OF "status", "is_cancelled" ON "public"."products"
    FOR EACH ROW
    WHEN ((NEW."status" = 'DONE' AND OLD."status" <> 'DONE')
          OR (NEW."is_cancelled" AND NOT OLD."is_cancelled"))
    EXECUTE FUNCTION "public"."fn_product_finish_order"();

CREATE TRIGGER "trg_product_finish_order_on_delete"
    AFTER DELETE ON "public"."products"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."fn_product_finish_order"();

-- ── The guard ────────────────────────────────────────────────────────────────

/**
 * Trigger guard: the statuses only a database function may write.
 * IN_PRODUCTION is reached through release_to_production or
 * force_release_to_production, AWAITING_APPROVAL through
 * create_approval_request, and the move between IN_SETUP and PREPRESS — in
 * either direction — through fn_apply_automatic_status alone; a product is
 * not created in pre-press either. PREPRESS stays writable from
 * IN_PRODUCTION: going back to pre-press is the one manual step.
 *
 * Privileged roles are exempt as in the lock guards: postgres / supabase_admin
 * run the seed and the functions above, service_role is the e2e runner.
 *
 * @trigger BEFORE INSERT OR UPDATE OF status ON products (per row)
 * @raises when `authenticated` writes IN_PRODUCTION or AWAITING_APPROVAL
 *   itself, moves a product between IN_SETUP and PREPRESS, or creates one in
 *   PREPRESS.
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

  IF TG_OP = 'INSERT' AND NEW.status = 'PREPRESS' THEN
    RAISE EXCEPTION
      'Product (%) cannot be created in pre-press; it enters pre-press on its own once it is ready',
      NEW.id;
  END IF;

  IF TG_OP = 'UPDATE'
     AND ((OLD.status = 'IN_SETUP' AND NEW.status = 'PREPRESS')
          OR (OLD.status = 'PREPRESS' AND NEW.status = 'IN_SETUP')) THEN
    RAISE EXCEPTION
      'Product (%) moves between setup and pre-press only on its own, by whether it is ready',
      NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- ── The status entries ───────────────────────────────────────────────────────
-- Only the steps this package moves into the database, and the manual return
-- whose event replaces PREPRESS_READY_MANUAL. The other status entries
-- (MARKED_DONE, PROCESSING_STARTED, ORDER_BILLED, …) follow in WP3; the
-- release to production and the approval steps are recorded by their own
-- functions (decision 6).

/**
 * Records a product's move into pre-press: PREPRESS_READY from setup (only
 * ever automatic), RETURNED_TO_PREPRESS from production (only ever manual).
 * A return from an approval round is recorded by fn_approval_request_closed.
 *
 * @trigger AFTER UPDATE OF status ON products (per row), when the status changes
 */
CREATE OR REPLACE FUNCTION "public"."fn_record_product_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
BEGIN
  IF OLD.status = 'IN_SETUP' AND NEW.status = 'PREPRESS' THEN
    PERFORM public.fn_write_history(
      'PREPRESS_READY',
      jsonb_build_object('order_id', NEW.order_id, 'product_id', NEW.id)
    );
  ELSIF OLD.status = 'IN_PRODUCTION' AND NEW.status = 'PREPRESS' THEN
    PERFORM public.fn_write_history(
      'RETURNED_TO_PREPRESS',
      jsonb_build_object('order_id', NEW.order_id, 'product_id', NEW.id)
    );
  END IF;
  RETURN NULL;
END;
$$;

ALTER FUNCTION "public"."fn_record_product_status_change"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_record_product_status_change"() FROM PUBLIC;

CREATE TRIGGER "trg_record_product_status_change"
    AFTER UPDATE OF "status" ON "public"."products"
    FOR EACH ROW
    WHEN (OLD."status" IS DISTINCT FROM NEW."status")
    EXECUTE FUNCTION "public"."fn_record_product_status_change"();

/**
 * Records an order finishing: ORDER_FINISHED on IN_PROGRESS → FINISHED,
 * whether fn_finish_order_if_done made it or the order's *Mark finished*
 * button did.
 *
 * @trigger AFTER UPDATE OF status ON orders (per row), when the status changes
 */
CREATE OR REPLACE FUNCTION "public"."fn_record_order_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
BEGIN
  IF OLD.status = 'IN_PROGRESS' AND NEW.status = 'FINISHED' THEN
    PERFORM public.fn_write_history('ORDER_FINISHED', jsonb_build_object('order_id', NEW.id));
  END IF;
  RETURN NULL;
END;
$$;

ALTER FUNCTION "public"."fn_record_order_status_change"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_record_order_status_change"() FROM PUBLIC;

CREATE TRIGGER "trg_record_order_status_change"
    AFTER UPDATE OF "status" ON "public"."orders"
    FOR EACH ROW
    WHEN (OLD."status" IS DISTINCT FROM NEW."status")
    EXECUTE FUNCTION "public"."fn_record_order_status_change"();

-- ── Bring the rows in line ───────────────────────────────────────────────────
-- Until now a product moved only when an app displayed its order, and a
-- manual release could put one in pre-press that the condition rejects. Apply
-- the condition once to every product, so every row holds what the guard and
-- the triggers keep from here on. An entry it writes names no user: the
-- migration has no session.

SELECT "public"."fn_apply_automatic_status"(ARRAY(SELECT "id" FROM "public"."products"));
