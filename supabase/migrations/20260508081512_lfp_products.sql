-- 20260508081512_lfp_products.sql — LFP product type tables
-- Split from baseline 20260508081503_remote_schema.sql (delete that file once verified).

CREATE TABLE IF NOT EXISTS "public"."sticker_products" (
    "department_product_id" "uuid" NOT NULL,
    "material" "text",
    "material_variant" "text",
    "contour_cut" "text",
    "laminate" "text",
    "output" "text",
    "width" numeric,
    "height" numeric,
    CONSTRAINT "sticker_products_pkey" PRIMARY KEY ("department_product_id"),
    CONSTRAINT "sticker_products_department_product_id_fkey" FOREIGN KEY ("department_product_id") REFERENCES "public"."department_products"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."sticker_products" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."sign_uv_products" (
    "department_product_id" "uuid" NOT NULL,
    "material" "text",
    "print_side" "text",
    "acrylic_print_direction" "text",
    "width" numeric,
    "height" numeric,
    "round_corners" boolean,
    "drill_holes" boolean,
    "drill_hole_diameter" integer,
    "drill_hole_position" "text",
    CONSTRAINT "sign_uv_products_pkey" PRIMARY KEY ("department_product_id"),
    CONSTRAINT "sign_uv_products_department_product_id_fkey" FOREIGN KEY ("department_product_id") REFERENCES "public"."department_products"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."sign_uv_products" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."sign_foil_products" (
    "department_product_id" "uuid" NOT NULL,
    "material" "text",
    "laminate" "text",
    "print_side" "text",
    "width" numeric,
    "height" numeric,
    "round_corners" boolean,
    "drill_holes" boolean,
    "drill_hole_diameter" integer,
    "drill_hole_position" "text",
    CONSTRAINT "sign_foil_products_pkey" PRIMARY KEY ("department_product_id"),
    CONSTRAINT "sign_foil_products_department_product_id_fkey" FOREIGN KEY ("department_product_id") REFERENCES "public"."department_products"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."sign_foil_products" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."foil_plotter_products" (
    "department_product_id" "uuid" NOT NULL,
    "material" "text",
    "output" "text",
    "width" numeric,
    "height" numeric,
    CONSTRAINT "foil_plotter_products_pkey" PRIMARY KEY ("department_product_id"),
    CONSTRAINT "foil_plotter_products_department_product_id_fkey" FOREIGN KEY ("department_product_id") REFERENCES "public"."department_products"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."foil_plotter_products" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."banner_products" (
    "department_product_id" "uuid" NOT NULL,
    "material" "text",
    "width" numeric,
    "height" numeric,
    "hem" boolean,
    "hem_sides" "text",
    "eyelets" boolean,
    "eyelet_detail" "text",
    CONSTRAINT "banner_products_pkey" PRIMARY KEY ("department_product_id"),
    CONSTRAINT "banner_products_department_product_id_fkey" FOREIGN KEY ("department_product_id") REFERENCES "public"."department_products"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."banner_products" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."rollup_products" (
    "department_product_id" "uuid" NOT NULL,
    "material" "text",
    "rollup_system" "text",
    "rollup_width" integer,
    CONSTRAINT "rollup_products_pkey" PRIMARY KEY ("department_product_id"),
    CONSTRAINT "rollup_products_department_product_id_fkey" FOREIGN KEY ("department_product_id") REFERENCES "public"."department_products"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."rollup_products" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."vehicle_lettering_products" (
    "department_product_id" "uuid" NOT NULL,
    "vehicle_make" "text",
    "vehicle_model" "text",
    "area_sides" boolean,
    "area_front" boolean,
    "area_rear" boolean,
    "installation" "text",
    "existing_wrap" boolean,
    "installation_date" date,
    CONSTRAINT "vehicle_lettering_products_pkey" PRIMARY KEY ("department_product_id"),
    CONSTRAINT "vehicle_lettering_products_department_product_id_fkey" FOREIGN KEY ("department_product_id") REFERENCES "public"."department_products"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."vehicle_lettering_products" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."other_lfp_products" (
    "department_product_id" "uuid" NOT NULL,
    "description" "text",
    CONSTRAINT "other_lfp_products_pkey" PRIMARY KEY ("department_product_id"),
    CONSTRAINT "other_lfp_products_department_product_id_fkey" FOREIGN KEY ("department_product_id") REFERENCES "public"."department_products"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."other_lfp_products" OWNER TO "postgres";

ALTER TABLE "public"."sticker_products" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees: full access" ON "public"."sticker_products" TO "authenticated" USING (true) WITH CHECK (true);

ALTER TABLE "public"."sign_uv_products" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees: full access" ON "public"."sign_uv_products" TO "authenticated" USING (true) WITH CHECK (true);

ALTER TABLE "public"."sign_foil_products" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees: full access" ON "public"."sign_foil_products" TO "authenticated" USING (true) WITH CHECK (true);

ALTER TABLE "public"."foil_plotter_products" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees: full access" ON "public"."foil_plotter_products" TO "authenticated" USING (true) WITH CHECK (true);

ALTER TABLE "public"."banner_products" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees: full access" ON "public"."banner_products" TO "authenticated" USING (true) WITH CHECK (true);

ALTER TABLE "public"."rollup_products" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees: full access" ON "public"."rollup_products" TO "authenticated" USING (true) WITH CHECK (true);

ALTER TABLE "public"."vehicle_lettering_products" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees: full access" ON "public"."vehicle_lettering_products" TO "authenticated" USING (true) WITH CHECK (true);

ALTER TABLE "public"."other_lfp_products" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees: full access" ON "public"."other_lfp_products" TO "authenticated" USING (true) WITH CHECK (true);

GRANT ALL ON TABLE "public"."sticker_products" TO "anon";

GRANT ALL ON TABLE "public"."sticker_products" TO "authenticated";

GRANT ALL ON TABLE "public"."sticker_products" TO "service_role";

GRANT ALL ON TABLE "public"."sign_uv_products" TO "anon";

GRANT ALL ON TABLE "public"."sign_uv_products" TO "authenticated";

GRANT ALL ON TABLE "public"."sign_uv_products" TO "service_role";

GRANT ALL ON TABLE "public"."sign_foil_products" TO "anon";

GRANT ALL ON TABLE "public"."sign_foil_products" TO "authenticated";

GRANT ALL ON TABLE "public"."sign_foil_products" TO "service_role";

GRANT ALL ON TABLE "public"."foil_plotter_products" TO "anon";

GRANT ALL ON TABLE "public"."foil_plotter_products" TO "authenticated";

GRANT ALL ON TABLE "public"."foil_plotter_products" TO "service_role";

GRANT ALL ON TABLE "public"."banner_products" TO "anon";

GRANT ALL ON TABLE "public"."banner_products" TO "authenticated";

GRANT ALL ON TABLE "public"."banner_products" TO "service_role";

GRANT ALL ON TABLE "public"."rollup_products" TO "anon";

GRANT ALL ON TABLE "public"."rollup_products" TO "authenticated";

GRANT ALL ON TABLE "public"."rollup_products" TO "service_role";

GRANT ALL ON TABLE "public"."vehicle_lettering_products" TO "anon";

GRANT ALL ON TABLE "public"."vehicle_lettering_products" TO "authenticated";

GRANT ALL ON TABLE "public"."vehicle_lettering_products" TO "service_role";

GRANT ALL ON TABLE "public"."other_lfp_products" TO "anon";

GRANT ALL ON TABLE "public"."other_lfp_products" TO "authenticated";

GRANT ALL ON TABLE "public"."other_lfp_products" TO "service_role";
