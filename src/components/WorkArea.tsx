import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { authService } from '../services/authService'
import { fileService } from '../services/fileService'
import { employeeService } from '../services/employeeService'
import { orderService } from '../services/orderService'
import { subOrderService } from '../services/subOrderService'
import { customerName } from '../lib/customer'
import { departmentAbbreviation } from '../const/departmentAbbreviation'
import {
  subOrderDepartmentLabel,
  type Auftrag,
  type OrderDetailRow,
  type OrderStatus,
  type Department,
  type CustomerContactJoin,
  type CustomerContactRow,
  type DeliveryChoice,
  type Priority,
  type SubOrderRow,
} from '../types/database'
import { useToast } from './Toast'
import { AddSubOrderOverlay } from './AddSubOrderOverlay'
import { DateInput } from './DateInput'
import type { FileRow } from '../services/fileService'
import { SubOrderDetail } from './SubOrderDetail'
import './WorkArea.css'

function firstContactRow(contact: CustomerContactJoin | null): CustomerContactRow | null {
  if (contact == null) return null
  const row = Array.isArray(contact) ? (contact[0] ?? null) : contact
  return row ?? null
}

/** One line for the header: email preferred, phone as fallback. */
function customerContactOneLine(contact: CustomerContactJoin | null): string {
  const row = firstContactRow(contact)
  if (!row) return ''
  const email = row.email?.trim() ?? ''
  if (email !== '') return email
  return row.telefon?.trim() ?? ''
}

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
  onOrderCustomerLoaded: (k: CustomerContactJoin | null) => void
  onOrderFromWorkArea: (a: Auftrag | null) => void
  onOrderFilesChanged: (d: FileRow[]) => void
  onOrderUpdated: (a: Auftrag) => void
  onEditCustomer: () => void
}

