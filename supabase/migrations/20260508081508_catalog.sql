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

-- Lookup table for stamp ink colours (not textile — garment colours are
-- per-variant free text, a different vocabulary and scale). Kept as a table
-- rather than a CHECK constraint so the palette can move to a settings UI
-- without a migration.
CREATE TABLE IF NOT EXISTS "public"."stamp_ink_colors" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "hex" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    CONSTRAINT "stamp_ink_colors_pkey" PRIMARY KEY ("code")
);

ALTER TABLE "public"."stamp_ink_colors" OWNER TO "postgres";

INSERT INTO "public"."stamp_ink_colors" ("code", "label", "hex", "sort_order") VALUES
    ('BLACK', 'Black', '#000000', 1),
    ('RED', 'Red', '#DC2626', 2),
    ('BLUE', 'Blue', '#2563EB', 3),
    ('GREEN', 'Green', '#16A34A', 4),
    ('OTHER', 'Other', NULL, 5)
ON CONFLICT ("code") DO NOTHING;

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
    CONSTRAINT "stamp_models_size_check" CHECK (("size" = ANY (ARRAY['SMALL'::"text", 'MEDIUM'::"text", 'LARGE'::"text"]))),
    CONSTRAINT "stamp_models_stock_check" CHECK (("stock" >= 0)),
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
    "sample_stock" integer DEFAULT 0 NOT NULL,
    "stock" integer DEFAULT 0 NOT NULL,
    "min_stock" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "material" "text",
    CONSTRAINT "textile_variants_stock_check" CHECK (("stock" >= 0)),
    CONSTRAINT "textile_variants_sample_stock_check" CHECK (("sample_stock" >= 0 AND "sample_stock" <= "stock"))
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

ALTER TABLE ONLY "public"."stamp_models"
    ADD CONSTRAINT "stamp_models_color_fkey" FOREIGN KEY ("color") REFERENCES "public"."stamp_ink_colors"("code");

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

CREATE INDEX "idx_stamp_models_color" ON "public"."stamp_models" USING "btree" ("color");

CREATE INDEX "idx_stamp_stock_movements_created" ON "public"."stamp_stock_movements" USING "btree" ("created_at");

CREATE INDEX "idx_stamp_stock_movements_model" ON "public"."stamp_stock_movements" USING "btree" ("model_id");

CREATE INDEX "idx_stamp_models_active" ON "public"."stamp_models" USING "btree" ("is_active");

CREATE INDEX "idx_stamp_models_type" ON "public"."stamp_models" USING "btree" ("type");

CREATE INDEX "idx_textile_stock_movements_created" ON "public"."textile_stock_movements" USING "btree" ("created_at");

CREATE INDEX "idx_textile_stock_movements_variant" ON "public"."textile_stock_movements" USING "btree" ("variant_id");

CREATE POLICY "Employees: full access" ON "public"."stamp_stock_movements" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."stamp_ink_colors" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."stamp_models" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."textile_stock_movements" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."textile_brands" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."textile_products" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."textile_variants" TO "authenticated" USING (true) WITH CHECK (true);

ALTER TABLE "public"."stamp_stock_movements" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."stamp_ink_colors" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."stamp_models" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."textile_stock_movements" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."textile_brands" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."textile_products" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."textile_variants" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "public"."stamp_stock_movements" TO "anon";

GRANT ALL ON TABLE "public"."stamp_stock_movements" TO "authenticated";

GRANT ALL ON TABLE "public"."stamp_stock_movements" TO "service_role";

GRANT ALL ON TABLE "public"."stamp_ink_colors" TO "anon";

GRANT ALL ON TABLE "public"."stamp_ink_colors" TO "authenticated";

GRANT ALL ON TABLE "public"."stamp_ink_colors" TO "service_role";

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

