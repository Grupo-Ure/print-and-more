-- 20260930120004_products.sql — products (the unit of work) + numbering,
-- guards, time logs, file links and the per-department stage defaults.
--
-- Merges the old jobs.sql and products_core.sql: `products` is the former
-- `department_products` with the job's workflow columns absorbed into it, and
-- `jobs` never exists. Also folds in 20260923144410_production_job_assignment
-- (department_default_assignees + the stage-default trigger) and the products
-- realtime membership from 20260925101438_realtime_publication.
--
-- The old admin-only assignee guard (fn_enforce_job_assignee_rules) is
-- deliberately not recreated: anyone may assign or reassign, as production
-- settled on.

-- ---------------------------------------------------------------------------
-- products — supertype of the typed per-type child tables, and the unit the
-- production workflow acts on. `type` selects the child table (see
-- CHILD_TABLE_BY_TYPE in src/types/product.ts); deadline, delivery and
-- priority are NULL to inherit the order's value.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    -- Assigned by trg_product_number BEFORE INSERT; never set by the client.
    "product_number" "text" NOT NULL,
    "order_id" "uuid" NOT NULL,
    "department" "public"."department" NOT NULL,
    -- Discriminator for the typed child row. Validated against the department
    -- by trg_product_type_check below.
    "type" "text" NOT NULL,
    "status" "public"."product_status" DEFAULT 'IN_SETUP'::"public"."product_status" NOT NULL,
    -- NULL for a TEXTILE batch: its quantity lives on the garment lines.
    "quantity" integer,
    "notes" "text",
    "deadline" "date",
    "delivery" "public"."delivery_type",
    -- Nullable, no default: NULL means "inherit the parent order's priority"
    -- (mirrors delivery above). Resolution happens in application code.
    "priority" "public"."priority_type",
    "assignee_id" "uuid",
    "customer_approval_required" boolean DEFAULT false NOT NULL,
    "customer_approval_granted" boolean DEFAULT false NOT NULL,
    "customer_approval_file_id" "uuid",
    "is_cancelled" boolean DEFAULT false NOT NULL,
    -- Orders the products within their order.
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "approval_consistency" CHECK (((NOT (("customer_approval_granted" = true) AND ("customer_approval_required" = false))) AND (NOT (("customer_approval_granted" = true) AND ("customer_approval_file_id" IS NULL))) AND (NOT (("customer_approval_file_id" IS NOT NULL) AND ("customer_approval_required" = false)))))
);

ALTER TABLE "public"."products" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."product_number_counter" (
    "order_id" "uuid" NOT NULL,
    "department" "public"."department" NOT NULL,
    "last_value" integer NOT NULL
);

ALTER TABLE "public"."product_number_counter" OWNER TO "postgres";

-- ---------------------------------------------------------------------------
-- product_files — M:N link from a product to the order's files.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."product_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "file_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."product_files" OWNER TO "postgres";

