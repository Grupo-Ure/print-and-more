import { useNavigation } from '../context/navigation.context'

/** The active order/product selection. */
export function useOrderSelection() {
  const {
    activeOrderId,
    activeProductId,
    setActiveOrder,
    setActiveProduct,
    clearActive,
  } = useNavigation()
  return {
    activeOrderId,
    activeProductId,
    setActiveOrder,
    setActiveProduct,
    clearActive,
  }
}
