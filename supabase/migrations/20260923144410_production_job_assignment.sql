-- 20260923144410_production_job_assignment.sql — job assignment rules for the
-- Production page (see .plans/BACK_OFFICE_PAGE.md, WP1).
--
-- 1. Anyone may assign or reassign a job: the admin-only guard on
--    jobs.assignee_id goes away.
-- 2. At most one default assignee per department, configured on the
--    Settings page (department_default_assignees).
-- 3. Every job has an assignee from the moment it is created: the department
--    default if one exists, else the creating user. Done in a BEFORE INSERT
--    trigger so every creation path (the app, duplicate_order, later ones)
--    behaves the same.
-- 4. One-off backfill: jobs created before this rule take their order's
--    creator.

-- ── 1. Drop the admin-only assignee guard ────────────────────────────────────

DROP TRIGGER IF EXISTS "trg_job_assignee_rules" ON "public"."jobs";

DROP FUNCTION IF EXISTS "public"."fn_enforce_job_assignee_rules"();

-- ── 2. department_default_assignees ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "public"."department_default_assignees" (
    "department" "public"."department" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "department_default_assignees_pkey" PRIMARY KEY ("department"),
    CONSTRAINT "department_default_assignees_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."department_default_assignees" OWNER TO "postgres";

COMMENT ON TABLE "public"."department_default_assignees" IS
    'At most one default assignee per department. A new job of that department is assigned to this user unless the client sets an assignee; a department without a row assigns the creating user. Deleting the user removes the row (cascade).';

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

-- ── 3. Default assignee on insert ────────────────────────────────────────────

/**
 * Trigger: fills `jobs.assignee_id` when the client leaves it NULL — the
 * department's default assignee if configured, otherwise the signed-in user.
 * Under a connection without a user (service role, seeding) and no department
 * default the column stays NULL.
 *
 * @trigger BEFORE INSERT ON jobs (per row)
 */
CREATE OR REPLACE FUNCTION "public"."fn_default_job_assignee"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" = ''
    AS $$
BEGIN
  IF NEW.assignee_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO NEW.assignee_id
  FROM public.department_default_assignees
  WHERE department = NEW.department;

  IF NEW.assignee_id IS NULL THEN
    NEW.assignee_id := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."fn_default_job_assignee"() OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."fn_default_job_assignee"() TO "anon";

GRANT ALL ON FUNCTION "public"."fn_default_job_assignee"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."fn_default_job_assignee"() TO "service_role";

CREATE OR REPLACE TRIGGER "trg_default_job_assignee"
    BEFORE INSERT ON "public"."jobs"
    FOR EACH ROW EXECUTE FUNCTION "public"."fn_default_job_assignee"();

-- ── 4. Backfill ──────────────────────────────────────────────────────────────

-- Jobs created before this rule: attribute them to whoever created the order.
-- Orders without a recorded creator keep their unassigned jobs.
UPDATE "public"."jobs" AS "job"
SET "assignee_id" = "ord"."created_by"
FROM "public"."orders" AS "ord"
WHERE "ord"."id" = "job"."order_id"
  AND "job"."assignee_id" IS NULL
  AND "ord"."created_by" IS NOT NULL;
