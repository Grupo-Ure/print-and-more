-- 20261103115959_drop_erp_export_and_blueprint.sql — MKS-99, MKS-2
--
-- Two leftovers go: the ERP export the shop retired (erp_exports,
-- orders.is_erp_exported — the client code went with MKS-99) and the four
-- blueprint_* tables of a plan-copy counter that predates this app and that
-- nothing in the client has ever read. MKS-2 asked for both to be protected
-- against deletion; a table the app does not write holds nothing to protect,
-- so it is dropped instead.
--
-- The database is live, so the drop is guarded: the migration raises if any
-- of the five tables still holds a row, and the deploy fails with nothing
-- changed. Production is checked before the release; a payload the shop
-- still wants is exported by hand first. On a fresh database the tables are
-- empty and the guard passes.
--
-- The history_event value ERP_EXPORTED stays: production history may hold
-- it, and removing an enum value means recreating the type. Its label in the
-- client stays with it.

DO $$
DECLARE
  populated text;
BEGIN
  SELECT string_agg(name, ', ') INTO populated
  FROM (
    SELECT 'erp_exports' AS name WHERE EXISTS (SELECT 1 FROM public.erp_exports)
    UNION ALL SELECT 'blueprint_job_items' WHERE EXISTS (SELECT 1 FROM public.blueprint_job_items)
    UNION ALL SELECT 'blueprint_jobs' WHERE EXISTS (SELECT 1 FROM public.blueprint_jobs)
    UNION ALL SELECT 'blueprint_projects' WHERE EXISTS (SELECT 1 FROM public.blueprint_projects)
    UNION ALL SELECT 'blueprint_customers' WHERE EXISTS (SELECT 1 FROM public.blueprint_customers)
  ) t;

  IF populated IS NOT NULL THEN
    RAISE EXCEPTION
      'Refusing to drop populated tables: %. Export or clear them first, then rerun the migration.',
      populated;
  END IF;
END;
$$;

DROP TABLE "public"."erp_exports";

ALTER TABLE "public"."orders" DROP COLUMN "is_erp_exported";

-- Children before parents: items → jobs → projects → customers.
DROP TABLE "public"."blueprint_job_items";

DROP TABLE "public"."blueprint_jobs";

DROP TABLE "public"."blueprint_projects";

DROP TABLE "public"."blueprint_customers";
