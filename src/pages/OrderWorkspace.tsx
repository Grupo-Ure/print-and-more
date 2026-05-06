import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { Login } from '../components/Login'
import { OrderList } from '../components/OrderList'
import { WorkArea } from '../components/WorkArea'
import { ContextPanel } from '../components/ContextPanel'
import { NewOrderDialog, type NewOrderInsertRow } from '../components/NewOrderDialog'
import { CustomerDialog } from '../components/CustomerDialog'
import { contactJoinToCustomer } from '../lib/customers'
import type { Customer } from '../lib/customers'
import type { Auftrag, AuftragStatus, KundeKontaktJoin, TeilauftragRow } from '../types/database'
import type { Datei } from '../components/FileList'

const ORDER_LIST_IN_PLACE_INITIAL: { tick: number; id: string; status: AuftragStatus } = {
  tick: 0,
  id: '',
  status: 'ANGEBOT',
}

export function OrderWorkspace() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null)
  const [activeOrder, setActiveOrder] = useState<Auftrag | null>(null)
  const [activeSubOrder, setActiveSubOrder] = useState<TeilauftragRow | null>(null)
  const [orderCustomer, setOrderCustomer] = useState<KundeKontaktJoin | null>(null)
  const [orderFiles, setOrderFiles] = useState<Datei[]>([])
  const [contextRefreshTick, setContextRefreshTick] = useState(0)
  const [orderListKey, setOrderListKey] = useState(0)
  const [orderInPlace, setOrderInPlace] = useState(ORDER_LIST_IN_PLACE_INITIAL)
  const [newOrderOpen, setNewOrderOpen] = useState(false)
  const [customerDialog, setCustomerDialog] = useState<{ open: boolean; customer: Customer | null }>({
    open: false,
    customer: null,
  })

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session)
        setLoading(false)
      })
      .catch(() => setLoading(false))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
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

  const handleOrderFromWorkArea = useCallback((a: Auftrag | null) => {
    setActiveOrder(a)
  }, [])

  const handleOrderCustomerLoaded = useCallback((k: KundeKontaktJoin | null) => {
    setOrderCustomer(k)
  }, [])

  const handleActiveSubOrderChanged = useCallback((t: TeilauftragRow | null) => {
    setActiveSubOrder(t)
  }, [])

  const handleOrderFilesChanged = useCallback((d: Datei[]) => {
    setOrderFiles(d)
  }, [])

  const handleFileChanged = useCallback((newFile?: Datei) => {
    if (newFile) {
      setOrderFiles(prev => [...prev, newFile])
    }
    setContextRefreshTick(x => x + 1)
  }, [])

  const handleOrderUpdated = useCallback((a: Auftrag) => {
    setActiveOrder(a)
    if (a.archiviert) {
      setActiveOrderId(null)
      setOrderListKey(k => k + 1)
      setOrderInPlace(ORDER_LIST_IN_PLACE_INITIAL)
    } else {
      setOrderInPlace(p => ({ tick: p.tick + 1, id: a.id, status: a.status }))
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

  const handleSubOrderUpdated = useCallback((t: TeilauftragRow) => {
    setActiveSubOrder(t)
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
    const k = contactJoinToCustomer(orderCustomer)
    if (k) setCustomerDialog({ open: true, customer: k })
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
    >
      <div
        className="app-col"
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
          aktiverAuftragId={activeOrderId}
          kontextAktualisiert={contextRefreshTick}
          onAktiverTeilauftragGeaendert={handleActiveSubOrderChanged}
          onAuftragKundeGeladen={handleOrderCustomerLoaded}
          onAuftragVomArbeitsbereich={handleOrderFromWorkArea}
          onAuftragDateienGeaendert={handleOrderFilesChanged}
          onAuftragAktualisiert={handleOrderUpdated}
          onKundeBearbeiten={openEditCustomer}
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
          auftrag={activeOrder}
          aktiverTeilauftrag={activeSubOrder}
          auftragKunde={orderCustomer}
          auftragDateien={orderFiles}
          onAuftragAktualisiert={handleOrderUpdated}
          onAuftragGeloescht={handleOrderDeleted}
          onTeilauftragAktualisiert={handleSubOrderUpdated}
          onTeilauftragEntfernt={handleSubOrderRemoved}
          onKundeBearbeiten={openEditCustomer}
          kontextAktualisiert={contextRefreshTick}
          onDateiGeaendert={handleFileChanged}
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