-- ---------------------------------------------------------------------------
-- department_default_assignees — the user a product of that department is
-- handed to when it enters that stage.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."department_default_assignees" (
    "department" "public"."department" NOT NULL,
    "status" "public"."product_status" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "department_default_assignees_pkey" PRIMARY KEY ("department", "status"),
    CONSTRAINT "department_default_assignees_status_check"
        CHECK ("status" IN ('PREPRESS', 'IN_PRODUCTION')),
    CONSTRAINT "department_default_assignees_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."department_default_assignees" OWNER TO "postgres";

-- ── functions ────────────────────────────────────────────────────────────────

/**
 * Department abbreviation used in product numbers. Must stay in sync with
 * DEPARTMENT_ABBREVIATIONS in src/const/departmentAbbreviation.ts.
 */
CREATE OR REPLACE FUNCTION "public"."fn_department_abbreviation"("dept" "public"."department") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT CASE dept
    WHEN 'LFP'             THEN 'LFP'
    WHEN 'COPYSHOP'        THEN 'CP'
    WHEN 'TEXTILE'         THEN 'TX'
    WHEN 'STAMP'           THEN 'ST'
    WHEN 'LASER_ENGRAVING' THEN 'LA'
    WHEN 'OTHER'           THEN 'OT'
  END;
$$;

/**
 * Trigger: assigns `products.product_number` as `<order_number>-<DEPT>-<NN>`
 * (e.g. 2026-07-0042-LFP-01), where NN is a per-order-per-department
 * sequence. Uses an atomic INSERT ... ON CONFLICT DO UPDATE on
 * `product_number_counter`, so concurrent inserts never collide; the counter
 * never decrements, so numbers of deleted products are not reused.
 *
 * @trigger BEFORE INSERT ON products (per row)
 */
CREATE OR REPLACE FUNCTION "public"."fn_generate_product_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  seq_value            integer;
  parent_order_number  text;
BEGIN
  INSERT INTO product_number_counter (order_id, department, last_value)
  VALUES (NEW.order_id, NEW.department, 1)
  ON CONFLICT (order_id, department) DO UPDATE
    SET last_value = product_number_counter.last_value + 1
  RETURNING last_value INTO seq_value;

  SELECT order_number INTO parent_order_number
  FROM orders
  WHERE id = NEW.order_id;

  NEW.product_number :=
    parent_order_number || '-' ||
    fn_department_abbreviation(NEW.department) || '-' ||
    lpad(seq_value::text, 2, '0');

  RETURN NEW;
END;
$$;

/**
 * Trigger guard: a product's customer-approval file must come from its own
 * order. If `customer_approval_file_id` is set, that file must belong to the
 * product's `order_id`.
 *
 * @trigger BEFORE INSERT OR UPDATE OF customer_approval_file_id, order_id ON products (per row)
 * @raises when the approval file belongs to a different order.
 */
CREATE OR REPLACE FUNCTION "public"."fn_check_approval_file_order"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.customer_approval_file_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM files
      WHERE id = NEW.customer_approval_file_id
        AND order_id = NEW.order_id
    ) THEN
      RAISE EXCEPTION
        'Approval file (%) does not belong to the order of this product (%)',
        NEW.customer_approval_file_id, NEW.order_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

/**
 * Trigger guard: a file linked to a product must belong to the product's own
 * order. `files` and `products` each carry their own `order_id`, and the link
 * table joins them without the FKs ever checking the two agree — so this is
 * the third of the three file references to verify it, alongside
 * fn_check_approval_file_order here and fn_check_textile_design_file on
 * textile_designs.
 *
 * search_path is pinned and tables are schema-qualified so the check still
 * resolves when it fires nested inside a function that pins its own.
 *
 * @trigger BEFORE INSERT OR UPDATE OF product_id, file_id ON product_files (per row)
 * @raises when the file belongs to a different order than the product.
 */
CREATE OR REPLACE FUNCTION "public"."fn_check_product_file_order"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" = ''
    AS $$
DECLARE
  parent_order_id uuid;
BEGIN
  SELECT order_id INTO parent_order_id
  FROM public.products WHERE id = NEW.product_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.files
    WHERE id = NEW.file_id AND order_id = parent_order_id
  ) THEN
    RAISE EXCEPTION
      'File (%) does not belong to the order of this product (%)',
      NEW.file_id, parent_order_id;
  END IF;
  RETURN NEW;
END;
$$;

/**
 * Trigger guard: validates `products.type` against the department's allowed
 * set — the department → type mapping the client keeps in
 * CHILD_TABLE_BY_TYPE (src/types/product.ts). Unlike the former
 * fn_check_job_type, `type` is NOT NULL here: it is the discriminator that
 * selects the typed child table, so every product has one. TEXTILE takes only
 * TEXTILE_GARMENT (the batch).
 *
 * @trigger BEFORE INSERT OR UPDATE OF department, type ON products (per row)
 * @raises when the type is not valid for the department.
 */
CREATE OR REPLACE FUNCTION "public"."fn_check_product_type"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  CASE NEW.department
    WHEN 'LFP' THEN
      IF NEW.type NOT IN (
        'STICKER','SIGN_UV','SIGN_FOIL','FOIL_PLOTTER',
        'BANNER','ROLLUP','VEHICLE_LETTERING','OTHER_LFP'
      ) THEN
        RAISE EXCEPTION 'Invalid type "%" for department LFP', NEW.type;
      END IF;
    WHEN 'COPYSHOP' THEN
      IF NEW.type NOT IN (
        'POSTER','CARD_FLYER','FOLDED_FLYER','BROCHURE',
        'BUSINESS_CARD','BINDING','PRINTOUT'
      ) THEN
        RAISE EXCEPTION 'Invalid type "%" for department COPYSHOP', NEW.type;
      END IF;
    WHEN 'TEXTILE' THEN
      IF NEW.type <> 'TEXTILE_GARMENT' THEN
        RAISE EXCEPTION 'Invalid type "%" for department TEXTILE', NEW.type;
      END IF;
    WHEN 'STAMP' THEN
      IF NEW.type NOT IN (
        'TRODAT_PRINTY','WOODEN_STAMP','STAND_STAMP','DATE_STAMP',
        'OTHER_STAMP','REFILL_INK','INK_PAD','STAMP_PLATE',
        'TRODAT_PAD'
      ) THEN
        RAISE EXCEPTION 'Invalid type "%" for department STAMP', NEW.type;
      END IF;
    WHEN 'LASER_ENGRAVING' THEN
      IF NEW.type NOT IN (
        'SIGN','TROPHY_PLATE','NAME_TAG','GIFT_ITEM','OTHER_LASER'
      ) THEN
        RAISE EXCEPTION 'Invalid type "%" for department LASER_ENGRAVING', NEW.type;
      END IF;
    WHEN 'OTHER' THEN
      IF NEW.type <> 'OTHER' THEN
        RAISE EXCEPTION 'Department OTHER allows only type = OTHER';
      END IF;
  END CASE;
  RETURN NEW;
