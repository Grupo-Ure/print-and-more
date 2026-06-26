import { Lock } from 'lucide-react'
import { useSetSubOrderStatus } from '../queries/subOrderQueries'
import type { SubOrderRow } from '../types/database'
import { useToast } from './Toast'
import { Button } from './ui/button'

type Props = {
  subOrder: SubOrderRow
}

export function SubOrderProductionBanner({ subOrder }: Props) {
  const setSubOrderStatus = useSetSubOrderStatus()
  const { showError } = useToast()

  if (subOrder.status !== 'PRODUCTION_READY') return null

  const handleGoBackToPrePress = async () => {
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

  return (
    <div className="flex items-center justify-center gap-4 border-b-6 border-blue-500 px-4 py-2 text-blue-500">
      <Lock/>
      <p className="text-sm font-medium">
        This job is in production and cannot be modified.
      </p>
      <Button
        type="button"
        variant="default"
        className="shrink-0 rounded-full bg-pink-500 hover:bg-pink-600"
        disabled={setSubOrderStatus.isPending}
        onClick={() => void handleGoBackToPrePress()}
      >
        {setSubOrderStatus.isPending ? '…' : 'Go back to Pre-Press'}
      </Button>
    </div>
  )
}
