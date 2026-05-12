
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

CREATE TYPE "public"."order_status" AS ENUM (
    'QUOTE',
    'INCOMPLETE',
    'PREPRESS_READY',
    'PRODUCTION_READY',
    'DONE',
    'INVOICED'
);

ALTER TYPE "public"."order_status" OWNER TO "postgres";

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
    'CUSTOMER_APPROVAL_GRANTED',
    'CUSTOMER_APPROVAL_EXPIRED',
    'CUSTOMER_APPROVAL_BYPASSED',
    'ROLLED_BACK',
    'CANCELLED',
    'ERP_EXPORTED'
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

CREATE TYPE "public"."sub_order_department" AS ENUM (
    'LFP',
    'COPYSHOP',
    'TEXTILE',
    'STAMP',
    'LASER_ENGRAVING',
    'OTHER'
);

ALTER TYPE "public"."sub_order_department" OWNER TO "postgres";

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

CREATE OR REPLACE FUNCTION "public"."check_textile_placement_conflict"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM textile_assignments existing
    JOIN textile_motifs existing_motif ON existing_motif.id = existing.motif_id
    JOIN textile_motifs new_motif ON new_motif.id = NEW.motif_id
    WHERE existing.position_id = NEW.position_id
      AND existing_motif.placement = new_motif.placement
      AND existing.id != NEW.id
  ) THEN
    RAISE EXCEPTION 'PLACEMENT_CONFLICT: This placement is already occupied for this textile position.';
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."check_textile_placement_conflict"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."duplicate_order"("source_order_id" "uuid", "new_priority" "text", "new_delivery" "text", "new_deadline" "date", "selected_sub_order_ids" "uuid"[], "created_by_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  source_customer_id    UUID;
  new_order_id          UUID;
  new_sub_order_id      UUID;
  new_product_id        UUID;
  source_product        RECORD;
  source_motif          RECORD;
  source_position       RECORD;
  source_assignment     RECORD;
  source_sub_order      RECORD;
  motif_id_map          JSONB := '{}'::JSONB;
  position_id_map       JSONB := '{}'::JSONB;
  new_motif_id          UUID;
  new_position_id       UUID;
BEGIN
  -- Customer of the source order
  SELECT customer_id INTO source_customer_id FROM orders WHERE id = source_order_id;
  IF source_customer_id IS NULL THEN
    RAISE EXCEPTION 'customer_id missing on source order';
  END IF;

  -- New order
  INSERT INTO orders (customer_id, status, priority, delivery, deadline)
  VALUES (source_customer_id, 'QUOTE', new_priority, new_delivery, new_deadline)
  RETURNING id INTO new_order_id;

  -- Sub-orders
  FOR source_sub_order IN
    SELECT * FROM sub_orders WHERE id = ANY(selected_sub_order_ids)
  LOOP
    INSERT INTO sub_orders (order_id, department, type, status, priority, delivery, detail)
    VALUES (new_order_id, source_sub_order.department, source_sub_order.type, 'INCOMPLETE', source_sub_order.priority, source_sub_order.delivery, source_sub_order.detail)
    RETURNING id INTO new_sub_order_id;

    IF source_sub_order.department = 'TEXTILE' THEN
      -- Copy motifs
      motif_id_map := '{}'::JSONB;
      FOR source_motif IN
        SELECT * FROM textile_motifs WHERE sub_order_id = source_sub_order.id
      LOOP
        INSERT INTO textile_motifs (sub_order_id, type, content, color, font_class, font_name, file_id, placement, size, print_method)
        VALUES (new_sub_order_id, source_motif.type, source_motif.content, source_motif.color, source_motif.font_class, source_motif.font_name, source_motif.file_id, source_motif.placement, source_motif.size, source_motif.print_method)
        RETURNING id INTO new_motif_id;
        motif_id_map := motif_id_map || jsonb_build_object(source_motif.id::TEXT, new_motif_id::TEXT);
      END LOOP;

      -- Copy positions
      position_id_map := '{}'::JSONB;
      FOR source_position IN
        SELECT * FROM textile_positions WHERE sub_order_id = source_sub_order.id
      LOOP
        INSERT INTO textile_positions (sub_order_id, origin, type, color, quantity, brand, model, size, variant_id)
        VALUES (new_sub_order_id, source_position.origin, source_position.type, source_position.color, source_position.quantity, source_position.brand, source_position.model, source_position.size, source_position.variant_id)
        RETURNING id INTO new_position_id;
        position_id_map := position_id_map || jsonb_build_object(source_position.id::TEXT, new_position_id::TEXT);
      END LOOP;

      -- Copy assignments
      FOR source_assignment IN
        SELECT * FROM textile_assignments WHERE sub_order_id = source_sub_order.id
      LOOP
        INSERT INTO textile_assignments (sub_order_id, motif_id, position_id)
        VALUES (
          new_sub_order_id,
          (motif_id_map->>source_assignment.motif_id::TEXT)::UUID,
          (position_id_map->>source_assignment.position_id::TEXT)::UUID
        );
      END LOOP;

    ELSE
      -- Copy products
      FOR source_product IN
        SELECT * FROM sub_order_products WHERE sub_order_id = source_sub_order.id ORDER BY sort_order
      LOOP
        INSERT INTO sub_order_products (sub_order_id, department, detail, sort_order)
        VALUES (new_sub_order_id, source_product.department, source_product.detail, source_product.sort_order)
        RETURNING id INTO new_product_id;

        -- Copy file assignments
        INSERT INTO product_files (product_id, file_id)
        SELECT new_product_id, file_id
        FROM product_files
        WHERE product_id = source_product.id;
      END LOOP;
    END IF;
  END LOOP;

  -- History
  INSERT INTO history (order_id, user_id, event_type, meta)
  VALUES (
    new_order_id,
    created_by_user_id,
    'ORDER_CREATED',
    jsonb_build_object('duplicated_from', source_order_id)
  );

  RETURN new_order_id;
END;
$$;

ALTER FUNCTION "public"."duplicate_order"("source_order_id" "uuid", "new_priority" "text", "new_delivery" "text", "new_deadline" "date", "selected_sub_order_ids" "uuid"[], "created_by_user_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."fn_calculate_order_status"("target_order_id" "uuid") RETURNS "public"."order_status"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  current_status  order_status;
  target_status   order_status;
BEGIN
  SELECT status INTO current_status
  FROM orders WHERE id = target_order_id;

  IF current_status = 'QUOTE' THEN
    RETURN 'QUOTE';
  END IF;

  SELECT status INTO target_status
  FROM sub_orders
  WHERE order_id = target_order_id
    AND is_cancelled = false
  ORDER BY CASE status
    WHEN 'INCOMPLETE'       THEN 1
    WHEN 'PREPRESS_READY'   THEN 2
    WHEN 'PRODUCTION_READY' THEN 3
    WHEN 'DONE'             THEN 4
    ELSE 0
  END ASC
  LIMIT 1;

  IF target_status IS NULL THEN
    RETURN 'INCOMPLETE';
  END IF;

  RETURN target_status;
END;
$$;

ALTER FUNCTION "public"."fn_calculate_order_status"("target_order_id" "uuid") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."fn_calculate_order_status"("target_order_id" "uuid") IS 'Lowest status of all non-cancelled sub-orders using an explicit CASE ordering. QUOTE at order level is never changed automatically. When adding enum values: update the CASE block here.';

CREATE OR REPLACE FUNCTION "public"."fn_check_file_versioning_order"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.replaces_file_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM files
      WHERE id = NEW.replaces_file_id
        AND order_id = NEW.order_id
    ) THEN
      RAISE EXCEPTION
        'Replaced file (%) does not belong to the same order (%)',
        NEW.replaces_file_id, NEW.order_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."fn_check_file_versioning_order"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."fn_check_approval_file_order"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.customer_approval_file_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM files
      WHERE id = NEW.customer_approval_file_id
        AND order_id = NEW.order_id
    ) THEN
      RAISE EXCEPTION
        'Approval file (%) does not belong to the order of this sub-order (%)',
        NEW.customer_approval_file_id, NEW.order_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."fn_check_approval_file_order"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."fn_check_sub_order_belongs_to_order"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.sub_order_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM sub_orders
      WHERE id = NEW.sub_order_id AND order_id = NEW.order_id
    ) THEN
      RAISE EXCEPTION 'Sub-order (%) does not belong to order (%)',
        NEW.sub_order_id, NEW.order_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."fn_check_sub_order_belongs_to_order"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."fn_check_sub_order_type"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  CASE NEW.department
    WHEN 'LFP' THEN
      IF NEW.type IS NOT NULL AND NEW.type NOT IN (
        'STICKER','SIGN_UV','SIGN_FOIL','FOIL_PLOTTER',
        'BANNER','ROLLUP','VEHICLE_LETTERING','OTHER_LFP'
      ) THEN
        RAISE EXCEPTION 'Invalid type "%" for department LFP', NEW.type;
      END IF;
    WHEN 'COPYSHOP' THEN
      IF NEW.type IS NOT NULL AND NEW.type NOT IN (
        'POSTER','CARD_FLYER','FOLDED_FLYER','BROCHURE',
        'BUSINESS_CARD','BINDING','PRINTOUT'
      ) THEN
        RAISE EXCEPTION 'Invalid type "%" for department COPYSHOP', NEW.type;
      END IF;
    WHEN 'TEXTILE' THEN
      IF NEW.type IS NOT NULL THEN
        RAISE EXCEPTION 'Department TEXTILE does not use a type value';
      END IF;
    WHEN 'STAMP' THEN
      IF NEW.type IS NOT NULL AND NEW.type NOT IN (
        'TRODAT_PRINTY','WOODEN_STAMP','STAND_STAMP','DATE_STAMP',
        'OTHER_STAMP','REFILL_INK','INK_PAD','STAMP_PLATE',
        'TRODAT_PAD'
      ) THEN
        RAISE EXCEPTION 'Invalid type "%" for department STAMP', NEW.type;
      END IF;
    WHEN 'LASER_ENGRAVING' THEN
      IF NEW.type IS NOT NULL AND NEW.type NOT IN (
        'SIGN','TROPHY_PLATE','NAME_TAG','GIFT_ITEM','OTHER_LASER'
      ) THEN
        RAISE EXCEPTION 'Invalid type "%" for department LASER_ENGRAVING', NEW.type;
      END IF;
    WHEN 'OTHER' THEN
      IF NEW.type IS NOT NULL AND NEW.type != 'OTHER' THEN
        RAISE EXCEPTION 'Department OTHER allows only type = OTHER or NULL';
      END IF;
  END CASE;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."fn_check_sub_order_type"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."fn_check_textile_motif_file"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  parent_order_id uuid;
