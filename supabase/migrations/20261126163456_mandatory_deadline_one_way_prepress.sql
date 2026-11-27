-- 20261126163456_mandatory_deadline_one_way_prepress.sql — every order has a
-- deadline, and a product never returns to setup (MKS-136)
--
-- A product reaches pre-press once it is ready: the order is past quote, it
-- has an effective deadline, and the customer has a name and an email or
-- phone (fn_product_ready_for_prepress). What made a product ready can be
-- changed afterwards but not emptied, and a product that has left setup does
-- not come back to it:
--
-- | Rule                              | What holds it                               |
-- |-----------------------------------|---------------------------------------------|
-- | an order always has a deadline    | `orders.deadline` is NOT NULL               |
-- | a customer always has a name      | `customers_name_required`: not blank        |
-- | a customer always has an email    | `customers_contact_required`: one of the    |
-- | or a phone                        | two is not blank                            |
-- | a product never returns to setup  | fn_apply_automatic_status promotes only     |
--
-- The deadline has no database default: the one-week default of a new order
-- is a local date the app computes, as a default here would be the server's.
-- duplicate_order inserts the deadline it is handed, so the column refuses a
-- copy without one; its body does not change.
--
-- A product's own deadline stays nullable: empty there means "inherit the
-- order's".
--
-- With setup one-way, a product sent back to pre-press from production or
-- from an approval round stays in pre-press whatever it lacks. That is the
-- product an admin force-released: the release is not undone by a later step.

-- ── Orders: the deadline is mandatory ────────────────────────────────────────

-- An order that has no deadline gets the default it should have had: one week
-- after its intake. The correction is not an action of anyone's, so it writes
-- no history entry; the products it makes ready are promoted below.
CREATE TEMPORARY TABLE "orders_given_a_deadline" ON COMMIT DROP AS
  SELECT o.id FROM "public"."orders" o WHERE o.deadline IS NULL;

ALTER TABLE "public"."orders" DISABLE TRIGGER USER;

UPDATE "public"."orders" o
SET deadline = (o.created_at AT TIME ZONE 'Europe/Berlin')::date + 7
WHERE o.deadline IS NULL;

ALTER TABLE "public"."orders" ENABLE TRIGGER USER;

ALTER TABLE "public"."orders" ALTER COLUMN "deadline" SET NOT NULL;

COMMENT ON COLUMN "public"."orders"."deadline" IS 'Overall deadline as a commercial frame; every order has one. A product inherits it unless products.deadline overrides it, and the override is operationally leading — no automatic sync.';

-- ── Customers: a name and a contact that are not blank ──────────────────────

-- A blank email or phone is no contact: stored as none, so the constraint
-- below judges what is really there. A customer left without any contact, or
-- with a blank name, fails the constraint and has to be corrected by hand.
ALTER TABLE "public"."customers" DROP CONSTRAINT "customers_contact_required";

ALTER TABLE "public"."customers" DISABLE TRIGGER USER;

UPDATE "public"."customers" c
SET email = NULLIF(btrim(c.email), ''),
    phone = NULLIF(btrim(c.phone), '')
WHERE c.email !~ '\S' OR c.phone !~ '\S';

ALTER TABLE "public"."customers" ENABLE TRIGGER USER;

ALTER TABLE "public"."customers"
    ADD CONSTRAINT "customers_contact_required"
    CHECK (COALESCE("email" ~ '\S', false) OR COALESCE("phone" ~ '\S', false));

ALTER TABLE "public"."customers"
    ADD CONSTRAINT "customers_name_required"
    CHECK ("name" ~ '\S');

-- ── Setup → pre-press, one way ───────────────────────────────────────────────

/**
 * Promotes each of the given products from setup to pre-press once it is
 * ready (fn_product_ready_for_prepress). It never moves a product back: a
 * product in pre-press stays there whatever changes afterwards. Only open,
 * non-cancelled products in IN_SETUP on an order that is not closed are
 * touched; every other id is skipped, so a caller may pass all the products
 * it has.
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
BEGIN
  FOR v_product IN
    SELECT p.id
    FROM public.products p
    JOIN public.orders o ON o.id = p.order_id
    WHERE p.id = ANY (p_product_ids)
      AND NOT p.is_cancelled
      AND p.status = 'IN_SETUP'
      AND o.status NOT IN ('FINISHED', 'BILLED')
    ORDER BY p.id
    FOR UPDATE OF p
  LOOP
    IF public.fn_product_ready_for_prepress(v_product.id) THEN
      UPDATE public.products SET status = 'PREPRESS' WHERE id = v_product.id;
    END IF;
  END LOOP;
END;
$$;

-- The products the deadline above made ready.
SELECT "public"."fn_apply_automatic_status"(
  ARRAY(
    SELECT p.id
    FROM "public"."products" p
    WHERE p.order_id IN (SELECT id FROM "orders_given_a_deadline")
  )
);
