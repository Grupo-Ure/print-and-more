import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

type NavigationValue = {
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
  const [selection, setSelection] = useState<Selection>(INITIAL_SELECTION)

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

  const value = useMemo<NavigationValue>(
    () => ({
      activeOrderId: selection.activeOrderId,
      activeJobId: selection.activeJobId,
      setActiveOrder,
      setActiveJob,
      clearActive,
    }),
    [selection, setActiveOrder, setActiveJob, clearActive],
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
