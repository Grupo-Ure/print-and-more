import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { authService } from '../services/authService'
import { fileService } from '../services/fileService'
import { employeeService } from '../services/employeeService'
import { orderService } from '../services/orderService'
import { subOrderService } from '../services/subOrderService'
import { departmentAbbreviation } from '../const/departmentAbbreviation'
import {
  type Auftrag,
  type Customer,
  type OrderDetailRow,
  type OrderHeaderPatch,
  type OrderStatus,
  type Department,
  type DeliveryChoice,
  type Priority,
  type SubOrderRow,
} from '../types/database'
import { subOrderDepartmentLabel } from '../const/departmentAbbreviation'
import { useToast } from './Toast'
import { AddSubOrderOverlay } from './AddSubOrderOverlay'
import { DateInput } from './DateInput'
import type { FileRow } from '../services/fileService'
import { SubOrderDetail } from './SubOrderDetail'
import { useOrderWorkspace } from '../context/order.context'
import './WorkArea.css'
import { Button } from './ui/button'
import { Settings } from 'lucide-react'

function subOrderStatusDotClass(status: OrderStatus): string {
  switch (status) {
    case 'QUOTE':
      return 'td-dot td-dot--grau'
    case 'INCOMPLETE':
      return 'td-dot td-dot--orange'
    case 'PREPRESS_READY':
      return 'td-dot td-dot--blau'
    case 'PRODUCTION_READY':
      return 'td-dot td-dot--lila'
    case 'DONE':
      return 'td-dot td-dot--gruen'
    default:
      return 'td-dot td-dot--grau'
  }
}

type Props = {
  activeOrderId: string | null
  contextRefreshTick: number
  onActiveSubOrderChanged: (t: SubOrderRow | null) => void
  onOrderCustomerLoaded: (k: Customer | null) => void
  onOrderFromWorkArea: (a: Auftrag | null) => void
  onOrderFilesChanged: (d: FileRow[]) => void
  onOrderUpdated: (a: Auftrag) => void
}

