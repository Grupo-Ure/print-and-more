-- 20260508081507_jobs.sql — jobs (+ type/approval guards)
-- Split from baseline 20260508081503_remote_schema.sql (delete that file once verified).

CREATE TABLE IF NOT EXISTS "public"."jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "department" "public"."department" NOT NULL,
    "type" "text",
    "status" "public"."job_status" DEFAULT 'IN_SETUP'::"public"."job_status" NOT NULL,
    "deadline" "date",
    "delivery" "public"."delivery_type",
    -- Nullable, no default: NULL means "inherit the parent order's priority"
    -- (mirrors delivery above). Resolution happens in application code.
    "priority" "public"."priority_type",
    "assignee_id" "uuid",
    "typesetting_minutes" integer,
    "data_status" "text",
    "detail" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "customer_approval_required" boolean DEFAULT false NOT NULL,
    "customer_approval_granted" boolean DEFAULT false NOT NULL,
    "customer_approval_file_id" "uuid",
    "is_cancelled" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "approval_consistency" CHECK (((NOT (("customer_approval_granted" = true) AND ("customer_approval_required" = false))) AND (NOT (("customer_approval_granted" = true) AND ("customer_approval_file_id" IS NULL))) AND (NOT (("customer_approval_file_id" IS NOT NULL) AND ("customer_approval_required" = false))))),
    CONSTRAINT "typesetting_time_positive" CHECK ((("typesetting_minutes" IS NULL) OR ("typesetting_minutes" > 0)))
);

ALTER TABLE "public"."jobs" OWNER TO "postgres";

/**
 * Trigger guard: a job's customer-approval file must come from its own order.
 * If `customer_approval_file_id` is set, that file must belong to the job's
 * `order_id`.
 *
 * @trigger BEFORE INSERT OR UPDATE OF customer_approval_file_id, order_id ON jobs (per row)
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
        'Approval file (%) does not belong to the order of this job (%)',
        NEW.customer_approval_file_id, NEW.order_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

/**
 * Trigger guard: validates `jobs.type` against the department's allowed set
 * (e.g. COPYSHOP → POSTER/CARD_FLYER/…; STAMP → TRODAT_PRINTY/…; LFP, LASER_ENGRAVING
 * each have their own list). TEXTILE must have a NULL type; OTHER allows only
 * 'OTHER' or NULL.
 *
 * @trigger BEFORE INSERT OR UPDATE OF department, type ON jobs (per row)
 * @raises when the type is not valid for the department.
 */
CREATE OR REPLACE FUNCTION "public"."fn_check_job_type"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  CASE NEW.department
    WHEN 'LFP' THEN
      IF NEW.type IS NOT NULL AND NEW.type NOT IN (
        'STICKER','SIGN_UV','SIGN_FOIL','FOIL_PLOTTER',
        'BANNER','ROLLUP','VEHICLE_LETTERING','OTHER_LFP'
      ) THEN
        RAISE EXCEPTION 'Invalid type "%" for department LFP', NEW.type;
      END IF;
    WHEN 'COPYSHOP' THEN
      IF NEW.type IS NOT NULL AND NEW.type NOT IN (
        'POSTER','CARD_FLYER','FOLDED_FLYER','BROCHURE',
        'BUSINESS_CARD','BINDING','PRINTOUT'
      ) THEN
        RAISE EXCEPTION 'Invalid type "%" for department COPYSHOP', NEW.type;
      END IF;
    WHEN 'TEXTILE' THEN
      IF NEW.type IS NOT NULL THEN
        RAISE EXCEPTION 'Department TEXTILE does not use a type value';
      END IF;
    WHEN 'STAMP' THEN
      IF NEW.type IS NOT NULL AND NEW.type NOT IN (
        'TRODAT_PRINTY','WOODEN_STAMP','STAND_STAMP','DATE_STAMP',
        'OTHER_STAMP','REFILL_INK','INK_PAD','STAMP_PLATE',
        'TRODAT_PAD'
      ) THEN
        RAISE EXCEPTION 'Invalid type "%" for department STAMP', NEW.type;
      END IF;
    WHEN 'LASER_ENGRAVING' THEN
      IF NEW.type IS NOT NULL AND NEW.type NOT IN (
        'SIGN','TROPHY_PLATE','NAME_TAG','GIFT_ITEM','OTHER_LASER'
      ) THEN
        RAISE EXCEPTION 'Invalid type "%" for department LASER_ENGRAVING', NEW.type;
      END IF;
    WHEN 'OTHER' THEN
      IF NEW.type IS NOT NULL AND NEW.type != 'OTHER' THEN
        RAISE EXCEPTION 'Department OTHER allows only type = OTHER or NULL';
      END IF;
  END CASE;
  RETURN NEW;
