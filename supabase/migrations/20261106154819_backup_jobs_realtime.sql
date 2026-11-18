-- 20261106154819_backup_jobs_realtime.sql — Settings → Backups follows deliveries live
--
-- BACKUP_RUNTIME.md, WP4. The backups list in Settings refetches when a job
-- is recorded, claimed, delivered, given back or purged, so an admin watching
-- it sees a delivery land without reloading. Every signed-in user may read
-- the table, so the change events reach exactly the users who could select
-- the row anyway.

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."backup_jobs";
