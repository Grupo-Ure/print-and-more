-- 20261127123947_time_logs_from_prepress.sql — time is logged on a product
-- from pre-press on, and not once its work is finished (MKS-137)
--
-- A product in setup can be deleted, and the delete takes its time logs and
-- their history entries along (fn_forget_history). Work on a product starts
-- in pre-press, and a product that has left setup never returns to it
-- (20261126163456), so with logging held to pre-press on, a product that can
-- still be deleted carries no logged time.
--
-- At the other end, a done product, or any product on a finished or billed
-- order, is finished work: its time logs are part of the record and cannot be
-- deleted (fn_refuse_time_log_delete, 20261103115958). The same threshold
-- holds for adding one, so the record of finished work is not extended
-- either.
--
-- The guard refuses the insert for every app role, admins logging on someone's
-- behalf included. The owner and service_role are exempt, as in every guard:
-- they run the seed, the security-definer functions and the e2e runner. The
-- logs already stored are left as they are; the rule is about what is
-- written from here.

-- ── product_time_logs ────────────────────────────────────────────────────────

/**
 * Trigger guard: time is logged only while a product is worked on — not while
 * it is still in setup, and not once its work is finished.
 *
 * @trigger BEFORE INSERT ON product_time_logs (per row)
 * @raises when the product is IN_SETUP; when it is DONE or its order
 *   FINISHED or BILLED.
 */
CREATE OR REPLACE FUNCTION "public"."fn_refuse_time_log_outside_work"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" = ''
    AS $$
DECLARE
  parent_status public.product_status;
  parent_order_id uuid;
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  SELECT status, order_id INTO parent_status, parent_order_id
  FROM public.products WHERE id = NEW.product_id;

  IF parent_status = 'IN_SETUP' THEN
    RAISE EXCEPTION
      'Product (%) is still in setup; time is logged from pre-press on',
      NEW.product_id;
  END IF;

  IF parent_status = 'DONE' OR public.fn_order_is_closed(parent_order_id) THEN
    RAISE EXCEPTION
      'Product (%) is finished work; no time is logged on it any more',
      NEW.product_id;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."fn_refuse_time_log_outside_work"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_refuse_time_log_outside_work"() FROM PUBLIC;

CREATE TRIGGER "trg_refuse_time_log_outside_work"
    BEFORE INSERT ON "public"."product_time_logs"
    FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_time_log_outside_work"();
