import { createHash } from 'node:crypto'
import type { Database } from '../../src/types/supabase'
import type { TestFile } from '../support/database'

type HistoryEvent = Database['public']['Enums']['history_event']

/** A request's state: open, or closed one of the four ways. */
export type ApprovalRequestStatus = Database['public']['Enums']['approval_request_status']

/**
 * What the `approvalRequest` fixture inserts for the test's product: the
 * employee's message, whether the customer was mailed, the state the round is
 * in and the note it closed with. A `PENDING` round puts the product into
 * awaiting approval, as sending the request would have; a closed one leaves
 * the product where the seed put it.
 */
export type ApprovalRequestSeed = {
  message: string | null
  mailed: boolean
  status: ApprovalRequestStatus
  note: string | null
}

// ── Statuses ──────────────────────────────────────────────────────────────

/** The state a request is created in: the customer has not answered yet. */
export const PENDING_REQUEST_STATUS: ApprovalRequestStatus = 'PENDING'

/** The two answers that settle a request — by an employee, or by the customer on the page. */
export type ApprovalRequestDecision = Extract<ApprovalRequestStatus, 'APPROVED' | 'CHANGES_REQUESTED'>

/** The decision that moves the product into production. */
export const APPROVED_REQUEST_STATUS: ApprovalRequestDecision = 'APPROVED'

/** The decision that returns the product to pre-press for a rework. */
export const CHANGES_REQUESTED_STATUS: ApprovalRequestDecision = 'CHANGES_REQUESTED'

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

// ── The customer's page ───────────────────────────────────────────────────

/** What the stored copy of the proof holds — the bytes the page downloads. */
export const PROOF_CONTENT = '%PDF-1.4 E2E proof'

/** How the function serves a proof: as a download, never inline. */
export const ATTACHMENT_DISPOSITION = 'attachment'

/** A token of the right shape that no request was ever given. */
export const UNKNOWN_TOKEN = 'e2e0'.repeat(16)

/** What the function answers a read or a decision with. */
export const FUNCTION_OK_STATUS = 200

/** What the function answers for a token or a file it does not serve. */
export const NOT_FOUND_STATUS = 404

/** An open request the customer was mailed — the default: the product is waiting. */
export const PENDING_MAILED_REQUEST: ApprovalRequestSeed = {
  message: APPROVAL_MESSAGE,
  mailed: true,
  status: PENDING_REQUEST_STATUS,
  note: null,
}

/** An open request shown to the customer another way: no mail went out, and none follows a withdrawal. */
export const PENDING_UNMAILED_REQUEST: ApprovalRequestSeed = { ...PENDING_MAILED_REQUEST, mailed: false }

/** A request the shop took back; the product is back in pre-press. */
export const WITHDRAWN_REQUEST: ApprovalRequestSeed = { ...PENDING_MAILED_REQUEST, status: WITHDRAWN_REQUEST_STATUS }

/** A round the customer sent back with a note; the product is back in pre-press, its release blocked. */
export const CHANGES_REQUESTED_REQUEST: ApprovalRequestSeed = {
  ...PENDING_MAILED_REQUEST,
  status: CHANGES_REQUESTED_STATUS,
  note: CHANGES_NOTE,
}

/** A round the customer approved, with the product back in pre-press — sent back from production after it. */
export const APPROVED_REQUEST: ApprovalRequestSeed = { ...PENDING_MAILED_REQUEST, status: APPROVED_REQUEST_STATUS }

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
