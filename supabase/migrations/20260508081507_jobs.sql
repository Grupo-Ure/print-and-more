-- 20260508081507_jobs.sql — jobs (+ job numbering, type/approval guards)
-- Split from baseline 20260508081503_remote_schema.sql (delete that file once verified).

CREATE TABLE IF NOT EXISTS "public"."jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    -- Assigned by trg_job_number BEFORE INSERT; never set by the client.
    "job_number" "text" NOT NULL,
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
    "data_status" "text",
    "customer_approval_required" boolean DEFAULT false NOT NULL,
    "customer_approval_granted" boolean DEFAULT false NOT NULL,
    "customer_approval_file_id" "uuid",
    "is_cancelled" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "approval_consistency" CHECK (((NOT (("customer_approval_granted" = true) AND ("customer_approval_required" = false))) AND (NOT (("customer_approval_granted" = true) AND ("customer_approval_file_id" IS NULL))) AND (NOT (("customer_approval_file_id" IS NOT NULL) AND ("customer_approval_required" = false)))))
);

ALTER TABLE "public"."jobs" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."job_number_counter" (
    "order_id" "uuid" NOT NULL,
    "department" "public"."department" NOT NULL,
    "last_value" integer NOT NULL
);

ALTER TABLE "public"."job_number_counter" OWNER TO "postgres";

/**
 * Department abbreviation used in job numbers. Must stay in sync with
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
 * Trigger: assigns `jobs.job_number` as `<order_number>-<DEPT>-<NN>`
 * (e.g. 2026-07-0042-LFP-01), where NN is a per-order-per-department
 * sequence. Uses an atomic INSERT ... ON CONFLICT DO UPDATE on
 * `job_number_counter`, so concurrent inserts never collide; the counter
 * never decrements, so numbers of deleted jobs are not reused.
 *
 * @trigger BEFORE INSERT ON jobs (per row)
 */
CREATE OR REPLACE FUNCTION "public"."fn_generate_job_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  seq_value            integer;
  parent_order_number  text;
BEGIN
  INSERT INTO job_number_counter (order_id, department, last_value)
  VALUES (NEW.order_id, NEW.department, 1)
  ON CONFLICT (order_id, department) DO UPDATE
    SET last_value = job_number_counter.last_value + 1
  RETURNING last_value INTO seq_value;

  SELECT order_number INTO parent_order_number
  FROM orders
  WHERE id = NEW.order_id;

  NEW.job_number :=
    parent_order_number || '-' ||
    fn_department_abbreviation(NEW.department) || '-' ||
    lpad(seq_value::text, 2, '0');

  RETURN NEW;
END;
$$;

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

ALTER FUNCTION "public"."fn_department_abbreviation"("public"."department") OWNER TO "postgres";

ALTER FUNCTION "public"."fn_generate_job_number"() OWNER TO "postgres";

ALTER FUNCTION "public"."fn_check_approval_file_order"() OWNER TO "postgres";

ALTER FUNCTION "public"."fn_check_job_type"() OWNER TO "postgres";

ALTER FUNCTION "public"."fn_enforce_job_assignee_rules"() OWNER TO "postgres";

ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_job_number_key" UNIQUE ("job_number");

ALTER TABLE ONLY "public"."job_number_counter"
    ADD CONSTRAINT "job_number_counter_pkey" PRIMARY KEY ("order_id", "department");

ALTER TABLE ONLY "public"."job_number_counter"
    ADD CONSTRAINT "job_number_counter_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "fk_approval_file" FOREIGN KEY ("customer_approval_file_id") REFERENCES "public"."files"("id");

ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;

CREATE INDEX "idx_jobs_order_id" ON "public"."jobs" USING "btree" ("order_id");

CREATE INDEX "idx_jobs_department" ON "public"."jobs" USING "btree" ("department");

CREATE INDEX "idx_jobs_status" ON "public"."jobs" USING "btree" ("status");

CREATE OR REPLACE TRIGGER "trg_job_number" BEFORE INSERT ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."fn_generate_job_number"();

CREATE OR REPLACE TRIGGER "trg_approval_file_order_check" BEFORE INSERT OR UPDATE OF "customer_approval_file_id", "order_id" ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."fn_check_approval_file_order"();

CREATE OR REPLACE TRIGGER "trg_job_type_check" BEFORE INSERT OR UPDATE OF "department", "type" ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."fn_check_job_type"();

CREATE OR REPLACE TRIGGER "trg_job_assignee_rules" BEFORE UPDATE OF "assignee_id" ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."fn_enforce_job_assignee_rules"();

