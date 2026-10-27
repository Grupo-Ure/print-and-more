import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import type { HistoryEvent, HistoryRow } from '../services/historyService'
import { useHistoryForOrder } from '../queries/historyQueries'
import { useProductsByOrderId } from '../queries/productQueries'
import { useUsers } from '../queries/userQueries'
import { PRODUCT_STATUS_META, ORDER_STATUS_META, type StatusMeta } from '../lib/statusLabels'
import { PRODUCT_TYPE_LABELS } from '../lib/productTypeLabels'
import { emailTemplateLabel } from '../lib/emailTemplateLabels'
import { formatDateShort, formatDateTimeHuman } from '../lib/formatDate'
import { shortProductNumber } from '../lib/productShared'
import { cn } from '../lib/utils'
import { isInDateRange } from '../lib/dateRange'
import { FilterBar, ProductLink, Quote } from './LogText'
import { DateRangeFilter } from './fields/DateRangeFilter'
import { EmployeeCombobox } from './fields/EmployeeCombobox'
import { HistoryEventCombobox } from './fields/HistoryEventCombobox'
import { ProductCombobox } from './fields/ProductCombobox'
import { Button } from './ui/button'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.orders.details.history
const FILTER_IDS = IDS.filters

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
    const text = formatDateShort(raw)
    return text === '—' ? raw : text
  }
  const labels: Record<string, string> = { PICKUP: 'Pickup', SHIPPING: 'Shipping', HIGH: 'High', NORMAL: 'Normal' }
  return labels[raw] ?? raw
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
 * plain strings render as-is, persons/products/quotes get a colour highlight,
 * statuses render in the status' actual colour. A product carries its id while
 * it still exists, which makes it a link to the product.
 */
type Segment =
  | string
  | { kind: 'person'; text: string }
  | { kind: 'product'; text: string; productId: string | null }
  | { kind: 'duration'; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'status'; meta: StatusMeta }

function segmentText(segment: Segment): string {
  if (typeof segment === 'string') return segment
  if (segment.kind === 'status') return segment.meta.label
  return segment.kind === 'quote' ? `“${segment.text}”` : segment.text
}

/**
 * One human sentence per event: "Brian moved LFP-01 to <Prepress>",
 * "Brian logged 45 min for Anna on TEX-02". The date is prefixed by the
 * renderer so it can be styled separately.
 */
