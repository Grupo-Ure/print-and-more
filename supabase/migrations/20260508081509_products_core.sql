-- 20260508081509_products_core.sql — department_products parent + product_files junction
-- Split from baseline 20260508081503_remote_schema.sql (delete that file once verified).

CREATE TABLE IF NOT EXISTS "public"."product_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "department_product_id" "uuid" NOT NULL,
    "file_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."product_files" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."department_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "department_order_id" "uuid" NOT NULL,
    "department" "text" NOT NULL,
    "type" "text" NOT NULL,
    "quantity" integer,
    "notes" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."department_products" OWNER TO "postgres";

ALTER TABLE ONLY "public"."product_files"
    ADD CONSTRAINT "product_files_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."product_files"
    ADD CONSTRAINT "product_files_department_product_id_file_id_key" UNIQUE ("department_product_id", "file_id");

ALTER TABLE ONLY "public"."department_products"
    ADD CONSTRAINT "department_products_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."product_files"
    ADD CONSTRAINT "product_files_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."product_files"
    ADD CONSTRAINT "product_files_department_product_id_fkey" FOREIGN KEY ("department_product_id") REFERENCES "public"."department_products"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."department_products"
    ADD CONSTRAINT "department_products_department_order_id_fkey" FOREIGN KEY ("department_order_id") REFERENCES "public"."department_orders"("id") ON DELETE CASCADE;

CREATE INDEX "idx_department_products_order" ON "public"."department_products" USING "btree" ("department_order_id");

CREATE INDEX "product_files_file_id_idx" ON "public"."product_files" USING "btree" ("file_id");

CREATE INDEX "product_files_department_product_id_idx" ON "public"."product_files" USING "btree" ("department_product_id");

CREATE POLICY "Employees: full access" ON "public"."product_files" USING (("auth"."role"() = 'authenticated'::"text"));

CREATE POLICY "Employees: full access" ON "public"."department_products" TO "authenticated" USING (true) WITH CHECK (true);

ALTER TABLE "public"."product_files" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."department_products" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "public"."product_files" TO "anon";

GRANT ALL ON TABLE "public"."product_files" TO "authenticated";

GRANT ALL ON TABLE "public"."product_files" TO "service_role";

GRANT ALL ON TABLE "public"."department_products" TO "anon";

GRANT ALL ON TABLE "public"."department_products" TO "authenticated";

GRANT ALL ON TABLE "public"."department_products" TO "service_role";
