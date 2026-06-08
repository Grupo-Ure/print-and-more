-- 20260508081514_textile_products.sql — Textile per-order tables (+ textile guards)
-- Split from baseline 20260508081503_remote_schema.sql (delete that file once verified).

CREATE TABLE IF NOT EXISTS "public"."textile_motifs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "department_order_id" "uuid" NOT NULL,
    "type" "public"."textile_motif_type" NOT NULL,
    "content" "text",
    "color" "text",
    "font_class" "public"."textile_font_class",
    "font_name" "text",
    "file_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "placement" "text" DEFAULT 'CHEST_LEFT'::"text" NOT NULL,
    "size" "text" DEFAULT 'MEDIUM'::"text" NOT NULL,
    "print_method" "text",
    CONSTRAINT "textile_motif_file_exclusive" CHECK ((("type" <> 'FILE'::"public"."textile_motif_type") OR (("content" IS NULL) AND ("color" IS NULL) AND ("font_class" IS NULL) AND ("font_name" IS NULL)))),
    CONSTRAINT "textile_motif_file_complete" CHECK ((("type" <> 'FILE'::"public"."textile_motif_type") OR ("file_id" IS NOT NULL))),
    CONSTRAINT "textile_motif_text_exclusive" CHECK ((("type" <> 'TEXT'::"public"."textile_motif_type") OR ("file_id" IS NULL))),
    CONSTRAINT "textile_motif_text_complete" CHECK ((("type" <> 'TEXT'::"public"."textile_motif_type") OR (("content" IS NOT NULL) AND ("color" IS NOT NULL) AND ("font_class" IS NOT NULL))))
);

ALTER TABLE "public"."textile_motifs" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."textile_positions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "department_order_id" "uuid" NOT NULL,
    "origin" "public"."textile_origin" NOT NULL,
    "quantity" integer NOT NULL,
    "type" "text",
    "color" "text",
    "brand" "text",
    "model" "text",
    "size" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "variant_id" "uuid",
    CONSTRAINT "own_stock_required_fields" CHECK ((("origin" <> 'OWN_STOCK'::"public"."textile_origin") OR (("brand" IS NOT NULL) AND ("model" IS NOT NULL) AND ("color" IS NOT NULL) AND ("size" IS NOT NULL)))),
    CONSTRAINT "customer_stock_required_fields" CHECK ((("origin" <> 'CUSTOMER_STOCK'::"public"."textile_origin") OR (("type" IS NOT NULL) AND ("color" IS NOT NULL)))),
    CONSTRAINT "textile_positions_quantity_check" CHECK (("quantity" > 0))
);

ALTER TABLE "public"."textile_positions" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."textile_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "department_order_id" "uuid" NOT NULL,
    "motif_id" "uuid" NOT NULL,
    "position_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."textile_assignments" OWNER TO "postgres";

/**
 * Trigger guard: blocks placing two motifs on the same spot of one garment.
 * Rejects an assignment whose motif shares a `placement` with another motif
 * already assigned to the same `position_id`.
 *
 * @trigger BEFORE INSERT OR UPDATE ON textile_assignments (per row)
 * @raises PLACEMENT_CONFLICT when the placement is already occupied.
 */
CREATE OR REPLACE FUNCTION "public"."check_textile_placement_conflict"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM textile_assignments existing
    JOIN textile_motifs existing_motif ON existing_motif.id = existing.motif_id
    JOIN textile_motifs new_motif ON new_motif.id = NEW.motif_id
    WHERE existing.position_id = NEW.position_id
      AND existing_motif.placement = new_motif.placement
      AND existing.id != NEW.id
  ) THEN
    RAISE EXCEPTION 'PLACEMENT_CONFLICT: This placement is already occupied for this textile position.';
  END IF;
  RETURN NEW;
END;
$$;

/**
 * Trigger guard: a textile motif's file must come from the motif's order.
 * If `file_id` is set, the file's `order_id` must match the order of the
 * motif's parent sub-order.
 *
 * @trigger BEFORE INSERT OR UPDATE OF file_id, department_order_id ON textile_motifs (per row)
 * @raises when the file belongs to a different order.
 */
CREATE OR REPLACE FUNCTION "public"."fn_check_textile_motif_file"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  parent_order_id uuid;
BEGIN
  IF NEW.file_id IS NOT NULL THEN
    SELECT order_id INTO parent_order_id
    FROM department_orders WHERE id = NEW.department_order_id;

    IF NOT EXISTS (
      SELECT 1 FROM files
      WHERE id = NEW.file_id AND order_id = parent_order_id
    ) THEN
      RAISE EXCEPTION
        'File (%) in textile motif does not belong to the order of the sub-order (%)',
        NEW.file_id, parent_order_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

/**
 * Trigger guard: an assignment's motif and position must belong to the same
 * sub-order as the assignment itself — both `motif_id` and `position_id` must
 * share the assignment's `department_order_id`.
 *
 * @trigger BEFORE INSERT OR UPDATE ON textile_assignments (per row)
 * @raises when the motif or position belongs to a different sub-order.
 */
