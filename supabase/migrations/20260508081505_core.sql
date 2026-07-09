-- 20260508081505_core.sql — customers, users

CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "note" "text",
    "is_archived" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "street" "text",
    "house_number" "text",
    "postal_code" "text",
    "city" "text",
    CONSTRAINT "customers_contact_required" CHECK ((("email" IS NOT NULL) OR ("phone" IS NOT NULL)))
);

ALTER TABLE "public"."customers" OWNER TO "postgres";

-- ── users ────────────────────────────────────────────────────────────────────
-- App-facing user record, 1:1 with auth.users. Nothing in the app reads the
-- auth schema directly; this table is the only surface.

CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "role" "public"."user_role" DEFAULT 'EMPLOYEE'::"public"."user_role" NOT NULL,
    -- Profile image URL. Auto-filled from raw_user_meta_data on signup (OAuth
    -- providers set avatar_url there); NULL for password accounts — the UI
    -- falls back to initials.
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."users" OWNER TO "postgres";

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

-- Auto-provision a public.users row for every new auth user. The initial role
-- is read from raw_app_meta_data, which only the service-role admin API can
-- set (client signUp option data lands in raw_user_meta_data), and is capped
-- at ADMIN: SUPER_ADMIN can never enter through this path.
CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'name', ''), split_part(NEW.email, '@', 1)),
    CASE WHEN NEW.raw_app_meta_data->>'role' = 'ADMIN'
         THEN 'ADMIN'::public.user_role
         ELSE 'EMPLOYEE'::public.user_role
    END,
    NULLIF(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

CREATE TRIGGER "on_auth_user_created"
  AFTER INSERT ON "auth"."users"
  FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();

-- Caller's role, readable from RLS policies without recursing into the
-- users table's own policies.
CREATE OR REPLACE FUNCTION "public"."current_user_role"() RETURNS "public"."user_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" = ''
    AS $$
  SELECT role FROM public.users WHERE id = (SELECT auth.uid());
$$;

ALTER FUNCTION "public"."current_user_role"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."current_user_role"() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."current_user_role"() TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."current_user_role"() TO "service_role";

-- Role rules, enforced independently of RLS (a trigger sees OLD and NEW,
-- WITH CHECK cannot):
--   * Only direct SQL as the DB owner may grant/revoke SUPER_ADMIN or modify
--     a SUPER_ADMIN row. service_role is deliberately not exempt, so no app
--     or server path can escalate.
--   * Nobody changes their own role.
--   * Only SUPER_ADMIN switches others between EMPLOYEE and ADMIN.
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

  IF OLD.role = 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'SUPER_ADMIN accounts cannot be modified through the application';
  END IF;

  IF NEW.role = 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'SUPER_ADMIN can only be granted by the database owner';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF (SELECT auth.uid()) = OLD.id THEN
      RAISE EXCEPTION 'Users cannot change their own role';
    END IF;
    IF public.current_user_role() IS DISTINCT FROM 'SUPER_ADMIN' THEN
      RAISE EXCEPTION 'Only super admins can change user roles';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."enforce_user_role_rules"() OWNER TO "postgres";

CREATE TRIGGER "trg_enforce_user_role_rules"
  BEFORE UPDATE ON "public"."users"
  FOR EACH ROW EXECUTE FUNCTION "public"."enforce_user_role_rules"();

-- SUPER_ADMIN rows are deletable only by the DB owner. Also blocks the
-- cascade from auth.admin.deleteUser (GoTrue runs as supabase_auth_admin).
-- INVOKER rights for the same current_user reason as above.
CREATE OR REPLACE FUNCTION "public"."prevent_super_admin_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" = ''
    AS $$
BEGIN
  IF OLD.role = 'SUPER_ADMIN' AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'SUPER_ADMIN accounts cannot be deleted through the application';
  END IF;
  RETURN OLD;
END;
$$;

ALTER FUNCTION "public"."prevent_super_admin_delete"() OWNER TO "postgres";

CREATE TRIGGER "trg_prevent_super_admin_delete"
  BEFORE DELETE ON "public"."users"
  FOR EACH ROW EXECUTE FUNCTION "public"."prevent_super_admin_delete"();

-- ── customers constraints/indexes ────────────────────────────────────────────

ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");

CREATE INDEX "idx_customers_archived" ON "public"."customers" USING "btree" ("is_archived");

CREATE INDEX "idx_customers_name_fulltext" ON "public"."customers" USING "gin" ("to_tsvector"('"simple"'::"regconfig", "name"));

-- ── RLS ──────────────────────────────────────────────────────────────────────

CREATE POLICY "Employees: full access" ON "public"."customers" TO "authenticated" USING (true) WITH CHECK (true);

-- Everyone authenticated can read users (id→name/email maps in the UI).
-- Updates are super-admin only; the trigger further constrains what may
-- change. No INSERT/DELETE policies: rows are created by handle_new_user and
-- removed via the auth.users cascade only.
CREATE POLICY "Users: read for all employees" ON "public"."users"
  FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Users: super admins update" ON "public"."users"
  FOR UPDATE TO "authenticated"
  USING ("public"."current_user_role"() = 'SUPER_ADMIN')
  WITH CHECK ("public"."current_user_role"() = 'SUPER_ADMIN');

ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "public"."customers" TO "anon";

GRANT ALL ON TABLE "public"."customers" TO "authenticated";

GRANT ALL ON TABLE "public"."customers" TO "service_role";

GRANT SELECT, UPDATE ON TABLE "public"."users" TO "authenticated";

GRANT ALL ON TABLE "public"."users" TO "service_role";

-- Default privileges in the Supabase baseline grant table access to anon;
-- users must not be readable without a session.
REVOKE ALL ON TABLE "public"."users" FROM "anon";

COMMENT ON TABLE "public"."customers" IS 'Reusable customer master data. Required: name + at least email or phone.';

COMMENT ON TABLE "public"."users" IS 'App user record, 1:1 with auth.users. role: EMPLOYEE | ADMIN | SUPER_ADMIN. SUPER_ADMIN is granted only via direct SQL by the DB owner.';