BEGIN
  IF NEW.file_id IS NOT NULL THEN
    SELECT order_id INTO parent_order_id
    FROM sub_orders WHERE id = NEW.sub_order_id;

    IF NOT EXISTS (
      SELECT 1 FROM files
      WHERE id = NEW.file_id AND order_id = parent_order_id
    ) THEN
      RAISE EXCEPTION
        'File (%) in textile motif does not belong to the order of the sub-order (%)',
        NEW.file_id, parent_order_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."fn_check_textile_motif_file"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."fn_check_textile_assignment_consistency"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM textile_motifs
    WHERE id = NEW.motif_id AND sub_order_id = NEW.sub_order_id
  ) THEN
    RAISE EXCEPTION 'Motif (%) does not belong to sub-order (%)',
      NEW.motif_id, NEW.sub_order_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM textile_positions
    WHERE id = NEW.position_id AND sub_order_id = NEW.sub_order_id
  ) THEN
    RAISE EXCEPTION 'Position (%) does not belong to sub-order (%)',
      NEW.position_id, NEW.sub_order_id;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."fn_check_textile_assignment_consistency"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."fn_generate_order_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  counter_year   integer := EXTRACT(YEAR  FROM now())::integer;
  counter_month  integer := EXTRACT(MONTH FROM now())::integer;
  seq_value      integer;
