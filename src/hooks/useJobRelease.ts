import { useConfirm } from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'
import { WORKFLOW_STATUSES } from '../const/orderStatus'
import { isJobComplete, resolveEffectiveJob } from '../lib/jobShared'
import {
  useForceReleaseToProduction,
  useReleaseToProduction,
  useSetJobStatus,
} from '../queries/jobQueries'
import { useOrderById } from '../queries/orderQueries'
import { useProductsByJobId } from '../queries/productQueries'
import { useStockAvailability } from '../queries/stockQueries'
import { useIsAdmin } from '../queries/userQueries'
import { InsufficientStockError } from '../services/productionReleaseService'
import type { JobRow, JobStatus } from '../types/database'

/** Label of the action that advances a job out of the given status. */
const ADVANCE_LABELS: Partial<Record<JobStatus, string>> = {
  IN_SETUP: 'Release to Pre-Press',
  PREPRESS: 'Release to Production',
  IN_PRODUCTION: 'Mark job as done',
}

export type JobRelease = {
  /** Status the advance moves to; null when there is none (DONE) or the order is still a quote. */
  target: JobStatus | null
  /** Label of the advance action; null exactly when `target` is. */
  label: string | null
  pending: boolean
  /** True while the advance is blocked by a gate or a mutation is in flight. */
  disabled: boolean
  hasProducts: boolean
  approvalBlocked: boolean
  /** Admins may bypass the completeness/stock gates while one of them is failing. */
  canForceRelease: boolean
  /** Confirms with the user, then advances the job one workflow step. */
  advance: () => Promise<void>
  /** Admin override past the completeness/stock gates; resolves true on success. */
  forceRelease: (reason: string) => Promise<boolean>
}

/**
 * The single forward action of a job's workflow — IN_SETUP → PREPRESS →
 * IN_PRODUCTION → DONE — with its gates (completeness, customer approval,
 * stock) and confirmations. Shared by the release button in the job header
 * and the job list's context menu so both enforce the same rules.
 */
export function useJobRelease(job: JobRow, orderNumber: string | null): JobRelease {
  const setJobStatus = useSetJobStatus()
  const releaseToProduction = useReleaseToProduction()
  const forceReleaseMutation = useForceReleaseToProduction()
  const { showError } = useToast()
  const confirm = useConfirm()
  const { isAdmin } = useIsAdmin()
  const orderQuery = useOrderById(job.order_id)
  const productsQuery = useProductsByJobId(job.id)
  const { data: shortages = [] } = useStockAvailability(job)

  const order = orderQuery.data
  const orderIsQuote = order?.status === 'QUOTE'
  const hasProducts = (productsQuery.data?.length ?? 0) > 0
  const stockBlocked = shortages.length > 0
  const effectiveJob = order ? resolveEffectiveJob(job, order) : null
  const complete = effectiveJob ? isJobComplete(effectiveJob, false, hasProducts) : false

  // The next status on the workflow track — none once the job is DONE.
  // Nothing advances while the order is still a quote.
  const nextIndex = WORKFLOW_STATUSES.indexOf(job.status) + 1
  const nextStatus: JobStatus | null =
    nextIndex < WORKFLOW_STATUSES.length ? WORKFLOW_STATUSES[nextIndex] : null
  const label = ADVANCE_LABELS[job.status] ?? null
  const available = nextStatus != null && label != null && !orderIsQuote

  const pending =
    setJobStatus.isPending || releaseToProduction.isPending || forceReleaseMutation.isPending

  // Customer approval blocks any release to production — including a forced
  // one; only the completeness and stock gates are overridable.
  const approvalBlocked =
    job.customer_approval_required === true && job.customer_approval_granted !== true

  const disabled =
    pending ||
    (job.status === 'IN_SETUP' && !complete) ||
    (job.status === 'PREPRESS' && (approvalBlocked || stockBlocked))

  // The override is offered only while a gate it can bypass is actually
  // failing; once the job validates the normal release covers it.
  const canForceRelease =
    isAdmin &&
    ((job.status === 'IN_SETUP' && !complete) || (job.status === 'PREPRESS' && stockBlocked))

  const releaseToPrepress = async (): Promise<void> => {
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

  const releaseJobToProduction = async (): Promise<void> => {
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
      await releaseToProduction.mutateAsync({ job, orderId: job.order_id, orderNumber })
    } catch (error) {
      // Lost the race against a concurrent release: the RPC rejected atomically.
      if (error instanceof InsufficientStockError) {
        showError('Not enough stock — the job was not released to production')
      } else {
        showError('Status could not be updated')
      }
    }
  }

  const markDone = async (): Promise<void> => {
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

  const advance = async (): Promise<void> => {
    if (job.status === 'IN_SETUP') return releaseToPrepress()
    if (job.status === 'PREPRESS') return releaseJobToProduction()
    if (job.status === 'IN_PRODUCTION') return markDone()
  }

  const forceRelease = async (reason: string): Promise<boolean> => {
    try {
      await forceReleaseMutation.mutateAsync({ job, orderId: job.order_id, orderNumber, reason })
      return true
    } catch {
      showError('Status could not be updated')
      return false
    }
  }

  return {
    target: available ? nextStatus : null,
    label: available ? label : null,
    pending,
    disabled,
    hasProducts,
    approvalBlocked,
    canForceRelease,
    advance,
    forceRelease,
  }
}