CREATE POLICY "Employees: full access" ON "public"."jobs" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."job_number_counter" TO "authenticated" USING (true) WITH CHECK (true);

ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."job_number_counter" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON FUNCTION "public"."fn_department_abbreviation"("public"."department") TO "anon";

GRANT ALL ON FUNCTION "public"."fn_department_abbreviation"("public"."department") TO "authenticated";

GRANT ALL ON FUNCTION "public"."fn_department_abbreviation"("public"."department") TO "service_role";

GRANT ALL ON FUNCTION "public"."fn_generate_job_number"() TO "anon";

GRANT ALL ON FUNCTION "public"."fn_generate_job_number"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."fn_generate_job_number"() TO "service_role";

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

GRANT ALL ON TABLE "public"."job_number_counter" TO "anon";

GRANT ALL ON TABLE "public"."job_number_counter" TO "authenticated";

GRANT ALL ON TABLE "public"."job_number_counter" TO "service_role";

COMMENT ON TABLE "public"."jobs" IS 'Core operational unit. Status must never be QUOTE (CHECK constraint). All type values are ASCII without diacritics (e.g. BROCHURE).';

COMMENT ON COLUMN "public"."jobs"."job_number" IS 'Human-facing job number: <order_number>-<DEPT>-<NN> (per-order-per-department sequence). Assigned by fn_generate_job_number() on insert; never set by the client.';

COMMENT ON FUNCTION "public"."fn_generate_job_number"() IS 'Atomic per-order-per-department counter using INSERT ... ON CONFLICT DO UPDATE. No race condition on concurrent inserts. Numbers of deleted jobs are never reused.';

COMMENT ON TABLE "public"."job_number_counter" IS 'Per-order-per-department counter for job numbers. One row per (order, department). Written exclusively via fn_generate_job_number(). Direct UPDATEs are forbidden — they would corrupt the numbering sequence.';

-- ── job_time_logs ─────────────────────────────────────────────────────────────
-- Per-job worked-time entries (replaces the former jobs.typesetting_minutes
-- free-edit column). The job's total time is always SUM(minutes) over its
-- logs — there is no denormalized aggregate. `user_id` is whom the time is
-- attributed to; `created_by` is who wrote the row. They differ only when an
-- admin logs on someone's behalf (enforced by RLS below). Rows are immutable:
-- no UPDATE policy exists; corrections are admin-only DELETE + re-log, each
-- side recorded in history (TIME_LOGGED / TIME_LOG_DELETED).

CREATE TABLE IF NOT EXISTS "public"."job_time_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    -- Whom the time is attributed to. SET NULL on user deletion (matches
    -- jobs.assignee_id); the UI shows a placeholder for orphaned logs.
    "user_id" "uuid",
    -- Who created the row (the signed-in actor).
    "created_by" "uuid",
    "minutes" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "job_time_logs_minutes_positive" CHECK (("minutes" > 0))
);

ALTER TABLE "public"."job_time_logs" OWNER TO "postgres";

ALTER TABLE ONLY "public"."job_time_logs"
    ADD CONSTRAINT "job_time_logs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."job_time_logs"
    ADD CONSTRAINT "job_time_logs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."job_time_logs"
    ADD CONSTRAINT "job_time_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."job_time_logs"
    ADD CONSTRAINT "job_time_logs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;

CREATE INDEX "idx_job_time_logs_job_id" ON "public"."job_time_logs" USING "btree" ("job_id");

-- Everyone may read logs; inserts must be written as yourself, and may only
-- be attributed to someone else by an admin; deletes are admin-only.
CREATE POLICY "Employees: read" ON "public"."job_time_logs"
    FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Log own time; admins on behalf" ON "public"."job_time_logs"
    FOR INSERT TO "authenticated"
    WITH CHECK (
        ("created_by" = ( SELECT "auth"."uid"() ))
        AND (
            ("user_id" = ( SELECT "auth"."uid"() ))
            OR ("public"."current_user_role"() IN ('ADMIN', 'SUPER_ADMIN'))
        )
    );

CREATE POLICY "Admins: delete" ON "public"."job_time_logs"
    FOR DELETE TO "authenticated"
    USING ("public"."current_user_role"() IN ('ADMIN', 'SUPER_ADMIN'));

ALTER TABLE "public"."job_time_logs" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "public"."job_time_logs" TO "anon";

GRANT ALL ON TABLE "public"."job_time_logs" TO "authenticated";

GRANT ALL ON TABLE "public"."job_time_logs" TO "service_role";

COMMENT ON TABLE "public"."job_time_logs" IS 'Worked-time entries per job. user_id = attributed employee, created_by = actor; total time is SUM(minutes) — no aggregate column. Append-only for employees; admins may delete (with TIME_LOG_DELETED history).';
