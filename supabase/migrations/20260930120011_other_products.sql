-- 20260930120011_other_products.sql — Other product table

CREATE TABLE IF NOT EXISTS "public"."other_products" (
    "product_id" "uuid" NOT NULL,
    "description" "text",
    CONSTRAINT "other_products_pkey" PRIMARY KEY ("product_id"),
    CONSTRAINT "other_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."other_products" OWNER TO "postgres";

ALTER TABLE "public"."other_products" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees: full access" ON "public"."other_products" TO "authenticated" USING (true) WITH CHECK (true);

GRANT ALL ON TABLE "public"."other_products" TO "anon";

GRANT ALL ON TABLE "public"."other_products" TO "authenticated";

GRANT ALL ON TABLE "public"."other_products" TO "service_role";