export function WorkArea({
  activeOrderId,
  contextRefreshTick,
  onActiveSubOrderChanged,
  onOrderCustomerLoaded,
  onOrderFromWorkArea,
  onOrderFilesChanged,
  onOrderUpdated,
  onEditCustomer,
}: Props) {
  const [order, setOrder] = useState<OrderDetailRow | null>(null)
  const [subOrders, setSubOrders] = useState<SubOrderRow[]>([])
  const [activeSubOrderId, setActiveSubOrderId] = useState<string | null>(null)
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
    termin: string | null
    lieferung: DeliveryChoice | null
    prioritaet: Priority
  }>({ termin: null, lieferung: null, prioritaet: 'NORMAL' })
  const { fehler: toastFehler } = useToast()
  const loadOrderRequestIdRef = useRef(0)

  const reloadFiles = useCallback(async () => {
    if (!activeOrderId) return
    try {
      const data = await fileService.getFilesByOrderId(activeOrderId)
      setFiles(data)
    } catch {
      setFiles([])
      toastFehler('Dateien konnten nicht geladen werden')
    }
  }, [activeOrderId, toastFehler])

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
      setActiveSubOrderId(null)
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
          setError('Auftrag nicht gefunden')
          toastFehler('Auftrag konnte nicht geladen werden')
          setOrder(null)
          setSubOrders([])
          setActiveSubOrderId(null)
          return
        }
        if (isStale()) return
        setOrder(orderData as OrderDetailRow)
        const subOrderList = subOrderResult
        setSubOrders(subOrderList)
        setActiveSubOrderId(currentId => {
          const visible = subOrderList.filter(subOrder => !subOrder.storniert)
          if (currentId && visible.some(subOrder => subOrder.id === currentId)) return currentId
          return visible[0]?.id ?? null
        })
      } catch (err) {
        if (isStale()) return
        setError(err instanceof Error ? err.message : String(err))
        toastFehler('Auftrag konnte nicht geladen werden')
        setOrder(null)
        setSubOrders([])
        setActiveSubOrderId(null)
      } finally {
        if (!isStale()) {
          setLoading(false)
        }
      }
    }

    void fetchData()
    return () => {}
  }, [activeOrderId, contextRefreshTick, toastFehler])

  useEffect(() => {
    if (!order) return
    const rawDeadline = order.termin
    const isoDate =
      rawDeadline && rawDeadline.length > 0
        ? rawDeadline.length > 10
          ? rawDeadline.slice(0, 10)
          : rawDeadline
        : ''
    // eslint-disable-next-line react-hooks/set-state-in-effect -- form mirrors server row
    setHeaderDeadline(isoDate)
    setHeaderDelivery(order.lieferung ?? '')
    setHeaderPriority(order.prioritaet)
    headerSnapshot.current = {
      termin: rawDeadline,
      lieferung: order.lieferung,
      prioritaet: order.prioritaet,
    }
  }, [order])

  const saveOrderHeader = useCallback(
    async (patch: Partial<Pick<OrderDetailRow, 'termin' | 'lieferung' | 'prioritaet'>>) => {
      if (!activeOrderId) return
      try {
        const updatedOrder = await orderService.updateOrder(activeOrderId, patch) as OrderDetailRow
        setOrder(updatedOrder)
        onOrderFromWorkArea(updatedOrder)
        onOrderCustomerLoaded(updatedOrder.kunden)
        headerSnapshot.current = {
          termin: updatedOrder.termin,
          lieferung: updatedOrder.lieferung,
          prioritaet: updatedOrder.prioritaet,
        }
      } catch {
        toastFehler('Auftrag konnte nicht gespeichert werden')
      }
    },
    [activeOrderId, onOrderFromWorkArea, onOrderCustomerLoaded, toastFehler]
  )

  const visibleSubOrders = useMemo(
    () => subOrders.filter(subOrder => !subOrder.storniert),
    [subOrders]
  )
  const activeSubOrder = useMemo((): SubOrderRow | null => {
    if (activeSubOrderId == null) return null
    return visibleSubOrders.find(subOrder => subOrder.id === activeSubOrderId) ?? null
  }, [visibleSubOrders, activeSubOrderId])

  useEffect(() => {
    const responsibleId = activeSubOrder?.verantwortlicher_id ?? null
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
  }, [activeSubOrder?.verantwortlicher_id])

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
    onOrderCustomerLoaded(order.kunden)
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
      setError('Nicht angemeldet')
      setSaving(false)
      return
    }
    const today = new Date()
    const deadlineIso = order.termin
      ? order.termin.length > 10
        ? order.termin.slice(0, 10)
        : order.termin
      : `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const priority = order.prioritaet
    const delivery = order.lieferung ?? 'ABHOLUNG'
    let data: SubOrderRow
    try {
      data = await subOrderService.createSubOrder({
        auftrag_id: activeOrderId,
        bereich,
        status: 'INCOMPLETE',
        prioritaet: priority,
        detail: {},
        termin: deadlineIso,
        lieferung: delivery,
        verantwortlicher_id: user.id,
        notfall_aktiv: false,
        notfall_begruendung: null,
        storniert: false,
        kundenfreigabe_erforderlich: false,
        kundenfreigabe_liegt_vor: false,
        kundenfreigabe_datei_id: null,
      })
    } catch (err) {
      setSaving(false)
      setError(err instanceof Error ? err.message : 'Fehler beim Erstellen')
      return
    }
    setSaving(false)
    setSubOrders(previous => {
      const sorted = [...previous, data].sort((a, b) =>
        a.id < b.id ? -1 : a.id > b.id ? 1 : 0
      )
      return sorted
    })
    setActiveSubOrderId(data.id)

    try {
      const statusResult = await orderService.synchronizeOrderStatus(order.id)
      setOrder(current => (current ? { ...current, status: statusResult.status } : current))
      onOrderUpdated({ ...order, status: statusResult.status })
    } catch {
      toastFehler('Auftragsstatus konnte nicht aktualisiert werden')
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
      <div className="work-area work-area--empty">
        <p className="wa-hint">Wählen Sie links einen Auftrag aus, um Details und Teilaufträge zu bearbeiten.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="work-area work-area--empty">
        <p className="wa-laden">Lädt Auftrag …</p>
      </div>
    )
  }

  if (error && !order) {
    return (
      <div className="work-area work-area--empty">
        <p className="wa-fehler">{error}</p>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="work-area work-area--empty">
        <p className="wa-hint">Auftrag nicht gefunden.</p>
      </div>
    )
  }

  const customerDisplayName = customerName(order.kunden)
  const trimDeadline = (dateString: string | null) => (dateString && dateString.length > 10 ? dateString.slice(0, 10) : dateString || '')
  const contactOneLine = customerContactOneLine(order.kunden)

  const priorityGlyph = (priority: Priority) => (priority === 'HOCH' ? '▲' : '●')

  return (
    <div className="work-area">
      <header
        className="work-area__header"
        style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px 12px',
              flexWrap: 'wrap',
              minWidth: 0,
            }}
          >
            <h1 className="work-area__kunde" style={{ margin: 0 }}>
              {customerDisplayName}
            </h1>
            <span className="work-area__ordersnummer">{order.auftragsnummer}</span>
            <button
              type="button"
              className="wa-gear"
              style={{ marginLeft: 0 }}
              onClick={onEditCustomer}
              title="Kunde bearbeiten"
              aria-label="Kunde bearbeiten"
            >
              <span className="wa-gear-ico" aria-hidden>
                ⚙
              </span>
            </button>
          </div>
          <div className="work-area__verantwortlich" aria-hidden style={{ flexShrink: 0, textAlign: 'right' }}>
            {responsibleName ?? ''}
          </div>
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

      {error && <p className="wa-fehler">{error}</p>}

      <section className="work-area__meta" aria-label="Auftrags-Meta">
        <label className="meta-pill" title="Termin">
          <span aria-hidden>📅</span>
          <DateInput
            value={headerDeadline}
            onChange={e => setHeaderDeadline(e.target.value)}
            onBlur={e => {
              const value = e.target.value || null
              const snapshotDeadline = trimDeadline(headerSnapshot.current.termin)
              if ((value || '') !== (snapshotDeadline || '')) {
                void saveOrderHeader({ termin: value })
              }
            }}
          />
        </label>
        <label className="meta-pill" title="Lieferung">
          <span aria-hidden>🚚</span>
          <select
            value={headerDelivery}
            onChange={e => {
              const value = e.target.value
              const deliveryValue: DeliveryChoice | null = value === 'ABHOLUNG' || value === 'VERSAND' ? value : null
              setHeaderDelivery(deliveryValue ?? '')
              if (deliveryValue !== headerSnapshot.current.lieferung) {
                void saveOrderHeader({ lieferung: deliveryValue })
              }
            }}
          >
            <option value="">—</option>
            <option value="ABHOLUNG">Abholung</option>
            <option value="VERSAND">Versand</option>
          </select>
        </label>
        <label className="meta-pill" title="Priorität">
          <span className="wa-prio-glyph" aria-hidden>
            {priorityGlyph(headerPriority)}
          </span>
          <select
            value={headerPriority}
            onChange={e => {
              const value = e.target.value
              if (value === 'NORMAL' || value === 'HOCH') {
                setHeaderPriority(value)
                if (value !== headerSnapshot.current.prioritaet) {
                  void saveOrderHeader({ prioritaet: value })
                }
              }
            }}
          >
            <option value="NORMAL">Normal</option>
            <option value="HOCH">Hoch</option>
          </select>
        </label>
      </section>

      <div className="work-area__tabs" role="tablist" aria-label="Teilaufträge">
        {visibleSubOrders.map(subOrder => {
          const isActive = subOrder.id === activeSubOrderId
          const abbreviation = departmentAbbreviation(subOrder.bereich)
          const tabTitle = `${subOrderDepartmentLabel(subOrder.bereich)} · ${subOrder.status}`
          return (
            <button
              key={subOrder.id}
              type="button"
              role="tab"
              className={isActive ? 'tab-btn tab-btn--active' : 'tab-btn'}
              aria-selected={isActive}
              onClick={() => setActiveSubOrderId(subOrder.id)}
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
          aria-label="Teilauftrag hinzufügen"
        >
          +
        </button>
      </div>

      <div className="work-area__formular" role="tabpanel">
        {activeSubOrder ? (
          <SubOrderDetail
            subOrder={activeSubOrder}
            orderStatus={order.status}
            orderDeadline={order.termin}
            orderDelivery={order.lieferung}
            orderPriority={order.prioritaet}
            orderCustomer={order.kunden}
            orderFiles={files}
            onUpdated={handleSubOrderUpdated}
          />
        ) : (
          <p className="wa-hint">Noch keine Teilaufträge. Nutzen Sie +, um einen Department anzulegen.</p>
        )}
      </div>

      <AddSubOrderOverlay
        open={overlayOpen}
        saving={saving}
        onDepartmentSelected={handleAddSubOrder}
        onClose={() => !saving && setOverlayOpen(false)}
      />
    </div>
  )
}