CREATE OR REPLACE FUNCTION "public"."fn_check_textile_assignment_consistency"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM textile_motifs
    WHERE id = NEW.motif_id AND department_order_id = NEW.department_order_id
  ) THEN
    RAISE EXCEPTION 'Motif (%) does not belong to sub-order (%)',
      NEW.motif_id, NEW.department_order_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM textile_positions
    WHERE id = NEW.position_id AND department_order_id = NEW.department_order_id
  ) THEN
    RAISE EXCEPTION 'Position (%) does not belong to sub-order (%)',
      NEW.position_id, NEW.department_order_id;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."check_textile_placement_conflict"() OWNER TO "postgres";

ALTER FUNCTION "public"."fn_check_textile_motif_file"() OWNER TO "postgres";

ALTER FUNCTION "public"."fn_check_textile_assignment_consistency"() OWNER TO "postgres";

ALTER TABLE ONLY "public"."textile_motifs"
    ADD CONSTRAINT "textile_motifs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."textile_positions"
    ADD CONSTRAINT "textile_positions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."textile_assignments"
    ADD CONSTRAINT "textile_assignments_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."textile_motifs"
    ADD CONSTRAINT "textile_motifs_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id");

ALTER TABLE ONLY "public"."textile_motifs"
    ADD CONSTRAINT "textile_motifs_department_order_id_fkey" FOREIGN KEY ("department_order_id") REFERENCES "public"."department_orders"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."textile_positions"
    ADD CONSTRAINT "textile_positions_department_order_id_fkey" FOREIGN KEY ("department_order_id") REFERENCES "public"."department_orders"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."textile_positions"
    ADD CONSTRAINT "textile_positions_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."textile_variants"("id");

ALTER TABLE ONLY "public"."textile_assignments"
    ADD CONSTRAINT "textile_assignments_motif_id_fkey" FOREIGN KEY ("motif_id") REFERENCES "public"."textile_motifs"("id");

ALTER TABLE ONLY "public"."textile_assignments"
    ADD CONSTRAINT "textile_assignments_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "public"."textile_positions"("id");

ALTER TABLE ONLY "public"."textile_assignments"
    ADD CONSTRAINT "textile_assignments_department_order_id_fkey" FOREIGN KEY ("department_order_id") REFERENCES "public"."department_orders"("id") ON DELETE CASCADE;

CREATE INDEX "idx_textile_motifs_department_order" ON "public"."textile_motifs" USING "btree" ("department_order_id");

CREATE INDEX "idx_textile_positions_department_order" ON "public"."textile_positions" USING "btree" ("department_order_id");

CREATE OR REPLACE TRIGGER "textile_placement_conflict_trigger" BEFORE INSERT OR UPDATE ON "public"."textile_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."check_textile_placement_conflict"();

CREATE OR REPLACE TRIGGER "trg_textile_motif_file_check" BEFORE INSERT OR UPDATE OF "file_id", "department_order_id" ON "public"."textile_motifs" FOR EACH ROW EXECUTE FUNCTION "public"."fn_check_textile_motif_file"();

CREATE OR REPLACE TRIGGER "trg_textile_assignment_consistency" BEFORE INSERT OR UPDATE ON "public"."textile_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."fn_check_textile_assignment_consistency"();

CREATE POLICY "Employees: full access" ON "public"."textile_motifs" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."textile_positions" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."textile_assignments" TO "authenticated" USING (true) WITH CHECK (true);

ALTER TABLE "public"."textile_motifs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."textile_positions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."textile_assignments" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON FUNCTION "public"."check_textile_placement_conflict"() TO "anon";

GRANT ALL ON FUNCTION "public"."check_textile_placement_conflict"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."check_textile_placement_conflict"() TO "service_role";

GRANT ALL ON FUNCTION "public"."fn_check_textile_motif_file"() TO "anon";

GRANT ALL ON FUNCTION "public"."fn_check_textile_motif_file"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."fn_check_textile_motif_file"() TO "service_role";

GRANT ALL ON FUNCTION "public"."fn_check_textile_assignment_consistency"() TO "anon";

GRANT ALL ON FUNCTION "public"."fn_check_textile_assignment_consistency"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."fn_check_textile_assignment_consistency"() TO "service_role";

GRANT ALL ON TABLE "public"."textile_motifs" TO "anon";

GRANT ALL ON TABLE "public"."textile_motifs" TO "authenticated";

GRANT ALL ON TABLE "public"."textile_motifs" TO "service_role";

GRANT ALL ON TABLE "public"."textile_positions" TO "anon";

GRANT ALL ON TABLE "public"."textile_positions" TO "authenticated";

GRANT ALL ON TABLE "public"."textile_positions" TO "service_role";

GRANT ALL ON TABLE "public"."textile_assignments" TO "anon";

GRANT ALL ON TABLE "public"."textile_assignments" TO "authenticated";

GRANT ALL ON TABLE "public"."textile_assignments" TO "service_role";

COMMENT ON TABLE "public"."textile_motifs" IS 'type=TEXT and type=FILE are fully exclusive: four CHECK constraints each enforce completeness and exclusion of the opposing field set.';
