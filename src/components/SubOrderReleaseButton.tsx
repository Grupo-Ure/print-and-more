import { cn } from '@/lib/utils'
import { useProductsBySubOrderId } from '../queries/productQueries'
import { useOrderById } from '../queries/orderQueries'
import { useReleaseToProduction, useSetSubOrderStatus } from '../queries/subOrderQueries'
import { isSubOrderComplete, resolveEffectiveSubOrder } from '../lib/subOrderShared'
import { STATUS_META, WORKFLOW_STATUSES } from '../const/orderStatus'
import type { SubOrderRow } from '../types/database'
import { useToast } from './Toast'
import { Button } from './ui/button'

type Props = {
  subOrder: SubOrderRow
  orderNumber: string | null
}

export function SubOrderReleaseButton({ subOrder, orderNumber }: Props) {
  const setSubOrderStatus = useSetSubOrderStatus()
  const releaseToProduction = useReleaseToProduction()
  const { showError } = useToast()
  const orderQuery = useOrderById(subOrder.order_id)
  const productsQuery = useProductsBySubOrderId(subOrder.id)

  const order = orderQuery.data
  const hasProducts = (productsQuery.data?.length ?? 0) > 0
  const effectiveSubOrder = order ? resolveEffectiveSubOrder(subOrder, order) : null
  const complete = effectiveSubOrder
    ? isSubOrderComplete(effectiveSubOrder, subOrder.status, hasProducts)
    : false

  const handleReleaseToPrepress = async () => {
    try {
      await setSubOrderStatus.mutateAsync({
        id: subOrder.id,
        orderId: subOrder.order_id,
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
        subOrder,
        orderId: subOrder.order_id,
        orderNumber,
      })
    } catch {
      showError('Status could not be updated')
    }
  }

  const handleMarkDone = async () => {
    if (!window.confirm('Mark job as done?')) return
    try {
      await setSubOrderStatus.mutateAsync({
        id: subOrder.id,
        orderId: subOrder.order_id,
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
  const target = WORKFLOW_STATUSES[WORKFLOW_STATUSES.indexOf(subOrder.status) + 1]

  const label =
    subOrder.status === 'INCOMPLETE' ? 'Release to Pre-Press' :
    subOrder.status === 'PREPRESS_READY' ? 'Release to Production' :
    subOrder.status === 'PRODUCTION_READY' ? 'Mark job as done' :
    null

  if (!label || !target) return null

  const pending = setSubOrderStatus.isPending || releaseToProduction.isPending

  const disabled =
    pending ||
    (subOrder.status === 'INCOMPLETE' && !complete) ||
    (subOrder.status === 'PREPRESS_READY' &&
      subOrder.customer_approval_required === true &&
      subOrder.customer_approval_granted !== true)

  const handleClick = () => {
    if (subOrder.status === 'INCOMPLETE') return void handleReleaseToPrepress()
    if (subOrder.status === 'PREPRESS_READY') return void handleReleaseToProduction()
    if (subOrder.status === 'PRODUCTION_READY') return void handleMarkDone()
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