END;
$$;

/**
 * Trigger: when a product enters PREPRESS or IN_PRODUCTION and its department
 * has a default assignee for that stage, hands the product to that user —
 * whoever held it before — and appends an ASSIGNEE_CHANGED history entry
 * flagged `automatic`. Without a default, or when the default already holds
 * it, nothing changes. Leaving a stage (back to setup, done) never reassigns.
 *
 * Runs as the invoking user: `history` lets every authenticated user append,
 * and `auth.uid()` then names who moved the product (NULL under the service
 * role).
 *
 * @trigger BEFORE UPDATE OF status ON products (per row), when the status changes
 */
CREATE OR REPLACE FUNCTION "public"."fn_assign_stage_default_assignee"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" = ''
    AS $$
DECLARE
  default_user uuid;
BEGIN
  IF NEW.status NOT IN ('PREPRESS', 'IN_PRODUCTION') THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO default_user
  FROM public.department_default_assignees
  WHERE department = NEW.department AND status = NEW.status;

  IF default_user IS NULL OR default_user IS NOT DISTINCT FROM OLD.assignee_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.history (order_id, product_id, event_type, user_id, meta)
  VALUES (
    NEW.order_id,
    NEW.id,
    'ASSIGNEE_CHANGED',
    auth.uid(),
    jsonb_build_object(
      'previous_assignee_id', OLD.assignee_id,
      'new_assignee_id', default_user,
      'automatic', true
    )
  );

  NEW.assignee_id := default_user;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."fn_department_abbreviation"("public"."department") OWNER TO "postgres";

ALTER FUNCTION "public"."fn_generate_product_number"() OWNER TO "postgres";

ALTER FUNCTION "public"."fn_check_approval_file_order"() OWNER TO "postgres";

ALTER FUNCTION "public"."fn_check_product_file_order"() OWNER TO "postgres";

ALTER FUNCTION "public"."fn_check_product_type"() OWNER TO "postgres";

ALTER FUNCTION "public"."fn_assign_stage_default_assignee"() OWNER TO "postgres";

-- ── constraints ──────────────────────────────────────────────────────────────

ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_product_number_key" UNIQUE ("product_number");

ALTER TABLE ONLY "public"."product_number_counter"
    ADD CONSTRAINT "product_number_counter_pkey" PRIMARY KEY ("order_id", "department");

ALTER TABLE ONLY "public"."product_number_counter"
    ADD CONSTRAINT "product_number_counter_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "fk_approval_file" FOREIGN KEY ("customer_approval_file_id") REFERENCES "public"."files"("id");

ALTER TABLE ONLY "public"."product_files"
    ADD CONSTRAINT "product_files_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."product_files"
    ADD CONSTRAINT "product_files_product_id_file_id_key" UNIQUE ("product_id", "file_id");

ALTER TABLE ONLY "public"."product_files"
    ADD CONSTRAINT "product_files_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."product_files"
    ADD CONSTRAINT "product_files_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE CASCADE;

-- ── indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX "idx_products_order_id" ON "public"."products" USING "btree" ("order_id");

CREATE INDEX "idx_products_department" ON "public"."products" USING "btree" ("department");

CREATE INDEX "idx_products_status" ON "public"."products" USING "btree" ("status");

CREATE INDEX "idx_products_assignee_id" ON "public"."products" USING "btree" ("assignee_id");

CREATE INDEX "product_files_product_id_idx" ON "public"."product_files" USING "btree" ("product_id");

