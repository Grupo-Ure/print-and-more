// approval-request — asks the customer to approve a proof. Queued by
// create_approval_request, to the order's customer, with the link to the
// customer app's approval page: CUSTOMER_APP_URL + '/approval#' + the token
// the message carries. The link is a fixed element of the folder's html and
// text frames, not a placeholder, so the shop's wording cannot lose it.
//
// Still needed while the request is PENDING: a request settled, withdrawn or
// expired before the mail went out is not sent.

import type { EmailTemplate } from '../registry.ts'
import { formatDate, loadApprovalRequestContext, loadRequestStatus, sharedData } from '../context.ts'

function approvalLink(token: unknown): string {
  if (typeof token !== 'string' || token === '') {
    throw new Error('approval-request: the message carries no token')
  }
  const base = Deno.env.get('CUSTOMER_APP_URL')
  if (!base) {
    throw new Error('approval-request: CUSTOMER_APP_URL is not set')
  }
  return `${base.replace(/\/+$/, '')}/approval#${encodeURIComponent(token)}`
}

const approvalRequest: EmailTemplate = {
  async stillNeeded(message, deps) {
    return (await loadRequestStatus(message, deps)) === 'PENDING'
  },
  async resolve(message, deps) {
    const context = await loadApprovalRequestContext(message, deps)
    const recipient = context.customer.email
    if (!recipient) {
      throw new Error(`approval-request: the customer of order ${context.order.order_number} has no email address`)
    }
    return {
      recipient,
      data: {
        ...sharedData(context),
        message: context.request.message,
        expiresAt: formatDate(context.request.expires_at),
        link: approvalLink(message.context.token),
      },
    }
  },
}

export default approvalRequest
