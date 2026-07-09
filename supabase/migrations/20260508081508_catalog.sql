-- 20260508081508_catalog.sql — stamp + textile master data
-- Split from baseline 20260508081503_remote_schema.sql (delete that file once verified).

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

ALTER TABLE ONLY "public"."stamp_stock_movements"
    ADD CONSTRAINT "stamp_stock_movements_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."stamp_models"
    ADD CONSTRAINT "stamp_models_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."textile_stock_movements"
    ADD CONSTRAINT "textile_stock_movements_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."textile_brands"
    ADD CONSTRAINT "textile_brands_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."textile_products"
    ADD CONSTRAINT "textile_products_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."textile_variants"
    ADD CONSTRAINT "textile_variants_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."stamp_stock_movements"
    ADD CONSTRAINT "stamp_stock_movements_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."stamp_models"("id");

ALTER TABLE ONLY "public"."stamp_stock_movements"
    ADD CONSTRAINT "stamp_stock_movements_person_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."textile_stock_movements"
    ADD CONSTRAINT "textile_stock_movements_person_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."textile_stock_movements"
    ADD CONSTRAINT "textile_stock_movements_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."textile_variants"("id");

ALTER TABLE ONLY "public"."textile_products"
    ADD CONSTRAINT "textile_products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."textile_brands"("id");

ALTER TABLE ONLY "public"."textile_variants"
    ADD CONSTRAINT "textile_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."textile_products"("id");

CREATE INDEX "idx_stamp_stock_movements_created" ON "public"."stamp_stock_movements" USING "btree" ("created_at");

CREATE INDEX "idx_stamp_stock_movements_model" ON "public"."stamp_stock_movements" USING "btree" ("model_id");

CREATE INDEX "idx_stamp_models_active" ON "public"."stamp_models" USING "btree" ("is_active");

CREATE INDEX "idx_stamp_models_type" ON "public"."stamp_models" USING "btree" ("type");

CREATE INDEX "idx_textile_stock_movements_created" ON "public"."textile_stock_movements" USING "btree" ("created_at");

CREATE INDEX "idx_textile_stock_movements_variant" ON "public"."textile_stock_movements" USING "btree" ("variant_id");

CREATE POLICY "Employees: full access" ON "public"."stamp_stock_movements" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."stamp_models" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."textile_stock_movements" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."textile_brands" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."textile_products" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."textile_variants" TO "authenticated" USING (true) WITH CHECK (true);

ALTER TABLE "public"."stamp_stock_movements" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."stamp_models" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."textile_stock_movements" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."textile_brands" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."textile_products" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."textile_variants" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "public"."stamp_stock_movements" TO "anon";

GRANT ALL ON TABLE "public"."stamp_stock_movements" TO "authenticated";

GRANT ALL ON TABLE "public"."stamp_stock_movements" TO "service_role";

GRANT ALL ON TABLE "public"."stamp_models" TO "anon";

GRANT ALL ON TABLE "public"."stamp_models" TO "authenticated";

GRANT ALL ON TABLE "public"."stamp_models" TO "service_role";

GRANT ALL ON TABLE "public"."textile_stock_movements" TO "anon";

GRANT ALL ON TABLE "public"."textile_stock_movements" TO "authenticated";

GRANT ALL ON TABLE "public"."textile_stock_movements" TO "service_role";

GRANT ALL ON TABLE "public"."textile_brands" TO "anon";

GRANT ALL ON TABLE "public"."textile_brands" TO "authenticated";

GRANT ALL ON TABLE "public"."textile_brands" TO "service_role";

GRANT ALL ON TABLE "public"."textile_products" TO "anon";

GRANT ALL ON TABLE "public"."textile_products" TO "authenticated";

GRANT ALL ON TABLE "public"."textile_products" TO "service_role";

GRANT ALL ON TABLE "public"."textile_variants" TO "anon";

GRANT ALL ON TABLE "public"."textile_variants" TO "authenticated";

GRANT ALL ON TABLE "public"."textile_variants" TO "service_role";
