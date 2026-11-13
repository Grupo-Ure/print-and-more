-- 20261103115958_gobd_record_protection.sql — MKS-2, MKS-5
--
-- GoBD (margin no. 107 ff.) asks that a record once entered into processing
-- can neither be deleted nor altered without a trace. Until now that rule
-- lived in the client only: the sidebar deletes quotes alone, a product is
-- deleted only in setup and cancelled past it, a finished or billed order is
-- read-only on screen. Every one of those tables carried an
-- "Employees: full access" policy with USING (true), so a signed-in user who
-- talked to Supabase directly could delete or rewrite anything — admins and
-- employees alike. Only `history` was already limited to SELECT and INSERT.
--
-- From here the database refuses it. One guard per table, each a BEFORE
-- trigger with INVOKER rights, each handling the delete and the update of
-- the billing-relevant columns of that table:
--   * `orders`: no delete from the app at all — a quote goes through
--     delete_quote below, the only sanctioned path, as release_to_production
--     is the only path into production. Once FINISHED or BILLED, the
--     columns an invoice rests on are locked (order_number, customer_id,
--     created_at, created_by, payment_method, delivery, deadline, priority);
--     BILLED is terminal, so its status is locked too. The lifecycle moves
--     out of FINISHED (reopen, invoice), archiving and the billing note stay
--     free; billed_at is kept by trg_order_billed_at and written by nobody.
--   * `products`: deleted only in IN_SETUP on an order that is not closed;
--     past that the removal rule cancels, which is an update the trigger
--     allows. A product of a closed order keeps its product_number,
--     order_id, created_at, status, is_cancelled, deadline, delivery and
--     priority. Until then nothing is billed: a done product on an order
--     in progress may still be cancelled with its order, and history
--     records it. assignee_id and sort_order are not billing;
--     the spec columns and the typed child rows are locked from
--     AWAITING_APPROVAL on by the guards of 20261008175931 already.
--   * `files`: the rows of a closed order can neither go nor change, and a
--     file that a released product links is not deleted either — its
--     delete would cascade into product_files as the owner, past that
--     guard. A file on an order in progress that only setup or pre-press
--     products link is still a working link the shop may correct; a file
--     a customer approved over is already held by the round's FK.
--   * `product_files`: a link of a product that is awaiting approval, in
--     production or done, or of any product on a closed order, stays — the
--     same threshold as the spec lock, since the files are part of what was
--     produced.
--   * `product_time_logs`: deleted only while the product is open and its
--     order not closed. Rows had no UPDATE policy already.
--   * `history`: never deleted, never updated — belt and braces over the
--     grants it already lacks, so the rule holds should a grant ever widen.
--   * `customers`: a customer with an order cannot be deleted already —
--     orders.customer_id has no cascade. Nothing to add.
--
-- Privileged roles are exempt, as in every guard before this one: postgres /
-- supabase_admin run the seed and the security-definer functions,
-- service_role is the e2e runner and the edge functions' key, and none of
-- the three reaches the browser. A superuser can disable a trigger anyway,
-- so exempting it costs no guarantee; the guarantee is for every app role.
-- Must run with INVOKER rights for current_user to be the caller.
--
-- Cascades: a referential action runs as the owner of the referencing table,
-- which is postgres, so a child guard sees the exemption while an order
-- cascades into its products, files and time logs. That is intended — the
-- order guard is the gate; the child guards are for direct writes.
--
-- History's FK onto orders loses its cascade (ON DELETE RESTRICT): a quote
-- deleted through the app took its history with it silently. delete_quote
-- removes the history rows itself, in the open, before the order.

-- ── orders ───────────────────────────────────────────────────────────────────

/**
 * Trigger guard: an order is deleted only through delete_quote, and the
 * billing-relevant columns of a finished or billed order cannot change.
 *
 * @trigger BEFORE UPDATE OR DELETE ON orders (per row)
 * @raises on any delete by an app role; when the order is FINISHED or BILLED
 *   and a locked column changes; when a BILLED order's status changes.
 */
CREATE OR REPLACE FUNCTION "public"."fn_refuse_order_record_change"() RETURNS "trigger"
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

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'Order (%) can only be deleted through delete_quote, and only while it is a quote',
      OLD.id;
  END IF;

  IF OLD.status = 'BILLED' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION
      'Order (%) has been billed; its status is final',
      OLD.id;
  END IF;

  IF OLD.status IN ('FINISHED', 'BILLED')
     AND (NEW.order_number, NEW.customer_id, NEW.created_at, NEW.created_by,
          NEW.payment_method, NEW.delivery, NEW.deadline, NEW.priority)
         IS DISTINCT FROM
         (OLD.order_number, OLD.customer_id, OLD.created_at, OLD.created_by,
          OLD.payment_method, OLD.delivery, OLD.deadline, OLD.priority) THEN
    RAISE EXCEPTION
      'Order (%) is closed (%); its billing-relevant columns are locked',
      OLD.id, OLD.status;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."fn_refuse_order_record_change"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_refuse_order_record_change"() FROM PUBLIC;

