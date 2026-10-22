-- 20261022090606_product_status_awaiting_approval.sql — the waiting status
--
-- CUSTOMER_APPROVAL.md, WP2, migration A. A product whose customer has been
-- asked to approve a proof waits in AWAITING_APPROVAL, between pre-press and
-- production: sending the request puts it there, and only the request closing
-- (approved, changes requested, expired, withdrawn) takes it out.
--
-- On its own because a value added to an enum cannot be used in the
-- transaction that adds it; the next migration, which builds the request
-- tables and the functions that move products into and out of the status,
-- is the first to use it.

ALTER TYPE "public"."product_status" ADD VALUE IF NOT EXISTS 'AWAITING_APPROVAL' BEFORE 'IN_PRODUCTION';
