import { useState, type ReactNode } from 'react'
import { Eye, RotateCcw } from 'lucide-react'
import type { HistoryRow } from '../services/historyService'
import type { QueuedEmailRow, SentEmailRow } from '../services/emailService'
import { useFailedEmails, useQueuedEmails, useSentEmails } from '../queries/emailQueries'
import { useProductsByOrderId } from '../queries/productQueries'
import { emailTemplateLabel } from '../lib/emailTemplateLabels'
import { formatDateTimeHuman } from '../lib/formatDate'
import { shortProductNumber } from '../lib/productShared'
import { isInDateRange } from '../lib/dateRange'
import { FilterBar, ProductLink, Quote } from './LogText'
import { DateRangeFilter } from './fields/DateRangeFilter'
import { ProductCombobox } from './fields/ProductCombobox'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { SectionTitle } from './ui/section-title'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.orders.details.emails
const FILTER_IDS = IDS.filters

type EmailFilter = { from: string; to: string; productId: string | null }

const NO_FILTER: EmailFilter = { from: '', to: '', productId: null }

/**
 * The order's mails: the ones waiting to go, the ones that went, the ones the
 * sender gave up on, under a row of filters — a date range (when it is due,
 * went, or failed) and the product it is about. Read-only — every mail is
 * automatic, so there is nothing to send, cancel or retry here. Rendered as
 * the order's Emails tab, mounted only while that tab is active.
 */
export function OrderEmails({
  orderId,
  onOpenProduct,
}: {
  orderId: string
  /** Shows the product on the order's Products tab; makes the product numbers links. */
  onOpenProduct?: (productId: string) => void
}) {
  const queuedQuery = useQueuedEmails(orderId)
  const sentQuery = useSentEmails(orderId)
  const failedQuery = useFailedEmails(orderId)
  const productsQuery = useProductsByOrderId(orderId)
  const [viewedEmail, setViewedEmail] = useState<SentEmailRow | null>(null)
  const [filter, setFilter] = useState<EmailFilter>(NO_FILTER)

  const allQueued = queuedQuery.data ?? []
  const allSent = sentQuery.data ?? []
  const allFailed = failedQuery.data ?? []
  const products = productsQuery.data ?? []

  const isLoading = queuedQuery.isLoading || sentQuery.isLoading || failedQuery.isLoading
  const isError = queuedQuery.isError || sentQuery.isError || failedQuery.isError
  const total = allQueued.length + allSent.length + allFailed.length
  const isEmpty = !isLoading && !isError && total === 0

  const isFiltered = filter.from !== '' || filter.to !== '' || filter.productId !== null
  const matches = (iso: string, productId: string | null) =>
    isInDateRange(iso, filter.from, filter.to) && (filter.productId === null || productId === filter.productId)
  const queued = allQueued.filter(email => matches(email.due_at, email.product_id))
  const sent = allSent.filter(email => matches(email.sent_at, email.product_id))
  const failed = allFailed.filter(entry => matches(entry.created_at, entry.product_id))
  const noMatch = total > 0 && queued.length + sent.length + failed.length === 0

  // "LFP-01" — every mail here belongs to the same order; null for a mail about the whole order.
  // The id stays only while the Products tab lists the product, so a deleted or cancelled one is not a link.
  const productOf = (productId: string | null): EmailProduct | null => {
    if (!productId) return null
    const product = products.find(candidate => candidate.id === productId)
    if (!product) return { id: null, label: 'Product' }
    return { id: product.is_cancelled ? null : productId, label: shortProductNumber(product.product_number) }
  }

  return (
    <section data-testid={IDS.root} aria-label="Order emails" className="flex h-full flex-col gap-3">
      {total > 0 && (
        <FilterBar label="Filter the emails">
          <DateRangeFilter
            from={filter.from}
            to={filter.to}
            onChange={range => setFilter(prev => ({ ...prev, ...range }))}
            testId={FILTER_IDS.dateRange}
            calendarTestId={FILTER_IDS.dateRangeCalendar}
          />
          <ProductCombobox
            products={products}
            value={filter.productId}
            onChange={productId => setFilter(prev => ({ ...prev, productId }))}
            testId={FILTER_IDS.product}
            emptyOptionTestId={FILTER_IDS.productAll}
            optionTestId={FILTER_IDS.productOption}
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

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {isError && <p className="text-sm text-destructive">Emails could not be loaded</p>}
        {isEmpty && (
          <p data-testid={IDS.empty} className="text-sm text-muted-foreground">
            No emails for this order yet
          </p>
        )}
        {noMatch && (
          <p data-testid={IDS.noMatch} className="text-sm text-muted-foreground">
            No emails match the filters
          </p>
        )}

        {queued.length > 0 && (
          <EmailGroup title="Waiting to go">
            {queued.map(email => (
              <QueuedEmailItem
                key={email.msg_id}
                email={email}
                product={productOf(email.product_id)}
                onOpenProduct={onOpenProduct}
              />
            ))}
          </EmailGroup>
        )}

        {failed.length > 0 && (
          <EmailGroup title="Failed">
            {failed.map(entry => (
              <FailedEmailItem
                key={entry.id}
                entry={entry}
                product={productOf(entry.product_id)}
                onOpenProduct={onOpenProduct}
              />
            ))}
          </EmailGroup>
        )}

        {sent.length > 0 && (
          <EmailGroup title="Sent">
            {sent.map(email => (
              <SentEmailItem
                key={email.id}
                email={email}
                product={productOf(email.product_id)}
                onOpenProduct={onOpenProduct}
                onView={() => setViewedEmail(email)}
              />
            ))}
          </EmailGroup>
        )}
      </div>

      <SentEmailDialog email={viewedEmail} onClose={() => setViewedEmail(null)} />
    </section>
  )
}

function EmailGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <SectionTitle className="mb-2">{title}</SectionTitle>
      <ul className="divide-y divide-border">{children}</ul>
    </div>
  )
}

