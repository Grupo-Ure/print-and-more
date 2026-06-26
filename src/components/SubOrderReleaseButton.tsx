import { cn } from '@/lib/utils'
import { useProductsBySubOrderId } from '../queries/productQueries'
import { useOrderById } from '../queries/orderQueries'
import { useReleaseToProduction, useSetSubOrderStatus } from '../queries/subOrderQueries'
import { isSubOrderComplete, resolveEffectiveSubOrder } from '../lib/subOrderShared'
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

  const label =
    subOrder.status === 'INCOMPLETE' ? 'Release to Pre-Press' :
    subOrder.status === 'PREPRESS_READY' ? 'Release to Production' :
    null

  if (!label) return null

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
  }

  const className = cn(
    'ml-auto h-10 px-6 text-lg rounded-full',
    subOrder.status === 'INCOMPLETE'
      ? 'bg-pink-500 hover:bg-pink-600'
      : 'bg-blue-500 hover:bg-blue-600',
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
