-- 20260508081505_core.sql — customers, profiles, employees
-- Split from baseline 20260508081503_remote_schema.sql (delete that file once verified).

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

CREATE OR REPLACE VIEW "public"."employees" AS
 SELECT "id",
    "email"
   FROM "auth"."users"
  WHERE ("auth"."uid"() IS NOT NULL)
  ORDER BY "email";

ALTER VIEW "public"."employees" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "name" "text" NOT NULL
);

ALTER TABLE "public"."profiles" OWNER TO "postgres";

ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

CREATE INDEX "idx_customers_archived" ON "public"."customers" USING "btree" ("is_archived");

CREATE INDEX "idx_customers_name_fulltext" ON "public"."customers" USING "gin" ("to_tsvector"('"simple"'::"regconfig", "name"));

CREATE POLICY "Employees: full access" ON "public"."customers" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."profiles" TO "authenticated" USING (true) WITH CHECK (true);

ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "public"."customers" TO "anon";

GRANT ALL ON TABLE "public"."customers" TO "authenticated";

GRANT ALL ON TABLE "public"."customers" TO "service_role";

GRANT ALL ON TABLE "public"."employees" TO "anon";

GRANT ALL ON TABLE "public"."employees" TO "authenticated";

GRANT ALL ON TABLE "public"."employees" TO "service_role";

GRANT ALL ON TABLE "public"."profiles" TO "anon";

GRANT ALL ON TABLE "public"."profiles" TO "authenticated";

GRANT ALL ON TABLE "public"."profiles" TO "service_role";

COMMENT ON TABLE "public"."customers" IS 'Reusable customer master data. Required: name + at least email or phone.';
