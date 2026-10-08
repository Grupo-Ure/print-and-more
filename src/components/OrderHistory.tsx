import type { HistoryRow } from '../services/historyService'
import { useHistoryForOrder } from '../queries/historyQueries'
import { useProductsByOrderId } from '../queries/productQueries'
import { useUsers } from '../queries/userQueries'
import { PRODUCT_STATUS_META, ORDER_STATUS_META, type StatusMeta } from '../lib/statusLabels'
import { PRODUCT_TYPE_LABELS } from '../lib/productTypeLabels'
import { shortProductNumber } from '../lib/productShared'
import { cn } from '../lib/utils'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.orders.details.history

/**
 * What a PRODUCT_* event's product was, from the meta snapshot: "12× Banner".
 * The sentence names the product by its number; this says what it is, which is
 * the only record left once the row itself is deleted.
 */
function productKind(meta: Record<string, unknown> | null): string {
  const type = typeof meta?.type === 'string' ? meta.type : null
  const kind = (type && PRODUCT_TYPE_LABELS[type]) ?? 'product'
  const quantity = typeof meta?.quantity === 'number' ? `${meta.quantity}× ` : ''
  return `${quantity}${kind}`
}

/** SETTINGS_CHANGED meta.field → the word used in the sentence. */
const SETTING_FIELD_LABELS: Record<string, string> = {
  deadline: 'deadline',
  delivery: 'delivery type',
  priority: 'priority',
}

/** SETTINGS_CHANGED meta value → display text (dates formatted, enums labelled). */
function settingValueText(field: string, value: unknown): string | null {
  if (value == null || value === '') return null
  const raw = String(value)
  if (field === 'deadline') {
    const date = new Date(raw)
    return Number.isNaN(date.getTime())
      ? raw
      : date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })
  }
  const labels: Record<string, string> = { PICKUP: 'Pickup', SHIPPING: 'Shipping', HIGH: 'High', NORMAL: 'Normal' }
  return labels[raw] ?? raw
}

function formatHistoryTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function metaRecord(entry: HistoryRow): Record<string, unknown> | null {
  const meta = entry.meta
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null
  return meta as Record<string, unknown>
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
 * plain strings render as-is, persons/products get a colour highlight, statuses
 * render as a chip in the status' actual colour.
 */
type Segment =
  | string
  | { kind: 'person'; text: string }
  | { kind: 'product'; text: string }
  | { kind: 'duration'; text: string }
  | { kind: 'status'; meta: StatusMeta }

function segmentText(segment: Segment): string {
  if (typeof segment === 'string') return segment
  return segment.kind === 'status' ? segment.meta.label : segment.text
}

/**
 * One human sentence per event: "Brian moved LFP-01 to <Prepress>",
 * "Brian logged 45 min for Anna on TEX-02". The date is prefixed by the
 * renderer so it can be styled separately.
 */
function historySegments(
  entry: HistoryRow,
  productLabel: string | null,
  staffById: Map<string, string>,
): Segment[] {
  const actor: Segment = {
    kind: 'person',
    text: entry.user_id ? (staffById.get(entry.user_id) ?? 'Someone') : 'The system',
  }
  const product: Segment = productLabel ? { kind: 'product', text: productLabel } : 'a product'
  const meta = metaRecord(entry)

  switch (entry.event_type) {
    case 'ORDER_CREATED':
      return [actor, ' created the order']
    case 'PROCESSING_STARTED':
      return [actor, ' moved the order to ', { kind: 'status', meta: ORDER_STATUS_META.IN_PROGRESS }]
    case 'PREPRESS_READY_AUTO':
      return [product, ' became ready for ', { kind: 'status', meta: PRODUCT_STATUS_META.PREPRESS }]
    case 'PREPRESS_READY_MANUAL':
      return [actor, ' moved ', product, ' to ', { kind: 'status', meta: PRODUCT_STATUS_META.PREPRESS }]
    case 'PRODUCTION_READY_SET':
      return [actor, ' released ', product, ' to ', { kind: 'status', meta: PRODUCT_STATUS_META.IN_PRODUCTION }]
    case 'MARKED_DONE':
      return [actor, ' marked ', product, ' as ', { kind: 'status', meta: PRODUCT_STATUS_META.DONE }]
    case 'ORDER_FINISHED':
      // Written automatically when the last product was done — no one clicked.
      if (meta?.automatic === true) {
        return ['Every product is done — the order became ', { kind: 'status', meta: ORDER_STATUS_META.FINISHED }]
      }
      return [actor, ' marked the order as ', { kind: 'status', meta: ORDER_STATUS_META.FINISHED }]
    case 'ORDER_REOPENED':
      return [actor, ' reopened the order']
    case 'ORDER_BILLED':
      return [actor, ' marked the order as ', { kind: 'status', meta: ORDER_STATUS_META.BILLED }]
    case 'ORDER_CLOSED_CASH':
      return [actor, ' finished and closed the order as ', { kind: 'status', meta: ORDER_STATUS_META.BILLED }, ' (paid in cash)']
    case 'EMERGENCY_TRIGGERED':
      return [actor, ' force-released ', product, ' to ', { kind: 'status', meta: PRODUCT_STATUS_META.IN_PRODUCTION }]
    case 'CUSTOMER_APPROVAL_ACTIVATED':
      return [actor, ' requested customer approval for ', product]
    case 'CUSTOMER_APPROVAL_DEACTIVATED':
      return [actor, ' removed the customer-approval requirement for ', product]
    case 'CUSTOMER_APPROVAL_GRANTED':
      return [actor, ' granted customer approval for ', product]
    case 'CUSTOMER_APPROVAL_EXPIRED':
      return ['Customer approval for ', product, ' expired']
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
        number ? { kind: 'product', text: number } : 'a product',
        ` (${productKind(meta)})`,
      ]
    }
    case 'FILE_ADDED':
    case 'FILE_REMOVED': {
      const name = typeof meta?.display_name === 'string' ? meta.display_name : 'a file'
      return entry.event_type === 'FILE_ADDED'
        ? [actor, ` added file ${name}`]
        : [actor, ` removed file ${name}`]
    }
    case 'ASSIGNEE_CHANGED': {
      const previous = metaName(meta, 'previous_assignee_name', 'previous_assignee_id', staffById)
      const next = metaName(meta, 'new_assignee_name', 'new_assignee_id', staffById)
      const suffix = meta?.automatic === true ? ' (automatic)' : ''
      if (next && previous)
        return [actor, ' reassigned ', product, ' from ', { kind: 'person', text: previous }, ' to ', { kind: 'person', text: next }, suffix]
      if (next) return [actor, ' assigned ', product, ' to ', { kind: 'person', text: next }, suffix]
      if (previous) return [actor, ' unassigned ', { kind: 'person', text: previous }, ' from ', product, suffix]
      return [actor, ' changed the assignee of ', product, suffix]
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
    default:
      return [actor, `: ${(entry.event_type as string).replace(/_/g, ' ').toLowerCase()}`, ...(productLabel ? [' (', product, ')'] : [])]
  }
}

