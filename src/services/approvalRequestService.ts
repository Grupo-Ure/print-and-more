import { supabase } from '../supabase'
import type { Database, Tables } from '../types/supabase'
import type { FileRow } from './fileService'

export type ApprovalRequestStatus = Database['public']['Enums']['approval_request_status']

/** The two answers an employee records for a customer who called or walked in. */
export type ApprovalDecision = Extract<ApprovalRequestStatus, 'APPROVED' | 'CHANGES_REQUESTED'>

/** One file of a round: the order's file it is a copy of, and whether the copy is still held. */
export type ApprovalRequestFile = {
  file_id: string
  display_name: string
  purged_at: string | null
}

/** One round of asking the customer, as the requests table on the Files tab shows it. */
export type ApprovalRequest = Pick<
  Tables<'product_approval_requests'>,
  | 'id'
  | 'product_id'
  | 'round'
  | 'message'
  | 'status'
  | 'mailed'
  | 'expires_at'
  | 'note'
  | 'responded_at'
  | 'created_at'
> & {
  files: ApprovalRequestFile[]
  /** Who recorded the answer or withdrew the round; null for the customer's page and the expiry. */
  settled_by_name: string | null
  requested_by_name: string | null
}

/** Asking for a round: the product, the files to show and the employee's note. */
export type CreateApprovalRequestInput = {
  orderId: string
  productId: string
  files: FileRow[]
  message: string | null
  mailed: boolean
}

/** A proof could not be read from the share or stored for the customer's page. */
export class ApprovalProofError extends Error {
  readonly fileName: string

  constructor(fileName: string, cause: string) {
    super(`${fileName}: ${cause}`)
    this.name = 'ApprovalProofError'
    this.fileName = fileName
  }
}

/** Asking for an approval needs the desktop app: only it can read the file off the share. */
export class DesktopAppRequiredError extends Error {
  constructor() {
    super('Requesting an approval requires the desktop app.')
    this.name = 'DesktopAppRequiredError'
  }
}

const APPROVAL_PROOFS_BUCKET = 'approval-proofs'

const REQUEST_SELECT =
  'id, product_id, round, message, status, mailed, expires_at, note, responded_at, created_at, ' +
  'settled_by_user:users!product_approval_requests_settled_by_fkey(name), ' +
  'requested_by_user:users!product_approval_requests_requested_by_fkey(name), ' +
  'product_approval_request_files(file_id, purged_at, files(display_name))'

// The content types a proof is usually in; the customer's browser is handed
// the copy as a download either way, so anything else goes as plain bytes.
const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  webp: 'image/webp',
}

function contentTypeFor(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? ''
  return CONTENT_TYPE_BY_EXTENSION[extension] ?? 'application/octet-stream'
}

/**
 * Where a file's copy goes: `<order_id>/<request_id>/<file_id>-<display_name>`.
 * Storage keys refuse much of what a display name may hold (umlauts, `#`,
 * `?`), so the name is reduced to a safe alphabet; the file id keeps the key
 * unique and the page names the download after the file row, not the key.
 */
function storagePathFor(orderId: string, requestId: string, file: FileRow): string {
  const safeName = file.display_name.replace(/[^A-Za-z0-9._-]+/g, '_')
  return `${orderId}/${requestId}/${file.id}-${safeName}`
}

type RequestRow = Omit<ApprovalRequest, 'files' | 'settled_by_name' | 'requested_by_name'> & {
  settled_by_user: { name: string } | null
  requested_by_user: { name: string } | null
  product_approval_request_files: { file_id: string; purged_at: string | null; files: { display_name: string } | null }[]
}

function toApprovalRequest(row: RequestRow): ApprovalRequest {
  const { settled_by_user, requested_by_user, product_approval_request_files, ...request } = row
  return {
    ...request,
    settled_by_name: settled_by_user?.name ?? null,
    requested_by_name: requested_by_user?.name ?? null,
    files: product_approval_request_files.map(file => ({
      file_id: file.file_id,
      display_name: file.files?.display_name ?? file.file_id,
      purged_at: file.purged_at,
    })),
  }
}

/**
 * The customer approval's rounds (`product_approval_requests`). Read through
 * the Data API; written only through the request RPCs, which own every
 * consequence on the product — its status, the stock, the history, the mails.
 */
class ApprovalRequestService {
  /** Every round of the product, newest first. */
  async listByProduct(productId: string): Promise<ApprovalRequest[]> {
    const { data, error } = await supabase
      .from('product_approval_requests')
      .select(REQUEST_SELECT)
      .eq('product_id', productId)
      .order('round', { ascending: false })
    if (error) throw error
    // The embedded users and files come back typed loosely through the named
    // foreign keys; the select above fixes their shape.
    return ((data ?? []) as unknown as RequestRow[]).map(toApprovalRequest)
  }

  /**
   * Sends a round: reads each file off the share through the desktop bridge,
   * stores its copy in the approval-proofs bucket under a fresh request id,
   * then calls `create_approval_request`, which moves the product to awaiting
   * approval and queues the mail. When a read, an upload or the RPC fails, the
   * copies stored so far are removed again, best effort.
   *
   * @returns the request id.
   */
  async create({ orderId, productId, files, message, mailed }: CreateApprovalRequestInput): Promise<string> {
    const native = window.pam
    if (!native) throw new DesktopAppRequiredError()

    const requestId = crypto.randomUUID()
    const storedPaths: string[] = []
    try {
      for (const file of files) {
        const read = await native.readFile(file.path)
        if (!read.ok) throw new ApprovalProofError(file.display_name, read.error)

        const path = storagePathFor(orderId, requestId, file)
        const { error: uploadError } = await supabase.storage
          .from(APPROVAL_PROOFS_BUCKET)
          .upload(path, new Blob([read.data], { type: contentTypeFor(file.display_name) }))
        if (uploadError) throw new ApprovalProofError(file.display_name, uploadError.message)
        storedPaths.push(path)
      }

      const { error } = await supabase.rpc('create_approval_request', {
        request_id: requestId,
        product_id: productId,
        file_ids: files.map(file => file.id),
        storage_paths: storedPaths,
        message: message ?? undefined,
        mailed,
      })
      if (error) throw error
    } catch (error) {
      await this.removeCopies(storedPaths)
      throw error
    }
    return requestId
  }

  /** Records the customer's answer by hand; a request for changes needs a note. */
  async settle(requestId: string, decision: ApprovalDecision, note: string | null): Promise<void> {
    const { error } = await supabase.rpc('settle_approval_request', {
      request_id: requestId,
      decision,
      note: note ?? undefined,
    })
    if (error) throw error
  }

  /** Takes an open round back; the product returns to pre-press. */
  async withdraw(requestId: string): Promise<void> {
    const { error } = await supabase.rpc('withdraw_approval_request', { request_id: requestId })
    if (error) throw error
  }

  private async removeCopies(paths: string[]): Promise<void> {
    if (paths.length === 0) return
    try {
      await supabase.storage.from(APPROVAL_PROOFS_BUCKET).remove(paths)
    } catch {
      // Best effort: an orphaned copy is never served, since no request names it.
    }
  }
}

export const approvalRequestService = new ApprovalRequestService()
