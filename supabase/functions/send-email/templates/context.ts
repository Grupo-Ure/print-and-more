// What the customer approval's mails look up at send time: the request the
// message names, with its product, order and customer. Shared by the
// approval-* templates; each adds what its own wording needs on top.
//
// Everything here is resolved when the mail is claimed, not when it was
// queued, so a mail that waited goes out with today's details. The message
// carries only the request id (and, for the request mail, the link's token).

import type { EmailMessage, TemplateDeps } from './registry.ts'
import { productLabel } from '../../_shared/productLabel.ts'

export interface ApprovalRequestContext {
  request: {
    id: string
    round: number
    status: string
    message: string | null
    note: string | null
    expires_at: string
    settled_by: string | null
    mailed: boolean
  }
  product: {
    id: string
    product_number: string
    type: string
    assignee_id: string | null
  }
  order: {
    id: string
    order_number: string
  }
  customer: {
    name: string
    email: string | null
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The request id the message carries, or a rejection when it carries none. */
export function requestIdOf(message: EmailMessage): string {
  const requestId = message.context.request_id
  if (typeof requestId !== 'string' || !UUID_RE.test(requestId)) {
    throw new Error(`${message.template}: the message carries no request_id`)
  }
  return requestId
}

/** The request's status as it is now — what "still needed?" asks. */
export async function loadRequestStatus(message: EmailMessage, { db }: TemplateDeps): Promise<string | null> {
  const { data, error } = await db
    .from('product_approval_requests')
    .select('status')
    .eq('id', requestIdOf(message))
    .maybeSingle()
  if (error) throw new Error(`${message.template}: request lookup failed: ${error.message}`)
  return data?.status ?? null
}

export async function loadApprovalRequestContext(message: EmailMessage, { db }: TemplateDeps): Promise<ApprovalRequestContext> {
  const requestId = requestIdOf(message)

  const { data: request, error: requestError } = await db
    .from('product_approval_requests')
    .select('id, round, status, message, note, expires_at, settled_by, mailed, product_id')
    .eq('id', requestId)
    .maybeSingle()
  if (requestError) throw new Error(`${message.template}: request lookup failed: ${requestError.message}`)
  if (!request) throw new Error(`${message.template}: request ${requestId} does not exist`)

  const { data: product, error: productError } = await db
    .from('products')
    .select('id, product_number, type, assignee_id, order_id')
    .eq('id', request.product_id)
    .maybeSingle()
  if (productError) throw new Error(`${message.template}: product lookup failed: ${productError.message}`)
  if (!product) throw new Error(`${message.template}: product ${request.product_id} does not exist`)

  const { data: order, error: orderError } = await db
    .from('orders')
    .select('id, order_number, customers(name, email)')
    .eq('id', product.order_id)
    .maybeSingle()
  if (orderError) throw new Error(`${message.template}: order lookup failed: ${orderError.message}`)
  if (!order) throw new Error(`${message.template}: order ${product.order_id} does not exist`)

  // Supabase may hand a to-one join back as a one-element array.
  const joined: unknown = order.customers
  const customer = (Array.isArray(joined) ? joined[0] : joined) as { name: string; email: string | null } | null
  if (!customer) throw new Error(`${message.template}: order ${order.id} has no customer`)

  return {
    request: {
      id: request.id,
      round: request.round,
      status: request.status,
      message: request.message,
      note: request.note,
      expires_at: request.expires_at,
      settled_by: request.settled_by,
      mailed: request.mailed,
    },
    product: {
      id: product.id,
      product_number: product.product_number,
      type: product.type,
      assignee_id: product.assignee_id,
    },
    order: { id: order.id, order_number: order.order_number },
    customer: { name: customer.name, email: customer.email },
  }
}

/** A timestamp as the shop writes dates: day.month.year. */
export function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** The wording's shared slots: the order, product and customer every approval mail names. */
export function sharedData(context: ApprovalRequestContext): Record<string, unknown> {
  return {
    customerName: context.customer.name,
    orderNumber: context.order.order_number,
    productNumber: context.product.product_number,
    productLabel: productLabel(context.product.type),
  }
}
