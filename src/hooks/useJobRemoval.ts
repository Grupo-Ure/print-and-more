import { useConfirm } from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'
import { shortJobNumber } from '../lib/jobShared'
import { useCancelJob, useDeleteJob, useFinishOrderWhenAllJobsDone } from '../queries/jobQueries'
import type { JobRow } from '../types/database'

export type JobRemoval = {
  /** A job still in setup is deleted outright. */
  canDelete: boolean
  /** Past setup a job is cancelled instead (kept for history) — never once in production or done. */
  canCancel: boolean
  pending: boolean
  /** Confirms with the user, then permanently deletes the job. */
  requestDelete: () => Promise<void>
  /** Confirms with the user, then cancels the job. */
  requestCancel: () => Promise<void>
}

/**
 * Removing a job from its order: delete while still in setup, cancel
 * afterwards. Shared by the job header buttons and the job list's context
 * menu so both apply the same rules. `job` may be null while the detail view
 * has nothing loaded; the actions are then no-ops.
 *
 * Either removal can leave the order with only done jobs, in which case the
 * order finishes on its own (see `useFinishOrderWhenAllJobsDone`).
 */
export function useJobRemoval(job: JobRow | null): JobRemoval {
  const cancelJob = useCancelJob()
  const deleteJob = useDeleteJob()
  const finishOrderWhenAllJobsDone = useFinishOrderWhenAllJobsDone()
  const confirm = useConfirm()
  const { showError } = useToast()

  const finishOrderIfComplete = async (orderId: string): Promise<void> => {
    try {
      await finishOrderWhenAllJobsDone(orderId)
    } catch {
      showError('Order could not be marked as finished')
    }
  }

  const canDelete = job?.status === 'IN_SETUP'
  const canCancel =
    job != null && !job.is_cancelled && job.status !== 'IN_PRODUCTION' && job.status !== 'DONE'

  const requestCancel = async (): Promise<void> => {
    if (!job) return
    const confirmed = await confirm({
      title: 'Cancel this job?',
      description: shortJobNumber(job.job_number),
      confirmLabel: 'Cancel job',
      destructive: true,
    })
    if (!confirmed) return
    try {
      await cancelJob.mutateAsync({ id: job.id, orderId: job.order_id })
    } catch {
      showError('Job could not be cancelled')
      return
    }
    await finishOrderIfComplete(job.order_id)
  }

  const requestDelete = async (): Promise<void> => {
    if (!job) return
    const confirmed = await confirm({
      title: 'Permanently delete this job?',
      description: shortJobNumber(job.job_number),
      confirmLabel: 'Delete job',
      destructive: true,
    })
    if (!confirmed) return
    try {
      await deleteJob.mutateAsync({ id: job.id, orderId: job.order_id })
    } catch {
      showError('Job could not be deleted')
      return
    }
    await finishOrderIfComplete(job.order_id)
  }

  return {
    canDelete,
    canCancel,
    pending: cancelJob.isPending || deleteJob.isPending,
    requestDelete,
    requestCancel,
  }
}