/** The product a mail is about: its short number, and its id while it still exists. */
type EmailProduct = { id: string | null; label: string }

/** What every line passes on: the mail's product and how to open it. */
type EmailProductProps = {
  product: EmailProduct | null
  onOpenProduct?: (productId: string) => void
}

type EmailLineProps = EmailProductProps & {
  /** When it went, or is due — the line starts with it, as a history entry does. */
  time: string
  template: string
  subject?: string | null
  recipient?: string | null
  /** What follows: the delivery state, the retry, the failure. */
  detail?: string | null
  /** The detail is bad news (bounced, failed) and reads in red. */
  alert?: boolean
}

/**
 * One mail as one line, styled like a history entry: the time first in muted
 * gray, then the template, the product in sky (a link to it), the subject as a
 * quote, the recipient highlighted, and the detail last. Truncates with the full line in the tooltip.
 */
function EmailLine({ time, template, product, onOpenProduct, subject, recipient, detail, alert = false }: EmailLineProps) {
  const label = emailTemplateLabel(template)
  const plain = [
    `${time} — ${label}`,
    product && ` (${product.label})`,
    subject && ` “${subject}”`,
    recipient && ` to ${recipient}`,
    detail && ` — ${detail}`,
  ]
    .filter(Boolean)
    .join('')
  return (
    <p className="min-w-0 flex-1 truncate" title={plain}>
      <span className="text-muted-foreground">{time} — </span>
      <span className="font-medium">{label}</span>
      {product && (
        <>
          {' ('}
          <ProductLink productId={product.id} onOpen={onOpenProduct}>
            {product.label}
          </ProductLink>
          {')'}
        </>
      )}
      {subject && (
        <>
          {' '}
          <Quote>{subject}</Quote>
        </>
      )}
      {recipient && (
        <>
          {' to '}
          <span className="font-medium text-pink-800">{recipient}</span>
        </>
      )}
      {detail && <span className={alert ? 'text-destructive' : 'text-muted-foreground'}> — {detail}</span>}
    </p>
  )
}

function queuedTime(email: QueuedEmailRow): string {
  const isDue = new Date(email.due_at).getTime() <= Date.now()
  return isDue ? 'Due now' : `Due ${formatDateTimeHuman(email.due_at)}`
}

function QueuedEmailItem({ email, ...productProps }: EmailProductProps & { email: QueuedEmailRow }) {
  // A claim that did not end in a send leaves the count above zero: the provider refused it, and it comes back.
  const retry = email.attempts > 0 ? `retrying after ${email.attempts} failed attempts` : null
  return (
    <li data-testid={IDS.queuedItem} data-msg-id={email.msg_id} data-template={email.template} className="flex py-1.5 text-sm">
      <EmailLine
        time={queuedTime(email)}
        template={email.template}
        {...productProps}
        detail={retry}
        alert={retry !== null}
      />
    </li>
  )
}

