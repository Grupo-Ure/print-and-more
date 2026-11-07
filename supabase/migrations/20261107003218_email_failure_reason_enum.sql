-- failed_emails.reason as an enum (MKS-7). The column was text with a check
-- of the five codes, so the generated type was a plain string and the app
-- matched it against bare literals. A fixed set of values is an enum here,
-- as order_status and history_event are; the generated type becomes the
-- union, and a code the app does not handle no longer compiles.

CREATE TYPE "public"."email_failure_reason" AS ENUM (
    'unknown_template',
    'no_settings_row',
    'render_failed',
    'resolve_failed',
    'provider_refused'
);

ALTER TYPE "public"."email_failure_reason" OWNER TO "postgres";

COMMENT ON TYPE "public"."email_failure_reason" IS
    'Why the sender gave a mail up: unknown_template, no_settings_row, render_failed (the wording names a slot the data lacks), resolve_failed (looking the data up failed on the last allowed attempt), provider_refused (the provider refused it on the last allowed attempt).';

ALTER TABLE "public"."failed_emails" DROP CONSTRAINT "failed_emails_reason_check";

ALTER TABLE "public"."failed_emails"
    ALTER COLUMN "reason" TYPE "public"."email_failure_reason" USING "reason"::"public"."email_failure_reason";

COMMENT ON COLUMN "public"."failed_emails"."reason" IS
    'What stopped the mail; the codes are described on the email_failure_reason type.';