CREATE INDEX "product_files_file_id_idx" ON "public"."product_files" USING "btree" ("file_id");

-- ── triggers ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE TRIGGER "trg_product_number" BEFORE INSERT ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."fn_generate_product_number"();

CREATE OR REPLACE TRIGGER "trg_approval_file_order_check" BEFORE INSERT OR UPDATE OF "customer_approval_file_id", "order_id" ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."fn_check_approval_file_order"();

CREATE OR REPLACE TRIGGER "trg_product_type_check" BEFORE INSERT OR UPDATE OF "department", "type" ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."fn_check_product_type"();

CREATE OR REPLACE TRIGGER "trg_product_file_order_check" BEFORE INSERT OR UPDATE OF "product_id", "file_id" ON "public"."product_files" FOR EACH ROW EXECUTE FUNCTION "public"."fn_check_product_file_order"();

CREATE OR REPLACE TRIGGER "trg_assign_stage_default_assignee"
    BEFORE UPDATE OF "status" ON "public"."products"
    FOR EACH ROW
    WHEN (OLD."status" IS DISTINCT FROM NEW."status")
    EXECUTE FUNCTION "public"."fn_assign_stage_default_assignee"();

-- ── RLS ──────────────────────────────────────────────────────────────────────

CREATE POLICY "Employees: full access" ON "public"."products" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."product_number_counter" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."product_files" TO "authenticated" USING (true) WITH CHECK (true);

-- Everyone reads (the production page and the product header show assignees);
-- only admins change the defaults.
CREATE POLICY "Employees: read" ON "public"."department_default_assignees"
    FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Admins: write" ON "public"."department_default_assignees"
    FOR ALL TO "authenticated"
    USING ("public"."current_user_role"() IN ('ADMIN', 'SUPER_ADMIN'))
    WITH CHECK ("public"."current_user_role"() IN ('ADMIN', 'SUPER_ADMIN'));

ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."product_number_counter" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."product_files" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."department_default_assignees" ENABLE ROW LEVEL SECURITY;

-- ── grants ───────────────────────────────────────────────────────────────────

GRANT ALL ON FUNCTION "public"."fn_department_abbreviation"("public"."department") TO "anon";

GRANT ALL ON FUNCTION "public"."fn_department_abbreviation"("public"."department") TO "authenticated";

GRANT ALL ON FUNCTION "public"."fn_department_abbreviation"("public"."department") TO "service_role";

GRANT ALL ON FUNCTION "public"."fn_generate_product_number"() TO "anon";

GRANT ALL ON FUNCTION "public"."fn_generate_product_number"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."fn_generate_product_number"() TO "service_role";

GRANT ALL ON FUNCTION "public"."fn_check_approval_file_order"() TO "anon";

GRANT ALL ON FUNCTION "public"."fn_check_approval_file_order"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."fn_check_approval_file_order"() TO "service_role";

GRANT ALL ON FUNCTION "public"."fn_check_product_file_order"() TO "anon";

GRANT ALL ON FUNCTION "public"."fn_check_product_file_order"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."fn_check_product_file_order"() TO "service_role";

GRANT ALL ON FUNCTION "public"."fn_check_product_type"() TO "anon";

GRANT ALL ON FUNCTION "public"."fn_check_product_type"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."fn_check_product_type"() TO "service_role";

GRANT ALL ON FUNCTION "public"."fn_assign_stage_default_assignee"() TO "anon";

GRANT ALL ON FUNCTION "public"."fn_assign_stage_default_assignee"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."fn_assign_stage_default_assignee"() TO "service_role";

GRANT ALL ON TABLE "public"."products" TO "anon";

GRANT ALL ON TABLE "public"."products" TO "authenticated";

GRANT ALL ON TABLE "public"."products" TO "service_role";

GRANT ALL ON TABLE "public"."product_number_counter" TO "anon";

GRANT ALL ON TABLE "public"."product_number_counter" TO "authenticated";

GRANT ALL ON TABLE "public"."product_number_counter" TO "service_role";

GRANT ALL ON TABLE "public"."product_files" TO "anon";

GRANT ALL ON TABLE "public"."product_files" TO "authenticated";

GRANT ALL ON TABLE "public"."product_files" TO "service_role";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."department_default_assignees" TO "authenticated";

GRANT ALL ON TABLE "public"."department_default_assignees" TO "service_role";

-- ── comments ─────────────────────────────────────────────────────────────────

