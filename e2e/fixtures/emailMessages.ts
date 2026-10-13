import type { Database } from '../../src/types/supabase'

type HistoryEvent = Database['public']['Enums']['history_event']

/**
 * What the `queuedEmail` fixture queues for the test's order: the template,
 * what cannot be looked up again at send time, and how long the message waits
 * before a drain may claim it.
 */
export type QueuedEmailSeed = {
  template: string
  context: Record<string, unknown>
  delaySeconds: number
}

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
