// The contract between the customer-approval edge function and the customer
// app's approval page: what the page sends and what it gets back. The
// function is typed against it; the customer app (markus/customer-app)
// declares the same shapes in its lib/api.ts, so a change here is a change
// there, and its e2e suite fails when the two drift apart.
//
//   GET  ?token=…                → ApprovalView (404 ApprovalError for an unknown token)
//   GET  ?token=…&file=<file id> → the file, as an attachment (404 when not served)
//   POST ApprovalDecisionBody    → ApprovalView (400 ApprovalError for a malformed body)

/** Every state a request can be in, as the customer sees it. */
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED' | 'EXPIRED' | 'WITHDRAWN'

/** The two answers the customer can give. *Please contact me* is CHANGES_REQUESTED with CONTACT_ME_NOTE. */
export type ApprovalDecision = 'APPROVED' | 'CHANGES_REQUESTED'

/** The note *Please contact me* sends: a request for changes the assignee answers by calling. */
export const CONTACT_ME_NOTE = 'The customer would like to be contacted'

/** The longest note the function accepts. */
export const MAX_NOTE_LENGTH = 2000

/** One proof the customer can download: `GET ?token=…&file=<id>`. */
export interface ApprovalFile {
  id: string
  display_name: string
}

/** How a request that is no longer open ended, and when. */
export interface ApprovalOutcome {
  decision: Exclude<ApprovalStatus, 'PENDING'>
  /** The customer's note, or the employee's when the answer was recorded in the shop. */
  note: string | null
  /** When it was decided, withdrawn or expired. */
  responded_at: string
}

/** The request the link belongs to — the GET's answer, and the POST's. */
export interface ApprovalView {
  status: ApprovalStatus
  order_number: string
  product_number: string
  /** The product type in words, e.g. "Trodat printy". */
  product_label: string
  /** The employee's note to the customer. */
  message: string | null
  /** The proofs still served: none once the request expired or was withdrawn, or the copies were purged. */
  files: ApprovalFile[]
  expires_at: string
  /** Present once the request is no longer PENDING. */
  outcome?: ApprovalOutcome
}

/** The POST's body: the customer's decision. `note` is required for CHANGES_REQUESTED. */
export interface ApprovalDecisionBody {
  token: string
  decision: ApprovalDecision
  note: string | null
}

/** Every non-2xx JSON answer. */
export interface ApprovalError {
  error: 'not_found' | 'invalid_request' | 'method_not_allowed' | 'server_error'
  detail?: string
}
