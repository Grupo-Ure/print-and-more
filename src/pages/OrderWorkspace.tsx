import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import type { Session } from '@supabase/supabase-js'
import { authService } from '../services/authService'
import { Login } from '../components/Login'
import { OrderSidebar } from '../components/OrderSidebar'
import { OrderDetails } from '../components/OrderDetails'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { useIsMobile } from '@/hooks/use-mobile'
import { OrderWorkspaceProvider } from '../context/order.context'
import { useOrderParams } from '../hooks/useOrderParams'
import type { Auftrag, Customer, OrderStatus, JobRow } from '../types/database'
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
  // Fixed sidebar width per breakpoint — never content-driven, just narrower
  // on small laptops. Same breakpoint as the `desktop:` Tailwind variant.
  const isCompact = useIsMobile()
  const [activeOrder, setActiveOrder] = useState<Auftrag | null>(null)
  const [activeJob, setActiveJob] = useState<JobRow | null>(null)
  const [orderCustomer, setOrderCustomer] = useState<Customer | null>(null)
  const [orderFiles, setOrderFiles] = useState<FileRow[]>([])
  const [contextRefreshTick, setContextRefreshTick] = useState(0)
  const [orderInPlace, setOrderInPlace] = useState(ORDER_LIST_IN_PLACE_INITIAL)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset child caches when the URL-driven active order changes
    setActiveOrder(null)
    setActiveJob(null)
    setOrderCustomer(null)
    setOrderFiles([])
  }, [activeOrderId])

  const handleOrderFromWorkArea = useCallback((order: Auftrag | null) => {
    setActiveOrder(order)
  }, [])

  const handleOrderCustomerLoaded = useCallback((customer: Customer | null) => {
    setOrderCustomer(customer)
  }, [])

  const handleActiveJobChanged = useCallback((job: JobRow | null) => {
    setActiveJob(job)
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
    setActiveJob(null)
    setOrderInPlace(ORDER_LIST_IN_PLACE_INITIAL)
    setContextRefreshTick(x => x + 1)
  }, [clearActive])

  const handleJobUpdated = useCallback((job: JobRow) => {
    setActiveJob(job)
    setContextRefreshTick(x => x + 1)
  }, [])

  const handleJobRemoved = useCallback((removedId: string) => {
    setActiveJob(cur => (cur?.id === removedId ? null : cur))
    setContextRefreshTick(x => x + 1)
  }, [])

  return (
    <SidebarProvider
      defaultOpen
      style={{ '--sidebar-width': isCompact ? '15rem' : '17.5rem' } as CSSProperties}
      className="h-full min-h-0 font-sans text-sm"
    >
      <OrderSidebar orderInPlace={orderInPlace} />

      <SidebarInset className="flex flex-col h-full overflow-hidden">
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <OrderDetails
            contextRefreshTick={contextRefreshTick}
            onActiveJobChanged={handleActiveJobChanged}
            onOrderCustomerLoaded={handleOrderCustomerLoaded}
            onOrderFromWorkArea={handleOrderFromWorkArea}
            onOrderFilesChanged={handleOrderFilesChanged}
          />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
