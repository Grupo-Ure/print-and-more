-- 20260925101438_realtime_publication.sql — publish jobs, orders and customers
-- to Supabase Realtime.
--
-- The production feed lists jobs across all orders and so far refreshed only
-- on the viewer's own job actions and on window refocus: a job someone else
-- moved into pre-press, reassigned or finished showed up late. The page now
-- subscribes to changes on `jobs` and `orders` (the order carries the
-- inherited deadline, priority, delivery and the archive flag) and refetches.
-- The order sidebar has subscribed to `customers` for a while, but the
-- `supabase_realtime` publication held no tables, so that subscription never
-- fired; adding `customers` makes it work.
--
-- Whether the hosted project already has any of these tables in the
-- publication (added through the dashboard) is unknown, and ADD TABLE fails
-- for a table that is already a member — so each table is added only when it
-- is missing. RLS applies to Realtime: every signed-in user may read all
-- three tables, so nothing is broadcast that a client could not select.

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['jobs', 'orders', 'customers'] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
END;
$$;
