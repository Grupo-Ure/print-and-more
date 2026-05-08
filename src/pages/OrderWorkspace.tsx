import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { authService } from '../services/authService'
import { Login } from '../components/Login'
import { OrderList } from '../components/OrderList'
import { WorkArea } from '../components/WorkArea'
import { ContextPanel } from '../components/ContextPanel'
import { NewOrderDialog, type NewOrderInsertRow } from '../components/NewOrderDialog'
import { CustomerDialog } from '../components/CustomerDialog'
import { contactJoinToCustomer } from '../lib/customers'
import type { Customer } from '../lib/customers'
import type { Auftrag, OrderStatus, CustomerContactJoin, SubOrderRow } from '../types/database'
import type { FileRow } from '../services/fileService'

const ORDER_LIST_IN_PLACE_INITIAL: { tick: number; id: string; status: OrderStatus } = {
  tick: 0,
  id: '',
  status: 'ANGEBOT',
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
  const [orderListKey, setOrderListKey] = useState(0)
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
    if (order.archiviert) {
      setActiveOrderId(null)
      setOrderListKey(k => k + 1)
      setOrderInPlace(ORDER_LIST_IN_PLACE_INITIAL)
    } else {
      setOrderInPlace(prev => ({ tick: prev.tick + 1, id: order.id, status: order.status }))
    }
    setContextRefreshTick(x => x + 1)
  }, [])

  const handleOrderDeleted = useCallback(() => {
    setActiveOrderId(null)
    setActiveSubOrder(null)
    setOrderListKey(k => k + 1)
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
    setOrderListKey(k => k + 1)
    setOrderInPlace(ORDER_LIST_IN_PLACE_INITIAL)
    setContextRefreshTick(x => x + 1)
  }, [])

  const handleNewOrderSuccess = useCallback((a: NewOrderInsertRow) => {
    setNewOrderOpen(false)
    setActiveOrderId(a.id)
    setOrderListKey(k => k + 1)
    setOrderInPlace(ORDER_LIST_IN_PLACE_INITIAL)
  }, [])

  const openEditCustomer = useCallback(() => {
    const customer = contactJoinToCustomer(orderCustomer)
    if (customer) setCustomerDialog({ open: true, customer })
  }, [orderCustomer])

  if (loading) return null
  if (!session) return <Login />

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '280px 1fr 300px',
        height: '100vh',
        overflow: 'hidden',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 14,
      }}
      className="b-dev"
    >
      <div
        className="app-col b-dev p-4"
        style={{ borderRight: '1px solid #e5e5e5', background: '#fafafa' }}
      >
        <OrderList
          key={orderListKey}
          orderInPlace={orderInPlace}
          activeOrderId={activeOrderId}
          onSelectOrder={id => setActiveOrderId(id)}
          onNewOrder={() => setNewOrderOpen(true)}
        />
      </div>
      <div className="app-col">
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
      </div>
      <div
        className="app-col"
        style={{
          borderLeft: '1px solid #e5e5e5',
          background: '#fafafa',
          padding: 16,
        }}
      >
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
      </div>

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
    </div>
  )
}
