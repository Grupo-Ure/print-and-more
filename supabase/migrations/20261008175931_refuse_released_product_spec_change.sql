-- 20261008175931_refuse_released_product_spec_change.sql — MKS-88
--
-- A product that has been released to production (IN_PRODUCTION) or finished
-- (DONE) has its specification locked. Until now that rule lived in the client
-- only: the Basic info form hides Edit once the product is released, and a
-- save that landed anyway bounced the product back to IN_SETUP with a
-- ROLLED_BACK history entry. Both read the client's cached status, which goes
-- stale the moment a colleague releases the product from another window, and
-- nothing on the server refused the write.
--
-- From here the database refuses it. The client-side bounce-back goes with
-- this migration; ROLLED_BACK stays in history_event for the rows already
-- written. The UI keeps hiding what the database would reject — the same
-- arrangement as the role rules (see enforce_user_role_rules). A realtime
-- subscription on the orders view, so the client's lock stops going stale in
-- the first place, is its own stream; this is the backstop under it.
--
-- Two guards, both BEFORE triggers with INVOKER rights:
--   * on `products`: a change to the parent's spec columns (department, type,
--     quantity, notes) while the row is released is refused. sort_order is
--     ordering, not spec, and stays free. The client writes parent then
--     child, so refusing the parent first leaves nothing half-written.
--   * on every typed child table — the 30 single-child tables plus
--     textile_garments and textile_designs — any insert, update or delete of
--     a row whose parent is released is refused. A textile batch is rewritten
--     wholesale (delete all, insert all), so the delete is what stops it.
--
-- Privileged roles are exempt: postgres / supabase_admin run the seed and
-- service_role is the e2e runner, and both insert released products together
-- with their spec. Neither key reaches the browser; the app writes as
-- `authenticated`, which is who the rule is for. Must run with INVOKER rights
-- for current_user to be the caller, as enforce_user_role_rules notes.
--
-- While a product delete cascades into its children the parent row is already
-- gone, so the lookup finds no status and the cascade passes — whether a
-- released product may be deleted is the removal rule's business, not this
-- one's.

/**
 * Trigger guard: the spec columns of a released product cannot change.
 *
 * @trigger BEFORE UPDATE OF department, type, quantity, notes ON products (per row)
 * @raises when the product is IN_PRODUCTION or DONE and one of those columns changes.
 */
CREATE OR REPLACE FUNCTION "public"."fn_refuse_released_product_spec_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" = ''
    AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF OLD.status IN ('IN_PRODUCTION', 'DONE')
     AND (NEW.department, NEW.type, NEW.quantity, NEW.notes)
         IS DISTINCT FROM (OLD.department, OLD.type, OLD.quantity, OLD.notes) THEN
    RAISE EXCEPTION
      'Product (%) has been released (%); its specification is locked',
      OLD.id, OLD.status;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."fn_refuse_released_product_spec_change"() OWNER TO "postgres";

CREATE TRIGGER "trg_refuse_released_product_spec_change"
  BEFORE UPDATE OF department, type, quantity, notes ON "public"."products"
  FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_released_product_spec_change"();

/**
 * Trigger guard: the typed child rows of a released product cannot be
 * inserted, changed or deleted. Shared by every child table; the parent is
 * found through the row's `product_id` (OLD's on a delete, NEW's otherwise).
 *
 * @trigger BEFORE INSERT OR UPDATE OR DELETE ON each typed child table (per row)
 * @raises when the parent product is IN_PRODUCTION or DONE.
 */
CREATE OR REPLACE FUNCTION "public"."fn_refuse_released_product_child_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" = ''
    AS $$
DECLARE
  parent_id uuid;
  parent_status public.product_status;
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    parent_id := OLD.product_id;
  ELSE
    parent_id := NEW.product_id;
  END IF;

  SELECT status INTO parent_status
  FROM public.products WHERE id = parent_id;

  IF parent_status IN ('IN_PRODUCTION', 'DONE') THEN
    RAISE EXCEPTION
      'Product (%) has been released (%); its specification is locked',
      parent_id, parent_status;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."fn_refuse_released_product_child_change"() OWNER TO "postgres";

-- CopyShop
CREATE TRIGGER "trg_refuse_released_product_child_change"
  BEFORE INSERT OR UPDATE OR DELETE ON "public"."poster_products"
  FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_released_product_child_change"();
CREATE TRIGGER "trg_refuse_released_product_child_change"
  BEFORE INSERT OR UPDATE OR DELETE ON "public"."card_flyer_products"
  FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_released_product_child_change"();
CREATE TRIGGER "trg_refuse_released_product_child_change"
  BEFORE INSERT OR UPDATE OR DELETE ON "public"."folded_flyer_products"
  FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_released_product_child_change"();
CREATE TRIGGER "trg_refuse_released_product_child_change"
  BEFORE INSERT OR UPDATE OR DELETE ON "public"."brochure_products"
  FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_released_product_child_change"();
CREATE TRIGGER "trg_refuse_released_product_child_change"
  BEFORE INSERT OR UPDATE OR DELETE ON "public"."business_card_products"
  FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_released_product_child_change"();
CREATE TRIGGER "trg_refuse_released_product_child_change"
  BEFORE INSERT OR UPDATE OR DELETE ON "public"."binding_products"
  FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_released_product_child_change"();
