import { createHash } from 'node:crypto'
import type { Database } from '../../src/types/supabase'
import type { TestFile } from '../support/database'

type HistoryEvent = Database['public']['Enums']['history_event']

/** A request's state: open, or closed one of the four ways. */
export type ApprovalRequestStatus = Database['public']['Enums']['approval_request_status']

/**
 * What the `approvalRequest` fixture inserts for the test's product: the
 * employee's message, whether the customer was mailed, and the state the
 * round is in. A `PENDING` round puts the product into awaiting approval,
 * as sending the request would have; a closed one leaves the product where
 * the seed put it.
 */
export type ApprovalRequestSeed = {
  message: string | null
  mailed: boolean
  status: ApprovalRequestStatus
}

// ── Statuses ──────────────────────────────────────────────────────────────

/** The state a request is created in: the customer has not answered yet. */
export const PENDING_REQUEST_STATUS: ApprovalRequestStatus = 'PENDING'

/** The decision that moves the product into production. */
export const APPROVED_REQUEST_STATUS: ApprovalRequestStatus = 'APPROVED'

/** The decision that returns the product to pre-press for a rework. */
export const CHANGES_REQUESTED_STATUS: ApprovalRequestStatus = 'CHANGES_REQUESTED'

/** The state of a request the shop took back. */
export const WITHDRAWN_REQUEST_STATUS: ApprovalRequestStatus = 'WITHDRAWN'

/** The round a product's first request gets. */
export const FIRST_ROUND = 1

// ── History ───────────────────────────────────────────────────────────────

/** The history entry creating a request writes — it records the move to awaiting approval too. */
export const APPROVAL_REQUESTED_HISTORY_EVENT: HistoryEvent = 'CUSTOMER_APPROVAL_REQUESTED'

/** The history entry an approval writes, naming who gave it and any stock it fell short of. */
export const APPROVAL_GRANTED_HISTORY_EVENT: HistoryEvent = 'CUSTOMER_APPROVAL_GRANTED'

/** The history entry a request for changes writes, with the note. */
export const CHANGES_REQUESTED_HISTORY_EVENT: HistoryEvent = 'CUSTOMER_APPROVAL_CHANGES_REQUESTED'

/** The history entry withdrawing a request writes. */
export const APPROVAL_WITHDRAWN_HISTORY_EVENT: HistoryEvent = 'CUSTOMER_APPROVAL_WITHDRAWN'

// ── Rows to insert ────────────────────────────────────────────────────────

/** The employee's note to the customer on a request. */
export const APPROVAL_MESSAGE = 'E2E please check the attached proof'

/** The note an employee records with a request for changes. */
export const CHANGES_NOTE = 'E2E the customer wants the logo higher up'

/** An open request the customer was mailed — the default: the product is waiting. */
export const PENDING_MAILED_REQUEST: ApprovalRequestSeed = {
  message: APPROVAL_MESSAGE,
  mailed: true,
  status: PENDING_REQUEST_STATUS,
}

/** An open request shown to the customer another way: no mail went out, and none follows a withdrawal. */
export const PENDING_UNMAILED_REQUEST: ApprovalRequestSeed = { ...PENDING_MAILED_REQUEST, mailed: false }

/** A request the shop took back; the product is back in pre-press. */
export const WITHDRAWN_REQUEST: ApprovalRequestSeed = { ...PENDING_MAILED_REQUEST, status: WITHDRAWN_REQUEST_STATUS }

// ── What the RPC takes and the mail carries ───────────────────────────────

/** A fresh id for a request the test creates through the RPC — the app mints it, since the file copies are stored under it first. */
export function newRequestId(): string {
  return crypto.randomUUID()
}

/** Where the app stores a file's copy for the customer's page: `<order>/<request>/<file>-<name>`. */
export function storagePathFor(orderId: string, requestId: string, file: TestFile): string {
  return `${orderId}/${requestId}/${file.id}-${file.display_name}`
}

/** The link's token, read out of the sent request mail's html: everything after `/approval#`. */
export function tokenFromMail(bodyHtml: string): string | null {
  const match = /\/approval#([0-9a-f]+)/.exec(bodyHtml)
  return match ? match[1] : null
}

/** How the database stores a token: the SHA-256 of its text, hex. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/** The note a release's automatic stock movements carry, naming the order. */
export function releaseMovementNote(orderNumber: string): string {
  return `Automatic on production release ${orderNumber}`
}
