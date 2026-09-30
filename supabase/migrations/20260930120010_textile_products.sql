-- 20260930120010_textile_products.sql — Textile: the product is the batch.
--
-- Textile is the one department where the job layer carried real meaning, so
-- the collapse runs the other way here (.plans/JOB_ELIMINATION.md, "Textile:
-- the product is the batch"): the garment lines collapse *into* one product
-- instead of the product collapsing into its lines.
--
-- One TEXTILE product = one batch:
--   * textile_garments — many rows, one per model × colour × size, each with
--     its own quantity. This makes textile the only typed child that is 1:n
--     instead of 1:1 (a deliberate, contained deviation). The parent's
--     `quantity` stays NULL.
--   * textile_designs — one row per design applied to the batch, merging the
--     old textile_motifs (the artwork or text) with textile_motif_links (its
--     placement, size and print method). "Logo, chest left, large" is declared
--     once and holds for every line, so lines carry no design reference.
--
-- Stored values are English from here on (textile decision 8); the UI labels
-- already were:
--   origin       SHOP_SUPPLIED | CUSTOMER_SUPPLIED   (was OWN_STOCK | CUSTOMER_STOCK)
--   garment_type T_SHIRT | POLO | SWEATSHIRT | HOODIE | ZIP_HOODIE | JACKET | OTHER
--   placement    CHEST_LEFT | CHEST_CENTRE | CHEST_RIGHT | BACK | SLEEVE_LEFT | SLEEVE_RIGHT | OTHER
--   size         SMALL | MEDIUM | LARGE | CUSTOM
-- They stay plain text, as every other product spec value does — validation
-- lives in the TEXTILE_GARMENT Zod schema.

-- ---------------------------------------------------------------------------
-- Garment lines — the 1:n typed child of a TEXTILE product.
-- SHOP_SUPPLIED with a `variant_id` is stock-tracked (deducted on release);
-- SHOP_SUPPLIED without one, and CUSTOMER_SUPPLIED, are free-text and tracked
-- by nothing. The UI defaults to the catalog picker, where the size option's
-- value *is* the variant id, so a phantom SKU is structurally impossible.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."textile_garments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "origin" "text",
    "variant_id" "uuid",
    -- Free-text branch (no catalog variant): what the garment is.
    "garment_type" "text",
    "brand" "text",
    "model" "text",
    "color" "text",
    "size" "text",
    -- Pieces of this exact model/colour/size. The batch total is SUM(quantity).
    "quantity" integer NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "textile_garments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "textile_garments_quantity_positive" CHECK (("quantity" > 0)),
    CONSTRAINT "textile_garments_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE,
    CONSTRAINT "textile_garments_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."textile_variants"("id") ON DELETE SET NULL,
    -- One line per catalog variant per batch: the size grid has one cell per
    -- variant, so a second row for the same one is a double entry. Free-text
    -- lines (variant_id NULL) are not constrained — NULLs never conflict.
    CONSTRAINT "textile_garments_variant_unique" UNIQUE ("product_id", "variant_id")
);

ALTER TABLE "public"."textile_garments" OWNER TO "postgres";

-- ---------------------------------------------------------------------------
-- Designs — one row per design applied to the batch, at one placement.
-- The design is either an order file (type FILE) or typed-out text with a
-- font and colour (type TEXT); the two are fully exclusive (four CHECKs,
-- carried over from textile_motifs). Placement and size are required, the
-- print method is optional free text.
-- UNIQUE (product_id, placement): one design per position, while one design
-- may take many positions (it is then one row per position).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."textile_designs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "type" "public"."textile_design_type" NOT NULL,
    "content" "text",
    "color" "text",
    "font_class" "public"."textile_font_class",
    "font_name" "text",
    "file_id" "uuid",
    "placement" "text" NOT NULL,
    "size" "text" NOT NULL,
    "print_method" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "textile_designs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "textile_designs_placement_unique" UNIQUE ("product_id", "placement"),
    CONSTRAINT "textile_design_file_exclusive" CHECK ((("type" <> 'FILE'::"public"."textile_design_type") OR (("content" IS NULL) AND ("color" IS NULL) AND ("font_class" IS NULL) AND ("font_name" IS NULL)))),
    CONSTRAINT "textile_design_file_complete" CHECK ((("type" <> 'FILE'::"public"."textile_design_type") OR ("file_id" IS NOT NULL))),
    CONSTRAINT "textile_design_text_exclusive" CHECK ((("type" <> 'TEXT'::"public"."textile_design_type") OR ("file_id" IS NULL))),
    CONSTRAINT "textile_design_text_complete" CHECK ((("type" <> 'TEXT'::"public"."textile_design_type") OR (("content" IS NOT NULL) AND ("color" IS NOT NULL) AND ("font_class" IS NOT NULL)))),
    CONSTRAINT "textile_designs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE,
    CONSTRAINT "textile_designs_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id")
);