CREATE TRIGGER "trg_refuse_order_record_change"
    BEFORE UPDATE OR DELETE ON "public"."orders"
    FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_order_record_change"();

-- ── products ─────────────────────────────────────────────────────────────────

/**
 * Whether the order is FINISHED or BILLED — the state in which everything
 * under it becomes the record. Shared by the guards on the order's children.
 */
CREATE OR REPLACE FUNCTION "public"."fn_order_is_closed"("p_order_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" = ''
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders
    WHERE id = p_order_id AND status IN ('FINISHED', 'BILLED')
  );
$$;

ALTER FUNCTION "public"."fn_order_is_closed"("uuid") OWNER TO "postgres";

-- Called from the guards below, which run as the caller: `authenticated`
-- must be able to execute it (a trigger function itself needs no grant).
REVOKE ALL ON FUNCTION "public"."fn_order_is_closed"("uuid") FROM PUBLIC, "anon";

GRANT EXECUTE ON FUNCTION "public"."fn_order_is_closed"("uuid") TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."fn_order_is_closed"("uuid") TO "service_role";

/**
 * Trigger guard: a product is deleted only while in setup on an open order;
 * a product of a closed order keeps its workflow columns.
 *
 * @trigger BEFORE UPDATE OR DELETE ON products (per row)
 * @raises on a delete past IN_SETUP or on a closed order; when the order is
 *   closed and a locked column changes.
 */
CREATE OR REPLACE FUNCTION "public"."fn_refuse_product_record_change"() RETURNS "trigger"
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

  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'IN_SETUP' THEN
      RAISE EXCEPTION
        'Product (%) has left setup (%); it can be cancelled but not deleted',
        OLD.id, OLD.status;
    END IF;
    IF public.fn_order_is_closed(OLD.order_id) THEN
      RAISE EXCEPTION
        'Product (%) belongs to a closed order; it cannot be deleted',
        OLD.id;
    END IF;
    RETURN OLD;
  END IF;

  IF public.fn_order_is_closed(OLD.order_id)
     AND (NEW.product_number, NEW.order_id, NEW.created_at, NEW.status,
          NEW.is_cancelled, NEW.deadline, NEW.delivery, NEW.priority)
         IS DISTINCT FROM
         (OLD.product_number, OLD.order_id, OLD.created_at, OLD.status,
          OLD.is_cancelled, OLD.deadline, OLD.delivery, OLD.priority) THEN
    RAISE EXCEPTION
      'Product (%) is part of the record (%); its workflow columns are locked',
      OLD.id, OLD.status;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."fn_refuse_product_record_change"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_refuse_product_record_change"() FROM PUBLIC;

CREATE TRIGGER "trg_refuse_product_record_change"
    BEFORE UPDATE OR DELETE ON "public"."products"
    FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_product_record_change"();

-- ── files ────────────────────────────────────────────────────────────────────

/**
 * Trigger guard: the file rows of a closed order can neither be deleted nor
 * changed, and a file linked to a released product is not deleted.
 *
 * @trigger BEFORE UPDATE OR DELETE ON files (per row)
 * @raises when the order is FINISHED or BILLED; on a delete, when a product
 *   that is AWAITING_APPROVAL, IN_PRODUCTION or DONE links the file.
 */
CREATE OR REPLACE FUNCTION "public"."fn_refuse_file_record_change"() RETURNS "trigger"
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

  IF public.fn_order_is_closed(OLD.order_id) THEN
    RAISE EXCEPTION
      'File (%) belongs to a closed order; it is part of the record',
      OLD.id;
  END IF;

  -- Deleting the file row would cascade into product_files as the owner,
  -- past the guard on that table — so the released links are checked here.
  IF TG_OP = 'DELETE' AND EXISTS (
    SELECT 1
    FROM public.product_files pf
    JOIN public.products p ON p.id = pf.product_id
    WHERE pf.file_id = OLD.id
      AND p.status IN ('AWAITING_APPROVAL', 'IN_PRODUCTION', 'DONE')
  ) THEN
    RAISE EXCEPTION
      'File (%) is linked to a released product; it is part of the record',
      OLD.id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."fn_refuse_file_record_change"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_refuse_file_record_change"() FROM PUBLIC;

CREATE TRIGGER "trg_refuse_file_record_change"
    BEFORE UPDATE OR DELETE ON "public"."files"
    FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_file_record_change"();

-- ── product_files ────────────────────────────────────────────────────────────

/**
 * Trigger guard: the file links of a product that has left pre-press, or of
 * any product on a closed order, can neither be removed nor changed.
 *
 * @trigger BEFORE UPDATE OR DELETE ON product_files (per row)
 * @raises when the product is AWAITING_APPROVAL, IN_PRODUCTION or DONE, or
 *   its order FINISHED or BILLED.
 */
