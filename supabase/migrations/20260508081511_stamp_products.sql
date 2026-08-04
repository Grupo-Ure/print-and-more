-- 20260508081511_stamp_products.sql — Stamp product type tables
-- Split from baseline 20260508081503_remote_schema.sql (delete that file once verified).

CREATE TABLE IF NOT EXISTS "public"."trodat_printy_products" (
    "department_product_id" "uuid" NOT NULL,
    "model_id" "uuid",
    "color" "text",
    "color_other" "text",
    "description" "text",
    CONSTRAINT "trodat_printy_products_pkey" PRIMARY KEY ("department_product_id"),
    CONSTRAINT "trodat_printy_products_department_product_id_fkey" FOREIGN KEY ("department_product_id") REFERENCES "public"."department_products"("id") ON DELETE CASCADE,
    CONSTRAINT "trodat_printy_products_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."stamp_models"("id") ON DELETE SET NULL,
    CONSTRAINT "trodat_printy_products_color_fkey" FOREIGN KEY ("color") REFERENCES "public"."stamp_ink_colors"("code")
);

ALTER TABLE "public"."trodat_printy_products" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."wooden_stamp_products" (
    "department_product_id" "uuid" NOT NULL,
    "model_id" "uuid",
    "color" "text",
    "color_other" "text",
    "description" "text",
    CONSTRAINT "wooden_stamp_products_pkey" PRIMARY KEY ("department_product_id"),
    CONSTRAINT "wooden_stamp_products_department_product_id_fkey" FOREIGN KEY ("department_product_id") REFERENCES "public"."department_products"("id") ON DELETE CASCADE,
    CONSTRAINT "wooden_stamp_products_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."stamp_models"("id") ON DELETE SET NULL,
    CONSTRAINT "wooden_stamp_products_color_fkey" FOREIGN KEY ("color") REFERENCES "public"."stamp_ink_colors"("code")
);

ALTER TABLE "public"."wooden_stamp_products" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."stand_stamp_products" (
    "department_product_id" "uuid" NOT NULL,
    "width" integer,
    "height" integer,
    "color" "text",
    "color_other" "text",
    "description" "text",
    CONSTRAINT "stand_stamp_products_pkey" PRIMARY KEY ("department_product_id"),
    CONSTRAINT "stand_stamp_products_department_product_id_fkey" FOREIGN KEY ("department_product_id") REFERENCES "public"."department_products"("id") ON DELETE CASCADE,
    CONSTRAINT "stand_stamp_products_color_fkey" FOREIGN KEY ("color") REFERENCES "public"."stamp_ink_colors"("code")
);

ALTER TABLE "public"."stand_stamp_products" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."date_stamp_products" (
    "department_product_id" "uuid" NOT NULL,
    "width" integer,
    "height" integer,
    "color" "text",
    "color_other" "text",
    "description" "text",
    CONSTRAINT "date_stamp_products_pkey" PRIMARY KEY ("department_product_id"),
    CONSTRAINT "date_stamp_products_department_product_id_fkey" FOREIGN KEY ("department_product_id") REFERENCES "public"."department_products"("id") ON DELETE CASCADE,
    CONSTRAINT "date_stamp_products_color_fkey" FOREIGN KEY ("color") REFERENCES "public"."stamp_ink_colors"("code")
);

ALTER TABLE "public"."date_stamp_products" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."other_stamp_products" (
    "department_product_id" "uuid" NOT NULL,
    "width" integer,
    "height" integer,
    "color" "text",
    "color_other" "text",
    "description" "text",
    CONSTRAINT "other_stamp_products_pkey" PRIMARY KEY ("department_product_id"),
    CONSTRAINT "other_stamp_products_department_product_id_fkey" FOREIGN KEY ("department_product_id") REFERENCES "public"."department_products"("id") ON DELETE CASCADE,
    CONSTRAINT "other_stamp_products_color_fkey" FOREIGN KEY ("color") REFERENCES "public"."stamp_ink_colors"("code")
);

