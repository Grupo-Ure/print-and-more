-- 20261127123947_time_logs_from_prepress.sql — time is logged on a product
-- from pre-press on, not in setup (MKS-137)
--
-- A product in setup can be deleted, and the delete takes its time logs and
-- their history entries along (fn_forget_history). Work on a product starts
-- in pre-press, and a product that has left setup never returns to it
-- (20261126163456), so with logging held to pre-press on, a product that can
-- still be deleted carries no logged time.
--
-- The guard refuses the insert for every app role, admins logging on someone's
-- behalf included. The owner and service_role are exempt, as in every guard:
-- they run the seed, the security-definer functions and the e2e runner. The
-- logs already stored are left as they are; the rule is about what is
-- written from here.

-- ── product_time_logs ────────────────────────────────────────────────────────

/**
 * Trigger guard: no time is logged on a product that is still in setup.
 *
 * @trigger BEFORE INSERT ON product_time_logs (per row)
 * @raises when the product's status is IN_SETUP.
 */
CREATE OR REPLACE FUNCTION "public"."fn_refuse_time_log_in_setup"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" = ''
    AS $$
DECLARE
  parent_status public.product_status;
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  SELECT status INTO parent_status
  FROM public.products WHERE id = NEW.product_id;

  IF parent_status = 'IN_SETUP' THEN
    RAISE EXCEPTION
      'Product (%) is still in setup; time is logged from pre-press on',
      NEW.product_id;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."fn_refuse_time_log_in_setup"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."fn_refuse_time_log_in_setup"() FROM PUBLIC;

CREATE TRIGGER "trg_refuse_time_log_in_setup"
    BEFORE INSERT ON "public"."product_time_logs"
    FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_time_log_in_setup"();
