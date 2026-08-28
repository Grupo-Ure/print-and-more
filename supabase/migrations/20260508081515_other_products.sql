-- 20260508081515_other_products.sql — Other product table
-- Split from baseline 20260508081503_remote_schema.sql (delete that file once verified).

CREATE TABLE IF NOT EXISTS "public"."other_products" (
    "department_product_id" "uuid" NOT NULL,
    "description" "text",
    CONSTRAINT "other_products_pkey" PRIMARY KEY ("department_product_id"),
    CONSTRAINT "other_products_department_product_id_fkey" FOREIGN KEY ("department_product_id") REFERENCES "public"."department_products"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."other_products" OWNER TO "postgres";

ALTER TABLE "public"."other_products" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees: full access" ON "public"."other_products" TO "authenticated" USING (true) WITH CHECK (true);

GRANT ALL ON TABLE "public"."other_products" TO "anon";

GRANT ALL ON TABLE "public"."other_products" TO "authenticated";

GRANT ALL ON TABLE "public"."other_products" TO "service_role";