BEGIN
  INSERT INTO order_number_counter (year, month, last_value)
  VALUES (counter_year, counter_month, 1)
  ON CONFLICT (year, month) DO UPDATE
    SET last_value = order_number_counter.last_value + 1
  RETURNING last_value INTO seq_value;

  NEW.order_number :=
    to_char(now(), 'YYYY-MM') || '-' ||
    lpad(seq_value::text, 4, '0');

  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."fn_generate_order_number"() OWNER TO "postgres";

COMMENT ON FUNCTION "public"."fn_generate_order_number"() IS 'Atomic monthly counter using INSERT ... ON CONFLICT DO UPDATE. No race condition on concurrent inserts. Resets counter to 1 each month.';

SET default_tablespace = '';

SET default_table_access_method = "heap";

CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_number" "text" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "status" "public"."order_status" DEFAULT 'QUOTE'::"public"."order_status" NOT NULL,
    "deadline" "date",
    "delivery" "public"."delivery_type",
    "priority" "public"."priority_type" DEFAULT 'NORMAL'::"public"."priority_type" NOT NULL,
    "is_emergency" boolean DEFAULT false NOT NULL,
    "is_archived" boolean DEFAULT false NOT NULL,
    "is_erp_exported" boolean DEFAULT false NOT NULL,
    "billing_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);

ALTER TABLE "public"."orders" OWNER TO "postgres";

COMMENT ON TABLE "public"."orders" IS 'Central aggregate. status is set by application convention via fn_calculate_order_status() — the DB does not enforce this. Direct SQL updates to status are intentionally allowed for emergency migrations.';

COMMENT ON COLUMN "public"."orders"."deadline" IS 'Overall deadline as a commercial frame. sub_orders.deadline is operationally leading and may differ — no automatic sync (V1 domain model, intentional decision).';

CREATE TABLE IF NOT EXISTS "public"."order_number_counter" (
    "year" integer NOT NULL,
    "month" integer NOT NULL,
    "last_value" integer DEFAULT 0 NOT NULL
);

ALTER TABLE "public"."order_number_counter" OWNER TO "postgres";

COMMENT ON TABLE "public"."order_number_counter" IS 'Monthly counter for order numbers. One row per year+month. Written exclusively via fn_generate_order_number(). Direct UPDATEs are forbidden — they would corrupt the numbering sequence.';

CREATE TABLE IF NOT EXISTS "public"."blueprint_customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "short_code" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."blueprint_customers" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."blueprint_job_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "filename" "text",
    "page_count" integer DEFAULT 1 NOT NULL,
    "format" "text" NOT NULL,
    "width_mm" numeric,
    "height_mm" numeric,
    "is_color" boolean NOT NULL,
    "copies" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "blueprint_job_items_copies_check" CHECK (("copies" > 0)),
    CONSTRAINT "blueprint_job_items_format_check" CHECK (("format" = ANY (ARRAY['A0'::"text", 'A1'::"text", 'A2'::"text", 'A3'::"text", 'A4'::"text", 'custom'::"text"]))),
    CONSTRAINT "blueprint_job_items_height_mm_check" CHECK ((("height_mm" IS NULL) OR ("height_mm" > (0)::numeric))),
    CONSTRAINT "blueprint_job_items_page_count_check" CHECK (("page_count" > 0)),
    CONSTRAINT "blueprint_job_items_width_mm_check" CHECK ((("width_mm" IS NULL) OR ("width_mm" > (0)::numeric)))
);

ALTER TABLE "public"."blueprint_job_items" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."blueprint_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "job_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "project_id" "uuid"
);

ALTER TABLE "public"."blueprint_jobs" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."blueprint_projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."blueprint_projects" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    "path" "text" NOT NULL,
    "role" "public"."file_role" DEFAULT 'PRODUCTION_FILE'::"public"."file_role" NOT NULL,
    "thumbnail_path" "text",
    "version" integer DEFAULT 1 NOT NULL,
    "replaces_file_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);

ALTER TABLE "public"."files" OWNER TO "postgres";

COMMENT ON TABLE "public"."files" IS 'Always attached to an order, never to a sub-order. No file upload — network path only. replaces_file_id: empty in V1, trigger already enforces same order.';

CREATE TABLE IF NOT EXISTS "public"."erp_exports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "mode" "text" NOT NULL,
    "exported_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "exported_by" "uuid",
    "export_data" "jsonb" NOT NULL,
    CONSTRAINT "erp_exports_mode_check" CHECK (("mode" = ANY (ARRAY['SINGLE'::"text", 'BULK'::"text"])))
);

ALTER TABLE "public"."erp_exports" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."errors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "sub_order_id" "uuid",
    "text" "text" NOT NULL,
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."errors" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "sub_order_id" "uuid",
    "event_type" "public"."history_event" NOT NULL,
    "user_id" "uuid",
    "reason" "text",
    "meta" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."history" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "note" "text",
    "is_archived" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "street" "text",
    "house_number" "text",
    "postal_code" "text",
    "city" "text",
    CONSTRAINT "customers_contact_required" CHECK ((("email" IS NOT NULL) OR ("phone" IS NOT NULL)))
);

