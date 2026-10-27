import type { Database } from '../../src/types/supabase'
import type { BounceDetail, DeliveryReport } from '../../supabase/functions/_shared/emailProvider.ts'
import { requiredEnv } from '../support/database'
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

/** One template's row in Settings → Emails (`email_settings`), as the database holds it. */
export type EmailSettingRow = Database['public']['Tables']['email_settings']['Row']

/**
 * What the `emailSetting` fixture writes onto a template's row: every switch,
 * and the wording only where a spec needs its own — otherwise the row keeps
 * the wording its migration shipped.
 */
export type EmailSettingSeed = Omit<EmailSettingRow, 'subject' | 'body' | 'placeholders'> &
  Partial<Pick<EmailSettingRow, 'subject' | 'body'>>

/** The switches a spec changes on a seeded row. */
export type EmailSettingPatch = Partial<Omit<EmailSettingSeed, 'template'>>

/** The email system's own template; it exists to drive the whole path without a feature's mail. */
export const TEST_MESSAGE_TEMPLATE = 'test-message'

/** The mail asking the customer to approve a proof, with the private link. */
export const APPROVAL_REQUEST_TEMPLATE = 'approval-request'

/** The mail telling the product's assignee what the customer decided. */
export const APPROVAL_DECIDED_TEMPLATE = 'approval-decided'

/** The mail telling the customer that the shop withdrew its request. */
export const APPROVAL_WITHDRAWN_TEMPLATE = 'approval-withdrawn'

/** The mail telling the shop that nobody answered a request before its link ran out. */
export const APPROVAL_EXPIRED_TEMPLATE = 'approval-expired'

/** Every mail type the sender knows — each has its row in Settings → Emails, the immediate ones included. */
export const MAIL_TEMPLATES = [
  TEST_MESSAGE_TEMPLATE,
  APPROVAL_REQUEST_TEMPLATE,
  APPROVAL_DECIDED_TEMPLATE,
  APPROVAL_WITHDRAWN_TEMPLATE,
  APPROVAL_EXPIRED_TEMPLATE,
]

/**
 * The shop's own inbox, where the sender addresses mail meant for the
 * business — its EMAIL_SHOP_TO, which the runner reads from the same
 * `supabase/functions/.env`.
 */
export function shopInbox(): string {
  return requiredEnv('EMAIL_SHOP_TO')
}

/** A name no template module is registered under. */
export const UNKNOWN_TEMPLATE = 'e2e-unknown-template'

/** Where test-message addresses the mail. The dry-run transport sends nothing, so the address is never reached. */
export const TEST_MESSAGE_RECIPIENT = 'inbox@e2e.local'

/** The provider id the sender records in place of the provider's when EMAIL_DRY_RUN=true. */
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

/** The status the webhook answers a report with that is not signed with its secret. */
export const REFUSED_REPORT_STATUS = 401

/** A signing secret that is not the function's. */
export const WRONG_WEBHOOK_SECRET = 'not-the-functions-webhook-secret'

/** A hard bounce: the receiving server does not know the address. */
export const PERMANENT_BOUNCE: BounceDetail = {
  reason: 'The recipient address does not exist',
  classification: 'InvalidRecipient',
  statusCode: '5.1.1',
}

/** The address the customer is corrected to after a bounce. */
export const CORRECTED_CUSTOMER_EMAIL = 'corrected-customer@e2e.local'

/**
 * A report about the mail with that provider id, as the webhook acts on it.
 * The support's `EmailWebhookFunction` writes it in the provider's format.
 */
function report(event: DeliveryReport['event'], providerId: string, bounce: BounceDetail | null): DeliveryReport {
  return { event, occurredAt: new Date().toISOString(), providerId, bounce }
}

/** The provider reporting the mail with that id delivered. */
export function deliveredReport(providerId: string): DeliveryReport {
  return report('delivered', providerId, null)
}

/** The provider reporting the mail with that id bounced, hard. */
export function bouncedReport(providerId: string): DeliveryReport {
  return report('bounced', providerId, PERMANENT_BOUNCE)
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

// ── Wording ───────────────────────────────────────────────────────────────

/** The fixed part of a subject with a slot for the order. */
const ORDER_SUBJECT_PREFIX = 'E2E mail about order'

/** test-message with a subject whose slot the sender fills with the order's id. */
export const ORDER_SLOT_SUBJECT_SETTING: EmailSettingSeed = {
  ...IMMEDIATE_TEST_MESSAGE_SETTING,
  subject: `${ORDER_SUBJECT_PREFIX} {{orderId}}`,
}

/** The subject that setting's mail goes out with for that order. */
export function orderSlotSubject(orderId: string): string {
  return `${ORDER_SUBJECT_PREFIX} ${orderId}`
}

/** test-message with a subject naming a slot test-message's data does not have. */
export const MISSING_SLOT_SUBJECT_SETTING: EmailSettingSeed = {
  ...IMMEDIATE_TEST_MESSAGE_SETTING,
  subject: 'E2E mail with {{e2eMissingSlot}}',
}

/** The subject a spec types into the wording dialog. */
export const EDITED_SUBJECT = 'E2E edited subject'

/** Body text using a placeholder test-message does not offer. */
export const UNOFFERED_SLOT_BODY = 'E2E text with {{e2eUnofferedSlot}}'
