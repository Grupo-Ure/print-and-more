-- 20260508081513_laser_products.sql — Laser product type tables
-- Split from baseline 20260508081503_remote_schema.sql (delete that file once verified).

CREATE TABLE IF NOT EXISTS "public"."sign_products" (
    "department_product_id" "uuid" NOT NULL,
    "motif" "text",
    "material" "text",
    "material_other" "text",
    "width" integer,
    "height" integer,
    "round_corners" boolean,
    "self_adhesive" boolean,
    CONSTRAINT "sign_products_pkey" PRIMARY KEY ("department_product_id"),
    CONSTRAINT "sign_products_department_product_id_fkey" FOREIGN KEY ("department_product_id") REFERENCES "public"."department_products"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."sign_products" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."trophy_plate_products" (
    "department_product_id" "uuid" NOT NULL,
    "motif" "text",
    "material" "text",
    "material_other" "text",
    "width" integer,
    "height" integer,
    "round_corners" boolean,
    "self_adhesive" boolean,
    CONSTRAINT "trophy_plate_products_pkey" PRIMARY KEY ("department_product_id"),
    CONSTRAINT "trophy_plate_products_department_product_id_fkey" FOREIGN KEY ("department_product_id") REFERENCES "public"."department_products"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."trophy_plate_products" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."name_tag_products" (
    "department_product_id" "uuid" NOT NULL,
    "motif" "text",
    "material" "text",
    "material_other" "text",
    "width" integer,
    "height" integer,
    "round_corners" boolean,
    CONSTRAINT "name_tag_products_pkey" PRIMARY KEY ("department_product_id"),
    CONSTRAINT "name_tag_products_department_product_id_fkey" FOREIGN KEY ("department_product_id") REFERENCES "public"."department_products"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."name_tag_products" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."gift_item_products" (
    "department_product_id" "uuid" NOT NULL,
    "motif" "text",
    "material_free_text" "text",
    "origin" "text",
    CONSTRAINT "gift_item_products_pkey" PRIMARY KEY ("department_product_id"),
    CONSTRAINT "gift_item_products_department_product_id_fkey" FOREIGN KEY ("department_product_id") REFERENCES "public"."department_products"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."gift_item_products" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."other_laser_products" (
    "department_product_id" "uuid" NOT NULL,
    "motif" "text",
    "material_free_text" "text",
    "origin" "text",
    "self_adhesive" boolean,
    CONSTRAINT "other_laser_products_pkey" PRIMARY KEY ("department_product_id"),
    CONSTRAINT "other_laser_products_department_product_id_fkey" FOREIGN KEY ("department_product_id") REFERENCES "public"."department_products"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."other_laser_products" OWNER TO "postgres";

ALTER TABLE "public"."sign_products" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees: full access" ON "public"."sign_products" TO "authenticated" USING (true) WITH CHECK (true);

ALTER TABLE "public"."trophy_plate_products" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees: full access" ON "public"."trophy_plate_products" TO "authenticated" USING (true) WITH CHECK (true);

ALTER TABLE "public"."name_tag_products" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees: full access" ON "public"."name_tag_products" TO "authenticated" USING (true) WITH CHECK (true);

ALTER TABLE "public"."gift_item_products" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees: full access" ON "public"."gift_item_products" TO "authenticated" USING (true) WITH CHECK (true);

ALTER TABLE "public"."other_laser_products" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees: full access" ON "public"."other_laser_products" TO "authenticated" USING (true) WITH CHECK (true);

GRANT ALL ON TABLE "public"."sign_products" TO "anon";

GRANT ALL ON TABLE "public"."sign_products" TO "authenticated";

GRANT ALL ON TABLE "public"."sign_products" TO "service_role";

GRANT ALL ON TABLE "public"."trophy_plate_products" TO "anon";

GRANT ALL ON TABLE "public"."trophy_plate_products" TO "authenticated";

GRANT ALL ON TABLE "public"."trophy_plate_products" TO "service_role";

GRANT ALL ON TABLE "public"."name_tag_products" TO "anon";

GRANT ALL ON TABLE "public"."name_tag_products" TO "authenticated";

GRANT ALL ON TABLE "public"."name_tag_products" TO "service_role";

GRANT ALL ON TABLE "public"."gift_item_products" TO "anon";

GRANT ALL ON TABLE "public"."gift_item_products" TO "authenticated";

GRANT ALL ON TABLE "public"."gift_item_products" TO "service_role";

GRANT ALL ON TABLE "public"."other_laser_products" TO "anon";

GRANT ALL ON TABLE "public"."other_laser_products" TO "authenticated";

GRANT ALL ON TABLE "public"."other_laser_products" TO "service_role";
