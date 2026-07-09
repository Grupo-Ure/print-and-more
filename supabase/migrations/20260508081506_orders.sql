-- 20260508081506_orders.sql — orders, order_number_counter, files, erp_exports (+ order/file fns)
-- Split from baseline 20260508081503_remote_schema.sql (delete that file once verified).

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

CREATE TABLE IF NOT EXISTS "public"."order_number_counter" (
    "year" integer NOT NULL,
    "month" integer NOT NULL,
    "last_value" integer DEFAULT 0 NOT NULL
);

ALTER TABLE "public"."order_number_counter" OWNER TO "postgres";

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

/**
 * Trigger guard: a file's version chain must stay within one order.
 * If `replaces_file_id` is set, the replaced file must belong to the same
 * `order_id` as the new file.
 *
 * @trigger BEFORE INSERT OR UPDATE OF replaces_file_id, order_id ON files (per row)
 * @raises when the replaced file belongs to a different order.
 */
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

/**
 * Trigger: assigns `orders.order_number` as `YYYY-MM-NNNN`, where NNNN is a
 * per-month sequence. Uses an atomic INSERT ... ON CONFLICT DO UPDATE on
 * `order_number_counter`, so concurrent inserts never collide; the counter
 * restarts at 1 each calendar month.
 *
 * @trigger BEFORE INSERT ON orders (per row)
 */
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

ALTER FUNCTION "public"."fn_check_file_versioning_order"() OWNER TO "postgres";

ALTER FUNCTION "public"."fn_generate_order_number"() OWNER TO "postgres";

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_order_number_key" UNIQUE ("order_number");

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."order_number_counter"
    ADD CONSTRAINT "order_number_counter_pkey" PRIMARY KEY ("year", "month");

ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."erp_exports"
    ADD CONSTRAINT "erp_exports_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");

ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_replaces_file_id_fkey" FOREIGN KEY ("replaces_file_id") REFERENCES "public"."files"("id");

ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."erp_exports"
    ADD CONSTRAINT "erp_exports_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");

ALTER TABLE ONLY "public"."erp_exports"
    ADD CONSTRAINT "erp_exports_exported_by_fkey" FOREIGN KEY ("exported_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;

CREATE INDEX "idx_orders_archived" ON "public"."orders" USING "btree" ("is_archived");

CREATE INDEX "idx_orders_created_at" ON "public"."orders" USING "btree" ("created_at");

CREATE INDEX "idx_orders_customer_id" ON "public"."orders" USING "btree" ("customer_id");

CREATE INDEX "idx_orders_status" ON "public"."orders" USING "btree" ("status");

CREATE INDEX "idx_orders_deadline" ON "public"."orders" USING "btree" ("deadline");

CREATE INDEX "idx_files_order_id" ON "public"."files" USING "btree" ("order_id");

CREATE INDEX "idx_erp_exports_order_id" ON "public"."erp_exports" USING "btree" ("order_id");

CREATE OR REPLACE TRIGGER "trg_order_number" BEFORE INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."fn_generate_order_number"();

CREATE OR REPLACE TRIGGER "trg_file_versioning_order_check" BEFORE INSERT OR UPDATE OF "replaces_file_id", "order_id" ON "public"."files" FOR EACH ROW EXECUTE FUNCTION "public"."fn_check_file_versioning_order"();

CREATE POLICY "Employees: full access" ON "public"."orders" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."order_number_counter" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."files" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."erp_exports" TO "authenticated" USING (true) WITH CHECK (true);

ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."order_number_counter" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."files" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."erp_exports" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON FUNCTION "public"."fn_check_file_versioning_order"() TO "anon";

GRANT ALL ON FUNCTION "public"."fn_check_file_versioning_order"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."fn_check_file_versioning_order"() TO "service_role";

GRANT ALL ON FUNCTION "public"."fn_generate_order_number"() TO "anon";

GRANT ALL ON FUNCTION "public"."fn_generate_order_number"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."fn_generate_order_number"() TO "service_role";

GRANT ALL ON TABLE "public"."orders" TO "anon";

GRANT ALL ON TABLE "public"."orders" TO "authenticated";

GRANT ALL ON TABLE "public"."orders" TO "service_role";

GRANT ALL ON TABLE "public"."order_number_counter" TO "anon";

GRANT ALL ON TABLE "public"."order_number_counter" TO "authenticated";

GRANT ALL ON TABLE "public"."order_number_counter" TO "service_role";

GRANT ALL ON TABLE "public"."files" TO "anon";

GRANT ALL ON TABLE "public"."files" TO "authenticated";

GRANT ALL ON TABLE "public"."files" TO "service_role";

GRANT ALL ON TABLE "public"."erp_exports" TO "anon";

GRANT ALL ON TABLE "public"."erp_exports" TO "authenticated";

GRANT ALL ON TABLE "public"."erp_exports" TO "service_role";

COMMENT ON FUNCTION "public"."fn_generate_order_number"() IS 'Atomic monthly counter using INSERT ... ON CONFLICT DO UPDATE. No race condition on concurrent inserts. Resets counter to 1 each month.';

COMMENT ON TABLE "public"."orders" IS 'Central aggregate. status is set by application convention via calculateOrderStatus() in src/lib/orderStatus.ts — the DB does not enforce this. Direct SQL updates to status are intentionally allowed for emergency migrations.';

COMMENT ON COLUMN "public"."orders"."deadline" IS 'Overall deadline as a commercial frame. jobs.deadline is operationally leading and may differ — no automatic sync (V1 domain model, intentional decision).';

COMMENT ON TABLE "public"."order_number_counter" IS 'Monthly counter for order numbers. One row per year+month. Written exclusively via fn_generate_order_number(). Direct UPDATEs are forbidden — they would corrupt the numbering sequence.';

COMMENT ON TABLE "public"."files" IS 'Always attached to an order, never to a job. No file upload — network path only. replaces_file_id: empty in V1, trigger already enforces same order.';
