import type { HistoryRow } from '../services/historyService'
import { STAMP_COLOR_LABELS } from '../types/stamp'
import { PRODUCT_STATUS_META, ORDER_STATUS_META, type StatusMeta } from './statusLabels'
import { PRODUCT_TYPE_LABELS } from './productTypeLabels'
import { emailTemplateLabel } from './emailTemplateLabels'
import { FILE_ROLE_LABELS } from './fileRoleLabels'
import { formatDateShort } from './formatDate'
import { shortProductNumber } from './productShared'

/**
 * The wording of a history entry: one human sentence per event, shared by the
 * order's History tab and the global History page so an entry reads the same
 * on both. Pure — `HistoryEntryLine` renders the segments.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * What a PRODUCT_* event's product was, from the meta snapshot: "12× Banner".
 * The sentence names the product by its number; this says what it is, which is
 * the only record left once the row itself is deleted.
 */
function productKind(meta: Record<string, unknown> | null): string {
  // The database's entries keep the product's full content under `after`
  // (created, updated) or `before` (cancelled); entries written before that
  // keep type and quantity at the top.
  const content = isRecord(meta?.after) ? meta.after : isRecord(meta?.before) ? meta.before : meta
  const type = typeof content?.type === 'string' ? content.type : null
  const kind = (type && PRODUCT_TYPE_LABELS[type]) ?? 'product'
  const quantity = typeof content?.quantity === 'number' ? `${content.quantity}× ` : ''
  return `${quantity}${kind}`
}

/** SETTINGS_CHANGED meta.field → the word used in the sentence. */
const SETTING_FIELD_LABELS: Record<string, string> = {
  deadline: 'deadline',
  delivery: 'delivery type',
  priority: 'priority',
  payment_method: 'payment method',
}

/** SETTINGS_CHANGED meta value → display text (dates formatted, enums labelled). */
function settingValueText(field: string, value: unknown): string | null {
  if (value == null || value === '') return null
  const raw = String(value)
  if (field === 'deadline') {
    const text = formatDateShort(raw)
    return text === '—' ? raw : text
  }
  const labels: Record<string, string> = {
    PICKUP: 'Pickup',
    SHIPPING: 'Shipping',
    HIGH: 'High',
    NORMAL: 'Normal',
    INVOICE: 'Invoice',
    CASH: 'Cash',
  }
  return labels[raw] ?? raw
}

/** A file's name from the entry: kept on the entry itself, or in the file row it was created with (meta.after). */
export function historyFileName(meta: Record<string, unknown> | null): string {
  if (typeof meta?.display_name === 'string') return meta.display_name
  const after = meta?.after
  if (isRecord(after) && typeof after.display_name === 'string') return after.display_name
  return 'a file'
}

function fileRoleText(value: unknown): string {
  return typeof value === 'string' ? (FILE_ROLE_LABELS[value as keyof typeof FILE_ROLE_LABELS] ?? value) : 'none'
}

/** A stamp model's name with its ink colour: pads of one name differ only by colour. */
export function stampModelLabel(model: { name: string; color: string | null }): string {
  const color = model.color ? ((STAMP_COLOR_LABELS as Record<string, string>)[model.color] ?? model.color) : null
  return [model.name, color].filter(Boolean).join(' · ')
}

/** The stock item a stock entry concerns: "Model · Ink colour" for a stamp model, "Model · Colour · Size" for a textile variant. */
export function stockItemLabel(entry: HistoryRow): string {
  if (entry.stamp_models) return stampModelLabel(entry.stamp_models)
  const variant = entry.textile_variants
  if (variant) return [variant.textile_models?.name, variant.color, variant.size].filter(Boolean).join(' · ')
  return 'stock item'
}

export function historyMeta(entry: HistoryRow): Record<string, unknown> | null {
  return isRecord(entry.meta) ? entry.meta : null
}