CREATE TRIGGER "trg_refuse_released_product_child_change"
  BEFORE INSERT OR UPDATE OR DELETE ON "public"."printout_products"
  FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_released_product_child_change"();

-- Stamp
CREATE TRIGGER "trg_refuse_released_product_child_change"
  BEFORE INSERT OR UPDATE OR DELETE ON "public"."trodat_printy_products"
  FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_released_product_child_change"();
CREATE TRIGGER "trg_refuse_released_product_child_change"
  BEFORE INSERT OR UPDATE OR DELETE ON "public"."wooden_stamp_products"
  FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_released_product_child_change"();
CREATE TRIGGER "trg_refuse_released_product_child_change"
  BEFORE INSERT OR UPDATE OR DELETE ON "public"."stand_stamp_products"
  FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_released_product_child_change"();
CREATE TRIGGER "trg_refuse_released_product_child_change"
  BEFORE INSERT OR UPDATE OR DELETE ON "public"."date_stamp_products"
  FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_released_product_child_change"();
CREATE TRIGGER "trg_refuse_released_product_child_change"
  BEFORE INSERT OR UPDATE OR DELETE ON "public"."other_stamp_products"
  FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_released_product_child_change"();
CREATE TRIGGER "trg_refuse_released_product_child_change"
  BEFORE INSERT OR UPDATE OR DELETE ON "public"."stamp_plate_products"
  FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_released_product_child_change"();
CREATE TRIGGER "trg_refuse_released_product_child_change"
  BEFORE INSERT OR UPDATE OR DELETE ON "public"."refill_ink_products"
  FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_released_product_child_change"();
CREATE TRIGGER "trg_refuse_released_product_child_change"
  BEFORE INSERT OR UPDATE OR DELETE ON "public"."ink_pad_products"
  FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_released_product_child_change"();
CREATE TRIGGER "trg_refuse_released_product_child_change"
  BEFORE INSERT OR UPDATE OR DELETE ON "public"."trodat_pad_products"
  FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_released_product_child_change"();

-- LFP
CREATE TRIGGER "trg_refuse_released_product_child_change"
  BEFORE INSERT OR UPDATE OR DELETE ON "public"."sticker_products"
  FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_released_product_child_change"();
CREATE TRIGGER "trg_refuse_released_product_child_change"
  BEFORE INSERT OR UPDATE OR DELETE ON "public"."sign_uv_products"
  FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_released_product_child_change"();
CREATE TRIGGER "trg_refuse_released_product_child_change"
  BEFORE INSERT OR UPDATE OR DELETE ON "public"."sign_foil_products"
  FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_released_product_child_change"();
CREATE TRIGGER "trg_refuse_released_product_child_change"
  BEFORE INSERT OR UPDATE OR DELETE ON "public"."foil_plotter_products"
  FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_released_product_child_change"();
CREATE TRIGGER "trg_refuse_released_product_child_change"
  BEFORE INSERT OR UPDATE OR DELETE ON "public"."banner_products"
  FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_released_product_child_change"();
CREATE TRIGGER "trg_refuse_released_product_child_change"
  BEFORE INSERT OR UPDATE OR DELETE ON "public"."rollup_products"
  FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_released_product_child_change"();
CREATE TRIGGER "trg_refuse_released_product_child_change"
  BEFORE INSERT OR UPDATE OR DELETE ON "public"."vehicle_lettering_products"
  FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_released_product_child_change"();
CREATE TRIGGER "trg_refuse_released_product_child_change"
  BEFORE INSERT OR UPDATE OR DELETE ON "public"."other_lfp_products"
  FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_released_product_child_change"();

-- Laser engraving
CREATE TRIGGER "trg_refuse_released_product_child_change"
  BEFORE INSERT OR UPDATE OR DELETE ON "public"."sign_products"
  FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_released_product_child_change"();
CREATE TRIGGER "trg_refuse_released_product_child_change"
  BEFORE INSERT OR UPDATE OR DELETE ON "public"."trophy_plate_products"
  FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_released_product_child_change"();
CREATE TRIGGER "trg_refuse_released_product_child_change"
  BEFORE INSERT OR UPDATE OR DELETE ON "public"."name_tag_products"
  FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_released_product_child_change"();
CREATE TRIGGER "trg_refuse_released_product_child_change"
  BEFORE INSERT OR UPDATE OR DELETE ON "public"."gift_item_products"
  FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_released_product_child_change"();
CREATE TRIGGER "trg_refuse_released_product_child_change"
  BEFORE INSERT OR UPDATE OR DELETE ON "public"."other_laser_products"
  FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_released_product_child_change"();

-- Textile: the batch's two 1:n children
CREATE TRIGGER "trg_refuse_released_product_child_change"
  BEFORE INSERT OR UPDATE OR DELETE ON "public"."textile_garments"
  FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_released_product_child_change"();
CREATE TRIGGER "trg_refuse_released_product_child_change"
  BEFORE INSERT OR UPDATE OR DELETE ON "public"."textile_designs"
  FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_released_product_child_change"();

-- Other
CREATE TRIGGER "trg_refuse_released_product_child_change"
  BEFORE INSERT OR UPDATE OR DELETE ON "public"."other_products"
  FOR EACH ROW EXECUTE FUNCTION "public"."fn_refuse_released_product_child_change"();