COMMENT ON TABLE "public"."products" IS 'The unit of work: one product of one department, parent of its typed child row (chosen by `type`). Carries the production workflow (status, assignee, approval, cancellation) the old `jobs` table held. All type values are ASCII without diacritics (e.g. BROCHURE).';

COMMENT ON COLUMN "public"."products"."product_number" IS 'Human-facing product number: <order_number>-<DEPT>-<NN> (per-order-per-department sequence). Assigned by fn_generate_product_number() on insert; never set by the client.';

COMMENT ON COLUMN "public"."products"."quantity" IS 'NULL for a TEXTILE batch — its quantities live on the textile_garments lines.';

COMMENT ON FUNCTION "public"."fn_generate_product_number"() IS 'Atomic per-order-per-department counter using INSERT ... ON CONFLICT DO UPDATE. No race condition on concurrent inserts. Numbers of deleted products are never reused.';

COMMENT ON TABLE "public"."product_number_counter" IS 'Per-order-per-department counter for product numbers. One row per (order, department). Written exclusively via fn_generate_product_number(). Direct UPDATEs are forbidden — they would corrupt the numbering sequence.';

COMMENT ON TABLE "public"."product_files" IS 'M:N link from a product to files of its order. The file itself always belongs to the order.';

COMMENT ON TABLE "public"."department_default_assignees" IS 'One default assignee per department and stage (PREPRESS or IN_PRODUCTION). When a product enters that stage, fn_assign_stage_default_assignee assigns it to this user; without a row the assignee is left as it is. Deleting the user removes the row (cascade).';

-- ── product_time_logs ────────────────────────────────────────────────────────
-- Per-product worked-time entries. The total is always SUM(minutes) over the
-- logs — there is no denormalized aggregate. `user_id` is whom the time is
-- attributed to; `created_by` is who wrote the row. They differ only when an
-- admin logs on someone's behalf (enforced by RLS below). Rows are immutable:
-- no UPDATE policy exists; corrections are admin-only DELETE + re-log, each
-- side recorded in history (TIME_LOGGED / TIME_LOG_DELETED).

CREATE TABLE IF NOT EXISTS "public"."product_time_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    -- Whom the time is attributed to. SET NULL on user deletion (matches
    -- products.assignee_id); the UI shows a placeholder for orphaned logs.
    "user_id" "uuid",
    -- Who created the row (the signed-in actor).
    "created_by" "uuid",
    "minutes" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "product_time_logs_minutes_positive" CHECK (("minutes" > 0))
);

ALTER TABLE "public"."product_time_logs" OWNER TO "postgres";

ALTER TABLE ONLY "public"."product_time_logs"
    ADD CONSTRAINT "product_time_logs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."product_time_logs"
    ADD CONSTRAINT "product_time_logs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."product_time_logs"
    ADD CONSTRAINT "product_time_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."product_time_logs"
    ADD CONSTRAINT "product_time_logs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;

CREATE INDEX "idx_product_time_logs_product_id" ON "public"."product_time_logs" USING "btree" ("product_id");

-- Everyone may read logs; inserts must be written as yourself, and may only
-- be attributed to someone else by an admin; deletes are admin-only.
CREATE POLICY "Employees: read" ON "public"."product_time_logs"
    FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Log own time; admins on behalf" ON "public"."product_time_logs"
    FOR INSERT TO "authenticated"
    WITH CHECK (
        ("created_by" = ( SELECT "auth"."uid"() ))
        AND (
            ("user_id" = ( SELECT "auth"."uid"() ))
            OR ("public"."current_user_role"() IN ('ADMIN', 'SUPER_ADMIN'))
        )
    );

CREATE POLICY "Admins: delete" ON "public"."product_time_logs"
    FOR DELETE TO "authenticated"
    USING ("public"."current_user_role"() IN ('ADMIN', 'SUPER_ADMIN'));

ALTER TABLE "public"."product_time_logs" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "public"."product_time_logs" TO "anon";

GRANT ALL ON TABLE "public"."product_time_logs" TO "authenticated";

GRANT ALL ON TABLE "public"."product_time_logs" TO "service_role";

COMMENT ON TABLE "public"."product_time_logs" IS 'Worked-time entries per product. user_id = attributed employee, created_by = actor; total time is SUM(minutes) — no aggregate column. Append-only for employees; admins may delete (with TIME_LOG_DELETED history).';

-- ── realtime ─────────────────────────────────────────────────────────────────
-- The production feed lists products across all orders, so someone else's
-- release, reassignment or completion has to reach every open client.

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."products";