/** Name from a meta snapshot (written at event time), falling back to the current users map. */
function metaName(
  meta: Record<string, unknown> | null,
  nameKey: string,
  idKey: string,
  staffById: Map<string, string>,
): string | null {
  if (!meta) return null
  const name = meta[nameKey]
  if (typeof name === 'string' && name) return name
  const id = meta[idKey]
  if (typeof id === 'string' && id) return staffById.get(id) ?? '—'
  return null
}

/**
 * A sentence is a list of segments so each part can carry its own styling:
 * plain strings render as-is, persons/products/quotes get a colour highlight,
 * statuses render in the status' actual colour. A product carries its id while
 * it still exists, which makes it a link to the product.
 */
export type Segment =
  | string
  | { kind: 'person'; text: string }
  | { kind: 'product'; text: string; productId: string | null }
  | { kind: 'duration'; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'status'; meta: StatusMeta }

export function segmentText(segment: Segment): string {
  if (typeof segment === 'string') return segment
  if (segment.kind === 'status') return segment.meta.label
  return segment.kind === 'quote' ? `“${segment.text}”` : segment.text
}

/**
 * One human sentence per event: "Brian moved LFP-01 to <Prepress>",
 * "Brian logged 45 min for Anna on TEX-02". The date is prefixed by the
 * renderer so it can be styled separately. An order-level entry speaks of
 * "the order": the order's tab is that order, and the History page names it
 * beside the sentence.
 */
