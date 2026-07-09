-- 20260508081517_audit.sql — history, errors (+ belongs-to-order guard)
-- Split from baseline 20260508081503_remote_schema.sql (delete that file once verified).

CREATE TABLE IF NOT EXISTS "public"."errors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "job_id" "uuid",
    "text" "text" NOT NULL,
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."errors" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "job_id" "uuid",
    "event_type" "public"."history_event" NOT NULL,
    "user_id" "uuid",
    "reason" "text",
    "meta" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."history" OWNER TO "postgres";

/**
 * Trigger guard: a referenced job must belong to the referenced order.
 * For rows that carry both `order_id` and an optional `job_id` (errors,
 * history): if `job_id` is set, it must belong to that `order_id`.
 *
 * @trigger BEFORE INSERT OR UPDATE OF job_id, order_id ON errors and history (per row)
 * @raises when the job does not belong to the order.
 */
CREATE OR REPLACE FUNCTION "public"."fn_check_job_belongs_to_order"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.job_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM jobs
      WHERE id = NEW.job_id AND order_id = NEW.order_id
    ) THEN
      RAISE EXCEPTION 'Job (%) does not belong to order (%)',
        NEW.job_id, NEW.order_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."fn_check_job_belongs_to_order"() OWNER TO "postgres";

ALTER TABLE ONLY "public"."errors"
    ADD CONSTRAINT "errors_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."history"
    ADD CONSTRAINT "history_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."errors"
    ADD CONSTRAINT "errors_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."errors"
    ADD CONSTRAINT "errors_person_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."errors"
    ADD CONSTRAINT "errors_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id");

ALTER TABLE ONLY "public"."history"
    ADD CONSTRAINT "history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."history"
    ADD CONSTRAINT "history_person_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."history"
    ADD CONSTRAINT "history_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id");

CREATE INDEX "idx_errors_order_id" ON "public"."errors" USING "btree" ("order_id");

CREATE INDEX "idx_history_order_id" ON "public"."history" USING "btree" ("order_id");

CREATE INDEX "idx_history_created_at" ON "public"."history" USING "btree" ("created_at");

CREATE INDEX "idx_history_job_id" ON "public"."history" USING "btree" ("job_id");

CREATE OR REPLACE TRIGGER "trg_error_job_check" BEFORE INSERT OR UPDATE OF "job_id", "order_id" ON "public"."errors" FOR EACH ROW EXECUTE FUNCTION "public"."fn_check_job_belongs_to_order"();

CREATE OR REPLACE TRIGGER "trg_history_job_check" BEFORE INSERT OR UPDATE OF "job_id", "order_id" ON "public"."history" FOR EACH ROW EXECUTE FUNCTION "public"."fn_check_job_belongs_to_order"();

CREATE POLICY "Employees: full access" ON "public"."errors" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Employees: full access" ON "public"."history" TO "authenticated" USING (true) WITH CHECK (true);

ALTER TABLE "public"."errors" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."history" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON FUNCTION "public"."fn_check_job_belongs_to_order"() TO "anon";

GRANT ALL ON FUNCTION "public"."fn_check_job_belongs_to_order"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."fn_check_job_belongs_to_order"() TO "service_role";

GRANT ALL ON TABLE "public"."errors" TO "anon";

GRANT ALL ON TABLE "public"."errors" TO "authenticated";

GRANT ALL ON TABLE "public"."errors" TO "service_role";

GRANT ALL ON TABLE "public"."history" TO "anon";

GRANT ALL ON TABLE "public"."history" TO "authenticated";

GRANT ALL ON TABLE "public"."history" TO "service_role";
