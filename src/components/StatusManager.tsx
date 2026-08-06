import { useJobsByOrderId } from '../queries/jobQueries'
import { useStatusManager } from '../queries/useStatusManager'

/**
 * Order-level host for the automatic status manager: mounts one watcher per
 * non-cancelled job in the automatic band (IN_SETUP / PREPRESS), so the
 * IN_SETUP ↔ PREPRESS transition is evaluated for every job of the open order
 * as soon as its data actually changes — not just for the job whose tab
 * happens to be open. (Previously the watcher lived in JobDetail, so a job
 * that quietly became complete would only be promoted the next time someone
 * clicked its tab — the promotion looked caused by the click.)
 *
 * Renders nothing. Committed rows (IN_PRODUCTION / DONE) are filtered out
 * here so no products query is mounted for them; the hook re-checks the same
 * gate anyway.
 */
export function StatusManager({ orderId }: { orderId: string | null }) {
  const { data: jobs } = useJobsByOrderId(orderId)
  const watched = (jobs ?? []).filter(
    job => !job.is_cancelled && (job.status === 'IN_SETUP' || job.status === 'PREPRESS'),
  )
  return (
    <>
      {watched.map(job => (
        <JobStatusWatcher key={job.id} orderId={orderId} jobId={job.id} />
      ))}
    </>
  )
}

/** One hook instance per watched job (hooks can't run in a loop). */
function JobStatusWatcher({ orderId, jobId }: { orderId: string | null; jobId: string }) {
  useStatusManager(orderId, jobId)
  return null
}