ALTER TABLE "public"."other_stamp_products" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."stamp_plate_products" (
    "department_product_id" "uuid" NOT NULL,
    "width" integer,
    "height" integer,
    CONSTRAINT "stamp_plate_products_pkey" PRIMARY KEY ("department_product_id"),
    CONSTRAINT "stamp_plate_products_department_product_id_fkey" FOREIGN KEY ("department_product_id") REFERENCES "public"."department_products"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."stamp_plate_products" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."refill_ink_products" (
    "department_product_id" "uuid" NOT NULL,
    "color" "text",
    "ink_type" "text",
    CONSTRAINT "refill_ink_products_pkey" PRIMARY KEY ("department_product_id"),
    CONSTRAINT "refill_ink_products_department_product_id_fkey" FOREIGN KEY ("department_product_id") REFERENCES "public"."department_products"("id") ON DELETE CASCADE,
    CONSTRAINT "refill_ink_products_color_fkey" FOREIGN KEY ("color") REFERENCES "public"."stamp_ink_colors"("code")
);

ALTER TABLE "public"."refill_ink_products" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."ink_pad_products" (
    "department_product_id" "uuid" NOT NULL,
    "pad_size" "text",
    "color" "text",
    CONSTRAINT "ink_pad_products_pkey" PRIMARY KEY ("department_product_id"),
    CONSTRAINT "ink_pad_products_department_product_id_fkey" FOREIGN KEY ("department_product_id") REFERENCES "public"."department_products"("id") ON DELETE CASCADE,
    CONSTRAINT "ink_pad_products_color_fkey" FOREIGN KEY ("color") REFERENCES "public"."stamp_ink_colors"("code"),
    CONSTRAINT "ink_pad_products_pad_size_check" CHECK (("pad_size" = ANY (ARRAY['SMALL'::"text", 'MEDIUM'::"text", 'LARGE'::"text"])))
);

ALTER TABLE "public"."ink_pad_products" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."trodat_pad_products" (
    "department_product_id" "uuid" NOT NULL,
    "pad_article_number" "text",
    "pad_variant_id" "uuid",
    "color" "text",
    CONSTRAINT "trodat_pad_products_pkey" PRIMARY KEY ("department_product_id"),
    CONSTRAINT "trodat_pad_products_department_product_id_fkey" FOREIGN KEY ("department_product_id") REFERENCES "public"."department_products"("id") ON DELETE CASCADE,
    CONSTRAINT "trodat_pad_products_pad_variant_id_fkey" FOREIGN KEY ("pad_variant_id") REFERENCES "public"."stamp_models"("id") ON DELETE SET NULL,
    CONSTRAINT "trodat_pad_products_color_fkey" FOREIGN KEY ("color") REFERENCES "public"."stamp_ink_colors"("code")
);

ALTER TABLE "public"."trodat_pad_products" OWNER TO "postgres";

ALTER TABLE "public"."trodat_printy_products" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees: full access" ON "public"."trodat_printy_products" TO "authenticated" USING (true) WITH CHECK (true);

ALTER TABLE "public"."wooden_stamp_products" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees: full access" ON "public"."wooden_stamp_products" TO "authenticated" USING (true) WITH CHECK (true);

ALTER TABLE "public"."stand_stamp_products" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees: full access" ON "public"."stand_stamp_products" TO "authenticated" USING (true) WITH CHECK (true);

ALTER TABLE "public"."date_stamp_products" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees: full access" ON "public"."date_stamp_products" TO "authenticated" USING (true) WITH CHECK (true);

ALTER TABLE "public"."other_stamp_products" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees: full access" ON "public"."other_stamp_products" TO "authenticated" USING (true) WITH CHECK (true);

ALTER TABLE "public"."stamp_plate_products" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees: full access" ON "public"."stamp_plate_products" TO "authenticated" USING (true) WITH CHECK (true);

ALTER TABLE "public"."refill_ink_products" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees: full access" ON "public"."refill_ink_products" TO "authenticated" USING (true) WITH CHECK (true);

ALTER TABLE "public"."ink_pad_products" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees: full access" ON "public"."ink_pad_products" TO "authenticated" USING (true) WITH CHECK (true);

ALTER TABLE "public"."trodat_pad_products" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees: full access" ON "public"."trodat_pad_products" TO "authenticated" USING (true) WITH CHECK (true);

GRANT ALL ON TABLE "public"."trodat_printy_products" TO "anon";

GRANT ALL ON TABLE "public"."trodat_printy_products" TO "authenticated";

GRANT ALL ON TABLE "public"."trodat_printy_products" TO "service_role";

GRANT ALL ON TABLE "public"."wooden_stamp_products" TO "anon";

GRANT ALL ON TABLE "public"."wooden_stamp_products" TO "authenticated";

GRANT ALL ON TABLE "public"."wooden_stamp_products" TO "service_role";

GRANT ALL ON TABLE "public"."stand_stamp_products" TO "anon";

GRANT ALL ON TABLE "public"."stand_stamp_products" TO "authenticated";

GRANT ALL ON TABLE "public"."stand_stamp_products" TO "service_role";

GRANT ALL ON TABLE "public"."date_stamp_products" TO "anon";

GRANT ALL ON TABLE "public"."date_stamp_products" TO "authenticated";

GRANT ALL ON TABLE "public"."date_stamp_products" TO "service_role";

GRANT ALL ON TABLE "public"."other_stamp_products" TO "anon";

GRANT ALL ON TABLE "public"."other_stamp_products" TO "authenticated";

GRANT ALL ON TABLE "public"."other_stamp_products" TO "service_role";

GRANT ALL ON TABLE "public"."stamp_plate_products" TO "anon";

GRANT ALL ON TABLE "public"."stamp_plate_products" TO "authenticated";

GRANT ALL ON TABLE "public"."stamp_plate_products" TO "service_role";

GRANT ALL ON TABLE "public"."refill_ink_products" TO "anon";

GRANT ALL ON TABLE "public"."refill_ink_products" TO "authenticated";

GRANT ALL ON TABLE "public"."refill_ink_products" TO "service_role";

GRANT ALL ON TABLE "public"."ink_pad_products" TO "anon";

GRANT ALL ON TABLE "public"."ink_pad_products" TO "authenticated";

GRANT ALL ON TABLE "public"."ink_pad_products" TO "service_role";

GRANT ALL ON TABLE "public"."trodat_pad_products" TO "anon";

GRANT ALL ON TABLE "public"."trodat_pad_products" TO "authenticated";

GRANT ALL ON TABLE "public"."trodat_pad_products" TO "service_role";