CREATE OR REPLACE FUNCTION "public"."fn_refuse_product_file_record_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" = ''
    AS $$
DECLARE
  parent_status public.product_status;
  parent_order_id uuid;
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  SELECT status, order_id INTO parent_status, parent_order_id
  FROM public.products WHERE id = OLD.product_id;

  IF parent_status IN ('AWAITING_APPROVAL', 'IN_PRODUCTION', 'DONE')
     OR public.fn_order_is_closed(parent_order_id) THEN
    RAISE EXCEPTION
      'Product (%) has been released (%); its file links are part of the record',
      OLD.product_id, parent_status;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."fn_refuse_product_file_record_change"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_refuse_product_file_record_change"() FROM PUBLIC;

CREATE TRIGGER "trg_refuse_product_file_record_change"
    BEFORE UPDATE OR DELETE ON "public"."product_files"
    FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_product_file_record_change"();

-- ── product_time_logs ────────────────────────────────────────────────────────

/**
 * Trigger guard: a time log of a done product, or of any product on a closed
 * order, cannot be deleted. Corrections stay possible while the work is open.
 *
 * @trigger BEFORE DELETE ON product_time_logs (per row)
 * @raises when the product is DONE or its order FINISHED or BILLED.
 */
CREATE OR REPLACE FUNCTION "public"."fn_refuse_time_log_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" = ''
    AS $$
DECLARE
  parent_status public.product_status;
  parent_order_id uuid;
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN OLD;
  END IF;

  SELECT status, order_id INTO parent_status, parent_order_id
  FROM public.products WHERE id = OLD.product_id;

  IF parent_status = 'DONE' OR public.fn_order_is_closed(parent_order_id) THEN
    RAISE EXCEPTION
      'Time log (%) belongs to finished work; it is part of the record',
      OLD.id;
  END IF;

  RETURN OLD;
END;
$$;

ALTER FUNCTION "public"."fn_refuse_time_log_delete"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_refuse_time_log_delete"() FROM PUBLIC;

CREATE TRIGGER "trg_refuse_time_log_delete"
    BEFORE DELETE ON "public"."product_time_logs"
    FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_time_log_delete"();

-- ── history ──────────────────────────────────────────────────────────────────

/**
 * Trigger guard: history is append-only for every app role.
 *
 * @trigger BEFORE UPDATE OR DELETE ON history (per row)
 * @raises on any update or delete by an app role.
 */
CREATE OR REPLACE FUNCTION "public"."fn_refuse_history_change"() RETURNS "trigger"
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
    'History entry (%) is a record; it can neither be changed nor deleted',
    OLD.id;
END;
$$;

ALTER FUNCTION "public"."fn_refuse_history_change"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_refuse_history_change"() FROM PUBLIC;

CREATE TRIGGER "trg_refuse_history_change"
    BEFORE UPDATE OR DELETE ON "public"."history"
    FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_history_change"();

-- The order's history no longer disappears with the order. A quote's rows
-- are removed by delete_quote in the open; nothing else deletes an order.
ALTER TABLE "public"."history"
    DROP CONSTRAINT "history_order_id_fkey",
    ADD CONSTRAINT "history_order_id_fkey"
        FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE RESTRICT;

-- ── delete_quote ─────────────────────────────────────────────────────────────

/**
 * Deletes a quote with everything under it — the one order deletion the app
 * offers (the sidebar's row menu). Refuses any other status. Runs as the
 * owner, so it passes fn_refuse_order_record_change and may delete the
 * order's history, which `authenticated` cannot; the products, files,
 * counters and sent mails follow by cascade as before. A signed-in session
 * is required: the function is for the app, not for a key.
 *
 * @raises when there is no session, the order does not exist, or it is not a quote.
 */
CREATE OR REPLACE FUNCTION "public"."delete_quote"("p_order_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
DECLARE
  current_status public.order_status;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'delete_quote requires a signed-in user';
  END IF;

  SELECT status INTO current_status
  FROM public.orders WHERE id = p_order_id
  FOR UPDATE;

  IF current_status IS NULL THEN
    RAISE EXCEPTION 'Order (%) does not exist', p_order_id;
  END IF;

  IF current_status <> 'QUOTE' THEN
    RAISE EXCEPTION
      'Order (%) is % and cannot be deleted; only a quote can',
      p_order_id, current_status;
  END IF;

  -- The rounds' file links have no cascade from files, and Postgres checks
  -- that FK as soon as the files cascade runs; a quote has no rounds (a
  -- product leaves setup only past QUOTE), so nothing to clear here.
  DELETE FROM public.history WHERE order_id = p_order_id;
  DELETE FROM public.orders WHERE id = p_order_id;
END;
$$;

ALTER FUNCTION "public"."delete_quote"("uuid") OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."delete_quote"("uuid") FROM PUBLIC, "anon";

GRANT EXECUTE ON FUNCTION "public"."delete_quote"("uuid") TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."delete_quote"("uuid") TO "service_role";
