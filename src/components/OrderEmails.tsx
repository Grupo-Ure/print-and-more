import { useState, type ReactNode } from 'react'
import { Eye } from 'lucide-react'
import type { HistoryRow } from '../services/historyService'
import type { QueuedEmailRow, SentEmailRow } from '../services/emailService'
import { useFailedEmails, useQueuedEmails, useSentEmails } from '../queries/emailQueries'
import { useProductsByOrderId } from '../queries/productQueries'
import { emailTemplateLabel } from '../lib/emailTemplateLabels'
import { formatDateTimeDe } from '../lib/formatDate'
import { shortProductNumber } from '../lib/productShared'
import { cn } from '../lib/utils'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { SectionTitle } from './ui/section-title'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.orders.details.emails

/**
 * The order's mails: the ones waiting to go, the ones that went, the ones the
 * sender gave up on. Read-only — every mail is automatic, so there is nothing
 * to send, cancel or retry here. Rendered as the order's Emails tab, mounted
 * only while that tab is active.
 */
export function OrderEmails({ orderId }: { orderId: string }) {
  const queuedQuery = useQueuedEmails(orderId)
  const sentQuery = useSentEmails(orderId)
  const failedQuery = useFailedEmails(orderId)
  const productsQuery = useProductsByOrderId(orderId)
  const [viewedEmail, setViewedEmail] = useState<SentEmailRow | null>(null)

  const queued = queuedQuery.data ?? []
  const sent = sentQuery.data ?? []
  const failed = failedQuery.data ?? []
  const products = productsQuery.data ?? []

  const isLoading = queuedQuery.isLoading || sentQuery.isLoading || failedQuery.isLoading
  const isError = queuedQuery.isError || sentQuery.isError || failedQuery.isError
  const isEmpty = !isLoading && !isError && queued.length + sent.length + failed.length === 0

  // "LFP-01" — every mail here belongs to the same order; null for a mail about the whole order.
  const productLabel = (productId: string | null): string | null => {
    if (!productId) return null
    const number = products.find(product => product.id === productId)?.product_number
    return number ? shortProductNumber(number) : 'Product'
  }

  return (
    <section data-testid={IDS.root} aria-label="Order emails" className="flex h-full flex-col gap-6 overflow-y-auto">
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && <p className="text-sm text-destructive">Emails could not be loaded</p>}
      {isEmpty && (
        <p data-testid={IDS.empty} className="text-sm text-muted-foreground">
          No emails for this order yet
        </p>
      )}

      {queued.length > 0 && (
        <EmailGroup title="Waiting to go">
          {queued.map(email => (
            <QueuedEmailItem key={email.msg_id} email={email} productLabel={productLabel(email.product_id)} />
          ))}
        </EmailGroup>
      )}

      {failed.length > 0 && (
        <EmailGroup title="Failed">
          {failed.map(entry => (
            <FailedEmailItem key={entry.id} entry={entry} productLabel={productLabel(entry.product_id)} />
          ))}
        </EmailGroup>
      )}

      {sent.length > 0 && (
        <EmailGroup title="Sent">
          {sent.map(email => (
            <SentEmailItem
              key={email.id}
              email={email}
              productLabel={productLabel(email.product_id)}
              onView={() => setViewedEmail(email)}
            />
          ))}
        </EmailGroup>
      )}

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

type EmailLineProps = {
  template: string
  productLabel: string | null
  /** What follows the template and product: due time, recipient, reason. */
  detail: string
}

/** One mail as one line: the template, the product it is about, then the detail. Truncates with the full line in the tooltip. */
function EmailLine({ template, productLabel, detail }: EmailLineProps) {
  const label = emailTemplateLabel(template)
  const plain = `${label}${productLabel ? ` (${productLabel})` : ''} — ${detail}`
  return (
    <p className="min-w-0 flex-1 truncate" title={plain}>
      <span className="font-medium">{label}</span>
      {productLabel && <span className="font-medium text-sky-600 dark:text-sky-400"> ({productLabel})</span>}
      <span className="text-muted-foreground"> — {detail}</span>
    </p>
  )
}

function queuedDetail(email: QueuedEmailRow): string {
  const isDue = new Date(email.due_at).getTime() <= Date.now()
  const due = isDue ? 'due now' : `due ${formatDateTimeDe(email.due_at)}`
  // A claim that did not end in a send leaves the count above zero: the provider refused it, and it comes back.
  return email.attempts > 0 ? `${due}, retrying after ${email.attempts} failed attempts` : due
}

function QueuedEmailItem({ email, productLabel }: { email: QueuedEmailRow; productLabel: string | null }) {
  return (
    <li data-testid={IDS.queuedItem} data-msg-id={email.msg_id} data-template={email.template} className="flex py-1.5 text-sm">
      <EmailLine template={email.template} productLabel={productLabel} detail={queuedDetail(email)} />
    </li>
  )
}

type SentEmailItemProps = {
  email: SentEmailRow
  productLabel: string | null
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

function SentEmailItem({ email, productLabel, onView }: SentEmailItemProps) {
  const state = deliveryState(email)
  const detail = `“${email.subject}” to ${email.recipient}, ${formatDateTimeDe(email.sent_at)}${state ? `, ${state}` : ''}`
  return (
    <li
      data-testid={IDS.sentItem}
      data-sent-email-id={email.id}
      data-template={email.template}
      className={cn('flex items-center gap-2 py-1 text-sm', email.bounced_at && 'text-destructive')}
    >
      <EmailLine template={email.template} productLabel={productLabel} detail={detail} />
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

function FailedEmailItem({ entry, productLabel }: { entry: HistoryRow; productLabel: string | null }) {
  const meta = metaRecord(entry)
  const template = typeof meta?.template === 'string' ? meta.template : 'Email'
  const recipient = typeof meta?.recipient === 'string' ? ` to ${meta.recipient}` : ''
  const detail = `not sent${recipient}, ${formatDateTimeDe(entry.created_at)} — ${failureReason(meta)}`
  return (
    <li data-testid={IDS.failedItem} data-history-id={entry.id} className="flex py-1.5 text-sm text-destructive">
      <EmailLine template={template} productLabel={productLabel} detail={detail} />
    </li>
  )
}

type SentEmailDialogProps = {
  email: SentEmailRow | null
  onClose: () => void
}

/**
 * A sent mail as it went out: the stored html body, not a re-render, in a
 * sandboxed frame so nothing in it runs or reaches the app.
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
                To {email.recipient}, {formatDateTimeDe(email.sent_at)}
              </DialogDescription>
            </DialogHeader>
            <iframe
              title={email.subject}
              sandbox=""
              srcDoc={email.body_html}
              className="h-[60vh] w-full rounded-md border border-border"
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
