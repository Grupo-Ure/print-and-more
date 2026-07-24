-- 20260508081504_types.sql — extensions, enum types, and global settings/grants
-- Split from baseline 20260508081503_remote_schema.sql (delete that file once verified).

SET statement_timeout = 0;

SET lock_timeout = 0;

SET idle_in_transaction_session_timeout = 0;

SET client_encoding = 'UTF8';

SET standard_conforming_strings = on;

SELECT pg_catalog.set_config('search_path', '', false);

SET check_function_bodies = false;

SET xmloption = content;

SET client_min_messages = warning;

SET row_security = off;

COMMENT ON SCHEMA "public" IS 'standard public schema';

CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

SET default_tablespace = '';

SET default_table_access_method = "heap";

GRANT USAGE ON SCHEMA "public" TO "postgres";

GRANT USAGE ON SCHEMA "public" TO "anon";

GRANT USAGE ON SCHEMA "public" TO "authenticated";

GRANT USAGE ON SCHEMA "public" TO "service_role";

-- Order lifecycle: manual transitions only (no aggregation from jobs).
CREATE TYPE "public"."order_status" AS ENUM (
    'QUOTE',
    'IN_PROGRESS',
    'FINISHED',
    'BILLED'
);

ALTER TYPE "public"."order_status" OWNER TO "postgres";

-- Job production workflow, independent of the order lifecycle.
CREATE TYPE "public"."job_status" AS ENUM (
    'IN_SETUP',
    'PREPRESS',
    'IN_PRODUCTION',
    'DONE'
);

ALTER TYPE "public"."job_status" OWNER TO "postgres";

CREATE TYPE "public"."file_role" AS ENUM (
    'PRODUCTION_FILE',
    'PREVIEW',
    'CUSTOMER_APPROVAL',
    'REFERENCE'
);

ALTER TYPE "public"."file_role" OWNER TO "postgres";

CREATE TYPE "public"."history_event" AS ENUM (
    'ORDER_CREATED',
    'PROCESSING_STARTED',
    'PREPRESS_READY_AUTO',
    'PREPRESS_READY_MANUAL',
    'PRODUCTION_READY_SET',
    'MARKED_DONE',
    'EMERGENCY_TRIGGERED',
    'CUSTOMER_APPROVAL_ACTIVATED',
    'CUSTOMER_APPROVAL_DEACTIVATED',
    'CUSTOMER_APPROVAL_GRANTED',
    'CUSTOMER_APPROVAL_EXPIRED',
    'CUSTOMER_APPROVAL_BYPASSED',
    'ROLLED_BACK',
    'CANCELLED',
    'ERP_EXPORTED',
    'ASSIGNEE_CHANGED',
    'ORDER_FINISHED',
    'ORDER_REOPENED',
    'ORDER_BILLED',
    'ORDER_CLOSED_CASH',
    'ORDER_ARCHIVED',
    'TIME_LOGGED',
    'TIME_LOG_DELETED',
    'JOB_CREATED',
    'JOB_CANCELLED',
    'JOB_DELETED',
    'SETTINGS_CHANGED',
    'PRODUCT_CREATED',
    'PRODUCT_UPDATED',
    'PRODUCT_DELETED',
    'FILE_ADDED',
    'FILE_REMOVED'
);

ALTER TYPE "public"."history_event" OWNER TO "postgres";

CREATE TYPE "public"."delivery_type" AS ENUM (
    'PICKUP',
    'SHIPPING'
);

ALTER TYPE "public"."delivery_type" OWNER TO "postgres";

CREATE TYPE "public"."priority_type" AS ENUM (
    'NORMAL',
    'HIGH'
);

ALTER TYPE "public"."priority_type" OWNER TO "postgres";

-- How the order is settled: INVOICE goes through FINISHED → BILLED manually;
-- CASH is paid at the counter and closes (BILLED + archived) directly from IN_PROGRESS.
CREATE TYPE "public"."payment_method" AS ENUM (
    'INVOICE',
    'CASH'
);

ALTER TYPE "public"."payment_method" OWNER TO "postgres";

CREATE TYPE "public"."department" AS ENUM (
    'LFP',
    'COPYSHOP',
    'TEXTILE',
    'STAMP',
    'LASER_ENGRAVING',
    'OTHER'
);

ALTER TYPE "public"."department" OWNER TO "postgres";

CREATE TYPE "public"."textile_origin" AS ENUM (
    'CUSTOMER_STOCK',
    'OWN_STOCK'
);

ALTER TYPE "public"."textile_origin" OWNER TO "postgres";

CREATE TYPE "public"."textile_motif_type" AS ENUM (
    'TEXT',
    'FILE'
);

ALTER TYPE "public"."textile_motif_type" OWNER TO "postgres";

CREATE TYPE "public"."textile_font_class" AS ENUM (
    'SANS_SERIF',
    'SERIF',
    'ELEGANT',
    'PLAYFUL'
);

ALTER TYPE "public"."textile_font_class" OWNER TO "postgres";

CREATE TYPE "public"."user_role" AS ENUM (
    'EMPLOYEE',
    'ADMIN',
    'SUPER_ADMIN'
);

ALTER TYPE "public"."user_role" OWNER TO "postgres";

ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
