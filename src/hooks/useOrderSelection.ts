import { useNavigation } from '../context/navigation.context'

/** The active order/product selection, including an unsaved product being added. */
export function useOrderSelection() {
  const {
    activeOrderId,
    activeProductId,
    productDraft,
    setActiveOrder,
    setActiveProduct,
    startProductDraft,
    clearProductDraft,
    clearActive,
  } = useNavigation()
  return {
    activeOrderId,
    activeProductId,
    productDraft,
    setActiveOrder,
    setActiveProduct,
    startProductDraft,
    clearProductDraft,
    clearActive,
  }
}
