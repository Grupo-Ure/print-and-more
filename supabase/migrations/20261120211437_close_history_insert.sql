-- 20261120211437_close_history_insert.sql — only the database writes history
--
-- TRANSACTION_RECORD.md, WP7 (decision 2). The base schema let every
-- employee append to `history` (the INSERT grant and the "Employees: append"
-- policy, 20260930120013_audit), because the app wrote its own entries. Since
-- WP2 to WP4 no part of the app writes one: every entry comes from
-- fn_write_history, called by a trigger or a database function in the
-- transaction of the change, and that writer runs as its owner. The grant and
-- the policy are what is left of the client's write, so both go.
--
-- After this a signed-in user reads history and nothing else; an insert
-- through the API fails with "permission denied", as an update or delete
-- already does. service_role (the e2e runner, the edge functions) keeps its
-- grant, as every guard exempts it.

DROP POLICY "Employees: append" ON "public"."history";

REVOKE INSERT ON TABLE "public"."history" FROM "authenticated";