ALTER TABLE "public"."customers" OWNER TO "postgres";

COMMENT ON TABLE "public"."customers" IS 'Reusable customer master data. Required: name + at least email or phone.';

CREATE TABLE IF NOT EXISTS "public"."stamp_stock_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "model_id" "uuid" NOT NULL,
    "quantity" integer NOT NULL,
    "type" "text" NOT NULL,
    "note" "text",
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "stamp_stock_movements_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "stamp_stock_movements_type_check" CHECK (("type" = ANY (ARRAY['INBOUND'::"text", 'OUTBOUND'::"text", 'AUTO_DEDUCTION'::"text"])))
);

ALTER TABLE "public"."stamp_stock_movements" OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."employees" AS
 SELECT "id",
    "email"
   FROM "auth"."users"
  WHERE ("auth"."uid"() IS NOT NULL)
  ORDER BY "email";

ALTER VIEW "public"."employees" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."product_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "file_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."product_files" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "name" "text" NOT NULL
);

ALTER TABLE "public"."profiles" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."stamp_models" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "max_width_mm" integer,
    "max_height_mm" integer,
    "print_area" "text",
    "article_number" "text",
    "stock" integer DEFAULT 0 NOT NULL,
    "min_stock" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "net_price" numeric(10,2),
    "replacement_pad_article_number" "text",
    "size" "text",
    "color" "text",
    CONSTRAINT "stamp_models_color_check" CHECK (("color" = ANY (ARRAY['BLACK'::"text", 'RED'::"text", 'BLUE'::"text", 'GREEN'::"text"]))),
    CONSTRAINT "stamp_models_size_check" CHECK (("size" = ANY (ARRAY['SMALL'::"text", 'MEDIUM'::"text", 'LARGE'::"text"]))),
    CONSTRAINT "stamp_models_type_check" CHECK (("type" = ANY (ARRAY['TRODAT_PRINTY'::"text", 'WOODEN_STAMP'::"text", 'STAND_STAMP'::"text", 'DATE_STAMP'::"text", 'INK_PAD_PRODUCT'::"text", 'TRODAT_PAD'::"text"])))
);

ALTER TABLE "public"."stamp_models" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."sub_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "department" "public"."sub_order_department" NOT NULL,
    "type" "text",
    "status" "public"."order_status" DEFAULT 'INCOMPLETE'::"public"."order_status" NOT NULL,
    "deadline" "date",
    "delivery" "public"."delivery_type",
    "priority" "public"."priority_type" DEFAULT 'NORMAL'::"public"."priority_type" NOT NULL,
    "assignee_id" "uuid",
    "typesetting_minutes" integer,
    "data_status" "text",
    "detail" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_emergency" boolean DEFAULT false NOT NULL,
    "emergency_reason" "text",
    "customer_approval_required" boolean DEFAULT false NOT NULL,
    "customer_approval_granted" boolean DEFAULT false NOT NULL,
    "customer_approval_file_id" "uuid",
    "is_cancelled" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "approval_consistency" CHECK (((NOT (("customer_approval_granted" = true) AND ("customer_approval_required" = false))) AND (NOT (("customer_approval_granted" = true) AND ("customer_approval_file_id" IS NULL))) AND (NOT (("customer_approval_file_id" IS NOT NULL) AND ("customer_approval_required" = false))))),
    CONSTRAINT "emergency_reason_required" CHECK (((NOT "is_emergency") OR (("emergency_reason" IS NOT NULL) AND (TRIM(BOTH FROM "emergency_reason") <> ''::"text")))),
    CONSTRAINT "typesetting_time_positive" CHECK ((("typesetting_minutes" IS NULL) OR ("typesetting_minutes" > 0))),
    CONSTRAINT "sub_order_status_no_quote" CHECK (("status" <> 'QUOTE'::"public"."order_status"))
);

ALTER TABLE "public"."sub_orders" OWNER TO "postgres";

COMMENT ON TABLE "public"."sub_orders" IS 'Core operational unit. Status must never be QUOTE (CHECK constraint). detail (JSONB): required-field logic lives in application code (Zod), not the DB. All type values are ASCII without diacritics (e.g. BROCHURE).';

COMMENT ON COLUMN "public"."sub_orders"."detail" IS 'Department-specific fields as JSONB. Validation in application code, not the DB. Intentional: allows new departments without a DB migration.';

CREATE TABLE IF NOT EXISTS "public"."sub_order_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sub_order_id" "uuid" NOT NULL,
    "department" "text" NOT NULL,
    "detail" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."sub_order_products" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."textile_stock_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "variant_id" "uuid" NOT NULL,
    "quantity" integer NOT NULL,
    "type" "text" NOT NULL,
    "note" "text",
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "textile_stock_movements_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "textile_stock_movements_type_check" CHECK (("type" = ANY (ARRAY['INBOUND'::"text", 'OUTBOUND'::"text", 'AUTO_DEDUCTION'::"text"])))
);

ALTER TABLE "public"."textile_stock_movements" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."textile_brands" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."textile_brands" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."textile_motifs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sub_order_id" "uuid" NOT NULL,
    "type" "public"."textile_motif_type" NOT NULL,
    "content" "text",
    "color" "text",
    "font_class" "public"."textile_font_class",
    "font_name" "text",
    "file_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "placement" "text" DEFAULT 'CHEST_LEFT'::"text" NOT NULL,
    "size" "text" DEFAULT 'MEDIUM'::"text" NOT NULL,
    "print_method" "text",
    CONSTRAINT "textile_motif_file_exclusive" CHECK ((("type" <> 'FILE'::"public"."textile_motif_type") OR (("content" IS NULL) AND ("color" IS NULL) AND ("font_class" IS NULL) AND ("font_name" IS NULL)))),
    CONSTRAINT "textile_motif_file_complete" CHECK ((("type" <> 'FILE'::"public"."textile_motif_type") OR ("file_id" IS NOT NULL))),
    CONSTRAINT "textile_motif_text_exclusive" CHECK ((("type" <> 'TEXT'::"public"."textile_motif_type") OR ("file_id" IS NULL))),
    CONSTRAINT "textile_motif_text_complete" CHECK ((("type" <> 'TEXT'::"public"."textile_motif_type") OR (("content" IS NOT NULL) AND ("color" IS NOT NULL) AND ("font_class" IS NOT NULL))))
);

