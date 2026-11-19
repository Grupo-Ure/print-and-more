-- 20261118182150_transaction_record_events.sql — the events the transaction record adds
--
-- TRANSACTION_RECORD.md, WP0 (decision 7). The events of the transactions the
-- history does not record yet, named as the Notion page *GoBD business
-- transactions* names them. Each is written by the package that moves its
-- area into the database (WP2 to WP5); nothing writes them yet. A value is
-- added in a migration of its own because it cannot be used in the
-- transaction that adds it.
--
-- The existing names stay: entries already written cannot be renamed.
-- PRODUCT_DELETED, FILE_REMOVED and TIME_LOG_DELETED stay in the type for the
-- same reason, although nothing writes them from WP0 on (decision 9) and the
-- entries written with them go in 20261118182151_one_history.

ALTER TYPE "public"."history_event" ADD VALUE IF NOT EXISTS 'CUSTOMER_CREATED';

ALTER TYPE "public"."history_event" ADD VALUE IF NOT EXISTS 'CUSTOMER_UPDATED';

ALTER TYPE "public"."history_event" ADD VALUE IF NOT EXISTS 'FILE_RENAMED';

ALTER TYPE "public"."history_event" ADD VALUE IF NOT EXISTS 'FILE_ROLE_CHANGED';

ALTER TYPE "public"."history_event" ADD VALUE IF NOT EXISTS 'ORDER_BILLING_NOTE_CHANGED';

ALTER TYPE "public"."history_event" ADD VALUE IF NOT EXISTS 'STOCK_BOOKED';

ALTER TYPE "public"."history_event" ADD VALUE IF NOT EXISTS 'STOCK_AUTO_DEDUCTED';

ALTER TYPE "public"."history_event" ADD VALUE IF NOT EXISTS 'RETURNED_TO_PREPRESS';