ALTER TABLE "public"."textile_designs" OWNER TO "postgres";

-- ---------------------------------------------------------------------------
-- Trigger guard: a design's artwork file must come from its product's order.
-- (Reuse across batches is exactly this — picking the same order file again.)
-- ---------------------------------------------------------------------------
/**
 * @trigger BEFORE INSERT OR UPDATE OF file_id, product_id ON textile_designs (per row)
 * @raises when the file belongs to a different order than the product.
 */
CREATE OR REPLACE FUNCTION "public"."fn_check_textile_design_file"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  parent_order_id uuid;
BEGIN
  IF NEW.file_id IS NOT NULL THEN
    SELECT order_id INTO parent_order_id
    FROM products WHERE id = NEW.product_id;

    IF NOT EXISTS (
      SELECT 1 FROM files
      WHERE id = NEW.file_id AND order_id = parent_order_id
    ) THEN
      RAISE EXCEPTION
        'File (%) in textile design does not belong to the order of the product (%)',
        NEW.file_id, parent_order_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."fn_check_textile_design_file"() OWNER TO "postgres";

CREATE INDEX "idx_textile_garments_product" ON "public"."textile_garments" USING "btree" ("product_id");

CREATE INDEX "idx_textile_garments_variant" ON "public"."textile_garments" USING "btree" ("variant_id");

CREATE INDEX "idx_textile_designs_product" ON "public"."textile_designs" USING "btree" ("product_id");

CREATE INDEX "idx_textile_designs_file" ON "public"."textile_designs" USING "btree" ("file_id");

CREATE OR REPLACE TRIGGER "trg_textile_design_file_check" BEFORE INSERT OR UPDATE OF "file_id", "product_id" ON "public"."textile_designs" FOR EACH ROW EXECUTE FUNCTION "public"."fn_check_textile_design_file"();

CREATE POLICY "Employees: full access" ON "public"."textile_garments" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."textile_designs" TO "authenticated" USING (true) WITH CHECK (true);

ALTER TABLE "public"."textile_garments" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."textile_designs" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON FUNCTION "public"."fn_check_textile_design_file"() TO "anon";

GRANT ALL ON FUNCTION "public"."fn_check_textile_design_file"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."fn_check_textile_design_file"() TO "service_role";

GRANT ALL ON TABLE "public"."textile_garments" TO "anon";

GRANT ALL ON TABLE "public"."textile_garments" TO "authenticated";

GRANT ALL ON TABLE "public"."textile_garments" TO "service_role";

GRANT ALL ON TABLE "public"."textile_designs" TO "anon";

GRANT ALL ON TABLE "public"."textile_designs" TO "authenticated";

GRANT ALL ON TABLE "public"."textile_designs" TO "service_role";

COMMENT ON TABLE "public"."textile_garments" IS 'Garment lines of a TEXTILE batch product: one row per model × colour × size with its own quantity. The only 1:n typed child. SHOP_SUPPLIED + variant_id is stock-tracked; everything else is free text and tracked by nothing.';

COMMENT ON COLUMN "public"."textile_garments"."origin" IS 'SHOP_SUPPLIED | CUSTOMER_SUPPLIED — who supplies the garment, not whether stock is tracked.';

COMMENT ON TABLE "public"."textile_designs" IS 'A design applied to the whole batch at one placement: an order file (type FILE) or typed text (type TEXT), plus placement, size and print method. Merges the former textile_motifs + textile_motif_links. Unique (product_id, placement) prevents two designs on one spot.';
