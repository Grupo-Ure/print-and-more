// approval-decided — tells the product's assignee that the customer answered:
// approved, or changes requested and what the note says. Queued by
// fn_approval_request_closed on either decision, whether the customer gave it
// on the page or an employee recorded it in the app. Goes to the assignee's
// address; a product with nobody assigned tells the shop's inbox instead.

import type { EmailTemplate, TemplateDeps } from '../registry.ts'
import { loadApprovalRequestContext, sharedData, type ApprovalRequestContext } from '../context.ts'

const OUTCOME_WORDING: Record<string, string> = {
  APPROVED: 'approved',
  CHANGES_REQUESTED: 'changes requested',
}

async function recipientOf(context: ApprovalRequestContext, db: TemplateDeps['db']): Promise<string> {
  if (context.product.assignee_id) {
    const { data, error } = await db.from('users').select('email').eq('id', context.product.assignee_id).maybeSingle()
    if (error) throw new Error(`approval-decided: assignee lookup failed: ${error.message}`)
    if (data?.email) return data.email
  }
  const shopInbox = Deno.env.get('EMAIL_SHOP_TO')
  if (!shopInbox) {
    throw new Error('approval-decided: the product has no assignee with an address and EMAIL_SHOP_TO is not set')
  }
  return shopInbox
}

/** Who gave the answer: the employee who recorded it, or the customer on the page. */
async function decidedBy(context: ApprovalRequestContext, db: TemplateDeps['db']): Promise<string> {
  if (!context.request.settled_by) return 'The customer'
  const { data, error } = await db.from('users').select('name').eq('id', context.request.settled_by).maybeSingle()
  if (error) throw new Error(`approval-decided: settling user lookup failed: ${error.message}`)
  return data?.name ? `${data.name} (recorded by hand)` : 'An employee (recorded by hand)'
}

const approvalDecided: EmailTemplate = {
  async resolve(message, deps) {
    const context = await loadApprovalRequestContext(message, deps)
    const outcome = OUTCOME_WORDING[context.request.status]
    if (!outcome) {
      throw new Error(`approval-decided: request ${context.request.id} is ${context.request.status}, not decided`)
    }
    return {
      recipient: await recipientOf(context, deps.db),
      data: {
        ...sharedData(context),
        outcome,
        note: context.request.note,
        decidedBy: await decidedBy(context, deps.db),
      },
    }
  },
}

export default approvalDecided