function historySegments(
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
      // Written by the database when a customer approval lands — nobody clicked.
      if (meta?.automatic === true) {
        return [product, ' went to ', { kind: 'status', meta: PRODUCT_STATUS_META.IN_PRODUCTION }, ' on the customer approval']
      }
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

type HistoryFilter = {
  from: string
  to: string
  userId: string | null
  productId: string | null
  event: HistoryEvent | null
}

const NO_FILTER: HistoryFilter = { from: '', to: '', userId: null, productId: null, event: null }

/**
 * The order's history log, newest first, one sentence per event, under a row
 * of filters: a date range, who did it, which product, which event. Rendered
 * as the order's History tab — mounted only while that tab is active, so the
 * query runs on demand (and the filters start empty each time).
 */
export function OrderHistory({
  orderId,
  onOpenProduct,
}: {
  orderId: string
  /** Shows the product on the order's Products tab; makes the product numbers links. */
  onOpenProduct?: (productId: string) => void
}) {
  const historyQuery = useHistoryForOrder(orderId)
  const productsQuery = useProductsByOrderId(orderId)
  const { data: users } = useUsers()
  const [filter, setFilter] = useState<HistoryFilter>(NO_FILTER)

  const staffById = new Map((users ?? []).map(user => [user.id, user.name ?? user.id]))
  const products = productsQuery.data ?? []
  const entries = historyQuery.data ?? []
  // Only the event types this order's history holds are worth offering.
  const eventOptions = [...new Set(entries.map(entry => entry.event_type))]
  const isFiltered =
    filter.from !== '' || filter.to !== '' || filter.userId !== null || filter.productId !== null || filter.event !== null
  const shown = entries.filter(
    entry =>
      isInDateRange(entry.created_at, filter.from, filter.to) &&
      (filter.userId === null || entry.user_id === filter.userId) &&
      (filter.productId === null || entry.product_id === filter.productId) &&
      (filter.event === null || entry.event_type === filter.event),
  )

  // "LFP-01" — the product number without the redundant order-number prefix
  // (every entry in this log belongs to the same order).
  const productShortNumber = (productId: string | null): string | null => {
    if (!productId) return null
    const number = products.find(product => product.id === productId)?.product_number
    return number ? shortProductNumber(number) : 'Product'
  }
  // The product to open from the entry, while the Products tab still lists it (not deleted, not cancelled).
  const existingProductId = (productId: string | null): string | null =>
    productId && products.some(product => product.id === productId && !product.is_cancelled) ? productId : null

  return (
    <section data-testid={IDS.root} aria-label="Order history" className="flex h-full flex-col gap-3">
      {entries.length > 0 && (
        <FilterBar label="Filter the history">
          <DateRangeFilter
            from={filter.from}
            to={filter.to}
            onChange={range => setFilter(prev => ({ ...prev, ...range }))}
            testId={FILTER_IDS.dateRange}
            calendarTestId={FILTER_IDS.dateRangeCalendar}
          />
          <EmployeeCombobox
            value={filter.userId}
            onChange={user => setFilter(prev => ({ ...prev, userId: user?.id ?? null }))}
            emptyLabel="Everyone"
            testId={FILTER_IDS.user}
            emptyOptionTestId={FILTER_IDS.userAll}
            userOptionTestId={FILTER_IDS.userOption}
          />
          <ProductCombobox
            products={products}
            value={filter.productId}
            onChange={productId => setFilter(prev => ({ ...prev, productId }))}
            testId={FILTER_IDS.product}
            emptyOptionTestId={FILTER_IDS.productAll}
            optionTestId={FILTER_IDS.productOption}
          />
          <HistoryEventCombobox
            options={eventOptions}
            value={filter.event}
            onChange={event => setFilter(prev => ({ ...prev, event }))}
            testId={FILTER_IDS.event}
            emptyOptionTestId={FILTER_IDS.eventAll}
            optionTestId={FILTER_IDS.eventOption}
          />
          {isFiltered && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              data-testid={FILTER_IDS.clear}
              onClick={() => setFilter(NO_FILTER)}
            >
              <RotateCcw />
              Clear
            </Button>
          )}
        </FilterBar>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {historyQuery.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {historyQuery.isError && (
          <p className="text-sm text-destructive">History could not be loaded</p>
        )}
        {historyQuery.isSuccess && entries.length === 0 && (
          <p data-testid={IDS.empty} className="text-sm text-muted-foreground">No history entries yet</p>
        )}
        {entries.length > 0 && shown.length === 0 && (
          <p data-testid={IDS.noMatch} className="text-sm text-muted-foreground">No entries match the filters</p>
        )}
        {shown.length > 0 && (
          <ul data-testid={IDS.list} className="divide-y divide-border">
            {shown.map(entry => (
              <HistoryItem
                key={entry.id}
                entry={entry}
                productLabel={productShortNumber(entry.product_id)}
                productId={existingProductId(entry.product_id)}
                staffById={staffById}
                onOpenProduct={onOpenProduct}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

type HistoryItemProps = {
  entry: HistoryRow
  /** Short product number ("LFP-01") for product-scoped entries; null = order-scoped. */
  productLabel: string | null
  /** The entry's product while it still exists, to link to; null otherwise. */
  productId: string | null
  staffById: Map<string, string>
  onOpenProduct?: (productId: string) => void
}

/**
 * One history entry as a single styled sentence line: the date first in muted
 * gray, then the sentence — persons in the brand colour, product numbers in sky
 * (a link to the product), quotes in dark yellow, statuses as text in their own
 * status colour. Every item is one line high; overflow truncates
 * with the full plain-text sentence in the title tooltip.
 */
function HistoryItem({ entry, productLabel, productId, staffById, onOpenProduct }: HistoryItemProps) {
  const segments = historySegments(entry, productLabel, productId, staffById)
  const time = formatDateTimeHuman(entry.created_at)
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
              <ProductLink key={i} productId={segment.productId} onOpen={onOpenProduct}>
                {segment.text}
              </ProductLink>
            )
          if (segment.kind === 'quote') return <Quote key={i}>{segment.text}</Quote>
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
