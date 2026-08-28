-- 20260508081516_blueprint.sql — Blueprint feature tables
-- Split from baseline 20260508081503_remote_schema.sql (delete that file once verified).

CREATE TABLE IF NOT EXISTS "public"."blueprint_customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "short_code" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."blueprint_customers" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."blueprint_job_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "filename" "text",
    "page_count" integer DEFAULT 1 NOT NULL,
    "format" "text" NOT NULL,
    "width_mm" numeric,
    "height_mm" numeric,
    "is_color" boolean NOT NULL,
    "copies" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "blueprint_job_items_copies_check" CHECK (("copies" > 0)),
    CONSTRAINT "blueprint_job_items_format_check" CHECK (("format" = ANY (ARRAY['A0'::"text", 'A1'::"text", 'A2'::"text", 'A3'::"text", 'A4'::"text", 'custom'::"text"]))),
    CONSTRAINT "blueprint_job_items_height_mm_check" CHECK ((("height_mm" IS NULL) OR ("height_mm" > (0)::numeric))),
    CONSTRAINT "blueprint_job_items_page_count_check" CHECK (("page_count" > 0)),
    CONSTRAINT "blueprint_job_items_width_mm_check" CHECK ((("width_mm" IS NULL) OR ("width_mm" > (0)::numeric)))
);

ALTER TABLE "public"."blueprint_job_items" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."blueprint_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "job_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "project_id" "uuid"
);

ALTER TABLE "public"."blueprint_jobs" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."blueprint_projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."blueprint_projects" OWNER TO "postgres";

ALTER TABLE ONLY "public"."blueprint_customers"
    ADD CONSTRAINT "blueprint_customers_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."blueprint_job_items"
    ADD CONSTRAINT "blueprint_job_items_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."blueprint_jobs"
    ADD CONSTRAINT "blueprint_jobs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."blueprint_projects"
    ADD CONSTRAINT "blueprint_projects_customer_id_name_key" UNIQUE ("customer_id", "name");

ALTER TABLE ONLY "public"."blueprint_projects"
    ADD CONSTRAINT "blueprint_projects_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."blueprint_job_items"
    ADD CONSTRAINT "blueprint_job_items_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."blueprint_jobs"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."blueprint_jobs"
    ADD CONSTRAINT "blueprint_jobs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."blueprint_customers"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."blueprint_jobs"
    ADD CONSTRAINT "blueprint_jobs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."blueprint_projects"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."blueprint_projects"
    ADD CONSTRAINT "blueprint_projects_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."blueprint_customers"("id") ON DELETE RESTRICT;

CREATE INDEX "idx_blueprint_job_items_job" ON "public"."blueprint_job_items" USING "btree" ("job_id");

CREATE INDEX "idx_blueprint_jobs_customer_date" ON "public"."blueprint_jobs" USING "btree" ("customer_id", "job_date");

CREATE INDEX "idx_blueprint_projects_customer" ON "public"."blueprint_projects" USING "btree" ("customer_id");

CREATE POLICY "Authenticated users only" ON "public"."blueprint_customers" USING (("auth"."role"() = 'authenticated'::"text"));

CREATE POLICY "Authenticated users only" ON "public"."blueprint_job_items" USING (("auth"."role"() = 'authenticated'::"text"));

CREATE POLICY "Authenticated users only" ON "public"."blueprint_jobs" USING (("auth"."role"() = 'authenticated'::"text"));

CREATE POLICY "Authenticated users only" ON "public"."blueprint_projects" USING (("auth"."role"() = 'authenticated'::"text"));

ALTER TABLE "public"."blueprint_customers" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."blueprint_job_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."blueprint_jobs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."blueprint_projects" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "public"."blueprint_customers" TO "anon";

GRANT ALL ON TABLE "public"."blueprint_customers" TO "authenticated";

GRANT ALL ON TABLE "public"."blueprint_customers" TO "service_role";

GRANT ALL ON TABLE "public"."blueprint_job_items" TO "anon";

GRANT ALL ON TABLE "public"."blueprint_job_items" TO "authenticated";

GRANT ALL ON TABLE "public"."blueprint_job_items" TO "service_role";

GRANT ALL ON TABLE "public"."blueprint_jobs" TO "anon";

GRANT ALL ON TABLE "public"."blueprint_jobs" TO "authenticated";

GRANT ALL ON TABLE "public"."blueprint_jobs" TO "service_role";

GRANT ALL ON TABLE "public"."blueprint_projects" TO "anon";

GRANT ALL ON TABLE "public"."blueprint_projects" TO "authenticated";

GRANT ALL ON TABLE "public"."blueprint_projects" TO "service_role";
