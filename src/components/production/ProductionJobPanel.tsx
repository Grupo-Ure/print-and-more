import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ORDER_STATUS_META } from '../../const/orderStatus'
import { useNavigation } from '../../context/navigation.context'
import { useOrderFiles } from '../../hooks/useOrderFiles'
import { formatDateDe } from '../../lib/formatDate'
import { jobKeys, useJobsByOrderId } from '../../queries/jobQueries'
import { useOrderById } from '../../queries/orderQueries'
import type { JobRow } from '../../types/database'
import { JobDetail } from '../JobDetail'
import { StatusBadge } from '../StatusBadge'
import { StatusManager } from '../StatusManager'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.production.jobPanel

/**
 * The Production page's main area: the selected job's detail, exactly as the
 * orders view shows it, under a read-only strip naming the order it belongs
 * to. Everything the detail needs from its order (the row, the sibling jobs,
 * the files, the automatic status watcher) is loaded here; the desk's order
 * actions stay on the orders view, one click away.
 */
export function ProductionJobPanel() {
  const { activeOrderId, activeJobId, openJobInOrders } = useNavigation()
  const queryClient = useQueryClient()
  const { data: order, isLoading: orderLoading, isError } = useOrderById(activeOrderId)
  const { data: jobs, isLoading: jobsLoading } = useJobsByOrderId(activeOrderId)
  const { files, reload: reloadFiles } = useOrderFiles(activeOrderId)

  // Same cache patch the orders view applies after a job header write.
  const handleJobUpdated = useCallback(
    (updatedJob: JobRow) => {
      queryClient.setQueryData<JobRow[]>(
        jobKeys.byOrderId(updatedJob.order_id),
        old => old?.map(job => (job.id === updatedJob.id ? updatedJob : job)) ?? old,
      )
    },
    [queryClient],
  )

  if (!activeOrderId || !activeJobId) {
    return (
      <div
        data-testid={TEST_IDS.production.placeholder}
        className="flex flex-1 items-center justify-center p-6 text-center text-neutral-500"
      >
        <p>Select a job on the left to work on it.</p>
      </div>
    )
  }

  if (orderLoading || jobsLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <h2>Loading job…</h2>
      </div>
    )
  }

  const job = jobs?.find(row => row.id === activeJobId) ?? null
  if (isError || !order || !job) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <h2>Job could not be loaded.</h2>
      </div>
    )
  }

  return (
    <div
      data-testid={IDS.root}
      data-order-id={order.id}
      data-job-id={job.id}
      className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3"
    >
      {/* Keeps the automatic IN_SETUP ↔ PREPRESS rule running for this order's
          jobs while they are edited here (renders nothing). */}
      <StatusManager orderId={activeOrderId} />

      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
          <h2 data-testid={IDS.customerName} className="text-foreground" title="Customer">
            {order.customers?.name?.trim() || '—'}
          </h2>
          <span className="flex items-center gap-1 text-sm desktop:text-base">
            Order:
            <span data-testid={IDS.orderNumber} className="font-medium text-foreground">
              {order.order_number}
            </span>
          </span>
          <span className="text-sm desktop:text-base">
            Deadline: {order.deadline ? formatDateDe(order.deadline) : 'none'}
          </span>
          <StatusBadge meta={ORDER_STATUS_META[order.status]} />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid={IDS.openInOrders}
          title="Open this order in the orders view"
          onClick={() => openJobInOrders(order.id, job.id)}
        >
          <ExternalLink />
          Open in orders
        </Button>
      </header>

      <Separator />

      <JobDetail orderFiles={files} onOrderFilesChanged={reloadFiles} onUpdated={handleJobUpdated} />
    </div>
  )
}
