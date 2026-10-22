// The email templates the sender knows, by name.
//
// A template is one folder named after it: html.hbs and text.hbs, the
// structure that places the wording ({{{body}}}) plus any fixed element, and
// an index.ts whose default export satisfies EmailTemplate. Its wording —
// subject and body — is its email_settings row, which the migration adding
// the mail inserts. Registering it here is what makes render.ts load its
// files at start-up and the sender accept messages that name it.

import type { SupabaseClient } from '@supabase/supabase-js'
import approvalDecided from './approval-decided/index.ts'
import approvalRequest from './approval-request/index.ts'
import approvalWithdrawn from './approval-withdrawn/index.ts'
import testMessage from './test-message/index.ts'

/** A queue message: the ids a mail is about, plus what cannot be looked up again. */
export interface EmailMessage {
  template: string
  order_id: string
  product_id: string | null
  context: Record<string, unknown>
}

/** What the sender hands a template's module to look things up with. */
export interface TemplateDeps {
  db: SupabaseClient
}

/** Who the mail goes to and the data its wording and .hbs files render with. */
export interface ResolvedEmail {
  recipient: string
  data: Record<string, unknown>
}

export interface EmailTemplate {
  /** Recipient and template data, looked up from the message's ids at send time. */
  resolve(message: EmailMessage, deps: TemplateDeps): Promise<ResolvedEmail>
  /** Whether the mail is still wanted when it is claimed. Absent means always. */
  stillNeeded?(message: EmailMessage, deps: TemplateDeps): Promise<boolean>
}

export const TEMPLATES = {
  'test-message': testMessage,
  'approval-request': approvalRequest,
  'approval-decided': approvalDecided,
  'approval-withdrawn': approvalWithdrawn,
} satisfies Record<string, EmailTemplate>

export type TemplateName = keyof typeof TEMPLATES

export const TEMPLATE_NAMES = Object.keys(TEMPLATES) as TemplateName[]

export function isTemplateName(name: string): name is TemplateName {
  return Object.hasOwn(TEMPLATES, name)
}
