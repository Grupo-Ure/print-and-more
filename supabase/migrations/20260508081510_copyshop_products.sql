-- 20260508081510_copyshop_products.sql — CopyShop product type tables
-- Split from baseline 20260508081503_remote_schema.sql (delete that file once verified).

CREATE TABLE IF NOT EXISTS "public"."poster_products" (
    "department_product_id" "uuid" NOT NULL,
    "format" "text",
    "width" integer,
    "height" integer,
    "material" "text",
    "laminate" "text",
    CONSTRAINT "poster_products_pkey" PRIMARY KEY ("department_product_id"),
    CONSTRAINT "poster_products_department_product_id_fkey" FOREIGN KEY ("department_product_id") REFERENCES "public"."department_products"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."poster_products" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."card_flyer_products" (
    "department_product_id" "uuid" NOT NULL,
    "format" "text",
    "width" integer,
    "height" integer,
    "color_mode" "text",
    "full_bleed" boolean,
    "production_path" "text",
    "cc_material" "text",
    "cc_material_other" "text",
    "offset_type" "text",
    "offset_weight" "text",
    "offset_finish" "text",
    "special_paper" "text",
    "special_paper_other" "text",
    "lamination_finish" "text",
    "lamination_sides" "text",
    "recycling_weight" "text",
    CONSTRAINT "card_flyer_products_pkey" PRIMARY KEY ("department_product_id"),
    CONSTRAINT "card_flyer_products_department_product_id_fkey" FOREIGN KEY ("department_product_id") REFERENCES "public"."department_products"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."card_flyer_products" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."folded_flyer_products" (
    "department_product_id" "uuid" NOT NULL,
    "format" "text",
    "width" integer,
    "height" integer,
    "color_mode" "text",
    "full_bleed" boolean,
    "production_path" "text",
    "cc_material" "text",
    "cc_material_other" "text",
    "offset_type" "text",
    "offset_weight" "text",
    "offset_finish" "text",
    "special_paper" "text",
    "special_paper_other" "text",
    "lamination_finish" "text",
    "lamination_sides" "text",
    "recycling_weight" "text",
    "fold_type" "text",
    "page_count" integer,
    CONSTRAINT "folded_flyer_products_pkey" PRIMARY KEY ("department_product_id"),
    CONSTRAINT "folded_flyer_products_department_product_id_fkey" FOREIGN KEY ("department_product_id") REFERENCES "public"."department_products"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."folded_flyer_products" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."brochure_products" (
    "department_product_id" "uuid" NOT NULL,
    "format" "text",
    "width" integer,
    "height" integer,
    "orientation" "text",
    "page_count" integer,
    "full_bleed" boolean,
    "production_path" "text",
    "cover_material" "text",
    "cover_material_other" "text",
    "inner_material" "text",
    "inner_material_other" "text",
    "binding" "text",
    "cover_weight" "text",
    "cover_finish" "text",
    "inner_weight" "text",
    "inner_finish" "text",
    CONSTRAINT "brochure_products_pkey" PRIMARY KEY ("department_product_id"),
    CONSTRAINT "brochure_products_department_product_id_fkey" FOREIGN KEY ("department_product_id") REFERENCES "public"."department_products"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."brochure_products" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."business_card_products" (
    "department_product_id" "uuid" NOT NULL,
    "format" "text",
    "width" integer,
    "height" integer,
    "orientation" "text",
    "color_mode" "text",
    "material" "text",
    "film_laminated" boolean,
    "multiloft_color" "text",
    "full_bleed" boolean,
    CONSTRAINT "business_card_products_pkey" PRIMARY KEY ("department_product_id"),
    CONSTRAINT "business_card_products_department_product_id_fkey" FOREIGN KEY ("department_product_id") REFERENCES "public"."department_products"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."business_card_products" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."binding_products" (
    "department_product_id" "uuid" NOT NULL,
    "format" "text",
    "width" integer,
    "height" integer,
    "orientation" "text",
    "material" "text",
    "material_other" "text",
    "color_mode" "text",
    "binding_type" "text",
    "binding_color" "text",
    "full_bleed" boolean,
    "hardcover_print" boolean,
    "hardcover_cover" "text",
    CONSTRAINT "binding_products_pkey" PRIMARY KEY ("department_product_id"),
    CONSTRAINT "binding_products_department_product_id_fkey" FOREIGN KEY ("department_product_id") REFERENCES "public"."department_products"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."binding_products" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."printout_products" (
    "department_product_id" "uuid" NOT NULL,
    "format" "text",
    "material" "text",
    "material_other" "text",
    "color_mode" "text",
    "punching" "text",
    "staple" boolean,
    "laminate" "text",
    CONSTRAINT "printout_products_pkey" PRIMARY KEY ("department_product_id"),
    CONSTRAINT "printout_products_department_product_id_fkey" FOREIGN KEY ("department_product_id") REFERENCES "public"."department_products"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."printout_products" OWNER TO "postgres";

ALTER TABLE "public"."poster_products" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees: full access" ON "public"."poster_products" TO "authenticated" USING (true) WITH CHECK (true);

ALTER TABLE "public"."card_flyer_products" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees: full access" ON "public"."card_flyer_products" TO "authenticated" USING (true) WITH CHECK (true);

ALTER TABLE "public"."folded_flyer_products" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees: full access" ON "public"."folded_flyer_products" TO "authenticated" USING (true) WITH CHECK (true);

ALTER TABLE "public"."brochure_products" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees: full access" ON "public"."brochure_products" TO "authenticated" USING (true) WITH CHECK (true);

ALTER TABLE "public"."business_card_products" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees: full access" ON "public"."business_card_products" TO "authenticated" USING (true) WITH CHECK (true);

ALTER TABLE "public"."binding_products" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees: full access" ON "public"."binding_products" TO "authenticated" USING (true) WITH CHECK (true);

ALTER TABLE "public"."printout_products" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees: full access" ON "public"."printout_products" TO "authenticated" USING (true) WITH CHECK (true);

GRANT ALL ON TABLE "public"."poster_products" TO "anon";

GRANT ALL ON TABLE "public"."poster_products" TO "authenticated";

GRANT ALL ON TABLE "public"."poster_products" TO "service_role";

GRANT ALL ON TABLE "public"."card_flyer_products" TO "anon";

GRANT ALL ON TABLE "public"."card_flyer_products" TO "authenticated";

GRANT ALL ON TABLE "public"."card_flyer_products" TO "service_role";

GRANT ALL ON TABLE "public"."folded_flyer_products" TO "anon";

GRANT ALL ON TABLE "public"."folded_flyer_products" TO "authenticated";

GRANT ALL ON TABLE "public"."folded_flyer_products" TO "service_role";

GRANT ALL ON TABLE "public"."brochure_products" TO "anon";

GRANT ALL ON TABLE "public"."brochure_products" TO "authenticated";

GRANT ALL ON TABLE "public"."brochure_products" TO "service_role";

GRANT ALL ON TABLE "public"."business_card_products" TO "anon";

GRANT ALL ON TABLE "public"."business_card_products" TO "authenticated";

GRANT ALL ON TABLE "public"."business_card_products" TO "service_role";

GRANT ALL ON TABLE "public"."binding_products" TO "anon";

GRANT ALL ON TABLE "public"."binding_products" TO "authenticated";

GRANT ALL ON TABLE "public"."binding_products" TO "service_role";

GRANT ALL ON TABLE "public"."printout_products" TO "anon";

GRANT ALL ON TABLE "public"."printout_products" TO "authenticated";

GRANT ALL ON TABLE "public"."printout_products" TO "service_role";
