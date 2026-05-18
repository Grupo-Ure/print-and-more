import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import type { Session } from '@supabase/supabase-js'
import { authService } from '../services/authService'
import { Login } from '../components/Login'
import { OrderSidebar } from '../components/OrderSidebar'
import { WorkArea } from '../components/WorkArea'
import { ContextPanel } from '../components/ContextPanel'
import { NewOrderDialog, type NewOrderInsertRow } from '../components/NewOrderDialog'
import { CustomerDialog } from '../components/CustomerDialog'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { contactJoinToCustomer } from '../lib/customers'
import type { Customer } from '../lib/customers'
import type { Auftrag, OrderStatus, CustomerContactJoin, SubOrderRow } from '../types/database'
import type { FileRow } from '../services/fileService'

const ORDER_LIST_IN_PLACE_INITIAL: { tick: number; id: string; status: OrderStatus } = {
  tick: 0,
  id: '',
  status: 'QUOTE',
}

export function OrderWorkspace() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null)
  const [activeOrder, setActiveOrder] = useState<Auftrag | null>(null)
  const [activeSubOrder, setActiveSubOrder] = useState<SubOrderRow | null>(null)
  const [orderCustomer, setOrderCustomer] = useState<CustomerContactJoin | null>(null)
  const [orderFiles, setOrderFiles] = useState<FileRow[]>([])
  const [contextRefreshTick, setContextRefreshTick] = useState(0)
  const [orderSidebarKey, setOrderSidebarKey] = useState(0)
  const [orderInPlace, setOrderInPlace] = useState(ORDER_LIST_IN_PLACE_INITIAL)
  const [newOrderOpen, setNewOrderOpen] = useState(false)
  const [customerDialog, setCustomerDialog] = useState<{ open: boolean; customer: Customer | null }>({
    open: false,
    customer: null,
  })

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

  useEffect(() => {
    setActiveOrder(null)
    setActiveSubOrder(null)
    setOrderCustomer(null)
    setOrderFiles([])
  }, [activeOrderId])

  const handleOrderFromWorkArea = useCallback((order: Auftrag | null) => {
    setActiveOrder(order)
  }, [])

  const handleOrderCustomerLoaded = useCallback((customer: CustomerContactJoin | null) => {
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

  const handleOrderUpdated = useCallback((order: Auftrag) => {
    setActiveOrder(order)
    if (order.is_archived) {
      setActiveOrderId(null)
      setOrderSidebarKey(k => k + 1)
      setOrderInPlace(ORDER_LIST_IN_PLACE_INITIAL)
    } else {
      setOrderInPlace(prev => ({ tick: prev.tick + 1, id: order.id, status: order.status }))
    }
    setContextRefreshTick(x => x + 1)
  }, [])

  const handleOrderDeleted = useCallback(() => {
    setActiveOrderId(null)
    setActiveSubOrder(null)
    setOrderSidebarKey(k => k + 1)
    setOrderInPlace(ORDER_LIST_IN_PLACE_INITIAL)
    setContextRefreshTick(x => x + 1)
  }, [])

  const handleSubOrderUpdated = useCallback((subOrder: SubOrderRow) => {
    setActiveSubOrder(subOrder)
    setContextRefreshTick(x => x + 1)
  }, [])

  const handleSubOrderRemoved = useCallback((removedId: string) => {
    setActiveSubOrder(cur => (cur?.id === removedId ? null : cur))
    setContextRefreshTick(x => x + 1)
  }, [])

  const handleCustomerSaved = useCallback(() => {
    setCustomerDialog({ open: false, customer: null })
    setOrderSidebarKey(k => k + 1)
    setOrderInPlace(ORDER_LIST_IN_PLACE_INITIAL)
    setContextRefreshTick(x => x + 1)
  }, [])

  const handleNewOrderSuccess = useCallback((a: NewOrderInsertRow) => {
    setNewOrderOpen(false)
    setActiveOrderId(a.id)
    setOrderSidebarKey(k => k + 1)
    setOrderInPlace(ORDER_LIST_IN_PLACE_INITIAL)
  }, [])

  const openEditCustomer = useCallback(() => {
    const customer = contactJoinToCustomer(orderCustomer)
    if (customer) setCustomerDialog({ open: true, customer })
  }, [orderCustomer])

  if (loading) return null
  if (!session) return <Login />

  return (
    <SidebarProvider
      defaultOpen
      style={{ '--sidebar-width': '280px' } as CSSProperties}
      className="font-sans text-sm"
    >
      <OrderSidebar
        key={orderSidebarKey}
        orderInPlace={orderInPlace}
        activeOrderId={activeOrderId}
        onSelectOrder={id => setActiveOrderId(id)}
        onNewOrder={() => setNewOrderOpen(true)}
      />

      <SidebarInset className="flex flex-col h-screen overflow-hidden">
        <div className="flex items-center gap-2 border-b border-neutral-200 px-3 py-1.5">
          <SidebarTrigger />
        </div>
        <div className="grid grid-cols-[1fr_300px] flex-1 min-h-0">
          <WorkArea
            activeOrderId={activeOrderId}
            contextRefreshTick={contextRefreshTick}
            onActiveSubOrderChanged={handleActiveSubOrderChanged}
            onOrderCustomerLoaded={handleOrderCustomerLoaded}
            onOrderFromWorkArea={handleOrderFromWorkArea}
            onOrderFilesChanged={handleOrderFilesChanged}
            onOrderUpdated={handleOrderUpdated}
            onEditCustomer={openEditCustomer}
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
              onEditCustomer={openEditCustomer}
              contextRefreshTick={contextRefreshTick}
              onFileChanged={handleFileChanged}
            />
          </aside>
        </div>
      </SidebarInset>

      <NewOrderDialog
        open={newOrderOpen}
        onClose={() => setNewOrderOpen(false)}
        onSuccess={handleNewOrderSuccess}
      />
      {customerDialog.open && (
        <CustomerDialog
          kunde={customerDialog.customer}
          onSaved={handleCustomerSaved}
          onCancel={() => setCustomerDialog({ open: false, customer: null })}
        />
      )}
    </SidebarProvider>
  )
}
