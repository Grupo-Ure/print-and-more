import { useState } from 'react'
import { Check, Pencil, Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ApprovalDecision, ApprovalRequest } from '../../services/approvalRequestService'
import { useWithdrawApprovalRequest } from '../../queries/approvalQueries'
import { formatDateTimeDe } from '../../lib/formatDate'
import { APPROVAL_REQUEST_STATUS_META } from '../../lib/statusLabels'
import { useConfirm } from '../ConfirmDialog'
import { StatusBadge } from '../StatusBadge'
import { useToast } from '../Toast'
import { Button } from '../ui/button'
import { Separator } from '../ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { ApprovalAnswerDialog } from './ApprovalAnswerDialog'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.orders.productDetail.files.requests

/**
 * Every approval round of the product, newest first: when it was sent and
 * until when the link holds, the files and the note, whether the customer was
 * mailed, and what came of it — with who recorded it. A file whose copy the
 * retention purge removed is struck through: the round still records that it
 * was shown, but the customer's page serves it no more. The open round carries
 * the three things an employee can do with it: record the customer's
 * *Approve* or *Request changes* by hand, or *Withdraw* it.
 */
export function ApprovalRequestsTable({
  orderId,
  productId,
  requests,
}: {
  orderId: string
  productId: string
  requests: ApprovalRequest[]
}) {
  const confirm = useConfirm()
  const withdraw = useWithdrawApprovalRequest()
  const { showError } = useToast()
  // The answer being recorded by hand, if any: its dialog is mounted while it is set.
  const [answering, setAnswering] = useState<{ request: ApprovalRequest; decision: ApprovalDecision } | null>(null)
  const pending = withdraw.isPending

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
      <h3 className="text-sm font-semibold">Approval requests</h3>
      {requests.length === 0 ? (
        <p data-testid={IDS.empty} className="text-sm text-muted-foreground">
          The customer has not been asked to approve this product yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                {['Round', 'Sent', 'Expires', 'Files', 'Message', 'Outcome', ''].map(heading => (
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
                  >
                    <TableCell className="px-3 py-2 align-top">{request.round}</TableCell>
                    <TableCell className="px-3 py-2 align-top text-xs whitespace-nowrap">
                      {formatDateTimeDe(request.created_at)}
                      {request.requested_by_name && (
                        <span className="block text-muted-foreground">{request.requested_by_name}</span>
                      )}
                      <span className="block text-muted-foreground">
                        {request.mailed ? 'Mailed to the customer' : 'Not mailed'}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-2 align-top text-xs whitespace-nowrap">
                      {formatDateTimeDe(request.expires_at)}
                    </TableCell>
                    <TableCell className="max-w-48 px-3 py-2 align-top">
                      <ul className="flex flex-col gap-0.5 text-xs">
                        {request.files.map(file => (
                          <li
                            key={file.file_id}
                            data-testid={IDS.file}
                            data-file-id={file.file_id}
                            data-purged={file.purged_at ? true : undefined}
                            title={
                              file.purged_at
                                ? `${file.display_name} — copy no longer held: removed ${formatDateTimeDe(file.purged_at)}, after the retention period`
                                : file.display_name
                            }
                            className={cn('truncate', file.purged_at && 'text-muted-foreground line-through')}
                          >
                            {file.display_name}
                          </li>
                        ))}
                      </ul>
                    </TableCell>
                    <TableCell className="max-w-48 px-3 py-2 align-top text-xs whitespace-pre-line">
                      {request.message ?? '—'}
                    </TableCell>
                    <TableCell className="max-w-56 px-3 py-2 align-top text-xs">
                      <StatusBadge meta={APPROVAL_REQUEST_STATUS_META[request.status]} />
                      {request.responded_at && (
                        <span className="mt-1 block text-muted-foreground">
                          {formatDateTimeDe(request.responded_at)}
                          {!isPending && (
                            <span data-testid={IDS.settledBy} data-user-name={request.settled_by_name ?? undefined}>
                              {' — '}
                              {request.settled_by_name ?? (request.status === 'EXPIRED' ? 'no answer' : 'the customer')}
                            </span>
                          )}
                        </span>
                      )}
                      {request.note && <span className="mt-1 block whitespace-pre-line">{request.note}</span>}
                    </TableCell>
                    <TableCell className="px-3 py-2 align-top">
                      {isPending && (
                        <div className="flex flex-col items-start gap-1">
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            data-testid={IDS.approve}
                            disabled={pending}
                            onClick={() => setAnswering({ request, decision: 'APPROVED' })}
                          >
                            <Check />
                            Approve
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            data-testid={IDS.requestChanges}
                            disabled={pending}
                            onClick={() => setAnswering({ request, decision: 'CHANGES_REQUESTED' })}
                          >
                            <Pencil />
                            Request changes
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            data-testid={IDS.withdraw}
                            disabled={pending}
                            onClick={() => void handleWithdraw(request)}
                          >
                            <Undo2 />
                            Withdraw
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