/**
 * The order's history log, newest first, one sentence per event. Rendered as
 * the order's History tab — mounted only while that tab is active, so the
 * query runs on demand.
 */
export function OrderHistory({ orderId }: { orderId: string }) {
  const historyQuery = useHistoryForOrder(orderId)
  const productsQuery = useProductsByOrderId(orderId)
  const { data: users } = useUsers()

  const staffById = new Map((users ?? []).map(user => [user.id, user.name ?? user.id]))
  const products = productsQuery.data ?? []
  const entries = historyQuery.data ?? []

  // "LFP-01" — the product number without the redundant order-number prefix
  // (every entry in this log belongs to the same order).
  const productShortNumber = (productId: string | null): string | null => {
    if (!productId) return null
    const number = products.find(product => product.id === productId)?.product_number
    return number ? shortProductNumber(number) : 'Product'
  }

  return (
    <section data-testid={IDS.root} aria-label="Order history" className="h-full overflow-y-auto">
      {historyQuery.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {historyQuery.isError && (
        <p className="text-sm text-destructive">History could not be loaded</p>
      )}
      {historyQuery.isSuccess && entries.length === 0 && (
        <p data-testid={IDS.empty} className="text-sm text-muted-foreground">No history entries yet</p>
      )}
      {entries.length > 0 && (
        <ul data-testid={IDS.list} className="divide-y divide-border">
          {entries.map(entry => (
            <HistoryItem
              key={entry.id}
              entry={entry}
              productLabel={productShortNumber(entry.product_id)}
              staffById={staffById}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

type HistoryItemProps = {
  entry: HistoryRow
  /** Short product number ("LFP-01") for product-scoped entries; null = order-scoped. */
  productLabel: string | null
  staffById: Map<string, string>
}

/**
 * One history entry as a single styled sentence line: the date first in muted
 * gray, then the sentence — persons in the brand colour, product numbers in sky,
 * statuses as text in their own status colour. Every item is one line high; overflow truncates
 * with the full plain-text sentence in the title tooltip.
 */
function HistoryItem({ entry, productLabel, staffById }: HistoryItemProps) {
  const segments = historySegments(entry, productLabel, staffById)
  const time = formatHistoryTime(entry.created_at)
  const plain = `${time} — ${segments.map(segmentText).join('')}${entry.reason ? ` — ${entry.reason}` : ''}`

  return (
    <li data-testid={IDS.item} data-event-type={entry.event_type} className="py-1.5 text-sm">
      <p className="truncate" title={plain}>
        <span className="text-muted-foreground">{time}</span>
        <span className="text-muted-foreground"> — </span>
        {segments.map((segment, i) => {
          if (typeof segment === 'string') return <span key={i}>{segment}</span>
          if (segment.kind === 'person')
            return (
              <span key={i} className="font-medium text-pink-800">
                {segment.text}
              </span>
            )
          if (segment.kind === 'product')
            return (
              <span key={i} className="font-medium text-sky-600 dark:text-sky-400">
                {segment.text}
              </span>
            )
          if (segment.kind === 'duration')
            return (
              <span key={i} className="font-medium text-primary">
                {segment.text}
              </span>
            )
          return (
            <span key={i} className={cn('font-medium', segment.meta.textColor)}>
              {segment.meta.label}
            </span>
          )
        })}
        {entry.reason && <span className="text-muted-foreground"> — {entry.reason}</span>}
      </p>
    </li>
  )
}