type SentEmailItemProps = EmailProductProps & {
  email: SentEmailRow
  onView: () => void
}

/**
 * What the provider has reported of the mail since it went out, if anything:
 * a bounce outranks a delivery (a mail can be delivered first and bounce from
 * a forward later), a spam complaint likewise.
 */
function deliveryState(email: SentEmailRow): string | null {
  if (email.bounced_at) return `bounced: ${email.bounce_reason ?? 'no reason given'}`
  if (email.complained_at) return 'marked as spam'
  if (email.delivered_at) return 'delivered'
  return null
}

function SentEmailItem({ email, onView, ...productProps }: SentEmailItemProps) {
  return (
    <li
      data-testid={IDS.sentItem}
      data-sent-email-id={email.id}
      data-template={email.template}
      className="flex items-center gap-2 py-1 text-sm"
    >
      <EmailLine
        time={formatDateTimeHuman(email.sent_at)}
        template={email.template}
        {...productProps}
        subject={email.subject}
        recipient={email.recipient}
        detail={deliveryState(email)}
        alert={!!email.bounced_at || !!email.complained_at}
      />
      <Button data-testid={IDS.viewSent} variant="ghost" size="sm" onClick={onView}>
        <Eye />
        View
      </Button>
    </li>
  )
}

function metaRecord(entry: HistoryRow): Record<string, unknown> | null {
  const meta = entry.meta
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null
  return meta as Record<string, unknown>
}

/**
 * Why the sender gave the mail up, from the EMAIL_FAILED meta: a template it
 * does not know, or the provider's last refusal.
 */
function failureReason(meta: Record<string, unknown> | null): string {
  if (meta?.reason === 'unknown_template') return 'the template does not exist'
  const error = meta?.error
  const message =
    error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : null
  const attempts = typeof meta?.attempts === 'number' ? ` after ${meta.attempts} attempts` : ''
  return message ? `refused${attempts}: ${message}` : `refused${attempts}`
}

function FailedEmailItem({ entry, ...productProps }: EmailProductProps & { entry: HistoryRow }) {
  const meta = metaRecord(entry)
  const template = typeof meta?.template === 'string' ? meta.template : 'Email'
  const recipient = typeof meta?.recipient === 'string' ? meta.recipient : null
  return (
    <li data-testid={IDS.failedItem} data-history-id={entry.id} className="flex py-1.5 text-sm">
      <EmailLine
        time={formatDateTimeHuman(entry.created_at)}
        template={template}
        {...productProps}
        recipient={recipient}
        detail={`not sent: ${failureReason(meta)}`}
        alert
      />
    </li>
  )
}

type SentEmailDialogProps = {
  email: SentEmailRow | null
  onClose: () => void
}

/**
 * What the preview adds to the stored mail. Links are inert: the approval link
 * would otherwise open the customer's page inside the frame — and a click from
 * here is not the customer's. Long unbroken text (a link printed as an
 * address) wraps, so a mail stored before its template wrapped it still fits
 * the frame.
 */
const PREVIEW_STYLE =
  '<style>a { pointer-events: none; cursor: default; } body { overflow-wrap: anywhere; }</style>'

/**
 * The stored body with {@link PREVIEW_STYLE} in its head. Not in front of the
 * doctype, which would put the frame in quirks mode and change how the mail's
 * tables render; a body without a head gets it in front.
 */
function forPreview(html: string): string {
  return html.includes('</head>') ? html.replace('</head>', `${PREVIEW_STYLE}</head>`) : PREVIEW_STYLE + html
}

/**
 * A sent mail as it went out: the stored html body, not a re-render, in a
 * sandboxed frame so nothing in it runs or reaches the app; see
 * {@link PREVIEW_STYLE} for the two things the preview changes.
 */
function SentEmailDialog({ email, onClose }: SentEmailDialogProps) {
  return (
    <Dialog open={email !== null} onOpenChange={open => !open && onClose()}>
      <DialogContent data-testid={IDS.sentDialog} className="sm:max-w-2xl">
        {email && (
          <>
            <DialogHeader>
              <DialogTitle>{email.subject}</DialogTitle>
              <DialogDescription>
                To {email.recipient}, {formatDateTimeHuman(email.sent_at)}
              </DialogDescription>
            </DialogHeader>
            <iframe
              title={email.subject}
              sandbox=""
              srcDoc={forPreview(email.body_html)}
              className="h-[60vh] w-full rounded-md border border-border"
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
