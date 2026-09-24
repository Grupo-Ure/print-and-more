-- 20260923144410_production_job_assignment.sql — job assignment rules for the
-- Production page (see .plans/BACK_OFFICE_PAGE.md, WP1).
--
-- 1. Anyone may assign or reassign a job: the admin-only guard on
--    jobs.assignee_id goes away.
-- 2. One default assignee per department and stage (PREPRESS,
--    IN_PRODUCTION), configured on the Settings page
--    (department_default_assignees).
-- 3. A job gets no assignee at creation. The moment it enters a stage that
--    has a default, a BEFORE UPDATE trigger hands it to that user and records
--    the change in the history; without a default the assignee stays as it
--    is. Done in the database so every path into a stage (automatic
--    promotion, manual release, force release, going back to pre-press)
--    behaves the same.
-- 4. The history guard fn_check_job_belongs_to_order is made safe to run
--    nested inside a function that pins search_path (the trigger above).

-- ── 1. Drop the admin-only assignee guard ────────────────────────────────────

DROP TRIGGER IF EXISTS "trg_job_assignee_rules" ON "public"."jobs";

DROP FUNCTION IF EXISTS "public"."fn_enforce_job_assignee_rules"();

-- ── 2. department_default_assignees ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "public"."department_default_assignees" (
    "department" "public"."department" NOT NULL,
    "status" "public"."job_status" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "department_default_assignees_pkey" PRIMARY KEY ("department", "status"),
    CONSTRAINT "department_default_assignees_status_check"
        CHECK ("status" IN ('PREPRESS', 'IN_PRODUCTION')),
    CONSTRAINT "department_default_assignees_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."department_default_assignees" OWNER TO "postgres";

COMMENT ON TABLE "public"."department_default_assignees" IS
    'One default assignee per department and stage (PREPRESS or IN_PRODUCTION). When a job enters that stage, fn_assign_stage_default_assignee assigns it to this user; without a row the assignee is left as it is. Deleting the user removes the row (cascade).';

-- Everyone reads (the Production page and the job header show assignees);
-- only admins change the defaults.
CREATE POLICY "Employees: read" ON "public"."department_default_assignees"
    FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Admins: write" ON "public"."department_default_assignees"
    FOR ALL TO "authenticated"
    USING ("public"."current_user_role"() IN ('ADMIN', 'SUPER_ADMIN'))
    WITH CHECK ("public"."current_user_role"() IN ('ADMIN', 'SUPER_ADMIN'));

ALTER TABLE "public"."department_default_assignees" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."department_default_assignees" TO "authenticated";

GRANT ALL ON TABLE "public"."department_default_assignees" TO "service_role";

-- ── 3. Default assignee on entering a stage ─────────────────────────────────

/**
 * Trigger: when a job enters PREPRESS or IN_PRODUCTION and its department has
 * a default assignee for that stage, hands the job to that user — whoever
 * held it before — and appends an ASSIGNEE_CHANGED history entry flagged
 * `automatic`. Without a default, or when the default already holds the job,
 * nothing changes. Leaving a stage (back to setup, done) never reassigns.
 *
 * Runs as the invoking user: `history` lets every authenticated user append,
 * and `auth.uid()` then names who moved the job (NULL under the service role).
 *
 * @trigger BEFORE UPDATE OF status ON jobs (per row), when the status changes
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

  INSERT INTO public.history (order_id, job_id, event_type, user_id, meta)
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

ALTER FUNCTION "public"."fn_assign_stage_default_assignee"() OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."fn_assign_stage_default_assignee"() TO "anon";

GRANT ALL ON FUNCTION "public"."fn_assign_stage_default_assignee"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."fn_assign_stage_default_assignee"() TO "service_role";

CREATE OR REPLACE TRIGGER "trg_assign_stage_default_assignee"
    BEFORE UPDATE OF "status" ON "public"."jobs"
    FOR EACH ROW
    WHEN (OLD."status" IS DISTINCT FROM NEW."status")
    EXECUTE FUNCTION "public"."fn_assign_stage_default_assignee"();

-- ── 4. History guard, nested-call safe ──────────────────────────────────────

-- A function-level `SET search_path` stays in effect for every trigger that
-- fires inside it. The history insert above therefore runs the guard below
-- with an empty search_path, where its unqualified `jobs` would not resolve.
-- Same check as in 20260508081517_audit.sql, with the schema spelled out.

/**
 * Trigger guard: a referenced job must belong to the referenced order.
 * For rows that carry both `order_id` and an optional `job_id` (history):
 * if `job_id` is set, it must belong to that `order_id`.
 *
 * @trigger BEFORE INSERT OR UPDATE OF job_id, order_id ON history (per row)
 * @raises when the job does not belong to the order.
 */
CREATE OR REPLACE FUNCTION "public"."fn_check_job_belongs_to_order"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" = ''
    AS $$
BEGIN
  IF NEW.job_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.jobs
      WHERE id = NEW.job_id AND order_id = NEW.order_id
    ) THEN
      RAISE EXCEPTION 'Job (%) does not belong to order (%)',
        NEW.job_id, NEW.order_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
