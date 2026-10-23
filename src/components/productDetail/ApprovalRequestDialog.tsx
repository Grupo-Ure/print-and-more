import { useState } from 'react'
import { FileText, TriangleAlert } from 'lucide-react'
import type { FileRow } from '../../services/fileService'
import type { StockShortage } from '../../services/productionReleaseService'
import { useCreateApprovalRequest } from '../../queries/approvalQueries'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Label } from '../ui/label'
import { Switch } from '../ui/switch'
import { Textarea } from '../ui/textarea'
import { useToast } from '../Toast'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.orders.productDetail.files.requestDialog

/**
 * Sends one round of asking the customer to approve a proof: the files
 * offered (the ticked ones on the Files tab, else all of the product's), each
 * with a checkbox to refine the pick, the employee's note, and whether the
 * customer is mailed the link. Confirming moves the product to *Awaiting
 * approval*, where it stays locked until the round closes.
 *
 * A product short of stock is only warned about: the shortage is named and
 * confirm reads *Send anyway* — nothing is held while the product waits.
 *
 * Mounted only while open, so every opening starts from the offered files.
 */
export function ApprovalRequestDialog({
  orderId,
  productId,
  files,
  preselectedFileIds,
  shortages,
  customerEmail,
  onClose,
}: {
  orderId: string
  productId: string
  /** The files the dialog offers. */
  files: FileRow[]
  /** Which of them start ticked. */
  preselectedFileIds: string[]
  /** What the product is short of — the banner's shortages. */
  shortages: StockShortage[]
  /** The order's customer's address; without one the round cannot be mailed. */
  customerEmail: string | null
  onClose: () => void
}) {
  const createRequest = useCreateApprovalRequest()
  const { showSuccess } = useToast()
  const [selected, setSelected] = useState<Set<string>>(() => new Set(preselectedFileIds))
  const [message, setMessage] = useState('')
  const canMail = !!customerEmail?.trim()
  const [mailed, setMailed] = useState(canMail)
  const [error, setError] = useState<string | null>(null)

  const hasBridge = !!window.pam
  const isShort = shortages.length > 0
  const chosen = files.filter(file => selected.has(file.id))
  // One line per short target: a textile batch reports each contributing line.
  const shortTargets = [...new Map(shortages.map(shortage => [shortage.targetId, shortage])).values()]

  const toggle = (fileId: string, checked: boolean) => {
    setSelected(previous => {
      const next = new Set(previous)
      if (checked) next.add(fileId)
      else next.delete(fileId)
      return next
    })
  }

  const handleSubmit = () => {
    if (chosen.length === 0) return
    setError(null)
    createRequest.mutate(
      { orderId, productId, files: chosen, message: message.trim() || null, mailed: mailed && canMail },
      {
        onSuccess: () => {
          showSuccess(mailed && canMail ? 'Approval requested — the customer is mailed' : 'Approval requested')
          onClose()
        },
        // The cause names the file that could not be read or stored, or what the database refused.
        onError: cause => setError(cause.message || 'The request could not be sent'),
      },
    )
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent data-testid={IDS.root} className="flex max-h-[80vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request customer approval</DialogTitle>
          <DialogDescription>
            The product moves to <em>Awaiting approval</em> and is locked — specification, deadline, delivery and
            priority — until the customer answers, the link expires or the request is withdrawn.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <ul className="flex flex-col gap-1" aria-label="Files to approve">
            {files.map(file => {
              const isChecked = selected.has(file.id)
              const inputId = `${IDS.file}-${file.id}`
              return (
                <li
                  key={file.id}
                  data-testid={IDS.file}
                  data-file-id={file.id}
                  data-state={isChecked ? 'checked' : 'unchecked'}
                  className="flex items-center gap-2 rounded-lg border p-2"
                >
                  <Checkbox id={inputId} data-testid={IDS.fileSelect} checked={isChecked} onCheckedChange={checked => toggle(file.id, checked === true)} />
                  <FileText className="size-4 shrink-0 text-primary" aria-hidden />
                  <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer">
                    <span className="block truncate text-sm font-medium">{file.display_name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{file.path}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={IDS.message}>Note to the customer (optional)</Label>
          <Textarea
            id={IDS.message}
            data-testid={IDS.message}
            value={message}
            maxLength={2000}
            onChange={event => setMessage(event.target.value)}
          />
        </div>

        <div className="flex items-center gap-3">
          <Switch
            id={IDS.mailed}
            data-testid={IDS.mailed}
            checked={mailed && canMail}
            disabled={!canMail}
            onCheckedChange={checked => setMailed(checked === true)}
          />
          <label htmlFor={IDS.mailed} className="text-sm select-none">
            Email the customer
            {!canMail && <span className="block text-xs text-muted-foreground">The customer has no email address.</span>}
            {canMail && !mailed && (
              <span className="block text-xs text-muted-foreground">Show the proof another way and record the answer here.</span>
            )}
          </label>
        </div>

        {isShort && (
          <div
            data-testid={IDS.shortages}
            role="alert"
            className="flex gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm"
          >
            <TriangleAlert className="size-4 shrink-0 text-amber-600" aria-hidden />
            <div className="flex flex-col gap-1">
              <p>Not enough stock to release this product. Nothing is set aside while it waits:</p>
              <ul className="list-disc pl-4">
                {shortTargets.map(shortage => (
                  <li key={shortage.targetId} data-testid={IDS.shortage} data-target-id={shortage.targetId}>
                    {shortage.targetLabel} — {shortage.available} of {shortage.required} in stock
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {!hasBridge && (
          <p data-testid={IDS.desktopRequired} className="text-sm text-destructive">
            Requesting an approval requires the desktop app: only it can read the files from the share.
          </p>
        )}
        {error && (
          <p data-testid={IDS.error} className="text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" data-testid={IDS.cancel} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            data-testid={IDS.submit}
            data-anyway={isShort || undefined}
            disabled={chosen.length === 0 || !hasBridge || createRequest.isPending}
            onClick={handleSubmit}
          >
            {createRequest.isPending ? 'Sending…' : isShort ? 'Send anyway' : 'Send request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
