-- 20260508081514_textile_products.sql — Textile as a product department.
-- Garment lines are products (department_products + textile_garment_products
-- typed child). Designs are a per-job reusable drawer (textile_motifs),
-- referenced by garment products through an attributed link (textile_motif_links).
-- Split from baseline 20260508081503_remote_schema.sql (delete that file once verified).

-- ---------------------------------------------------------------------------
-- Garment line — the typed product child (PK = FK to department_products).
-- origin OWN_STOCK references a stock-tracked textile_variants row (like
-- trodat_pad_products → stamp_models); CUSTOMER_STOCK is free-text. Columns are
-- nullable plain text — validation lives in the TEXTILE_GARMENT Zod schema.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."textile_garment_products" (
    "department_product_id" "uuid" NOT NULL,
    "origin" "text",
    "variant_id" "uuid",
    "garment_type" "text",
    "brand" "text",
    "model" "text",
    "color" "text",
    "size" "text",
    CONSTRAINT "textile_garment_products_pkey" PRIMARY KEY ("department_product_id"),
    CONSTRAINT "textile_garment_products_department_product_id_fkey" FOREIGN KEY ("department_product_id") REFERENCES "public"."department_products"("id") ON DELETE CASCADE,
    CONSTRAINT "textile_garment_products_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."textile_variants"("id") ON DELETE SET NULL
);

ALTER TABLE "public"."textile_garment_products" OWNER TO "postgres";

-- ---------------------------------------------------------------------------
-- Designs drawer — per job, reusable across that order's garment lines.
-- The design itself (artwork/text); placement/size/method live on the link.
-- TEXT and FILE are fully exclusive (four CHECK constraints).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."textile_motifs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "type" "public"."textile_motif_type" NOT NULL,
    "content" "text",
    "color" "text",
    "font_class" "public"."textile_font_class",
    "font_name" "text",
    "file_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "textile_motifs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "textile_motif_file_exclusive" CHECK ((("type" <> 'FILE'::"public"."textile_motif_type") OR (("content" IS NULL) AND ("color" IS NULL) AND ("font_class" IS NULL) AND ("font_name" IS NULL)))),
    CONSTRAINT "textile_motif_file_complete" CHECK ((("type" <> 'FILE'::"public"."textile_motif_type") OR ("file_id" IS NOT NULL))),
    CONSTRAINT "textile_motif_text_exclusive" CHECK ((("type" <> 'TEXT'::"public"."textile_motif_type") OR ("file_id" IS NULL))),
    CONSTRAINT "textile_motif_text_complete" CHECK ((("type" <> 'TEXT'::"public"."textile_motif_type") OR (("content" IS NOT NULL) AND ("color" IS NOT NULL) AND ("font_class" IS NOT NULL))))
);

ALTER TABLE "public"."textile_motifs" OWNER TO "postgres";

-- ---------------------------------------------------------------------------
-- Attributed link — which design goes on which garment product, where/how.
-- Placement/size required; one design per placement per garment (unique guard
-- replaces the old placement-conflict trigger).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."textile_motif_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "department_product_id" "uuid" NOT NULL,
    "motif_id" "uuid" NOT NULL,
    "placement" "text" NOT NULL,
    "size" "text" NOT NULL,
    "print_method" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "textile_motif_links_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "textile_motif_links_department_product_id_fkey" FOREIGN KEY ("department_product_id") REFERENCES "public"."department_products"("id") ON DELETE CASCADE,
    CONSTRAINT "textile_motif_links_motif_id_fkey" FOREIGN KEY ("motif_id") REFERENCES "public"."textile_motifs"("id") ON DELETE CASCADE,
    CONSTRAINT "textile_motif_links_placement_unique" UNIQUE ("department_product_id", "placement")
);

ALTER TABLE "public"."textile_motif_links" OWNER TO "postgres";

-- ---------------------------------------------------------------------------
-- Trigger guard: a textile motif's file must come from the motif's order.
-- (Retained; the assignment/placement triggers are dropped with their tables.)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."fn_check_textile_motif_file"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  parent_order_id uuid;
BEGIN
  IF NEW.file_id IS NOT NULL THEN
    SELECT order_id INTO parent_order_id
    FROM jobs WHERE id = NEW.job_id;

    IF NOT EXISTS (
      SELECT 1 FROM files
      WHERE id = NEW.file_id AND order_id = parent_order_id
    ) THEN
      RAISE EXCEPTION
        'File (%) in textile motif does not belong to the order of the job (%)',
        NEW.file_id, parent_order_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."fn_check_textile_motif_file"() OWNER TO "postgres";

ALTER TABLE ONLY "public"."textile_motifs"
    ADD CONSTRAINT "textile_motifs_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id");

ALTER TABLE ONLY "public"."textile_motifs"
    ADD CONSTRAINT "textile_motifs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;

CREATE INDEX "idx_textile_motifs_job" ON "public"."textile_motifs" USING "btree" ("job_id");

CREATE INDEX "idx_textile_motif_links_department_product" ON "public"."textile_motif_links" USING "btree" ("department_product_id");

CREATE INDEX "idx_textile_motif_links_motif" ON "public"."textile_motif_links" USING "btree" ("motif_id");

CREATE OR REPLACE TRIGGER "trg_textile_motif_file_check" BEFORE INSERT OR UPDATE OF "file_id", "job_id" ON "public"."textile_motifs" FOR EACH ROW EXECUTE FUNCTION "public"."fn_check_textile_motif_file"();

CREATE POLICY "Employees: full access" ON "public"."textile_garment_products" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."textile_motifs" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."textile_motif_links" TO "authenticated" USING (true) WITH CHECK (true);

ALTER TABLE "public"."textile_garment_products" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."textile_motifs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."textile_motif_links" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON FUNCTION "public"."fn_check_textile_motif_file"() TO "anon";

GRANT ALL ON FUNCTION "public"."fn_check_textile_motif_file"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."fn_check_textile_motif_file"() TO "service_role";

GRANT ALL ON TABLE "public"."textile_garment_products" TO "anon";

GRANT ALL ON TABLE "public"."textile_garment_products" TO "authenticated";

GRANT ALL ON TABLE "public"."textile_garment_products" TO "service_role";

GRANT ALL ON TABLE "public"."textile_motifs" TO "anon";

GRANT ALL ON TABLE "public"."textile_motifs" TO "authenticated";

GRANT ALL ON TABLE "public"."textile_motifs" TO "service_role";

GRANT ALL ON TABLE "public"."textile_motif_links" TO "anon";

GRANT ALL ON TABLE "public"."textile_motif_links" TO "authenticated";

GRANT ALL ON TABLE "public"."textile_motif_links" TO "service_role";

COMMENT ON TABLE "public"."textile_garment_products" IS 'Typed child of department_products for TEXTILE_GARMENT: a garment line, OWN_STOCK (variant_id → textile_variants, stock-tracked) or CUSTOMER_STOCK (free-text).';

COMMENT ON TABLE "public"."textile_motifs" IS 'Per-job reusable design drawer. type=TEXT and type=FILE are fully exclusive (four CHECK constraints). Placement/size/method live on textile_motif_links.';

COMMENT ON TABLE "public"."textile_motif_links" IS 'Attributed M:N: a design (textile_motifs) applied to a garment product at a placement/size/method. Unique (department_product_id, placement) prevents two designs on one spot.';
