import { cn } from '@/lib/utils'
import { useProductsByJobId } from '../queries/productQueries'
import { useOrderById } from '../queries/orderQueries'
import { useReleaseToProduction, useSetJobStatus } from '../queries/jobQueries'
import { isJobComplete, resolveEffectiveJob } from '../lib/jobShared'
import { STATUS_META, WORKFLOW_STATUSES } from '../const/orderStatus'
import type { JobRow } from '../types/database'
import { useToast } from './Toast'
import { Button } from './ui/button'

type Props = {
  job: JobRow
  orderNumber: string | null
}

export function JobReleaseButton({ job, orderNumber }: Props) {
  const setJobStatus = useSetJobStatus()
  const releaseToProduction = useReleaseToProduction()
  const { showError } = useToast()
  const orderQuery = useOrderById(job.order_id)
  const productsQuery = useProductsByJobId(job.id)

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

  const pending = setJobStatus.isPending || releaseToProduction.isPending

  const disabled =
    pending ||
    (job.status === 'INCOMPLETE' && !complete) ||
    (job.status === 'PREPRESS_READY' &&
      job.customer_approval_required === true &&
      job.customer_approval_granted !== true)

  const handleClick = () => {
    if (job.status === 'INCOMPLETE') return void handleReleaseToPrepress()
    if (job.status === 'PREPRESS_READY') return void handleReleaseToProduction()
    if (job.status === 'PRODUCTION_READY') return void handleMarkDone()
  }

  const className = cn(
    'ml-auto h-10 px-6 text-lg rounded-full hover:opacity-90',
    STATUS_META[target].color,
    )

  return (
    <Button
      type="button"
      variant="default"
      className={className}
      disabled={disabled}
      onClick={handleClick}
    >
      {pending ? '…' : label}
    </Button>
  )
}