ALTER TABLE "public"."textile_motifs" OWNER TO "postgres";

COMMENT ON TABLE "public"."textile_motifs" IS 'type=TEXT and type=FILE are fully exclusive: four CHECK constraints each enforce completeness and exclusion of the opposing field set.';

CREATE TABLE IF NOT EXISTS "public"."textile_positions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sub_order_id" "uuid" NOT NULL,
    "origin" "public"."textile_origin" NOT NULL,
    "quantity" integer NOT NULL,
    "type" "text",
    "color" "text",
    "brand" "text",
    "model" "text",
    "size" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "variant_id" "uuid",
    CONSTRAINT "own_stock_required_fields" CHECK ((("origin" <> 'OWN_STOCK'::"public"."textile_origin") OR (("brand" IS NOT NULL) AND ("model" IS NOT NULL) AND ("color" IS NOT NULL) AND ("size" IS NOT NULL)))),
    CONSTRAINT "customer_stock_required_fields" CHECK ((("origin" <> 'CUSTOMER_STOCK'::"public"."textile_origin") OR (("type" IS NOT NULL) AND ("color" IS NOT NULL)))),
    CONSTRAINT "textile_positions_quantity_check" CHECK (("quantity" > 0))
);

ALTER TABLE "public"."textile_positions" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."textile_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "article_number" "text",
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finishing_options" "text"[]
);

ALTER TABLE "public"."textile_products" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."textile_variants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "color" "text" NOT NULL,
    "color_hex" "text",
    "size" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_sample" boolean DEFAULT false NOT NULL,
    "stock" integer DEFAULT 0 NOT NULL,
    "min_stock" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "material" "text",
    CONSTRAINT "textile_variants_stock_check" CHECK (("stock" >= 0))
);

ALTER TABLE "public"."textile_variants" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."textile_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sub_order_id" "uuid" NOT NULL,
    "motif_id" "uuid" NOT NULL,
    "position_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."textile_assignments" OWNER TO "postgres";

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_order_number_key" UNIQUE ("order_number");

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."order_number_counter"
    ADD CONSTRAINT "order_number_counter_pkey" PRIMARY KEY ("year", "month");

ALTER TABLE ONLY "public"."blueprint_customers"
    ADD CONSTRAINT "blueprint_customers_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."blueprint_job_items"
    ADD CONSTRAINT "blueprint_job_items_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."blueprint_jobs"
    ADD CONSTRAINT "blueprint_jobs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."blueprint_projects"
    ADD CONSTRAINT "blueprint_projects_customer_id_name_key" UNIQUE ("customer_id", "name");

