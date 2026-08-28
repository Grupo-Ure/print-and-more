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
import { useStockAvailability } from '../queries/stockQueries'
import { InsufficientStockError } from '../services/productionReleaseService'
import { isJobComplete, resolveEffectiveJob } from '../lib/jobShared'
import { JOB_STATUS_META, WORKFLOW_STATUSES } from '../const/orderStatus'
import type { JobRow } from '../types/database'
import { useToast } from './Toast'
import { useConfirm } from './ConfirmDialog'
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
  const confirm = useConfirm()
  const { isAdmin } = useIsAdmin()
  const orderQuery = useOrderById(job.order_id)
  const productsQuery = useProductsByJobId(job.id)

  const [forceDialogOpen, setForceDialogOpen] = useState(false)
  const [forceReason, setForceReason] = useState('')

  const order = orderQuery.data
  const orderIsQuote = order?.status === 'QUOTE'
  const hasProducts = (productsQuery.data?.length ?? 0) > 0
  const { data: shortages = [] } = useStockAvailability(job)
  const stockBlocked = shortages.length > 0
  const effectiveJob = order ? resolveEffectiveJob(job, order) : null
  const complete = effectiveJob ? isJobComplete(effectiveJob, false, hasProducts) : false

  const handleReleaseToPrepress = async () => {
    const confirmed = await confirm({
      title: 'Release this job to pre-press?',
      confirmLabel: 'Release',
    })
    if (!confirmed) return
    try {
      await setJobStatus.mutateAsync({
        id: job.id,
        orderId: job.order_id,
        status: 'PREPRESS',
        history: { event_type: 'PREPRESS_READY_MANUAL' },
      })
    } catch {
      showError('Status could not be updated')
    }
  }

  const handleReleaseToProduction = async () => {
    const confirmed = await confirm({
      title: 'Release this job to production?',
      description:
        job.department === 'STAMP' || job.department === 'TEXTILE'
          ? 'Stock deductions are booked automatically on release.'
          : undefined,
      confirmLabel: 'Release',
    })
    if (!confirmed) return
    try {
      await releaseToProduction.mutateAsync({
        job,
        orderId: job.order_id,
        orderNumber,
      })
    } catch (err) {
      // Lost the race against a concurrent release: the RPC rejected atomically.
      if (err instanceof InsufficientStockError) {
        showError('Not enough stock — the job was not released to production')
      } else {
        showError('Status could not be updated')
      }
    }
  }

  const handleMarkDone = async () => {
    const confirmed = await confirm({
      title: 'Mark job as done?',
      confirmLabel: 'Mark done',
    })
    if (!confirmed) return
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
  // color is that target status' central color (JOB_STATUS_META). No next
  // status (DONE) → nothing to advance, so the button disappears.
  const target = WORKFLOW_STATUSES[WORKFLOW_STATUSES.indexOf(job.status) + 1]

  const label =
    job.status === 'IN_SETUP' ? 'Release to Pre-Press' :
    job.status === 'PREPRESS' ? 'Release to Production' :
    job.status === 'IN_PRODUCTION' ? 'Mark job as done' :
    null

  if (!label || !target || orderIsQuote) return null

  const pending = setJobStatus.isPending || releaseToProduction.isPending || forceRelease.isPending

  // Customer approval blocks any release to production — including a forced
  // one; only the completeness gate is overridable.
  const approvalBlocked =
    job.customer_approval_required === true && job.customer_approval_granted !== true

  const disabled =
    pending ||
    (job.status === 'IN_SETUP' && !complete) ||
    (job.status === 'PREPRESS' && (approvalBlocked || stockBlocked))

  const handleClick = () => {
    if (job.status === 'IN_SETUP') return void handleReleaseToPrepress()
    if (job.status === 'PREPRESS') return void handleReleaseToProduction()
    if (job.status === 'IN_PRODUCTION') return void handleMarkDone()
  }

  // The force-release override bypasses the completeness and stock gates, so
  // the dropdown shows only while one of those gates is actually failing.
  // Once the job validates (or the stock is topped up), the normal release
  // covers it. Admin / super admin only.
  const withDropdown =
    isAdmin &&
    ((job.status === 'IN_SETUP' && !complete) || (job.status === 'PREPRESS' && stockBlocked))

  const mainClassName = cn(
    'h-10 px-6 text-lg',
    JOB_STATUS_META[target].color,
    JOB_STATUS_META[target].hoverColor,
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
              JOB_STATUS_META[target].color,
              JOB_STATUS_META[target].hoverColor,
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
            className={cn('rounded-none px-3 py-2.5', JOB_STATUS_META[target].softHoverColor)}
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
                JOB_STATUS_META.IN_PRODUCTION.color,
                JOB_STATUS_META.IN_PRODUCTION.hoverColor,
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