export function historySegments(
  entry: HistoryRow,
  productLabel: string | null,
  productId: string | null,
  staffById: Map<string, string>,
): Segment[] {
  const actor: Segment = {
    kind: 'person',
    text: entry.user_id ? (staffById.get(entry.user_id) ?? 'Someone') : 'The system',
  }
  const product: Segment = productLabel ? { kind: 'product', text: productLabel, productId } : 'a product'
  const meta = historyMeta(entry)

  switch (entry.event_type) {
    case 'ORDER_CREATED':
      return [actor, ' created the order']
    case 'PROCESSING_STARTED':
      return [actor, ' moved the order to ', { kind: 'status', meta: ORDER_STATUS_META.IN_PROGRESS }]
    case 'PREPRESS_READY':
      // Only ever automatic: the database moves a ready product, in the write
      // of whoever's change made it ready.
      return [product, ' moved to ', { kind: 'status', meta: PRODUCT_STATUS_META.PREPRESS }]
    case 'RETURNED_TO_PREPRESS':
      return [actor, ' sent ', product, ' back to ', { kind: 'status', meta: PRODUCT_STATUS_META.PREPRESS }]
    case 'PRODUCTION_READY_SET':
      // Written by the database when a customer approval lands — nobody clicked.
      if (meta?.automatic === true) {
        return [product, ' went to ', { kind: 'status', meta: PRODUCT_STATUS_META.IN_PRODUCTION }, ' on the customer approval']
      }
      return [actor, ' released ', product, ' to ', { kind: 'status', meta: PRODUCT_STATUS_META.IN_PRODUCTION }]
    case 'MARKED_DONE':
      return [actor, ' marked ', product, ' as ', { kind: 'status', meta: PRODUCT_STATUS_META.DONE }]
    case 'ORDER_FINISHED':
      // The order's button or the last open product being done — either way the actor's change.
      return [actor, ' moved the order to ', { kind: 'status', meta: ORDER_STATUS_META.FINISHED }]
    case 'ORDER_REOPENED':
      return [actor, ' reopened the order']
    case 'ORDER_BILLED':
      return [actor, ' marked the order as ', { kind: 'status', meta: ORDER_STATUS_META.BILLED }]
    case 'ORDER_CLOSED_CASH':
      return [actor, ' finished and closed the order as ', { kind: 'status', meta: ORDER_STATUS_META.BILLED }, ' (paid in cash)']
    case 'EMERGENCY_TRIGGERED':
      return [actor, ' force-released ', product, ' to ', { kind: 'status', meta: PRODUCT_STATUS_META.IN_PRODUCTION }]
    case 'STOCK_AUTO_DEDUCTED': {
      // Written by the release (or the approval) it shares its action with,
      // one entry per stock item.
      const quantity = typeof meta?.quantity === 'number' ? `${meta.quantity} × ` : ''
      return [`${quantity}${stockItemLabel(entry)} taken from stock for `, product]
    }
    case 'CUSTOMER_APPROVAL_ACTIVATED':
      return [actor, ' requested customer approval for ', product]
    case 'CUSTOMER_APPROVAL_DEACTIVATED':
      return [actor, ' removed the customer-approval requirement for ', product]
    case 'CUSTOMER_APPROVAL_REQUESTED': {
      const round = typeof meta?.round === 'number' ? ` (round ${meta.round})` : ''
      const unmailed = meta?.mailed === false ? ', without a mail' : ''
      return [actor, ' asked the customer to approve ', product, `${round}${unmailed}`]
    }
    case 'CUSTOMER_APPROVAL_GRANTED': {
      // `by` is CUSTOMER when the answer came through the page; an employee
      // recording it by hand is the entry's actor.
      if (meta?.by === 'CUSTOMER') return ['The customer approved ', product]
      return [actor, ' recorded the customer approval for ', product]
    }
    case 'CUSTOMER_APPROVAL_CHANGES_REQUESTED': {
      const note: Segment[] = typeof meta?.note === 'string' && meta.note ? [': ', { kind: 'quote', text: meta.note }] : []
      if (meta?.by === 'CUSTOMER') return ['The customer requested changes to ', product, ...note]
      return [actor, ' recorded a request for changes to ', product, ...note]
    }
    case 'CUSTOMER_APPROVAL_WITHDRAWN':
      return [actor, ' withdrew the approval request for ', product]
    case 'CUSTOMER_APPROVAL_EXPIRED':
      return ['The approval request for ', product, ' expired']
    case 'CUSTOMER_APPROVAL_BYPASSED':
      return [actor, ' bypassed customer approval for ', product]
    case 'ROLLED_BACK':
      return [
        'A content change moved ',
        product,
        ' back to ',
        { kind: 'status', meta: PRODUCT_STATUS_META.IN_SETUP },
      ]
    case 'CANCELLED':
      return [actor, ' cancelled the order']
    case 'ORDER_ARCHIVED':
      return [actor, ' archived the order']
    case 'ORDER_BILLING_NOTE_CHANGED': {
      const next = typeof meta?.next === 'string' && meta.next ? meta.next : null
      return next ? [actor, ' set the billing note to ', { kind: 'quote', text: next }] : [actor, ' cleared the billing note']
    }
    case 'PRODUCT_CANCELLED':
      return [actor, ' cancelled ', product]
    case 'SETTINGS_CHANGED': {
      const field = typeof meta?.field === 'string' ? meta.field : null
      const fieldLabel = (field && SETTING_FIELD_LABELS[field]) ?? 'settings'
      const next = field ? settingValueText(field, meta?.next) : null
      if (productLabel) {
        // Product override: next null = the override was cleared back to the order's value.
        if (!next) return [actor, ` reset the ${fieldLabel} of `, product, " to the order's"]
        return [actor, ` set the ${fieldLabel} of `, product, ` to ${next}`]
      }
      if (!next) return [actor, ` cleared the order's ${fieldLabel}`]
      const previous = field ? settingValueText(field, meta?.previous) : null
      return [actor, ` changed the order's ${fieldLabel}${previous ? ` from ${previous}` : ''} to ${next}`]
    }
    case 'PRODUCT_CREATED':
    case 'PRODUCT_UPDATED':
      return [
        actor,
        entry.event_type === 'PRODUCT_CREATED' ? ' added ' : ' updated ',
        product,
        ` (${productKind(meta)})`,
      ]
    case 'PRODUCT_DELETED': {
      // The product row is gone (product_id is null); its number was
      // snapshotted into meta, so the sentence names it from there.
      const number = typeof meta?.product_number === 'string' ? shortProductNumber(meta.product_number) : null
      return [
        actor,
        ' deleted ',
        number ? { kind: 'product', text: number, productId: null } : 'a product',
        ` (${productKind(meta)})`,
      ]
    }
    case 'FILE_ADDED':
    case 'FILE_REMOVED': {
      const name = historyFileName(meta)
      if (entry.event_type === 'FILE_REMOVED') return [actor, ` removed file ${name}`]
      // With a product: the order's file attached to that product.
      return productLabel ? [actor, ` attached file ${name} to `, product] : [actor, ` added file ${name}`]
    }
    case 'FILE_RENAMED': {
      const previous = typeof meta?.previous === 'string' ? meta.previous : 'a file'
      const next = typeof meta?.next === 'string' ? meta.next : '—'
      return [actor, ` renamed file ${previous} to ${next}`]
    }
    case 'FILE_ROLE_CHANGED':
      return [
        actor,
        ` changed the role of file ${historyFileName(meta)} from ${fileRoleText(meta?.previous)} to ${fileRoleText(meta?.next)}`,
      ]
    case 'ASSIGNEE_CHANGED': {
      // By hand or the stage's default — the database writes both the same
      // way; a handover shares its action with the step that caused it.
      // Entries written before the database recorded them use the older keys.
      const previous =
        metaName(meta, 'previous_name', 'previous', staffById) ??
        metaName(meta, 'previous_assignee_name', 'previous_assignee_id', staffById)
      const next =
        metaName(meta, 'next_name', 'next', staffById) ?? metaName(meta, 'new_assignee_name', 'new_assignee_id', staffById)
      if (next && previous)
        return [actor, ' reassigned ', product, ' from ', { kind: 'person', text: previous }, ' to ', { kind: 'person', text: next }]
      if (next) return [actor, ' assigned ', product, ' to ', { kind: 'person', text: next }]
      if (previous) return [actor, ' unassigned ', { kind: 'person', text: previous }, ' from ', product]
      return [actor, ' changed the assignee of ', product]
    }
    case 'TIME_LOGGED':
    case 'TIME_LOG_DELETED': {
      const minutes: Segment =
        typeof meta?.minutes === 'number' ? { kind: 'duration', text: `${meta.minutes} min` } : 'time'
      const attributed = metaName(meta, 'user_name', 'user_id', staffById)
      const forWhom: Segment[] =
        attributed && meta?.user_id !== entry.user_id ? [' for ', { kind: 'person', text: attributed }] : []
      return entry.event_type === 'TIME_LOGGED'
        ? [actor, ' logged ', minutes, ...forWhom, ' on ', product]
        : [actor, ' deleted a ', minutes, ' log', ...forWhom, ' on ', product]
    }
    case 'EMAIL_SENT':
    case 'EMAIL_FAILED':
    case 'EMAIL_BOUNCED': {
      // Written by the sender or the webhook, never by a person; the details are the meta snapshot.
      const template = typeof meta?.template === 'string' ? emailTemplateLabel(meta.template) : 'An email'
      const recipient = typeof meta?.recipient === 'string' ? ` to ${meta.recipient}` : ''
      const about: Segment[] = productLabel ? [' about ', product] : []
      if (entry.event_type === 'EMAIL_SENT') {
        const subject: Segment[] = typeof meta?.subject === 'string' ? [' ', { kind: 'quote', text: meta.subject }] : []
        return [template, ...subject, ` was sent${recipient}`, ...about]
      }
      if (entry.event_type === 'EMAIL_BOUNCED') {
        const reason = typeof meta?.reason === 'string' ? `: ${meta.reason}` : ''
        return [`${template}${recipient}`, ...about, ` bounced${reason}`]
      }
      const unknown = meta?.reason === 'unknown_template' ? ' (unknown template)' : ''
      return [`${template}${recipient}`, ...about, ` could not be sent${unknown}`]
    }
    default:
      return [actor, `: ${(entry.event_type as string).replace(/_/g, ' ').toLowerCase()}`, ...(productLabel ? [' (', product, ')'] : [])]
  }
}
