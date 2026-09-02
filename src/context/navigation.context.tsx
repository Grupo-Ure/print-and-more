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

export type AppView = 'orders' | 'stampStock' | 'textileStock' | 'userManagement' | 'profile'

type NavigationValue = {
  view: AppView
  navigate: (view: AppView) => void
  activeOrderId: string | null
  activeJobId: string | null
  setActiveOrder: (orderId: string | null) => void
  setActiveJob: (jobId: string | null) => void
  clearActive: () => void
}

const NavigationContext = createContext<NavigationValue | null>(null)

type Selection = {
  activeOrderId: string | null
  activeJobId: string | null
}

const INITIAL_SELECTION: Selection = { activeOrderId: null, activeJobId: null }

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<AppView>('orders')
  const [selection, setSelection] = useState<Selection>(INITIAL_SELECTION)

  const navigate = useCallback((next: AppView) => {
    setView(next)
  }, [])

  const setActiveOrder = useCallback((orderId: string | null) => {
    setSelection(prev => {
      if (orderId == null) return INITIAL_SELECTION
      // A job selection is only meaningful within its order.
      if (prev.activeOrderId !== orderId) return { activeOrderId: orderId, activeJobId: null }
      return { ...prev, activeOrderId: orderId }
    })
  }, [])

  const setActiveJob = useCallback((jobId: string | null) => {
    setSelection(prev => ({ ...prev, activeJobId: jobId }))
  }, [])

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
      activeJobId: selection.activeJobId,
      setActiveOrder,
      setActiveJob,
      clearActive,
    }),
    [view, navigate, selection, setActiveOrder, setActiveJob, clearActive],
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
