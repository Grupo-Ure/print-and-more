import type { Database } from '../../src/types/supabase'
import { TEST_CUSTOMER } from './customers'

type HistoryEvent = Database['public']['Enums']['history_event']

/**
 * What the `queuedEmail` fixture queues for the test's order: the template,
 * what cannot be looked up again at send time, and how long the message waits
 * before a drain may claim it — `null` leaves the wait to the template's
 * delay in Settings, as a trigger queuing a delayed mail does.
 */
export type QueuedEmailSeed = {
  template: string
  context: Record<string, unknown>
  delaySeconds: number | null
}

/** One template's row in Settings → Emails (`email_settings`), as the `emailSetting` fixture writes it. */
export type EmailSettingSeed = Database['public']['Tables']['email_settings']['Row']

/** The switches a spec changes on a seeded row. */
export type EmailSettingPatch = Partial<Omit<EmailSettingSeed, 'template'>>

/** The email system's own template; it exists to drive the whole path without a feature's mail. */
export const TEST_MESSAGE_TEMPLATE = 'test-message'

/** A name no template module is registered under. */
export const UNKNOWN_TEMPLATE = 'e2e-unknown-template'

/** Where test-message addresses the mail. The dry-run transport sends nothing, so the address is never reached. */
export const TEST_MESSAGE_RECIPIENT = 'inbox@e2e.local'

/** The provider id the sender records in place of Resend's when EMAIL_DRY_RUN=true. */
export const DRY_RUN_PROVIDER_ID = 'dry-run'

/** The claim on which the sender gives a refused message up and writes the failure entry. */
export const MAX_SEND_ATTEMPTS = 5

/** The status the sender answers a caller that presents anything but the service-role key with. */
export const REFUSED_CALLER_STATUS = 401

/** A delay no drain during a test reaches on its own; the test makes the message due instead. */
const ONE_HOUR_IN_SECONDS = 3600

/** The history entry the sender writes when the provider accepts a mail. */
export const EMAIL_SENT_HISTORY_EVENT: HistoryEvent = 'EMAIL_SENT'

/** The history entry the sender writes when it gives a message up. */
export const EMAIL_FAILED_HISTORY_EVENT: HistoryEvent = 'EMAIL_FAILED'

/** The history entry the webhook writes when the provider reports a bounce. */
export const EMAIL_BOUNCED_HISTORY_EVENT: HistoryEvent = 'EMAIL_BOUNCED'

// ── Sent records and the provider's reports ───────────────────────────────

/** The columns a fixture chooses for a sent record it inserts; the ids are minted by the runner. */
export type SentEmailSeed = Pick<
  Database['public']['Tables']['sent_emails']['Row'],
  'template' | 'recipient' | 'subject' | 'body_html' | 'body_text'
>

/**
 * A test-message that went out to the test's customer, as the sender would
 * have recorded it — inserted directly, so a delivery report has a record to
 * find without a drain. The recipient is the customer's address, which is
 * what a bounce flags.
 */
export const SENT_TEST_MESSAGE: SentEmailSeed = {
  template: TEST_MESSAGE_TEMPLATE,
  recipient: TEST_CUSTOMER.email,
  subject: 'E2E test message',
  body_html: '<p>E2E test message</p>',
  body_text: 'E2E test message',
}

/** What Resend says about a bounce in its report. */
export type BounceDetail = {
  message: string
  type: string
  subType: string
}

/** Resend's event envelope, as far as the webhook reads it: the type, when it happened, and the mail's id. */
export type DeliveryReport = {
  type: string
  created_at: string
  data: {
    email_id: string
    from: string
    to: string[]
    subject: string
    created_at: string
    bounce?: BounceDetail
  }
}

/** The status the webhook answers a report with that is not signed with its secret. */
export const REFUSED_REPORT_STATUS = 401

/** A signing secret of the right shape that is not the function's. */
export const WRONG_WEBHOOK_SECRET = 'whsec_bm90LXRoZS1mdW5jdGlvbnMtc2VjcmV0'

