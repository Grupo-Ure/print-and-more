// approval-expired — tells the shop that a customer never answered an
// approval request and the link ran out. Queued by fn_approval_request_closed
// when the daily expiry run closes a request; the product is back in
// pre-press, and someone decides whether to chase or send a new round. Goes
// to the shop's inbox (EMAIL_SHOP_TO), with a pam:// link that opens the
// order in the desktop app — a fixed element of the folder's frames.

import type { EmailTemplate } from '../registry.ts'
import { formatDate, loadApprovalRequestContext, sharedData } from '../context.ts'

const DAY_MS = 24 * 60 * 60 * 1000

/** Whole days from sending the request to its closing — how long the shop waited. */
function waitedDays(createdAt: string, closedAt: string): number {
  return Math.round((new Date(closedAt).getTime() - new Date(createdAt).getTime()) / DAY_MS)
}

const approvalExpired: EmailTemplate = {
  async resolve(message, deps) {
    const context = await loadApprovalRequestContext(message, deps)
    if (context.request.status !== 'EXPIRED') {
      throw new Error(`approval-expired: request ${context.request.id} is ${context.request.status}, not expired`)
    }
    const recipient = Deno.env.get('EMAIL_SHOP_TO')
    if (!recipient) {
      throw new Error('approval-expired: EMAIL_SHOP_TO is not set')
    }
    return {
      recipient,
      data: {
        ...sharedData(context),
        sentAt: formatDate(context.request.created_at),
        waitedDays: waitedDays(context.request.created_at, context.request.responded_at ?? context.request.expires_at),
        link: `pam://order/${context.order.id}`,
      },
    }
  },
}

export default approvalExpired
