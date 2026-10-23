-- 20261023115426_drop_customer_approval_columns.sql — retire the approval switch
--
-- CUSTOMER_APPROVAL.md, WP5, decision 1. Before the approval request, a
-- customer approval was three columns on products: a switch
-- (customer_approval_required), a tick (customer_approval_granted) and the
-- file it was granted against (customer_approval_file_id), set by hand in the
-- product's settings. The request tables replace them — the newest round is
-- the gate, enforced by release_to_production — and the app no longer reads
-- or writes them, so they go, with their check, foreign key and trigger.
--
-- Nothing is salvaged: no approval granted through the columns is copied
-- anywhere, since there is no data to keep yet.
--
-- CUSTOMER_APPROVAL_ACTIVATED / _DEACTIVATED are no longer written; the enum
-- values stay for the rows they label.

DROP TRIGGER IF EXISTS "trg_approval_file_order_check" ON "public"."products";

DROP FUNCTION IF EXISTS "public"."fn_check_approval_file_order"();

ALTER TABLE "public"."products" DROP CONSTRAINT IF EXISTS "approval_consistency";

ALTER TABLE "public"."products" DROP CONSTRAINT IF EXISTS "fk_approval_file";

ALTER TABLE "public"."products"
    DROP COLUMN "customer_approval_required",
    DROP COLUMN "customer_approval_granted",
    DROP COLUMN "customer_approval_file_id";

COMMENT ON TABLE "public"."products" IS 'The unit of work: one product of one department, parent of its typed child row (chosen by `type`). Carries the production workflow (status, assignee, cancellation; the customer approval in product_approval_requests, approved_request_id naming the round it went into production on) the old `jobs` table held. All type values are ASCII without diacritics (e.g. BROCHURE).';
