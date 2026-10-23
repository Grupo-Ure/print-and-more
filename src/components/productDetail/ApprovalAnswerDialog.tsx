import { useState } from 'react'
import type { ApprovalDecision, ApprovalRequest } from '../../services/approvalRequestService'
import { useSettleApprovalRequest } from '../../queries/approvalQueries'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { useToast } from '../Toast'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.orders.productDetail.files.answerDialog

const WORDING: Record<ApprovalDecision, { title: string; description: string; noteLabel: string; submit: string }> = {
  APPROVED: {
    title: 'Record the approval?',
    description: 'The customer approved the proof. The product moves into production and its stock is booked.',
    noteLabel: 'Note (optional)',
    submit: 'Approve',
  },
  CHANGES_REQUESTED: {
    title: 'Record the request for changes?',
    description: 'The product returns to pre-press for a rework; send a new round once it is done.',
    noteLabel: 'What does the customer want changed?',
    submit: 'Request changes',
  },
}

/**
 * Records the customer's answer to an open round by hand — the customer
 * called or walked in — with the same effect as the answer on their page.
 * A request for changes needs the note, as it does on that page; for an
 * approval it is optional.
 *
 * Mounted only while open, so every opening starts with an empty note.
 */
export function ApprovalAnswerDialog({
  orderId,
  productId,
  request,
  decision,
  onClose,
}: {
  orderId: string
  productId: string
  request: ApprovalRequest
  decision: ApprovalDecision
  onClose: () => void
}) {
  const settle = useSettleApprovalRequest()
  const { showError } = useToast()
  const [note, setNote] = useState('')
  const wording = WORDING[decision]
  const isNoteMissing = decision === 'CHANGES_REQUESTED' && note.trim() === ''

  const handleSubmit = () => {
    settle.mutate(
      { requestId: request.id, orderId, productId, decision, note: note.trim() || null },
      {
        onSuccess: onClose,
        onError: cause => showError(cause.message || 'The answer could not be recorded'),
      },
    )
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent data-testid={IDS.root} data-decision={decision} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {wording.title} (round {request.round})
          </DialogTitle>
          <DialogDescription>{wording.description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={IDS.note}>{wording.noteLabel}</Label>
          <Textarea
            id={IDS.note}
            data-testid={IDS.note}
            value={note}
            maxLength={2000}
            onChange={event => setNote(event.target.value)}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" data-testid={IDS.cancel} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            data-testid={IDS.submit}
            disabled={isNoteMissing || settle.isPending}
            onClick={handleSubmit}
          >
            {wording.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