/** A hard bounce, as Resend words one. */
export const PERMANENT_BOUNCE: BounceDetail = {
  message: 'The recipient address does not exist',
  type: 'Permanent',
  subType: 'General',
}

/** The address the customer is corrected to after a bounce. */
export const CORRECTED_CUSTOMER_EMAIL = 'corrected-customer@e2e.local'

const REPORT_SENDER = 'Print And More <shop@e2e.local>'

function report(type: string, emailId: string, bounce?: BounceDetail): DeliveryReport {
  const now = new Date().toISOString()
  return {
    type,
    created_at: now,
    data: {
      email_id: emailId,
      from: REPORT_SENDER,
      to: [SENT_TEST_MESSAGE.recipient],
      subject: SENT_TEST_MESSAGE.subject,
      created_at: now,
      ...(bounce ? { bounce } : {}),
    },
  }
}

/** Resend reporting the mail with that id delivered. */
export function deliveredReport(emailId: string): DeliveryReport {
  return report('email.delivered', emailId)
}

/** Resend reporting the mail with that id bounced, hard. */
export function bouncedReport(emailId: string): DeliveryReport {
  return report('email.bounced', emailId, PERMANENT_BOUNCE)
}

// ── Messages to queue ─────────────────────────────────────────────────────

/** A test-message due at once — the default. */
export const IMMEDIATE_TEST_MESSAGE: QueuedEmailSeed = {
  template: TEST_MESSAGE_TEMPLATE,
  context: { to: TEST_MESSAGE_RECIPIENT },
  delaySeconds: 0,
}

/** The same message, not due for an hour. */
export const DELAYED_TEST_MESSAGE: QueuedEmailSeed = { ...IMMEDIATE_TEST_MESSAGE, delaySeconds: ONE_HOUR_IN_SECONDS }

/** A message naming a template the sender does not know. */
export const UNKNOWN_TEMPLATE_MESSAGE: QueuedEmailSeed = { ...IMMEDIATE_TEST_MESSAGE, template: UNKNOWN_TEMPLATE }

/** A test-message whose "still needed?" answers no when it is claimed. */
export const UNNEEDED_TEST_MESSAGE: QueuedEmailSeed = {
  ...IMMEDIATE_TEST_MESSAGE,
  context: { ...IMMEDIATE_TEST_MESSAGE.context, still_needed: false },
}

/** A test-message the dry-run transport refuses, as the provider might. */
export const REFUSED_TEST_MESSAGE: QueuedEmailSeed = {
  ...IMMEDIATE_TEST_MESSAGE,
  context: { ...IMMEDIATE_TEST_MESSAGE.context, dry_run_refuse: true },
}

/** A test-message queued with no delay of its own, so the one in Settings applies. */
export const SETTINGS_DELAYED_TEST_MESSAGE: QueuedEmailSeed = { ...IMMEDIATE_TEST_MESSAGE, delaySeconds: null }

// ── Settings rows ─────────────────────────────────────────────────────────

/** The delay a spec types into Settings → Emails. */
export const EDITED_DELAY_DAYS = 3

/** The repeat interval of the repeating row. */
export const REPEAT_INTERVAL_DAYS = 1

/** How often the repeating row's mail goes out at most: the first send and one repeat. */
export const REPEATING_MAX_SENDS = 2

/** test-message switched on, sent at once, never repeated — the default row. */
export const IMMEDIATE_TEST_MESSAGE_SETTING: EmailSettingSeed = {
  template: TEST_MESSAGE_TEMPLATE,
  is_enabled: true,
  delay_days: 0,
  repeat_days: null,
  max_sends: 1,
}

/** test-message repeated once a day, sent twice at most. */
export const REPEATING_TEST_MESSAGE_SETTING: EmailSettingSeed = {
  ...IMMEDIATE_TEST_MESSAGE_SETTING,
  repeat_days: REPEAT_INTERVAL_DAYS,
  max_sends: REPEATING_MAX_SENDS,
}

/** What switching a mail off in Settings writes to its row. */
export const SWITCHED_OFF: EmailSettingPatch = { is_enabled: false }
