import { AlertTriangle } from 'lucide-react'
import { formatMinutes } from '../lib/formatMinutes'
import { isInProductionMissingInfo, shortJobNumber } from '../lib/jobShared'
import { type JobStatus } from '../types/database'
import { useOrderParams } from '../hooks/useOrderParams'
import { useJobsByOrderId } from '../queries/jobQueries'
import { useOrderById } from '../queries/orderQueries'
import { useProductCountsByOrderId } from '../queries/productQueries'
import { useTimeLogMinutesByOrderId } from '../queries/timeLogQueries'
import { AddJobButton } from './AddJobButton'
import { cn } from '@/lib/utils'
import { JOB_STATUS_META, WORKFLOW_STATUSES } from '../const/orderStatus'

function JobStatusTrack({ status }: { status: JobStatus }) {
  return (
    <div className="flex items-center gap-0.5 rounded px-1 py-0.5 hover:bg-gray-100">
      {WORKFLOW_STATUSES.map(s => (
        <div
          key={s}
          title={JOB_STATUS_META[s].label}
          className={cn('w-2.5 h-2.5', s === status ? JOB_STATUS_META[s].color : 'bg-gray-200')}
        />
      ))}
    </div>
  )
}

export function JobList() {
  const { activeOrderId, activeJobId, setActiveJob } = useOrderParams()
  const jobsQuery = useJobsByOrderId(activeOrderId)
  const orderQuery = useOrderById(activeOrderId)
  const productCountsQuery = useProductCountsByOrderId(activeOrderId)
  const minutesQuery = useTimeLogMinutesByOrderId(activeOrderId)

  const visibleJobs = (jobsQuery.data ?? []).filter(job => !job.is_cancelled)
  const order = orderQuery.data
  const productCounts = productCountsQuery.data
  const minutesByJob = minutesQuery.data

  return (
    <nav className="flex flex-col gap-1 w-48 desktop:w-60 shrink-0">
        <h1>Jobs in this order</h1>
        <AddJobButton />
        {visibleJobs.length === 0 && !jobsQuery.isLoading && (
          <p className="p-2 text-sm text-muted-foreground">No jobs yet.</p>
        )}
        <ul className="flex flex-col flex-1 min-w-0 min-h-0 overflow-y-auto" aria-label="Jobs">
          {visibleJobs.map(job => (
            <li
              key={job.id}
              className={cn(
                'flex items-center justify-between w-full cursor-pointer p-2',
                job.id === activeJobId && 'bg-primary/10',
              )}
              onClick={() => setActiveJob(job.id)}
              title={`Order: ${job.job_number}`}
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="truncate">{shortJobNumber(job.job_number)}</span>
                {order &&
                  productCounts &&
                  isInProductionMissingInfo(job, order, (productCounts[job.id] ?? 0) > 0) && (
                    <span title="In production with missing information">
                      <AlertTriangle
                        size={14}
                        className="text-red-700 shrink-0"
                        aria-label="In production with missing information"
                      />
                    </span>
                  )}
              </span>
              {(minutesByJob?.[job.id] ?? 0) > 0 && (
                <span
                  className="text-xs text-muted-foreground tabular-nums shrink-0 px-1"
                  title="Time logged on this job"
                >
                  {formatMinutes(minutesByJob![job.id])}
                </span>
              )}
              <JobStatusTrack status={job.status} />
            </li>
          ))}
        </ul>
    </nav>
  )
}
