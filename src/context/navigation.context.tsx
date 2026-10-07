import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useSupabaseSession } from '../hooks/useSupabaseSession'
import type { Department } from '../types/database'

export type AppView =
  | 'orders'
  | 'production'
  | 'stampStock'
  | 'textileStock'
  | 'settings'
  | 'profile'
  | 'releaseNotes'

/**
 * A product being filled in but not yet written: its department and type are
 * settled (both are picked before the draft starts, from the add button and its
 * type menu), everything else is the form's business. There is no row in the
 * database until Save, so a draft has no id, no product number and no status —
 * which is why it is a selection state of its own rather than a product.
 */
export type ProductDraft = {
  department: Department
  type: string
}

type NavigationValue = {
  view: AppView
  navigate: (view: AppView) => void
  activeOrderId: string | null
  activeProductId: string | null
  /** The unsaved product of the active order, if one is being added. */
  productDraft: ProductDraft | null
  setActiveOrder: (orderId: string | null) => void
  setActiveProduct: (productId: string | null) => void
  /** Starts an unsaved product of this type — the selection the add buttons make. */
  startProductDraft: (department: Department, type: string) => void
  /** Drops the unsaved product, discarding whatever was typed into it. */
  clearProductDraft: () => void
  /** Selects an order and one of its products in one update, whatever the view (the production feed's row click). */
  selectProduct: (orderId: string, productId: string) => void
  /** Switches to the orders view with this order and product selected. */
  openProductInOrders: (orderId: string, productId: string) => void
  clearActive: () => void
}

const NavigationContext = createContext<NavigationValue | null>(null)

/**
 * What the workspace is pointed at. A product and a draft are mutually
 * exclusive by construction — the detail pane shows one or the other, so every
 * updater below sets one and clears the other rather than leaving the two to be
 * reconciled by whoever reads them.
 */
type Selection = {
  activeOrderId: string | null
  activeProductId: string | null
  productDraft: ProductDraft | null
}

const INITIAL_SELECTION: Selection = {
  activeOrderId: null,
  activeProductId: null,
  productDraft: null,
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<AppView>('orders')
  const [selection, setSelection] = useState<Selection>(INITIAL_SELECTION)

  const navigate = useCallback((next: AppView) => {
    setView(next)
  }, [])

  const setActiveOrder = useCallback((orderId: string | null) => {
    setSelection(prev => {
      if (orderId == null) return INITIAL_SELECTION
      // A product selection is only meaningful within its order.
      if (prev.activeOrderId !== orderId) return { ...INITIAL_SELECTION, activeOrderId: orderId }
      return { ...prev, activeOrderId: orderId }
    })
  }, [])

  const setActiveProduct = useCallback((productId: string | null) => {
    // Picking a saved product abandons the draft: the two share the detail pane.
    setSelection(prev => ({ ...prev, activeProductId: productId, productDraft: null }))
  }, [])

  const startProductDraft = useCallback((department: Department, type: string) => {
    setSelection(prev => ({ ...prev, activeProductId: null, productDraft: { department, type } }))
  }, [])

  // Leaves `activeProductId` null, so the orders view falls back to selecting a
  // saved product of the order — the state the user was in before adding.
  const clearProductDraft = useCallback(() => {
    setSelection(prev => ({ ...prev, productDraft: null }))
  }, [])

  const selectProduct = useCallback((orderId: string, productId: string) => {
    setSelection({ activeOrderId: orderId, activeProductId: productId, productDraft: null })
  }, [])

  const openProductInOrders = useCallback(
    (orderId: string, productId: string) => {
      setView('orders')
      selectProduct(orderId, productId)
    },
    [selectProduct],
  )

  const clearActive = useCallback(() => {
    setSelection(INITIAL_SELECTION)
  }, [])

  const { session } = useSupabaseSession()
  const isSignedIn = session != null

  // pam://order/<id>: main parks the id and nudges us. A link clicked while
  // logged out simply waits — this collects it as soon as a session exists.
  // Reading through consumePending() means a live push and a post-login pickup
  // can never both act on the same link.
  useEffect(() => {
    const bridge = window.pam
    if (!bridge || !isSignedIn) return

    let alive = true
    const collect = (): void => {
      void bridge.deepLinks.consumePending().then(orderId => {
        if (!alive || orderId == null) return
        setView('orders')
        setActiveOrder(orderId)
      })
    }

    collect()
    const unsubscribe = bridge.deepLinks.onOrderLink(collect)
    return () => {
      alive = false
      unsubscribe()
    }
  }, [isSignedIn, setActiveOrder])

  const value = useMemo<NavigationValue>(
    () => ({
      view,
      navigate,
      activeOrderId: selection.activeOrderId,
      activeProductId: selection.activeProductId,
      productDraft: selection.productDraft,
      setActiveOrder,
      setActiveProduct,
      startProductDraft,
      clearProductDraft,
      selectProduct,
      openProductInOrders,
      clearActive,
    }),
    [
      view,
      navigate,
      selection,
      setActiveOrder,
      setActiveProduct,
      startProductDraft,
      clearProductDraft,
      selectProduct,
      openProductInOrders,
      clearActive,
    ],
  )

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>
}

export function useNavigation(): NavigationValue {
  const value = useContext(NavigationContext)
  if (value == null) {
    throw new Error('useNavigation must be used within a NavigationProvider')
  }
  return value
}