END;
$$;

-- Only admins (ADMIN / SUPER_ADMIN) may change a job's assignee. INSERT is
-- deliberately unguarded: job creation auto-assigns the creator. Must run with
-- INVOKER rights so the owner bypass only fires for direct DB-owner SQL (same
-- reasoning as enforce_user_role_rules in the core migration).
CREATE OR REPLACE FUNCTION "public"."fn_enforce_job_assignee_rules"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" = ''
    AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id
     AND public.current_user_role() NOT IN ('ADMIN', 'SUPER_ADMIN') THEN
    RAISE EXCEPTION 'Only admins can change a job''s assignee';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."fn_check_approval_file_order"() OWNER TO "postgres";

ALTER FUNCTION "public"."fn_check_job_type"() OWNER TO "postgres";

ALTER FUNCTION "public"."fn_enforce_job_assignee_rules"() OWNER TO "postgres";

ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "fk_approval_file" FOREIGN KEY ("customer_approval_file_id") REFERENCES "public"."files"("id");

ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;

CREATE INDEX "idx_jobs_order_id" ON "public"."jobs" USING "btree" ("order_id");

CREATE INDEX "idx_jobs_department" ON "public"."jobs" USING "btree" ("department");

CREATE INDEX "idx_jobs_status" ON "public"."jobs" USING "btree" ("status");

CREATE OR REPLACE TRIGGER "trg_approval_file_order_check" BEFORE INSERT OR UPDATE OF "customer_approval_file_id", "order_id" ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."fn_check_approval_file_order"();

CREATE OR REPLACE TRIGGER "trg_job_type_check" BEFORE INSERT OR UPDATE OF "department", "type" ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."fn_check_job_type"();

CREATE OR REPLACE TRIGGER "trg_job_assignee_rules" BEFORE UPDATE OF "assignee_id" ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."fn_enforce_job_assignee_rules"();

CREATE POLICY "Employees: full access" ON "public"."jobs" TO "authenticated" USING (true) WITH CHECK (true);

ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON FUNCTION "public"."fn_check_approval_file_order"() TO "anon";

GRANT ALL ON FUNCTION "public"."fn_check_approval_file_order"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."fn_check_approval_file_order"() TO "service_role";

GRANT ALL ON FUNCTION "public"."fn_check_job_type"() TO "anon";

GRANT ALL ON FUNCTION "public"."fn_check_job_type"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."fn_check_job_type"() TO "service_role";

GRANT ALL ON FUNCTION "public"."fn_enforce_job_assignee_rules"() TO "anon";

GRANT ALL ON FUNCTION "public"."fn_enforce_job_assignee_rules"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."fn_enforce_job_assignee_rules"() TO "service_role";

GRANT ALL ON TABLE "public"."jobs" TO "anon";

GRANT ALL ON TABLE "public"."jobs" TO "authenticated";

GRANT ALL ON TABLE "public"."jobs" TO "service_role";

COMMENT ON TABLE "public"."jobs" IS 'Core operational unit. Status must never be QUOTE (CHECK constraint). detail (JSONB): required-field logic lives in application code (Zod), not the DB. All type values are ASCII without diacritics (e.g. BROCHURE).';

COMMENT ON COLUMN "public"."jobs"."detail" IS 'Department-specific fields as JSONB. Validation in application code, not the DB. Intentional: allows new departments without a DB migration.';
