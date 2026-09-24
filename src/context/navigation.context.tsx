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

type SetActiveJobOptions = {
  /**
   * Open the job's "add product" dialog as soon as its detail mounts. Used
   * right after creating a job so the user lands in product entry without a
   * second click. One-shot: consumed by the product editor of that job.
   */
  openProductAdd?: boolean
}

type NavigationValue = {
  view: AppView
  navigate: (view: AppView) => void
  activeOrderId: string | null
  activeJobId: string | null
  /** The job whose product editor should open in "add" mode on mount, if any. */
  pendingProductAddJobId: string | null
  setActiveOrder: (orderId: string | null) => void
  setActiveJob: (jobId: string | null, options?: SetActiveJobOptions) => void
  /** Selects an order and one of its jobs in one update, whatever the view (the production feed's row click). */
  selectJob: (orderId: string, jobId: string) => void
  /** Switches to the orders view with this order and job selected. */
  openJobInOrders: (orderId: string, jobId: string) => void
  /** Called by the product editor once it has acted on the pending request. */
  clearPendingProductAdd: () => void
  clearActive: () => void
}

const NavigationContext = createContext<NavigationValue | null>(null)

type Selection = {
  activeOrderId: string | null
  activeJobId: string | null
  pendingProductAddJobId: string | null
}

const INITIAL_SELECTION: Selection = {
  activeOrderId: null,
  activeJobId: null,
  pendingProductAddJobId: null,
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
      // A job selection is only meaningful within its order.
      if (prev.activeOrderId !== orderId) return { ...INITIAL_SELECTION, activeOrderId: orderId }
      return { ...prev, activeOrderId: orderId }
    })
  }, [])

  const setActiveJob = useCallback((jobId: string | null, options?: SetActiveJobOptions) => {
    setSelection(prev => ({
      ...prev,
      activeJobId: jobId,
      // Selecting a job in the same update as the request means the editor can
      // never observe the flag for a job other than the one it was meant for.
      pendingProductAddJobId: jobId != null && options?.openProductAdd ? jobId : null,
    }))
  }, [])

  const selectJob = useCallback((orderId: string, jobId: string) => {
    setSelection({ activeOrderId: orderId, activeJobId: jobId, pendingProductAddJobId: null })
  }, [])

  const openJobInOrders = useCallback(
    (orderId: string, jobId: string) => {
      setView('orders')
      selectJob(orderId, jobId)
    },
    [selectJob],
  )

  const clearPendingProductAdd = useCallback(() => {
    setSelection(prev =>
      prev.pendingProductAddJobId == null ? prev : { ...prev, pendingProductAddJobId: null },
    )
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
      pendingProductAddJobId: selection.pendingProductAddJobId,
      setActiveOrder,
      setActiveJob,
      selectJob,
      openJobInOrders,
      clearPendingProductAdd,
      clearActive,
    }),
    [view, navigate, selection, setActiveOrder, setActiveJob, selectJob, openJobInOrders, clearPendingProductAdd, clearActive],
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
