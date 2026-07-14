import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProductsByJobId } from '../queries/productQueries'
import { useOrderById } from '../queries/orderQueries'
import {
  useForceReleaseToProduction,
  useReleaseToProduction,
  useSetJobStatus,
} from '../queries/jobQueries'
import { useIsAdmin } from '../queries/userQueries'
import { isJobComplete, resolveEffectiveJob } from '../lib/jobShared'
import { STATUS_META, WORKFLOW_STATUSES } from '../const/orderStatus'
import type { JobRow } from '../types/database'
import { useToast } from './Toast'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { Textarea } from './ui/textarea'

type Props = {
  job: JobRow
  orderNumber: string | null
}

export function JobReleaseButton({ job, orderNumber }: Props) {
  const setJobStatus = useSetJobStatus()
  const releaseToProduction = useReleaseToProduction()
  const forceRelease = useForceReleaseToProduction()
  const { showError } = useToast()
  const { isAdmin } = useIsAdmin()
  const orderQuery = useOrderById(job.order_id)
  const productsQuery = useProductsByJobId(job.id)

  const [forceDialogOpen, setForceDialogOpen] = useState(false)
  const [forceReason, setForceReason] = useState('')

  const order = orderQuery.data
  const hasProducts = (productsQuery.data?.length ?? 0) > 0
  const effectiveJob = order ? resolveEffectiveJob(job, order) : null
  const complete = effectiveJob
    ? isJobComplete(effectiveJob, job.status, hasProducts)
    : false

  const handleReleaseToPrepress = async () => {
    try {
      await setJobStatus.mutateAsync({
        id: job.id,
        orderId: job.order_id,
        status: 'PREPRESS_READY',
        history: { event_type: 'PREPRESS_READY_MANUAL' },
      })
    } catch {
      showError('Status could not be updated')
    }
  }

  const handleReleaseToProduction = async () => {
    try {
      await releaseToProduction.mutateAsync({
        job,
        orderId: job.order_id,
        orderNumber,
      })
    } catch {
      showError('Status could not be updated')
    }
  }

  const handleMarkDone = async () => {
    if (!window.confirm('Mark job as done?')) return
    try {
      await setJobStatus.mutateAsync({
        id: job.id,
        orderId: job.order_id,
        status: 'DONE',
        history: { event_type: 'MARKED_DONE' },
      })
    } catch {
      showError('Status could not be updated')
    }
  }

  const handleForceRelease = async () => {
    try {
      await forceRelease.mutateAsync({
        job,
        orderId: job.order_id,
        orderNumber,
        reason: forceReason.trim(),
      })
      setForceDialogOpen(false)
      setForceReason('')
    } catch {
      showError('Status could not be updated')
    }
  }

  // The button advances the job to the next status in the workflow track; its
  // color is that target status' central color (STATUS_META). No next status
  // (DONE / QUOTE / INVOICED) → nothing to advance, so the button disappears.
  const target = WORKFLOW_STATUSES[WORKFLOW_STATUSES.indexOf(job.status) + 1]

  const label =
    job.status === 'INCOMPLETE' ? 'Release to Pre-Press' :
    job.status === 'PREPRESS_READY' ? 'Release to Production' :
    job.status === 'PRODUCTION_READY' ? 'Mark job as done' :
    null

  if (!label || !target) return null

  const pending = setJobStatus.isPending || releaseToProduction.isPending || forceRelease.isPending

  // Customer approval blocks any release to production — including a forced
  // one; only the completeness gate is overridable.
  const approvalBlocked =
    job.customer_approval_required === true && job.customer_approval_granted !== true

  const disabled =
    pending ||
    (job.status === 'INCOMPLETE' && !complete) ||
    (job.status === 'PREPRESS_READY' && approvalBlocked)

  const handleClick = () => {
    if (job.status === 'INCOMPLETE') return void handleReleaseToPrepress()
    if (job.status === 'PREPRESS_READY') return void handleReleaseToProduction()
    if (job.status === 'PRODUCTION_READY') return void handleMarkDone()
  }

  // The force-release override exists only to bypass the completeness gate,
  // so the dropdown shows only while that gate is actually failing. Once the
  // job validates (or is past INCOMPLETE), the normal release covers it.
  // Admin / super admin only.
  const withDropdown = isAdmin && job.status === 'INCOMPLETE' && !complete

  const mainClassName = cn(
    'h-10 px-6 text-lg',
    STATUS_META[target].color,
    STATUS_META[target].hoverColor,
    withDropdown ? 'rounded-l-full rounded-r-none' : 'ml-auto rounded-full',
  )

  const mainButton = (
    <Button
      type="button"
      variant="default"
      className={mainClassName}
      disabled={disabled}
      onClick={handleClick}
    >
      {pending ? '…' : label}
    </Button>
  )

  if (!withDropdown) return mainButton

  return (
    <div className="ml-auto flex items-center">
      {mainButton}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="default"
            className={cn(
              'h-10 rounded-r-full rounded-l-none border-l border-white/30 px-2',
              STATUS_META[target].color,
              STATUS_META[target].hoverColor,
            )}
            disabled={pending}
            aria-label="More release options"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto min-w-64 p-0 overflow-hidden">
          <DropdownMenuItem
            disabled={pending || approvalBlocked || !hasProducts}
            onSelect={() => setForceDialogOpen(true)}
            className={cn('rounded-none px-3 py-2.5', STATUS_META[target].softHoverColor)}
          >
            <div className="flex flex-col">
              <span>Force release to Production…</span>
              {!hasProducts && (
                <span className="text-xs text-muted-foreground">
                  Requires at least one product
                </span>
              )}
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={forceDialogOpen}
        onOpenChange={open => {
          setForceDialogOpen(open)
          if (!open) setForceReason('')
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Force release to production?</DialogTitle>
            <DialogDescription>
              The job moves to production even though its requirements are not
              fulfilled. The override is recorded in the order history with
              your name and reason.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={forceReason}
            onChange={e => setForceReason(e.target.value)}
            placeholder="Reason for the emergency release"
            autoFocus
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setForceDialogOpen(false)}
              disabled={forceRelease.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              className={cn(
                'text-primary-foreground',
                STATUS_META.PRODUCTION_READY.color,
                STATUS_META.PRODUCTION_READY.hoverColor,
              )}
              onClick={() => void handleForceRelease()}
              disabled={forceRelease.isPending || forceReason.trim() === ''}
            >
              {forceRelease.isPending ? '…' : 'Force Release to Production'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
