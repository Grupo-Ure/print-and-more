// approval-withdrawn — tells the customer that the shop took its request
// back and the link no longer works. Queued by fn_approval_request_closed
// when a mailed request is withdrawn; an unmailed one queues nothing.

import type { EmailTemplate } from '../registry.ts'
import { loadApprovalRequestContext, sharedData } from '../context.ts'

const approvalWithdrawn: EmailTemplate = {
  async resolve(message, deps) {
    const context = await loadApprovalRequestContext(message, deps)
    const recipient = context.customer.email
    if (!recipient) {
      throw new Error(`approval-withdrawn: the customer of order ${context.order.order_number} has no email address`)
    }
    return { recipient, data: sharedData(context) }
  },
}

export default approvalWithdrawn