/**
 * Book the automatic stock deductions of a production release atomically.
 *
 * `deductions` is a jsonb array of {"target": "STAMP"|"TEXTILE", "id": uuid,
 * "quantity": int} — STAMP targets stamp_models, TEXTILE targets
 * textile_variants. Each target row is locked (FOR UPDATE, in a stable order
 * to avoid deadlocks between concurrent releases), so two near-simultaneous
 * releases serialize instead of losing an update.
 *
 * Availability: STAMP availability is the model's stock; TEXTILE availability
 * is stock - sample_stock by design — declared samples are never consumed by
 * a release, only the physical stock above them is.
 *
 * allow_shortage = false (normal release): if any item's availability is below
 * its quantity (or the row is missing), the whole call raises INSUFFICIENT_STOCK
 * with the shortages as jsonb in DETAIL and rolls back — all-or-nothing.
 * allow_shortage = true (admin force release): the deduction is floored at the
 * available amount and the movement row records the actually deducted amount
 * (items deducting 0 get no movement row — movements require quantity > 0).
 *
 * Movement rows (type AUTO_DEDUCTION, the passed note, user_id = auth.uid())
 * are written in the same transaction. Returns {"ok": true, "shortages": [...]}.
 */
CREATE OR REPLACE FUNCTION "public"."book_production_deductions"("deductions" "jsonb", "note" "text", "allow_shortage" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  item        RECORD;
  prev_stock  INTEGER;
  deducted    INTEGER;
  shortages   JSONB := '[]'::JSONB;
BEGIN
  FOR item IN
    SELECT
      d->>'target'              AS target,
      (d->>'id')::uuid          AS id,
      (d->>'quantity')::integer AS quantity
    FROM jsonb_array_elements(deductions) AS d
    ORDER BY d->>'target', d->>'id'
  LOOP
    IF item.target NOT IN ('STAMP', 'TEXTILE') THEN
      RAISE EXCEPTION 'unknown deduction target %', item.target;
    END IF;
    IF item.quantity IS NULL OR item.quantity < 1 THEN
      RAISE EXCEPTION 'invalid deduction quantity for %', item.id;
    END IF;

    IF item.target = 'STAMP' THEN
      SELECT stock INTO prev_stock FROM stamp_models WHERE id = item.id FOR UPDATE;
    ELSE
      -- prev_stock holds the *available* amount: declared samples are excluded
      SELECT stock - sample_stock INTO prev_stock FROM textile_variants WHERE id = item.id FOR UPDATE;
    END IF;

    IF prev_stock IS NULL OR prev_stock < item.quantity THEN
      shortages := shortages || jsonb_build_object(
        'target', item.target,
        'id', item.id,
        'required', item.quantity,
        'available', COALESCE(prev_stock, 0)
      );
    END IF;

    -- Missing row: nothing to deduct. Under allow_shortage = false any update
    -- is rolled back by the shortage exception below, so deducting the full
    -- quantity here is safe either way.
    CONTINUE WHEN prev_stock IS NULL;

    deducted := LEAST(prev_stock, item.quantity);
    CONTINUE WHEN deducted = 0;

    IF item.target = 'STAMP' THEN
      UPDATE stamp_models SET stock = prev_stock - deducted WHERE id = item.id;
      INSERT INTO stamp_stock_movements (model_id, quantity, type, note, user_id)
      VALUES (item.id, deducted, 'AUTO_DEDUCTION', note, auth.uid());
    ELSE
      -- relative decrement: physical pieces leave, the sample count stays
      UPDATE textile_variants SET stock = stock - deducted WHERE id = item.id;
      INSERT INTO textile_stock_movements (variant_id, quantity, type, note, user_id)
      VALUES (item.id, deducted, 'AUTO_DEDUCTION', note, auth.uid());
    END IF;
  END LOOP;

  IF NOT allow_shortage AND jsonb_array_length(shortages) > 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK' USING DETAIL = shortages::text;
  END IF;

  RETURN jsonb_build_object('ok', true, 'shortages', shortages);
END;
$$;

ALTER FUNCTION "public"."book_production_deductions"("deductions" "jsonb", "note" "text", "allow_shortage" boolean) OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."book_production_deductions"("deductions" "jsonb", "note" "text", "allow_shortage" boolean) TO "anon";

GRANT ALL ON FUNCTION "public"."book_production_deductions"("deductions" "jsonb", "note" "text", "allow_shortage" boolean) TO "authenticated";

GRANT ALL ON FUNCTION "public"."book_production_deductions"("deductions" "jsonb", "note" "text", "allow_shortage" boolean) TO "service_role";
