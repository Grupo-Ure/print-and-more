import { useNavigation } from '../context/navigation.context'

/** The active order/job selection. */
export function useOrderSelection() {
  const {
    activeOrderId,
    activeJobId,
    pendingProductAddJobId,
    setActiveOrder,
    setActiveJob,
    clearPendingProductAdd,
    clearActive,
  } = useNavigation()
  return {
    activeOrderId,
    activeJobId,
    pendingProductAddJobId,
    setActiveOrder,
    setActiveJob,
    clearPendingProductAdd,
    clearActive,
  }
}
