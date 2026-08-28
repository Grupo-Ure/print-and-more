import { useNavigation } from '../context/navigation.context'

/** The active order/job selection. */
export function useOrderSelection() {
  const { activeOrderId, activeJobId, setActiveOrder, setActiveJob, clearActive } = useNavigation()
  return { activeOrderId, activeJobId, setActiveOrder, setActiveJob, clearActive }
}
