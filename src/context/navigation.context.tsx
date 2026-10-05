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

export type AppView =
  | 'orders'
  | 'production'
  | 'stampStock'
  | 'textileStock'
  | 'settings'
  | 'profile'
  | 'releaseNotes'

type NavigationValue = {
  view: AppView
  navigate: (view: AppView) => void
  activeOrderId: string | null
  activeProductId: string | null
  setActiveOrder: (orderId: string | null) => void
  setActiveProduct: (productId: string | null) => void
  /** Selects an order and one of its products in one update, whatever the view (the production feed's row click). */
  selectProduct: (orderId: string, productId: string) => void
  /** Switches to the orders view with this order and product selected. */
  openProductInOrders: (orderId: string, productId: string) => void
  clearActive: () => void
}

const NavigationContext = createContext<NavigationValue | null>(null)

type Selection = {
  activeOrderId: string | null
  activeProductId: string | null
}

const INITIAL_SELECTION: Selection = {
  activeOrderId: null,
  activeProductId: null,
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
    setSelection(prev => ({ ...prev, activeProductId: productId }))
  }, [])

  const selectProduct = useCallback((orderId: string, productId: string) => {
    setSelection({ activeOrderId: orderId, activeProductId: productId })
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
      setActiveOrder,
      setActiveProduct,
      selectProduct,
      openProductInOrders,
      clearActive,
    }),
    [view, navigate, selection, setActiveOrder, setActiveProduct, selectProduct, openProductInOrders, clearActive],
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
