import { CalendarX, CheckCircle2, Lock, TriangleAlert } from 'lucide-react'
import { formatDateDe } from '../lib/formatDate'
import { isDeadlineMissed, resolveEffectiveJob } from '../lib/jobShared'
import { useSetJobStatus } from '../queries/jobQueries'
import { useOrderById } from '../queries/orderQueries'
import { useProductsByJobId } from '../queries/productQueries'
import { useStockAvailability } from '../queries/stockQueries'
import type { JobRow, OrderStatus } from '../types/database'
import { useToast } from './Toast'
import { Button } from './ui/button'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.orders.jobDetail.banner

type Props = {
  job: JobRow
}

/** One reason an IN_SETUP job cannot enter pre-press, phrased as a clause for the banner. */
type PrepressBlocker = { text: string; aboutDeadline: boolean }

/**
 * Why the job is held in setup — the same requirements the release button and
 * the automatic advance enforce (`isJobComplete` plus the missed-deadline gate),
 * spelled out for the user. Delivery and priority always resolve via the order,
 * so the only requirements that can actually be unmet are the deadline and the
 * products. Empty while the order is still a quote (nothing is required yet),
 * while the products are still loading, or once the job qualifies.
 */
function prepressBlockers(
  job: JobRow,
  effectiveJob: JobRow | null,
  orderStatus: OrderStatus | undefined,
  productCount: number | undefined,
): PrepressBlocker[] {
  if (job.status !== 'IN_SETUP' || job.is_cancelled) return []
  if (!effectiveJob || orderStatus === undefined || orderStatus === 'QUOTE') return []

  const blockers: PrepressBlocker[] = []
  if (!effectiveJob.deadline) {
    blockers.push({ text: 'no deadline set', aboutDeadline: true })
  } else if (isDeadlineMissed(effectiveJob)) {
    blockers.push({
      text: `deadline ${formatDateDe(effectiveJob.deadline)} has passed`,
      aboutDeadline: true,
    })
  }
  // undefined = products still loading; don't flash a false "no products".
  if (productCount === 0) {
    blockers.push({ text: 'no products yet', aboutDeadline: false })
  }
  return blockers
}

export function JobProductionBanner({ job }: Props) {
  const setJobStatus = useSetJobStatus()
  const { showError } = useToast()
  // Only fetches for STAMP/TEXTILE jobs in pre-press; empty otherwise.
  const { data: shortages = [] } = useStockAvailability(job)
  // Both already cached by the detail view; needed to explain a blocked release.
  const { data: order } = useOrderById(job.order_id)
  const { data: products } = useProductsByJobId(job.id)
  const effectiveJob = order ? resolveEffectiveJob(job, order) : null
  const blockers = prepressBlockers(job, effectiveJob, order?.status, products?.length)

  // Done is terminal: a green, button-less banner — no going back once a job is done.
  if (job.status === 'DONE') {
    return (
      <div
        data-testid={IDS.root}
        data-kind="done"
        className="flex items-center justify-center gap-4 border-b-6 border-green-500 px-4 py-2 text-green-500"
      >
        <CheckCircle2 />
        <p className="text-sm font-medium">
          This job is done and can no longer be modified.
        </p>
      </div>
    )
  }

  // Pre-press with insufficient stock: red banner — the release button stays
  // disabled until the shortage is resolved (admins can still force-release).
  if (job.status === 'PREPRESS' && shortages.length > 0) {
    const labels = [...new Set(shortages.map(s => s.targetLabel))]
    return (
      <div
        data-testid={IDS.root}
        data-kind="shortage"
        className="flex items-center justify-center gap-4 border-b-6 border-red-500 px-4 py-2 text-red-500"
      >
        <TriangleAlert />
        <p className="text-sm font-medium">
          This job cannot be released to production — not enough stock for: {labels.join(', ')}.
        </p>
      </div>
    )
  }

  // Setup with unmet release requirements: red banner naming each one — the
  // release to pre-press (manual and automatic) is refused until they are
  // resolved. Mirrors the stock shortage one step later in the workflow; admins
  // can still force-release.
  if (blockers.length > 0) {
    const onlyDeadline = blockers.every(blocker => blocker.aboutDeadline)
    return (
      <div
        data-testid={IDS.root}
        data-kind="blocked"
        className="flex items-center justify-center gap-4 border-b-6 border-red-500 px-4 py-2 text-red-500"
      >
        {onlyDeadline ? <CalendarX /> : <TriangleAlert />}
        <p className="text-sm font-medium">
          Release to pre-press blocked: {blockers.map(blocker => blocker.text).join(', ')}.
        </p>
      </div>
    )
  }

  if (job.status !== 'IN_PRODUCTION') return null

  const handleGoBackToPrePress = async () => {
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

  return (
    <div
      data-testid={IDS.root}
      data-kind="production"
      className="flex items-center justify-center gap-4 border-b-6 border-blue-500 px-4 py-2 text-blue-500"
    >
      <Lock/>
      <p className="text-sm font-medium">
        This job is in production and cannot be modified.
      </p>
      <Button
        type="button"
        variant="default"
        data-testid={IDS.backToPrepress}
        className="shrink-0 rounded-full bg-pink-500 hover:bg-pink-600"
        disabled={setJobStatus.isPending}
        onClick={() => void handleGoBackToPrePress()}
      >
        {setJobStatus.isPending ? '…' : 'Go back to Pre-Press'}
      </Button>
    </div>
  )
}