ALTER TABLE ONLY "public"."blueprint_projects"
    ADD CONSTRAINT "blueprint_projects_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."erp_exports"
    ADD CONSTRAINT "erp_exports_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."errors"
    ADD CONSTRAINT "errors_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."history"
    ADD CONSTRAINT "history_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."stamp_stock_movements"
    ADD CONSTRAINT "stamp_stock_movements_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."product_files"
    ADD CONSTRAINT "product_files_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."product_files"
    ADD CONSTRAINT "product_files_product_id_file_id_key" UNIQUE ("product_id", "file_id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."stamp_models"
    ADD CONSTRAINT "stamp_models_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."sub_orders"
    ADD CONSTRAINT "sub_orders_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."sub_order_products"
    ADD CONSTRAINT "sub_order_products_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."textile_stock_movements"
    ADD CONSTRAINT "textile_stock_movements_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."textile_brands"
    ADD CONSTRAINT "textile_brands_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."textile_motifs"
    ADD CONSTRAINT "textile_motifs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."textile_positions"
    ADD CONSTRAINT "textile_positions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."textile_products"
    ADD CONSTRAINT "textile_products_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."textile_variants"
    ADD CONSTRAINT "textile_variants_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."textile_assignments"
    ADD CONSTRAINT "textile_assignments_pkey" PRIMARY KEY ("id");

CREATE INDEX "idx_orders_archived" ON "public"."orders" USING "btree" ("is_archived");

CREATE INDEX "idx_orders_created_at" ON "public"."orders" USING "btree" ("created_at");

CREATE INDEX "idx_orders_customer_id" ON "public"."orders" USING "btree" ("customer_id");

CREATE INDEX "idx_orders_status" ON "public"."orders" USING "btree" ("status");

CREATE INDEX "idx_orders_deadline" ON "public"."orders" USING "btree" ("deadline");

CREATE INDEX "idx_blueprint_job_items_job" ON "public"."blueprint_job_items" USING "btree" ("job_id");

CREATE INDEX "idx_blueprint_jobs_customer_date" ON "public"."blueprint_jobs" USING "btree" ("customer_id", "job_date");

CREATE INDEX "idx_blueprint_projects_customer" ON "public"."blueprint_projects" USING "btree" ("customer_id");

CREATE INDEX "idx_files_order_id" ON "public"."files" USING "btree" ("order_id");

CREATE INDEX "idx_erp_exports_order_id" ON "public"."erp_exports" USING "btree" ("order_id");

CREATE INDEX "idx_errors_order_id" ON "public"."errors" USING "btree" ("order_id");

CREATE INDEX "idx_history_order_id" ON "public"."history" USING "btree" ("order_id");

CREATE INDEX "idx_history_created_at" ON "public"."history" USING "btree" ("created_at");

CREATE INDEX "idx_history_sub_order_id" ON "public"."history" USING "btree" ("sub_order_id");

CREATE INDEX "idx_customers_archived" ON "public"."customers" USING "btree" ("is_archived");

CREATE INDEX "idx_customers_name_fulltext" ON "public"."customers" USING "gin" ("to_tsvector"('"simple"'::"regconfig", "name"));

CREATE INDEX "idx_stamp_stock_movements_created" ON "public"."stamp_stock_movements" USING "btree" ("created_at");

CREATE INDEX "idx_stamp_stock_movements_model" ON "public"."stamp_stock_movements" USING "btree" ("model_id");

CREATE INDEX "idx_stamp_models_active" ON "public"."stamp_models" USING "btree" ("is_active");

CREATE INDEX "idx_stamp_models_type" ON "public"."stamp_models" USING "btree" ("type");

CREATE INDEX "idx_sub_order_products_sub_order" ON "public"."sub_order_products" USING "btree" ("sub_order_id");

CREATE INDEX "idx_sub_orders_order_id" ON "public"."sub_orders" USING "btree" ("order_id");

CREATE INDEX "idx_sub_orders_department" ON "public"."sub_orders" USING "btree" ("department");

CREATE INDEX "idx_sub_orders_status" ON "public"."sub_orders" USING "btree" ("status");

CREATE INDEX "idx_textile_stock_movements_created" ON "public"."textile_stock_movements" USING "btree" ("created_at");

CREATE INDEX "idx_textile_stock_movements_variant" ON "public"."textile_stock_movements" USING "btree" ("variant_id");

CREATE INDEX "idx_textile_motifs_sub_order" ON "public"."textile_motifs" USING "btree" ("sub_order_id");

CREATE INDEX "idx_textile_positions_sub_order" ON "public"."textile_positions" USING "btree" ("sub_order_id");

CREATE INDEX "product_files_file_id_idx" ON "public"."product_files" USING "btree" ("file_id");

CREATE INDEX "product_files_product_id_idx" ON "public"."product_files" USING "btree" ("product_id");

CREATE OR REPLACE TRIGGER "textile_placement_conflict_trigger" BEFORE INSERT OR UPDATE ON "public"."textile_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."check_textile_placement_conflict"();

CREATE OR REPLACE TRIGGER "trg_order_number" BEFORE INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."fn_generate_order_number"();

CREATE OR REPLACE TRIGGER "trg_file_versioning_order_check" BEFORE INSERT OR UPDATE OF "replaces_file_id", "order_id" ON "public"."files" FOR EACH ROW EXECUTE FUNCTION "public"."fn_check_file_versioning_order"();

CREATE OR REPLACE TRIGGER "trg_error_sub_order_check" BEFORE INSERT OR UPDATE OF "sub_order_id", "order_id" ON "public"."errors" FOR EACH ROW EXECUTE FUNCTION "public"."fn_check_sub_order_belongs_to_order"();

CREATE OR REPLACE TRIGGER "trg_history_sub_order_check" BEFORE INSERT OR UPDATE OF "sub_order_id", "order_id" ON "public"."history" FOR EACH ROW EXECUTE FUNCTION "public"."fn_check_sub_order_belongs_to_order"();

CREATE OR REPLACE TRIGGER "trg_approval_file_order_check" BEFORE INSERT OR UPDATE OF "customer_approval_file_id", "order_id" ON "public"."sub_orders" FOR EACH ROW EXECUTE FUNCTION "public"."fn_check_approval_file_order"();

CREATE OR REPLACE TRIGGER "trg_sub_order_type_check" BEFORE INSERT OR UPDATE OF "department", "type" ON "public"."sub_orders" FOR EACH ROW EXECUTE FUNCTION "public"."fn_check_sub_order_type"();

CREATE OR REPLACE TRIGGER "trg_textile_motif_file_check" BEFORE INSERT OR UPDATE OF "file_id", "sub_order_id" ON "public"."textile_motifs" FOR EACH ROW EXECUTE FUNCTION "public"."fn_check_textile_motif_file"();

CREATE OR REPLACE TRIGGER "trg_textile_assignment_consistency" BEFORE INSERT OR UPDATE ON "public"."textile_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."fn_check_textile_assignment_consistency"();

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");

ALTER TABLE ONLY "public"."blueprint_job_items"
    ADD CONSTRAINT "blueprint_job_items_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."blueprint_jobs"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."blueprint_jobs"
    ADD CONSTRAINT "blueprint_jobs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."blueprint_customers"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."blueprint_jobs"
    ADD CONSTRAINT "blueprint_jobs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."blueprint_projects"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."blueprint_projects"
    ADD CONSTRAINT "blueprint_projects_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."blueprint_customers"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_replaces_file_id_fkey" FOREIGN KEY ("replaces_file_id") REFERENCES "public"."files"("id");

ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");

ALTER TABLE ONLY "public"."erp_exports"
    ADD CONSTRAINT "erp_exports_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");

ALTER TABLE ONLY "public"."erp_exports"
    ADD CONSTRAINT "erp_exports_exported_by_fkey" FOREIGN KEY ("exported_by") REFERENCES "auth"."users"("id");

ALTER TABLE ONLY "public"."errors"
    ADD CONSTRAINT "errors_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."errors"
    ADD CONSTRAINT "errors_person_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");

ALTER TABLE ONLY "public"."errors"
    ADD CONSTRAINT "errors_sub_order_id_fkey" FOREIGN KEY ("sub_order_id") REFERENCES "public"."sub_orders"("id");