export function WorkArea({
  activeOrderId,
  contextRefreshTick,
  onActiveSubOrderChanged,
  onOrderCustomerLoaded,
  onOrderFromWorkArea,
  onOrderFilesChanged,
  onOrderUpdated,
}: Props) {
  const { activeSubOrderId, setActiveSubOrder, openCustomerDialog } = useOrderWorkspace()
  const [order, setOrder] = useState<OrderDetailRow | null>(null)
  const [subOrders, setSubOrders] = useState<SubOrderRow[]>([])
  const [localReloadTick, setLocalReloadTick] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [files, setFiles] = useState<FileRow[]>([])
  const [headerDeadline, setHeaderDeadline] = useState('')
  const [headerDelivery, setHeaderDelivery] = useState<DeliveryChoice | ''>('')
  const [headerPriority, setHeaderPriority] = useState<Priority>('NORMAL')
  const [responsibleName, setResponsibleName] = useState<string | null>(null)
  const headerSnapshot = useRef<{
    deadline: string | null
    delivery: DeliveryChoice | null
    priority: Priority
  }>({ deadline: null, delivery: null, priority: 'NORMAL' })
  const { showError } = useToast()
  const loadOrderRequestIdRef = useRef(0)

  const reloadFiles = useCallback(async () => {
    if (!activeOrderId) return
    try {
      const data = await fileService.getFilesByOrderId(activeOrderId)
      setFiles(data)
    } catch {
      setFiles([])
      showError('Files could not be loaded')
    }
  }, [activeOrderId, showError])

  useEffect(() => {
    if (!activeOrderId) {
      setFiles([])
      return
    }
    void reloadFiles()
  }, [activeOrderId, contextRefreshTick, reloadFiles])

  useEffect(() => {
    if (!activeOrderId) {
      setOrder(null)
      setSubOrders([])
      setError(null)
      setLoading(false)
      return
    }

    const requestId = ++loadOrderRequestIdRef.current
    const isStale = () => requestId !== loadOrderRequestIdRef.current
    const orderId = activeOrderId

    const fetchData = async () => {
      setError(null)
      setLoading(true)
      try {
        const [orderData, subOrderResult] = await Promise.all([
          orderService.getOrderById(orderId),
          subOrderService.getSubOrdersByOrderId(orderId),
        ])
        if (isStale()) return

        if (!orderData) {
          setError('Order not found')
          showError('Order could not be loaded')
          setOrder(null)
          setSubOrders([])
          return
        }
        if (isStale()) return
        setOrder(orderData as OrderDetailRow)
        setSubOrders(subOrderResult)
      } catch (err) {
        if (isStale()) return
        setError(err instanceof Error ? err.message : String(err))
        showError('Order could not be loaded')
        setOrder(null)
        setSubOrders([])
      } finally {
        if (!isStale()) {
          setLoading(false)
        }
      }
    }

    void fetchData()
    return () => {}
  }, [activeOrderId, contextRefreshTick, localReloadTick, showError])

  // Pick a default sub-order tab when ?sub= is unset or no longer matches a visible row.
  useEffect(() => {
    const visible = subOrders.filter(s => !s.is_cancelled)
    if (visible.length === 0) {
      if (activeSubOrderId !== null) setActiveSubOrder(null)
      return
    }
    if (activeSubOrderId == null || !visible.some(s => s.id === activeSubOrderId)) {
      setActiveSubOrder(visible[0].id)
    }
  }, [subOrders, activeSubOrderId, setActiveSubOrder])

  useEffect(() => {
    if (!order) return
    const rawDeadline = order.deadline
    const isoDate =
      rawDeadline && rawDeadline.length > 0
        ? rawDeadline.length > 10
          ? rawDeadline.slice(0, 10)
          : rawDeadline
        : ''
    // eslint-disable-next-line react-hooks/set-state-in-effect -- form mirrors server row
    setHeaderDeadline(isoDate)
    setHeaderDelivery(order.delivery ?? '')
    setHeaderPriority(order.priority)
    headerSnapshot.current = {
      deadline: rawDeadline,
      delivery: order.delivery,
      priority: order.priority,
    }
  }, [order])

  const saveOrderHeader = useCallback(
    async (patch: OrderHeaderPatch) => {
      if (!activeOrderId) return
      try {
        const updatedOrder = await orderService.updateOrder(activeOrderId, patch) as OrderDetailRow
        setOrder(updatedOrder)
        onOrderFromWorkArea(updatedOrder)
        onOrderCustomerLoaded(updatedOrder.customers)
        headerSnapshot.current = {
          deadline: updatedOrder.deadline,
          delivery: updatedOrder.delivery,
          priority: updatedOrder.priority,
        }
      } catch {
        showError('Order could not be saved')
      }
    },
    [activeOrderId, onOrderFromWorkArea, onOrderCustomerLoaded, showError]
  )

  const visibleSubOrders = useMemo(
    () => subOrders.filter(subOrder => !subOrder.is_cancelled),
    [subOrders]
  )
  const activeSubOrder = useMemo((): SubOrderRow | null => {
    if (activeSubOrderId == null) return null
    return visibleSubOrders.find(subOrder => subOrder.id === activeSubOrderId) ?? null
  }, [visibleSubOrders, activeSubOrderId])

  useEffect(() => {
    const responsibleId = activeSubOrder?.assignee_id ?? null
    if (!responsibleId) {
      setResponsibleName(null)
      return
    }
    let alive = true
    void (async () => {
      try {
        const profile = await employeeService.getProfile(responsibleId)
        if (!alive) return
        setResponsibleName(profile?.name ?? null)
      } catch (err) {
        if (!alive) return
        console.error(err)
      }
    })()
    return () => {
      alive = false
    }
  }, [activeSubOrder?.assignee_id])

  const handleSubOrderUpdated = useCallback(
    (updatedSubOrder: SubOrderRow) => {
      setSubOrders(previous => previous.map(subOrder => (subOrder.id === updatedSubOrder.id ? updatedSubOrder : subOrder)))
      onActiveSubOrderChanged(updatedSubOrder)
    },
    [onActiveSubOrderChanged]
  )

  useEffect(() => {
    if (activeOrderId == null) {
      onOrderFromWorkArea(null)
      onOrderCustomerLoaded(null)
      onActiveSubOrderChanged(null)
      onOrderFilesChanged([])
      return
    }
    if (loading || !order || order.id !== activeOrderId) return
    onOrderFromWorkArea(order)
    onOrderCustomerLoaded(order.customers)
    onActiveSubOrderChanged(activeSubOrder)
    onOrderFilesChanged(files)
  }, [
    activeOrderId,
    loading,
    order,
    files,
    activeSubOrder,
    onOrderFromWorkArea,
    onOrderCustomerLoaded,
    onActiveSubOrderChanged,
    onOrderFilesChanged,
  ])

  const handleAddSubOrder = async (bereich: Department) => {
    if (!activeOrderId || !order) return
    setSaving(true)
    setError(null)
    const user = await authService.getUser()
    if (!user?.id) {
      setError('Not logged in')
      setSaving(false)
      return
    }
    const today = new Date()
    const deadlineIso = order.deadline
      ? order.deadline.length > 10
        ? order.deadline.slice(0, 10)
        : order.deadline
      : `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const priority = order.priority
    const delivery = order.delivery ?? 'PICKUP'
    let data: SubOrderRow
    try {
      data = await subOrderService.createSubOrder({
        order_id: activeOrderId,
        department: bereich,
        status: 'INCOMPLETE',
        priority: priority,
        detail: {},
        deadline: deadlineIso,
        delivery: delivery,
        assignee_id: user.id,
        is_emergency: false,
        emergency_reason: null,
        is_cancelled: false,
        customer_approval_required: false,
        customer_approval_granted: false,
        customer_approval_file_id: null,
      })
    } catch (err) {
      setSaving(false)
      setError(err instanceof Error ? err.message : 'Error creating sub-order')
      return
    }
    setSaving(false)
    setSubOrders(previous => {
      const sorted = [...previous, data].sort((a, b) =>
        a.id < b.id ? -1 : a.id > b.id ? 1 : 0
      )
      return sorted
    })
    setActiveSubOrder(data.id)

    try {
      const statusResult = await orderService.synchronizeOrderStatus(order.id)
      setOrder(current => (current ? { ...current, status: statusResult.status } : current))
      onOrderUpdated({ ...order, status: statusResult.status })
    } catch {
      showError('Order status could not be updated')
      const refreshed = await orderService.getOrderById(order.id)
      if (refreshed) {
        setOrder(refreshed as OrderDetailRow)
        onOrderUpdated(refreshed)
      }
    }
    setOverlayOpen(false)
  }

  if (!activeOrderId) {
    return (
      <div className="flex flex-col w-full h-full items-center justify-center">
        <h1 className='tracking-widest'>Welcome</h1>
        <h2>Select an order on the left to view details and sub-orders.</h2>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col w-full h-full items-center justify-center">
        <h2>Loading order…</h2>
      </div>
    )
  }

  if (error && !order) {
    return (
      <div className="flex flex-col w-full h-full items-center justify-center">
        <h2>{error}</h2>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex flex-col w-full h-full items-center justify-center">
        <h2>Order not found.</h2>
      </div>
    )
  }

  const customerDisplayName = order.customers?.name?.trim() || '—'
  const trimDeadline = (dateString: string | null) => (dateString && dateString.length > 10 ? dateString.slice(0, 10) : dateString || '')
  const contactOneLine =
    order.customers?.email?.trim() || order.customers?.phone?.trim() || ''

  const priorityGlyph = (priority: Priority) => (priority === 'HIGH' ? '▲' : '●')

  return (
    <main className="p-4">
      <header
        className="flex  border-green-500!"
        style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        <div
          className='flex'
        >
          <div
            className='w-full flex items-center gap-4'
          >
            <h1>
              {customerDisplayName}
            </h1>
            <h2>{order.order_number}</h2>
          </div>
            <Button
              onClick={() =>
                openCustomerDialog(order?.customers ?? null, {
                  onSaved: () => setLocalReloadTick(x => x + 1),
                })
              }
              title="Edit customer"
              aria-label="Edit customer"
            >
             <Settings/>
            </Button>
        </div>
        {contactOneLine ? (
          <div
            style={{
              width: '100%',
              fontSize: 12,
              color: '#6b7280',
              lineHeight: 1.35,
            }}
          >
            <span style={{ minWidth: 0 }} title={contactOneLine}>
              {contactOneLine}
            </span>
          </div>
        ) : null}
      </header>

      {error && <p className="wa-showError">{error}</p>}

      <section className="work-area__meta" aria-label="Order meta">
        <label className="meta-pill" title="Deadline">
          <span aria-hidden>📅</span>
          <DateInput
            value={headerDeadline}
            onChange={e => setHeaderDeadline(e.target.value)}
            onBlur={e => {
              const value = e.target.value || null
              const snapshotDeadline = trimDeadline(headerSnapshot.current.deadline)
              if ((value || '') !== (snapshotDeadline || '')) {
                void saveOrderHeader({ deadline: value })
              }
            }}
          />
        </label>
        <label className="meta-pill" title="Delivery">
          <span aria-hidden>🚚</span>
          <select
            value={headerDelivery}
            onChange={e => {
              const value = e.target.value
              const deliveryValue: DeliveryChoice | null = value === 'PICKUP' || value === 'SHIPPING' ? value : null
              setHeaderDelivery(deliveryValue ?? '')
              if (deliveryValue !== headerSnapshot.current.delivery) {
                void saveOrderHeader({ delivery: deliveryValue })
              }
            }}
          >
            <option value="">—</option>
            <option value="PICKUP">Pickup</option>
            <option value="SHIPPING">Shipping</option>
          </select>
        </label>
        <label className="meta-pill" title="Priority">
          <span className="wa-prio-glyph" aria-hidden>
            {priorityGlyph(headerPriority)}
          </span>
          <select
            value={headerPriority}
            onChange={e => {
              const value = e.target.value
              if (value === 'NORMAL' || value === 'HIGH') {
                setHeaderPriority(value)
                if (value !== headerSnapshot.current.priority) {
                  void saveOrderHeader({ priority: value })
                }
              }
            }}
          >
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
          </select>
        </label>
      </section>

      <div className="work-area__tabs " role="tablist" aria-label="Sub-orders">
        {visibleSubOrders.map(subOrder => {
          const isActive = subOrder.id === activeSubOrderId
          const abbreviation = departmentAbbreviation(subOrder.department)
          const tabTitle = `${subOrderDepartmentLabel(subOrder.department)} · ${subOrder.status}`
          return (
            <button
              key={subOrder.id}
              type="button"
              role="tab"
              className={isActive ? 'tab-btn tab-btn--active' : 'tab-btn'}
              aria-selected={isActive}
              onClick={() => setActiveSubOrder(subOrder.id)}
              title={tabTitle}
            >
              <span className="wa-tab-kz">{abbreviation}</span>
              <span className="wa-tab-sep" aria-hidden>
                {' '}
                ·{' '}
              </span>
              <span
                className={subOrderStatusDotClass(subOrder.status)}
                title={subOrder.status}
                aria-label={subOrder.status}
              />
            </button>
          )
        })}
        <button
          type="button"
          className="tab-add-btn"
          onClick={() => setOverlayOpen(true)}
          aria-label="Add sub-order"
        >
          +
        </button>
      </div>

      <div className="work-area__formular " role="tabpanel">
        {activeSubOrder ? (
          <SubOrderDetail
            subOrder={activeSubOrder}
            orderStatus={order.status}
            orderDeadline={order.deadline}
            orderDelivery={order.delivery}
            orderPriority={order.priority}
            orderCustomer={order.customers}
            orderFiles={files}
            onUpdated={handleSubOrderUpdated}
          />
        ) : (
          <p className="wa-hint">No sub-orders yet. Use + to add a department.</p>
        )}
      </div>

      <AddSubOrderOverlay
        open={overlayOpen}
        saving={saving}
        onDepartmentSelected={handleAddSubOrder}
        onClose={() => !saving && setOverlayOpen(false)}
      />
    </main>
  )
}
