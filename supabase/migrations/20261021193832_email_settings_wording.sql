-- 20261021193832_email_settings_wording.sql — a mail's wording lives in its email_settings row
--
-- CUSTOMER_APPROVAL.md, WP1 (decision 12). The shop edits a mail's subject
-- and body text in Settings → Emails without a deploy, so every mail type
-- has a row — the immediate ones too — and the row holds the wording:
--   subject       plain text with {{placeholder}} slots; one line once rendered
--   body          plain text with {{placeholder}} slots; a blank line starts a
--                 new paragraph
--   placeholders  the slots the wording may use — the names of the data the
--                 template's module resolves. Settings refuses any other.
--
-- The template folder keeps the structure around the wording (html.hbs and
-- text.hbs place it with {{{body}}}) and any fixed element; the sender
-- renders the row's text at send time. A template with no row is no longer
-- sent: the sender gives the mail up, as it does an unknown template.
--
-- queue_email is unchanged: it still reads is_enabled and delay_days only.

-- ── email_settings: the wording ──────────────────────────────────────────────

ALTER TABLE "public"."email_settings"
    ADD COLUMN "subject" "text",
    ADD COLUMN "body" "text",
    ADD COLUMN "placeholders" "text"[] DEFAULT '{}'::"text"[] NOT NULL;

-- test-message, the email system's own template, with the wording its
-- subject.hbs and html.hbs carried until now. Its context switches
-- (still_needed, dry_run_refuse) and the optional note stay in the code.
INSERT INTO "public"."email_settings" ("template", "subject", "body", "placeholders")
VALUES (
    'test-message',
    'Test message from Print And More',
    E'This is a test message from the Print And More email system. If you can read it, the template, the shared layout and the sender are working.\n\nOrder {{orderId}} · rendered {{renderedAt}}',
    ARRAY['orderId', 'productId', 'renderedAt']
)
ON CONFLICT ("template") DO UPDATE
    SET "subject" = EXCLUDED."subject",
        "body" = EXCLUDED."body",
        "placeholders" = EXCLUDED."placeholders";

ALTER TABLE "public"."email_settings"
    ALTER COLUMN "subject" SET NOT NULL,
    ALTER COLUMN "body" SET NOT NULL,
    ADD CONSTRAINT "email_settings_subject_check" CHECK (("btrim"("subject") <> ''::"text")),
    ADD CONSTRAINT "email_settings_body_check" CHECK (("btrim"("body") <> ''::"text"));

COMMENT ON TABLE "public"."email_settings" IS
    'One row per mail type, added by the migration that adds the mail: on/off, the delay before the first send, the repeat interval, the maximum number of sends, and the wording (subject and body with {{placeholder}} slots). The sender gives up a mail whose template has no row.';

COMMENT ON COLUMN "public"."email_settings"."subject" IS
    'The subject line, plain text with {{placeholder}} slots from placeholders; collapsed onto one line when rendered.';

COMMENT ON COLUMN "public"."email_settings"."body" IS
    'The body text, plain text with {{placeholder}} slots from placeholders. A blank line starts a new paragraph, a single line break stays a line break. The template''s html.hbs and text.hbs place it.';

COMMENT ON COLUMN "public"."email_settings"."placeholders" IS
    'The slots subject and body may use: the names of the data the template''s module resolves. Settings refuses wording with any other.';