ALTER TABLE ONLY "public"."sub_orders"
    ADD CONSTRAINT "fk_approval_file" FOREIGN KEY ("customer_approval_file_id") REFERENCES "public"."files"("id");

ALTER TABLE ONLY "public"."history"
    ADD CONSTRAINT "history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."history"
    ADD CONSTRAINT "history_person_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");

ALTER TABLE ONLY "public"."history"
    ADD CONSTRAINT "history_sub_order_id_fkey" FOREIGN KEY ("sub_order_id") REFERENCES "public"."sub_orders"("id");

ALTER TABLE ONLY "public"."stamp_stock_movements"
    ADD CONSTRAINT "stamp_stock_movements_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."stamp_models"("id");

ALTER TABLE ONLY "public"."stamp_stock_movements"
    ADD CONSTRAINT "stamp_stock_movements_person_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");

ALTER TABLE ONLY "public"."product_files"
    ADD CONSTRAINT "product_files_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."product_files"
    ADD CONSTRAINT "product_files_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."sub_order_products"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."sub_orders"
    ADD CONSTRAINT "sub_orders_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."sub_orders"
    ADD CONSTRAINT "sub_orders_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "auth"."users"("id");

ALTER TABLE ONLY "public"."sub_order_products"
    ADD CONSTRAINT "sub_order_products_sub_order_id_fkey" FOREIGN KEY ("sub_order_id") REFERENCES "public"."sub_orders"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."textile_stock_movements"
    ADD CONSTRAINT "textile_stock_movements_person_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");

ALTER TABLE ONLY "public"."textile_stock_movements"
    ADD CONSTRAINT "textile_stock_movements_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."textile_variants"("id");

ALTER TABLE ONLY "public"."textile_motifs"
    ADD CONSTRAINT "textile_motifs_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id");

ALTER TABLE ONLY "public"."textile_motifs"
    ADD CONSTRAINT "textile_motifs_sub_order_id_fkey" FOREIGN KEY ("sub_order_id") REFERENCES "public"."sub_orders"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."textile_positions"
    ADD CONSTRAINT "textile_positions_sub_order_id_fkey" FOREIGN KEY ("sub_order_id") REFERENCES "public"."sub_orders"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."textile_positions"
    ADD CONSTRAINT "textile_positions_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."textile_variants"("id");

ALTER TABLE ONLY "public"."textile_products"
    ADD CONSTRAINT "textile_products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."textile_brands"("id");

ALTER TABLE ONLY "public"."textile_variants"
    ADD CONSTRAINT "textile_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."textile_products"("id");

ALTER TABLE ONLY "public"."textile_assignments"
    ADD CONSTRAINT "textile_assignments_motif_id_fkey" FOREIGN KEY ("motif_id") REFERENCES "public"."textile_motifs"("id");

ALTER TABLE ONLY "public"."textile_assignments"
    ADD CONSTRAINT "textile_assignments_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "public"."textile_positions"("id");

ALTER TABLE ONLY "public"."textile_assignments"
    ADD CONSTRAINT "textile_assignments_sub_order_id_fkey" FOREIGN KEY ("sub_order_id") REFERENCES "public"."sub_orders"("id") ON DELETE CASCADE;

CREATE POLICY "Employees: full access" ON "public"."orders" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."order_number_counter" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."files" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."erp_exports" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."errors" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."history" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."customers" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."stamp_stock_movements" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."product_files" USING (("auth"."role"() = 'authenticated'::"text"));

CREATE POLICY "Employees: full access" ON "public"."profiles" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."stamp_models" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."sub_orders" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."sub_order_products" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."textile_stock_movements" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."textile_brands" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."textile_motifs" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."textile_positions" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."textile_products" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."textile_variants" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."textile_assignments" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users only" ON "public"."blueprint_customers" USING (("auth"."role"() = 'authenticated'::"text"));

CREATE POLICY "Authenticated users only" ON "public"."blueprint_job_items" USING (("auth"."role"() = 'authenticated'::"text"));

CREATE POLICY "Authenticated users only" ON "public"."blueprint_jobs" USING (("auth"."role"() = 'authenticated'::"text"));

CREATE POLICY "Authenticated users only" ON "public"."blueprint_projects" USING (("auth"."role"() = 'authenticated'::"text"));

ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."order_number_counter" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."blueprint_customers" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."blueprint_job_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."blueprint_jobs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."blueprint_projects" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."files" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."erp_exports" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."errors" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."history" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."stamp_stock_movements" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."product_files" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."stamp_models" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."sub_orders" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."sub_order_products" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."textile_stock_movements" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."textile_brands" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."textile_motifs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."textile_positions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."textile_products" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."textile_variants" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."textile_assignments" ENABLE ROW LEVEL SECURITY;

ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

GRANT ALL ON FUNCTION "public"."check_textile_placement_conflict"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_textile_placement_conflict"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_textile_placement_conflict"() TO "service_role";

