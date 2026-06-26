import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import type { Session } from '@supabase/supabase-js'
import { authService } from '../services/authService'
import { Login } from '../components/Login'
import { OrderSidebar } from '../components/OrderSidebar'
import { OrderDetails } from '../components/OrderDetails'
import { ContextPanel } from '../components/ContextPanel'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { OrderWorkspaceProvider } from '../context/order.context'
import { useOrderParams } from '../hooks/useOrderParams'
import type { Auftrag, Customer, OrderStatus, SubOrderRow } from '../types/database'
import type { FileRow } from '../services/fileService'

const ORDER_LIST_IN_PLACE_INITIAL: { tick: number; id: string; status: OrderStatus } = {
  tick: 0,
  id: '',
  status: 'QUOTE',
}

export function OrderWorkspace() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authService
      .getSession()
      .then(session => {
        setSession(session)
        setLoading(false)
      })
      .catch(() => setLoading(false))
    const { subscription } = authService.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return null
  if (!session) return <Login />

  return (
    <OrderWorkspaceProvider>
      <WorkspaceShell />
    </OrderWorkspaceProvider>
  )
}

function WorkspaceShell() {
  const { activeOrderId, clearActive } = useOrderParams()
  const [activeOrder, setActiveOrder] = useState<Auftrag | null>(null)
  const [activeSubOrder, setActiveSubOrder] = useState<SubOrderRow | null>(null)
  const [orderCustomer, setOrderCustomer] = useState<Customer | null>(null)
  const [orderFiles, setOrderFiles] = useState<FileRow[]>([])
  const [contextRefreshTick, setContextRefreshTick] = useState(0)
  const [orderInPlace, setOrderInPlace] = useState(ORDER_LIST_IN_PLACE_INITIAL)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset child caches when the URL-driven active order changes
    setActiveOrder(null)
    setActiveSubOrder(null)
    setOrderCustomer(null)
    setOrderFiles([])
  }, [activeOrderId])

  const handleOrderFromWorkArea = useCallback((order: Auftrag | null) => {
    setActiveOrder(order)
  }, [])

  const handleOrderCustomerLoaded = useCallback((customer: Customer | null) => {
    setOrderCustomer(customer)
  }, [])

  const handleActiveSubOrderChanged = useCallback((subOrder: SubOrderRow | null) => {
    setActiveSubOrder(subOrder)
  }, [])

  const handleOrderFilesChanged = useCallback((files: FileRow[]) => {
    setOrderFiles(files)
  }, [])

  const handleFileChanged = useCallback((newFile?: FileRow) => {
    if (newFile) {
      setOrderFiles(prev => [...prev, newFile])
    }
    setContextRefreshTick(x => x + 1)
  }, [])

  const handleOrderUpdated = useCallback(
    (order: Auftrag) => {
      setActiveOrder(order)
      if (order.is_archived) {
        clearActive()
        setOrderInPlace(ORDER_LIST_IN_PLACE_INITIAL)
      } else {
        setOrderInPlace(prev => ({ tick: prev.tick + 1, id: order.id, status: order.status }))
      }
      setContextRefreshTick(x => x + 1)
    },
    [clearActive],
  )

  const handleOrderDeleted = useCallback(() => {
    clearActive()
    setActiveSubOrder(null)
    setOrderInPlace(ORDER_LIST_IN_PLACE_INITIAL)
    setContextRefreshTick(x => x + 1)
  }, [clearActive])

  const handleSubOrderUpdated = useCallback((subOrder: SubOrderRow) => {
    setActiveSubOrder(subOrder)
    setContextRefreshTick(x => x + 1)
  }, [])

  const handleSubOrderRemoved = useCallback((removedId: string) => {
    setActiveSubOrder(cur => (cur?.id === removedId ? null : cur))
    setContextRefreshTick(x => x + 1)
  }, [])

  return (
    <SidebarProvider
      defaultOpen
      style={{ '--sidebar-width': '280px' } as CSSProperties}
      className="font-sans text-sm"
    >
      <OrderSidebar orderInPlace={orderInPlace} />

      <SidebarInset className="flex flex-col h-screen overflow-hidden">
        <div className="flex items-center gap-2 border-b border-neutral-200 px-3 py-1.5">
          <SidebarTrigger />
        </div>
        <div className="flex flex-col flex-1">
          <OrderDetails
            contextRefreshTick={contextRefreshTick}
            onActiveSubOrderChanged={handleActiveSubOrderChanged}
            onOrderCustomerLoaded={handleOrderCustomerLoaded}
            onOrderFromWorkArea={handleOrderFromWorkArea}
            onOrderFilesChanged={handleOrderFilesChanged}
          />
          <aside className="border-l border-neutral-200 bg-neutral-50 p-4 overflow-y-auto">
            <ContextPanel
              order={activeOrder}
              activeSubOrder={activeSubOrder}
              orderCustomer={orderCustomer}
              orderFiles={orderFiles}
              onOrderUpdated={handleOrderUpdated}
              onOrderDeleted={handleOrderDeleted}
              onSubOrderUpdated={handleSubOrderUpdated}
              onSubOrderRemoved={handleSubOrderRemoved}
              contextRefreshTick={contextRefreshTick}
              onFileChanged={handleFileChanged}
            />
          </aside>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
