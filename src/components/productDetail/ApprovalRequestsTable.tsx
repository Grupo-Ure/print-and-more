import { useState, type ReactNode } from 'react'
import { Check, FileText, Undo2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ApprovalDecision, ApprovalRequest } from '../../services/approvalRequestService'
import { useWithdrawApprovalRequest } from '../../queries/approvalQueries'
import { formatDateTimeHuman } from '../../lib/formatDate'
import { APPROVAL_REQUEST_STATUS_META } from '../../lib/statusLabels'
import { useConfirm } from '../ConfirmDialog'
import { StatusBadge } from '../StatusBadge'
import { useToast } from '../Toast'
import { UserAvatar } from '../UserAvatar'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import { Separator } from '../ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { QuoteBlock } from '../LogText'
import { ApprovalAnswerDialog } from './ApprovalAnswerDialog'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.orders.productDetail.files.requests

/**
 * Every approval round of the product, newest first: when it was sent, by
 * whom, and where it stands. A row opens the round's details (see
 * {@link ApprovalRequestDetailsDialog}). The open round carries the three
 * things an employee can do with it, as icons: record the customer's
 * *Approve* or *Request changes* by hand, or *Withdraw* it.
 */
export function ApprovalRequestsTable({
  orderId,
  productId,
  requests,
  action,
}: {
  orderId: string
  productId: string
  requests: ApprovalRequest[]
  /** Rendered at the right of the heading (the *Request approval* button). */
  action?: ReactNode
}) {
  const confirm = useConfirm()
  const withdraw = useWithdrawApprovalRequest()
  const { showError } = useToast()
  // The answer being recorded by hand, if any: its dialog is mounted while it is set.
  const [answering, setAnswering] = useState<{ request: ApprovalRequest; decision: ApprovalDecision } | null>(null)
  const pending = withdraw.isPending
  // The round whose details are open; held by id so the dialog follows a refetch.
  const [shownId, setShownId] = useState<string | null>(null)
  const shown = requests.find(request => request.id === shownId) ?? null

  const handleWithdraw = async (request: ApprovalRequest) => {
    const confirmed = await confirm({
      title: `Withdraw round ${request.round}?`,
      description: request.mailed
        ? 'The product returns to pre-press and the customer is mailed that the link no longer works.'
        : 'The product returns to pre-press.',
      confirmLabel: 'Withdraw',
      destructive: true,
    })
    if (!confirmed) return
    withdraw.mutate(
      { requestId: request.id, orderId, productId },
      { onError: cause => showError(cause.message || 'The request could not be withdrawn') },
    )
  }

  return (
    <div data-testid={IDS.root} className="flex flex-col gap-2">
      <Separator />
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Approval requests</h3>
        {action}
      </div>
      {requests.length === 0 ? (
        <p data-testid={IDS.empty} className="text-sm text-muted-foreground">
          The customer has not been asked to approve this product yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                {['Sent', 'Requested by', 'Status', ''].map(heading => (
                  <TableHead
                    key={heading}
                    className="h-9 px-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
                  >
                    {heading}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map(request => {
                const isPending = request.status === 'PENDING'
                return (
                  <TableRow
                    key={request.id}
                    data-testid={IDS.row}
                    data-request-id={request.id}
                    data-round={request.round}
                    data-status={request.status}
                    tabIndex={0}
                    title="Show the request"
                    className="cursor-pointer"
                    onClick={() => setShownId(request.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && e.target === e.currentTarget) setShownId(request.id)
                    }}
                  >
                    <TableCell className="px-3 py-2 text-base whitespace-nowrap">
                      {formatDateTimeHuman(request.created_at)}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-base">
                      <PersonName name={request.requested_by_name} avatarUrl={request.requested_by_avatar_url} />
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <StatusBadge meta={APPROVAL_REQUEST_STATUS_META[request.status]} />
                    </TableCell>
                    <TableCell className="w-px px-3 py-2">
                      {isPending && (
                        // The row opens the details; the actions must not.
                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            className="text-green-700 hover:bg-transparent hover:text-green-500 dark:text-green-500 dark:hover:bg-transparent dark:hover:text-green-400"
                            title="Approve"
                            aria-label="Approve"
                            data-testid={IDS.approve}
                            disabled={pending}
                            onClick={() => setAnswering({ request, decision: 'APPROVED' })}
                          >
                            <Check />
                          </Button>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            className="text-destructive hover:bg-transparent hover:text-destructive/70 dark:hover:bg-transparent"
                            title="Request changes"
                            aria-label="Request changes"
                            data-testid={IDS.requestChanges}
                            disabled={pending}
                            onClick={() => setAnswering({ request, decision: 'CHANGES_REQUESTED' })}
                          >
                            <X />
                          </Button>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            className="text-blue-700 hover:bg-transparent hover:text-blue-400 dark:text-blue-500 dark:hover:bg-transparent dark:hover:text-blue-600"
                            title="Withdraw"
                            aria-label="Withdraw"
                            data-testid={IDS.withdraw}
                            disabled={pending}
                            onClick={() => void handleWithdraw(request)}
                          >
                            <Undo2 />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
      {shown && <ApprovalRequestDetailsDialog request={shown} onClose={() => setShownId(null)} />}
      {answering && (
        <ApprovalAnswerDialog
          orderId={orderId}
          productId={productId}
          request={answering.request}
          decision={answering.decision}
          onClose={() => setAnswering(null)}
        />
      )}
    </div>
  )
}

/**
 * An employee with their avatar, as the assignee pickers show one;
 * `highlight` colours the name as the history log colours a person.
 */
function PersonName({
  name,
  avatarUrl,
  highlight = false,
}: {
  name: string | null
  avatarUrl: string | null
  highlight?: boolean
}) {
  if (!name) return <span className="text-muted-foreground">—</span>
  return (
    <span className="flex min-w-0 items-center gap-2">
      <UserAvatar name={name} avatarUrl={avatarUrl} />
      <span className={cn('truncate', highlight && 'font-medium text-pink-800')}>{name}</span>
    </span>
  )
}

/**
 * Everything about one round: when it was sent and by whom, whether the
 * customer was mailed, until when the link holds, the files and the message,
 * and what came of it — with who recorded it and the note. A file whose copy
 * the retention purge removed is struck through: the round still records that
 * it was shown, but the customer's page serves it no more.
 */
function ApprovalRequestDetailsDialog({ request, onClose }: { request: ApprovalRequest; onClose: () => void }) {
  const isPending = request.status === 'PENDING'
  // Only an answer carries a note; a round that expired or was withdrawn has none to show.
  const hasAnswer = request.status === 'APPROVED' || request.status === 'CHANGES_REQUESTED'
  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent data-testid={IDS.details} data-request-id={request.id} className="gap-0 sm:max-w-xl">
        {/* The header band bleeds to the dialog's edges, as the footer primitive does. */}
        <DialogHeader className="-mx-4 -mt-4 gap-2 rounded-t-xl border-b bg-muted/60 px-6 pt-5 pb-4">
          <DialogTitle className="flex items-center gap-3 text-lg font-semibold">
            Approval request · round {request.round}
            <StatusBadge meta={APPROVAL_REQUEST_STATUS_META[request.status]} />
          </DialogTitle>
          <DialogDescription>
            {request.mailed ? 'Mailed to the customer' : 'Not mailed — the customer was asked another way'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6 px-2 pt-6 pb-2 text-base">
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-8 gap-y-4">
            <DetailLabel>Sent</DetailLabel>
            <dd className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <DetailDate iso={request.created_at} />
              <span className="text-muted-foreground">by</span>
              <PersonName name={request.requested_by_name} avatarUrl={request.requested_by_avatar_url} highlight />
            </dd>

            <DetailLabel>Expires</DetailLabel>
            <dd>
              <DetailDate iso={request.expires_at} />
            </dd>

            {!isPending && (
              <>
                <DetailLabel>{hasAnswer ? 'Answered' : 'Closed'}</DetailLabel>
                <dd className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {request.responded_at && <DetailDate iso={request.responded_at} />}
                  {/* Laid out as the Sent row is: date, "by", then the person with their avatar. */}
                  {request.settled_by_name && <span className="text-muted-foreground">by</span>}
                  <span data-testid={IDS.settledBy} data-user-name={request.settled_by_name ?? undefined}>
                    {request.settled_by_name ? (
                      <PersonName name={request.settled_by_name} avatarUrl={request.settled_by_avatar_url} highlight />
                    ) : (
                      <span className="text-muted-foreground">
                        {request.status === 'EXPIRED' ? 'no answer' : 'by the customer'}
                      </span>
                    )}
                  </span>
                </dd>
              </>
            )}
          </dl>

          <DetailSection label="Files">
            <ul className="flex flex-col gap-1.5">
              {request.files.map(file => (
                <li
                  key={file.file_id}
                  data-testid={IDS.file}
                  data-file-id={file.file_id}
                  data-purged={file.purged_at ? true : undefined}
                  title={
                    file.purged_at
                      ? `${file.display_name} — copy no longer held: removed ${formatDateTimeHuman(file.purged_at)}, after the retention period`
                      : file.display_name
                  }
                  className={cn(
                    'flex min-w-0 items-center gap-2',
                    file.purged_at && 'text-muted-foreground line-through',
                  )}
                >
                  <FileText className="size-4 shrink-0 text-primary" aria-hidden />
                  <span className="truncate">{file.display_name}</span>
                </li>
              ))}
            </ul>
          </DetailSection>

          <DetailSection label="Message">
            <QuoteBlock placeholder="No message">{request.message}</QuoteBlock>
          </DetailSection>

          {hasAnswer && (
            <DetailSection label="Customer's note">
              <QuoteBlock placeholder="No note">{request.note}</QuoteBlock>
            </DetailSection>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** A labelled block below the facts, for what takes more than a line: the files, a message. */
function DetailSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-sm font-medium text-muted-foreground">{label}</h4>
      {children}
    </section>
  )
}

/** A moment in the details, set apart from the words around it. */
function DetailDate({ iso }: { iso: string }) {
  return <span className="font-medium tabular-nums">{formatDateTimeHuman(iso)}</span>
}

function DetailLabel({ children }: { children: ReactNode }) {
  return <dt className="text-sm font-medium text-muted-foreground">{children}</dt>
}
