-- 20260924131510_users_developer_flag.sql — hide developer accounts from the
-- assignee pickers.
--
-- A developer signs in to the production database as a super admin to debug,
-- and so far showed up as a team member wherever a user is picked: the job
-- header's assignee, the production feed's filter, the time-log form, the
-- department defaults. `users.is_developer` marks such an account; the UI
-- leaves it out of every picker (a job the account already holds still shows
-- who has it). The flag carries no privilege — it only hides the account —
-- and is set per database, so a local database can leave it off.
--
-- 1. users.is_developer, false for everyone (the shop's accounts stay as
--    they are).
-- 2. The update guard on users learns the new column: only super admins
--    change it (and, as before, a super admin row only by the account
--    itself), so the self-update policy still means profile editing only.
--    service_role may set it too — the flag cannot escalate anything, and a
--    server-side path (the e2e runner, a maintenance script) needs to.

-- ── 1. users.is_developer ────────────────────────────────────────────────────

ALTER TABLE "public"."users"
    ADD COLUMN "is_developer" boolean DEFAULT false NOT NULL;

COMMENT ON COLUMN "public"."users"."is_developer" IS
    'A developer account: left out of every assignee picker in the UI (job assignee, production filter, time logs, department defaults). Grants nothing.';

-- ── 2. Update guard ──────────────────────────────────────────────────────────

-- Same function as in 20260508081505_core.sql, plus the is_developer rule.
-- Must run with INVOKER rights: under SECURITY DEFINER current_user would be
-- the function owner (postgres) and the owner bypass would fire for everyone.
CREATE OR REPLACE FUNCTION "public"."enforce_user_role_rules"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" = ''
    AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'users.id cannot be changed';
  END IF;

  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'users.email mirrors the auth account and cannot be changed here';
  END IF;

  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'users.created_at cannot be changed';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF OLD.role = 'SUPER_ADMIN' OR NEW.role = 'SUPER_ADMIN' THEN
      RAISE EXCEPTION 'SUPER_ADMIN can only be granted or revoked by the database owner';
    END IF;
    IF (SELECT auth.uid()) = OLD.id THEN
      RAISE EXCEPTION 'Users cannot change their own role';
    END IF;
    IF public.current_user_role() IS DISTINCT FROM 'SUPER_ADMIN' THEN
      RAISE EXCEPTION 'Only super admins can change user roles';
    END IF;
  END IF;

  IF NEW.is_developer IS DISTINCT FROM OLD.is_developer
     AND current_user <> 'service_role'
     AND public.current_user_role() IS DISTINCT FROM 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'Only super admins can change the developer flag';
  END IF;

  IF OLD.role = 'SUPER_ADMIN' AND (SELECT auth.uid()) IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'SUPER_ADMIN accounts can only be modified by the account itself';
  END IF;

  RETURN NEW;
END;
$$;