GRANT ALL ON FUNCTION "public"."duplicate_order"("source_order_id" "uuid", "new_priority" "text", "new_delivery" "text", "new_deadline" "date", "selected_sub_order_ids" "uuid"[], "created_by_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."duplicate_order"("source_order_id" "uuid", "new_priority" "text", "new_delivery" "text", "new_deadline" "date", "selected_sub_order_ids" "uuid"[], "created_by_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."duplicate_order"("source_order_id" "uuid", "new_priority" "text", "new_delivery" "text", "new_deadline" "date", "selected_sub_order_ids" "uuid"[], "created_by_user_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."fn_calculate_order_status"("target_order_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_calculate_order_status"("target_order_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_calculate_order_status"("target_order_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."fn_check_file_versioning_order"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_check_file_versioning_order"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_check_file_versioning_order"() TO "service_role";

GRANT ALL ON FUNCTION "public"."fn_check_approval_file_order"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_check_approval_file_order"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_check_approval_file_order"() TO "service_role";

GRANT ALL ON FUNCTION "public"."fn_check_sub_order_belongs_to_order"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_check_sub_order_belongs_to_order"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_check_sub_order_belongs_to_order"() TO "service_role";

GRANT ALL ON FUNCTION "public"."fn_check_sub_order_type"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_check_sub_order_type"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_check_sub_order_type"() TO "service_role";

GRANT ALL ON FUNCTION "public"."fn_check_textile_motif_file"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_check_textile_motif_file"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_check_textile_motif_file"() TO "service_role";

GRANT ALL ON FUNCTION "public"."fn_check_textile_assignment_consistency"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_check_textile_assignment_consistency"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_check_textile_assignment_consistency"() TO "service_role";

GRANT ALL ON FUNCTION "public"."fn_generate_order_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_generate_order_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_generate_order_number"() TO "service_role";

GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";

GRANT ALL ON TABLE "public"."order_number_counter" TO "anon";
GRANT ALL ON TABLE "public"."order_number_counter" TO "authenticated";
GRANT ALL ON TABLE "public"."order_number_counter" TO "service_role";

GRANT ALL ON TABLE "public"."blueprint_customers" TO "anon";
GRANT ALL ON TABLE "public"."blueprint_customers" TO "authenticated";
GRANT ALL ON TABLE "public"."blueprint_customers" TO "service_role";

GRANT ALL ON TABLE "public"."blueprint_job_items" TO "anon";
GRANT ALL ON TABLE "public"."blueprint_job_items" TO "authenticated";
GRANT ALL ON TABLE "public"."blueprint_job_items" TO "service_role";

GRANT ALL ON TABLE "public"."blueprint_jobs" TO "anon";
GRANT ALL ON TABLE "public"."blueprint_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."blueprint_jobs" TO "service_role";

GRANT ALL ON TABLE "public"."blueprint_projects" TO "anon";
GRANT ALL ON TABLE "public"."blueprint_projects" TO "authenticated";
GRANT ALL ON TABLE "public"."blueprint_projects" TO "service_role";

GRANT ALL ON TABLE "public"."files" TO "anon";
GRANT ALL ON TABLE "public"."files" TO "authenticated";
GRANT ALL ON TABLE "public"."files" TO "service_role";

GRANT ALL ON TABLE "public"."erp_exports" TO "anon";
GRANT ALL ON TABLE "public"."erp_exports" TO "authenticated";
GRANT ALL ON TABLE "public"."erp_exports" TO "service_role";

GRANT ALL ON TABLE "public"."errors" TO "anon";
GRANT ALL ON TABLE "public"."errors" TO "authenticated";
GRANT ALL ON TABLE "public"."errors" TO "service_role";

GRANT ALL ON TABLE "public"."history" TO "anon";
GRANT ALL ON TABLE "public"."history" TO "authenticated";
GRANT ALL ON TABLE "public"."history" TO "service_role";

GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";

GRANT ALL ON TABLE "public"."stamp_stock_movements" TO "anon";
GRANT ALL ON TABLE "public"."stamp_stock_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."stamp_stock_movements" TO "service_role";

GRANT ALL ON TABLE "public"."employees" TO "anon";
GRANT ALL ON TABLE "public"."employees" TO "authenticated";
GRANT ALL ON TABLE "public"."employees" TO "service_role";

GRANT ALL ON TABLE "public"."product_files" TO "anon";
GRANT ALL ON TABLE "public"."product_files" TO "authenticated";
GRANT ALL ON TABLE "public"."product_files" TO "service_role";

GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";

GRANT ALL ON TABLE "public"."stamp_models" TO "anon";
GRANT ALL ON TABLE "public"."stamp_models" TO "authenticated";
GRANT ALL ON TABLE "public"."stamp_models" TO "service_role";

GRANT ALL ON TABLE "public"."sub_orders" TO "anon";
GRANT ALL ON TABLE "public"."sub_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."sub_orders" TO "service_role";

GRANT ALL ON TABLE "public"."sub_order_products" TO "anon";
GRANT ALL ON TABLE "public"."sub_order_products" TO "authenticated";
GRANT ALL ON TABLE "public"."sub_order_products" TO "service_role";

GRANT ALL ON TABLE "public"."textile_stock_movements" TO "anon";
GRANT ALL ON TABLE "public"."textile_stock_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."textile_stock_movements" TO "service_role";

GRANT ALL ON TABLE "public"."textile_brands" TO "anon";
GRANT ALL ON TABLE "public"."textile_brands" TO "authenticated";
GRANT ALL ON TABLE "public"."textile_brands" TO "service_role";

GRANT ALL ON TABLE "public"."textile_motifs" TO "anon";
GRANT ALL ON TABLE "public"."textile_motifs" TO "authenticated";
GRANT ALL ON TABLE "public"."textile_motifs" TO "service_role";

GRANT ALL ON TABLE "public"."textile_positions" TO "anon";
GRANT ALL ON TABLE "public"."textile_positions" TO "authenticated";
GRANT ALL ON TABLE "public"."textile_positions" TO "service_role";

GRANT ALL ON TABLE "public"."textile_products" TO "anon";
GRANT ALL ON TABLE "public"."textile_products" TO "authenticated";
GRANT ALL ON TABLE "public"."textile_products" TO "service_role";

GRANT ALL ON TABLE "public"."textile_variants" TO "anon";
GRANT ALL ON TABLE "public"."textile_variants" TO "authenticated";
GRANT ALL ON TABLE "public"."textile_variants" TO "service_role";

GRANT ALL ON TABLE "public"."textile_assignments" TO "anon";
GRANT ALL ON TABLE "public"."textile_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."textile_assignments" TO "service_role";

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
