import { useEffect, useState } from 'react'
import { authService } from '../services/authService'
import { historyService, type HistoryEvent } from '../services/historyService'
import { orderService } from '../services/orderService'
import { subOrderService } from '../services/subOrderService'
import { stampService } from '../services/stampService'
import { textileService } from '../services/textileService'
import { textileMasterDataService } from '../services/textileMasterDataService'
import { generateAndDownloadPdf } from '../lib/pdf/orderPdf'
import {
  type Auftrag,
  type Customer,
  type OrderStatus,
  type SubOrderRow,
} from '../types/database'
import { subOrderDetailToFieldMap } from '../lib/utils'
import { FileList } from './FileList'
import type { FileRow } from '../services/fileService'
import { HistoryPanel } from './HistoryPanel'
import { StatusBadge } from './StatusBadge'
import { useToast } from './Toast'
import { isSubOrderComplete } from '../lib/subOrderShared'
import { useOrderWorkspace } from '../context/order.context'
import './ContextPanel.css'

type Props = {
  order: Auftrag | null
  activeSubOrder: SubOrderRow | null
  orderCustomer: Customer | null
  orderFiles: FileRow[]
  onOrderUpdated: (updatedOrder: Auftrag) => void
  onOrderDeleted: (auftragId: string) => void
  onSubOrderUpdated: (updatedSubOrder: SubOrderRow) => void
  onSubOrderRemoved: (id: string) => void
  contextRefreshTick: number
  onFileChanged?: (newFileRow?: FileRow) => void | Promise<void>
}

function nextEmergencyStatus(status: OrderStatus): OrderStatus {
  if (status === 'INVOICED') return status
  if (status === 'INCOMPLETE') return 'PREPRESS_READY'
  if (status === 'PREPRESS_READY') return 'PRODUCTION_READY'
  if (status === 'PRODUCTION_READY') return 'DONE'
  return status
}

function hasStampModelLinked(detail: Record<string, unknown>): boolean {
  const padModelId = detail.kissen_modell_id
  const stampModelId = detail.modell_id
  return !!(padModelId && String(padModelId).trim()) || !!(stampModelId && String(stampModelId).trim())
}

function isStampStockCritical(
  stampStock: number | null,
  padStock: number | null
): boolean {
  return (
    (stampStock !== null && stampStock === 0) ||
    (padStock !== null && padStock === 0)
  )
}

function completionBlockedHint(
  stampStock: number | null,
  padStock: number | null
): string {
  const stampIsZero = stampStock !== null && stampStock === 0
  const padIsZero = padStock !== null && padStock === 0
  if (stampIsZero && padIsZero) {
    return 'Cannot mark done — stamp and pad stock are 0'
  }
  if (stampIsZero) return 'Cannot mark done — stamp stock is 0'
  if (padIsZero) return 'Cannot mark done — pad stock is 0'
  return ''
}

function productionStockModalTitle(
  stampStock: number | null,
  padStock: number | null
): string {
  const stampIsZero = stampStock !== null && stampStock === 0
  const padIsZero = padStock !== null && padStock === 0
  if (stampIsZero && padIsZero) return 'Warning: Stamp and pad stock are 0'
  if (stampIsZero) return 'Warning: Stamp stock is 0'
  if (padIsZero) return 'Warning: Pad stock is 0'
  return 'Warning: Stock is 0'
}

type StampPadStock = { stampStock: number | null; padStock: number | null }

/** Anzeige im Status: Zahl oder „—“ bei unbekannt (z. B. Ladefehler). */
function stockDisplayValue(stock: number | null): string {
  return stock === null ? '—' : String(stock)
}

/**
 * Lädt Stempel- und/oder Kissen-`bestand` je nach verknüpftem Modell, Farbe und Auftragstyp.
 */
async function loadStampStock(detail: Record<string, unknown>): Promise<StampPadStock> {
  const hasStampModel = detail.modell_id && String(detail.modell_id).trim()
  const hasPadModel = detail.kissen_modell_id && String(detail.kissen_modell_id).trim()
  const colorValue = detail.farbe
  const colorSet = colorValue != null && String(colorValue).trim() !== ''

  async function fetchStockById(id: string): Promise<number | null> {
    const row = await stampService.getStampModelById(id).catch(() => null)
    if (!row) return null
    return row.stock ?? 0
  }

  if (hasPadModel && !hasStampModel) {
    const padStockValue = await fetchStockById(String(detail.kissen_modell_id))
    return { stampStock: null, padStock: padStockValue }
  }

  let stampStockValue: number | null = null
  let padStockValue: number | null = null

  if (hasStampModel) {
    stampStockValue = await fetchStockById(String(detail.modell_id))
    if (colorSet) {
      const stampModelRow = await stampService.getStampModelForOrder(String(detail.modell_id)).catch(() => null)
      if (stampModelRow) {
        const articleNumber = stampModelRow.replacement_pad_article_number?.trim() || null
        if (articleNumber) {
          const padRow = await stampService.findReplacementPad(articleNumber, String(colorValue)).catch(() => null)
          padStockValue = padRow ? (padRow.stock ?? 0) : 0
        }
      }
    }
  }

  return { stampStock: stampStockValue, padStock: padStockValue }
}

export function ContextPanel({
  order,
  activeSubOrder,
  orderCustomer,
  orderFiles,
  onOrderUpdated,
  onOrderDeleted,
  onSubOrderUpdated,
  onSubOrderRemoved,
  contextRefreshTick,
  onFileChanged = async () => {},
}: Props) {
  const { openCustomerDialog } = useOrderWorkspace()
  const [busy, setBusy] = useState(false)
  const [subOrderAreaList, setSubOrderAreaList] = useState<{ id: string; department: string }[]>([])
  const [cancelInProgress, setCancelInProgress] = useState(false)
  const [deleteInProgress, setDeleteInProgress] = useState(false)
  const [emergencyDialogOpen, setEmergencyDialogOpen] = useState(false)
  const [emergencyReason, setEmergencyReason] = useState('')
  const [dialogCustomerApprovalFile, setDialogCustomerApprovalFile] = useState(false)
  const [customerApprovalFileId, setCustomerApprovalFileId] = useState('')
  const [stampStock, setStampStock] = useState<number | null>(null)
  const [padStock, setPadStock] = useState<number | null>(null)
  const [productionStockZeroDialogOpen, setProductionStockZeroDialogOpen] = useState(false)
  const { showError, showSuccess } = useToast()

  useEffect(() => {
    if (!activeSubOrder || activeSubOrder.department !== 'STAMP') {
      setStampStock(null)
      setPadStock(null)
      return
    }
    const stampDetail = subOrderDetailToFieldMap(activeSubOrder.detail)
    let alive = true
    void loadStampStock(stampDetail)
      .then(stockResult => {
        if (alive) {
          setStampStock(stockResult.stampStock)
          setPadStock(stockResult.padStock)
        }
      })
      .catch((err: unknown) => console.error(err))
    return () => {
      alive = false
    }
  }, [activeSubOrder, contextRefreshTick])

  useEffect(() => {
    if (!order) {
      setSubOrderAreaList([])
      return
    }
    let alive = true
    void (async () => {
      try {
        const summaries = await subOrderService.getSubOrderSummariesForOrder(order.id).catch(() => null)
        if (!alive) return
        if (!summaries) {
          showError('Data could not be loaded')
          setSubOrderAreaList([])
          return
        }
        setSubOrderAreaList(summaries)
      } catch (err: unknown) {
        if (alive) console.error(err)
      }
    })()
    return () => {
      alive = false
    }
  }, [order, contextRefreshTick, showError])

  if (!order) {
    return (
      <div className="cp" style={{ padding: 0 }}>
        <p className="cp-hinweis">Select an order on the left.</p>
      </div>
    )
  }

  const subOrder = activeSubOrder
  const subOrderActive = subOrder && !subOrder.is_cancelled
  const canDeleteOrder = order.status === 'QUOTE' || order.status === 'INCOMPLETE'
  const canCancelOrder = order.status !== 'QUOTE' && order.status !== 'INCOMPLETE'

  const handleInBearbeitung = async () => {
    if (busy || order.status !== 'QUOTE') return
    setBusy(true)
    try {
      await orderService.setOrderStatus(order.id, 'INCOMPLETE')
      await historyService.writeHistory({
        order_id: order.id,
        event_type: 'PROCESSING_STARTED',
      })
      const updated = await orderService.synchronizeOrderStatus(order.id)
      onOrderUpdated({ ...order, status: updated.status })
    } catch {
      showError('Status could not be changed')
    } finally {
      setBusy(false)
    }
  }

  const handleArchiv = async () => {
    if (busy) return
    if (!window.confirm('Archive order?\nIt will be hidden from the main list.')) return
    setBusy(true)
    try {
      await orderService.archiveOrder(order.id)
      onOrderUpdated({ ...order, is_archived: true })
    } catch {
      showError('Status could not be changed')
    } finally {
      setBusy(false)
    }
  }

  const handleAbrechnen = async () => {
    if (busy) return
    if (!window.confirm('Mark order as invoiced?\nIt will be hidden from the list.')) return
    setBusy(true)
    try {
      await orderService.markOrderBilled(order.id)
      await historyService.writeHistory({
        order_id: order.id,
        event_type: 'MARKED_DONE',
        meta: { abgerechnet_auftrag: true },
      })
      onOrderUpdated({ ...order, status: 'INVOICED', is_archived: true })
    } catch {
      showError('Status could not be changed')
    } finally {
      setBusy(false)
    }
  }

  const handleAuftragStornieren = async () => {
    if (busy) return
    if (
      !window.confirm(
        'Cancel order? All sub-orders will be cancelled and the order hidden.'
      )
    )
      return
    setBusy(true)
    try {
      await orderService.archiveOrderWithCancelledSubOrders(order.id)
      await historyService.writeHistory({ order_id: order.id, event_type: 'CANCELLED' })
      onOrderUpdated({ ...order, is_archived: true })
    } catch {
      showError('Status could not be changed')
    } finally {
      setBusy(false)
    }
  }

  const handleAuftragLoeschen = async () => {
    if (busy) return
    if (
      !window.confirm(
        'Permanently delete order?\nAll sub-orders and files will also be deleted.'
      )
    )
      return
    setBusy(true)
    try {
      await orderService.deleteOrder(order.id)
      onOrderDeleted(order.id)
    } catch {
      showError('Status could not be changed')
    } finally {
      setBusy(false)
    }
  }

  const syncOrderStatusAfterSubOrderAction = async () => {
    const updated = await orderService.synchronizeOrderStatus(order.id)
    onOrderUpdated({ ...order, status: updated.status })
  }

  const handlePrepressFrei = async () => {
    if (busy || !subOrder || subOrder.status !== 'INCOMPLETE') return
    if (order.status === 'QUOTE') {
      showError('Order must be started before releasing to PrePress')
      return
    }
    const isComplete = isSubOrderComplete(subOrder, subOrder.status)
    if (!isComplete) {
      showError('Sub-order is not yet complete')
      return
    }
    setBusy(true)
    try {
      const data = await subOrderService.setSubOrderStatus(subOrder.id, 'PREPRESS_READY')
      await historyService.writeHistory({
        order_id: order.id,
        sub_order_id: subOrder.id,
        event_type: 'PREPRESS_READY_MANUAL',
      })
      onSubOrderUpdated(data as SubOrderRow)
      const pdfOk = await generateAndDownloadPdf(subOrder.id, order.id)
      if (!pdfOk) showError('PDF could not be generated')
      await syncOrderStatusAfterSubOrderAction()
    } catch {
      showError('Status could not be changed')
    } finally {
      setBusy(false)
    }
  }

  const executeProductionRelease = async () => {
    if (busy || !subOrder || subOrder.status !== 'PREPRESS_READY') return
    if (subOrder.customer_approval_required && !subOrder.customer_approval_granted) return
    setBusy(true)
    try {
      // Stempel: Automatischer Lagerabgang (vor Status-Update).
      if (subOrder.department === 'STAMP') {
        const stampDetail = subOrderDetailToFieldMap(subOrder.detail)
        const rawQuantity = stampDetail.stueckzahl
        const parsedQuantity =
          typeof rawQuantity === 'number'
            ? rawQuantity
            : typeof rawQuantity === 'string' && rawQuantity.trim() !== ''
              ? parseInt(rawQuantity, 10)
              : 1
        const quantity = Number.isFinite(parsedQuantity) && parsedQuantity >= 1 ? Math.floor(parsedQuantity) : 1

        const stampNote = 'Automatic on production release ' + (order.order_number ?? '')

        const bookStampStockDeduction = async (modelId: string, quantity: number, note: string) => {
          const modelRow = await stampService.getStampModelById(modelId)
          if (!modelRow) return
          const currentStock = modelRow.stock ?? 0
          if (currentStock <= 0) return
          const newStock = Math.max(0, currentStock - quantity)
          await stampService.updateStampModelStock(modelId, newStock)
          const user = await authService.getUser()
          await stampService.createStockMovement({
            model_id: modelId,
            quantity,
            type: 'AUTOABGANG',
            note,
            user_id: user?.id ?? null,
          })
        }

        if (subOrder.type === 'TRODAT_KISSEN' && stampDetail.kissen_modell_id) {
          await bookStampStockDeduction(String(stampDetail.kissen_modell_id), quantity, stampNote)
        } else if (stampDetail.modell_id) {
          const stampId = String(stampDetail.modell_id)
          await bookStampStockDeduction(stampId, quantity, stampNote)

          const stampColor = stampDetail.farbe
          if (stampColor != null && String(stampColor).trim() !== '') {
            const stampModelRow = await stampService.getStampModelForOrder(stampId)
            if (stampModelRow) {
              const articleNumber = stampModelRow.replacement_pad_article_number?.trim() || null
              if (articleNumber) {
                const padRow = await stampService.findReplacementPad(articleNumber, String(stampColor))
                if (padRow) {
                  const padCurrentStock = padRow.stock ?? 0
                  if (padCurrentStock > 0) {
                    await bookStampStockDeduction(padRow.id, quantity, stampNote + ' (Pad for stamp)')
                  }
                }
              }
            }
          }
        }
      }

      // Textil: Automatischer Lagerabgang (vor Status-Update).
      if (subOrder.department === 'TEXTILE') {
        const textileNote = 'Automatic on production release ' + (order.order_number ?? '')
        const user = await authService.getUser()
        const userId = user?.id ?? null

        const positionList = await textileService.getEigenwarePositionsBySubOrder(subOrder.id)

        for (const position of positionList) {
          const variantId = position.variant_id ? String(position.variant_id) : ''
          if (!variantId) continue
          const quantity = Number.isFinite(position.quantity) && position.quantity >= 1 ? Math.floor(position.quantity) : 1

          const variantRow = await textileMasterDataService.getVariantStockById(variantId)
          const currentStock = variantRow?.stock ?? 0
          if (currentStock <= 0) continue

          const newStock = Math.max(0, currentStock - quantity)
          await textileMasterDataService.updateVariantStock(variantId, newStock)
          await textileMasterDataService.createTextileStockMovement({
            variant_id: variantId,
            quantity: quantity,
            type: 'AUTOABGANG',
            note: textileNote,
            user_id: userId,
          })
        }
      }

      const data = await subOrderService.setSubOrderStatus(subOrder.id, 'PRODUCTION_READY')

      try {
        await historyService.writeHistory({
          order_id: order.id,
          sub_order_id: subOrder.id,
          event_type: 'PRODUCTION_READY_SET',
        })
      } catch {
        console.error('History production-released failed')
      }

      onSubOrderUpdated(data)
      await syncOrderStatusAfterSubOrderAction()
    } catch {
      showError('Status could not be changed')
    } finally {
      setBusy(false)
    }
  }

  const handleProduktionFrei = () => {
    if (busy || !subOrder || subOrder.status !== 'PREPRESS_READY') return
    if (subOrder.customer_approval_required && !subOrder.customer_approval_granted) return
    if (subOrder.department === 'STAMP') {
      if (isStampStockCritical(stampStock, padStock)) {
        setProductionStockZeroDialogOpen(true)
        return
      }
    }
    void executeProductionRelease()
  }

  const handleFertigMelden = async () => {
    if (busy || !subOrder || subOrder.status !== 'PRODUCTION_READY') return
    if (!window.confirm('Mark sub-order as done?')) return
    setBusy(true)
    try {
      const data = await subOrderService.setSubOrderStatus(subOrder.id, 'DONE')
      await historyService.writeHistory({
        order_id: order.id,
        sub_order_id: subOrder.id,
        event_type: 'MARKED_DONE',
      })
      onSubOrderUpdated(data)
      await syncOrderStatusAfterSubOrderAction()
    } catch {
      showError('Status could not be changed')
    } finally {
      setBusy(false)
    }
  }

  const handleNotfallOeffnen = () => {
    if (busy || !subOrder) return
    if (subOrder.status === 'QUOTE' || subOrder.status === 'DONE') return
    setEmergencyReason('')
    setEmergencyDialogOpen(true)
  }

  const handleNotfallBestaetigt = async () => {
    if (busy || !subOrder) return
    const reason = emergencyReason.trim()
    if (!reason) {
      showError('Please enter a reason')
      return
    }
    const nextStatus = nextEmergencyStatus(subOrder.status)
    if (nextStatus === subOrder.status) {
      setEmergencyDialogOpen(false)
      return
    }
    setBusy(true)
    setEmergencyDialogOpen(false)
    try {
      const data = await subOrderService.setSubOrderEmergency(subOrder.id, {
        status: nextStatus,
        is_emergency: true,
        emergency_reason: reason,
      })
      await historyService.writeHistory({
        order_id: order.id,
        sub_order_id: subOrder.id,
        event_type: 'EMERGENCY_TRIGGERED',
        reason: reason,
      })
      onSubOrderUpdated(data)
      await syncOrderStatusAfterSubOrderAction()
    } catch {
      showError('Status could not be changed')
    } finally {
      setBusy(false)
    }
  }

  const handleNotfallZurueck = async () => {
    if (busy || !subOrder || !subOrder.is_emergency) return
    setBusy(true)
    try {
      const data = await subOrderService.setSubOrderEmergency(subOrder.id, {
        status: 'INCOMPLETE',
        is_emergency: false,
        emergency_reason: null,
      })
      await historyService.writeHistory({
        order_id: order.id,
        sub_order_id: subOrder.id,
        event_type: 'ROLLED_BACK',
      })
      onSubOrderUpdated(data)
      await syncOrderStatusAfterSubOrderAction()
    } catch {
      showError('Status could not be changed')
    } finally {
      setBusy(false)
    }
  }

  const handleCustomerApprovalToggle = async (enabled: boolean) => {
    if (busy || !subOrder) return
    if (subOrder.status === 'QUOTE') return
    setBusy(true)
    try {
      const approvalPatch = enabled
        ? { customer_approval_required: true }
        : {
            customer_approval_required: false,
            customer_approval_granted: false,
            customer_approval_file_id: null,
          }
      const data = await subOrderService.setCustomerApproval(subOrder.id, approvalPatch)
      // DB-Enum hat kein KUNDENFREIGABE_DEAKTIVIERT; bei Abschaltung der Anforderung VERFALLEN als nächstliegender Wert.
      const historyEvent: HistoryEvent = enabled ? 'CUSTOMER_APPROVAL_ACTIVATED' : 'CUSTOMER_APPROVAL_EXPIRED'
      await historyService.writeHistory({
        order_id: order.id,
        sub_order_id: subOrder.id,
        event_type: historyEvent,
        meta: { aktiv: enabled } as unknown as Record<string, unknown>,
      })
      onSubOrderUpdated(data)
      await syncOrderStatusAfterSubOrderAction()
    } catch {
      showError('Status could not be changed')
    } finally {
      setBusy(false)
    }
  }

  const handleCustomerApprovalFileOpen = () => {
    if (busy || !subOrder) return
    setCustomerApprovalFileId(orderFiles[0]?.id ?? '')
    setDialogCustomerApprovalFile(true)
  }

  const handleCustomerApprovalFileConfirmed = async () => {
    if (busy || !subOrder || !customerApprovalFileId) return
    setBusy(true)
    setDialogCustomerApprovalFile(false)
    try {
      const data = await subOrderService.setCustomerApproval(subOrder.id, {
        customer_approval_granted: true,
        customer_approval_file_id: customerApprovalFileId,
      })
      await historyService.writeHistory({
        order_id: order.id,
        sub_order_id: subOrder.id,
        event_type: 'CUSTOMER_APPROVAL_GRANTED',
        meta: { datei_id: customerApprovalFileId } as unknown as Record<string, unknown>,
      })
      onSubOrderUpdated(data)
      await syncOrderStatusAfterSubOrderAction()
      showSuccess('Approval granted')
    } catch {
      showError('Status could not be changed')
    } finally {
      setBusy(false)
    }
  }

  const handleStorno = async () => {
    if (!subOrder || cancelInProgress) return
    if (!window.confirm('Cancel sub-order? It will be hidden but not deleted.')) return
    setCancelInProgress(true)
    try {
      await subOrderService.cancelSubOrder(subOrder.id)
      onSubOrderRemoved(subOrder.id)
      try {
        await syncOrderStatusAfterSubOrderAction()
      } catch {
        showError('Status could not be changed')
      }
    } catch {
      showError('Status could not be changed')
    } finally {
      setCancelInProgress(false)
    }
  }

  const handleLoeschen = async () => {
    if (!subOrder || deleteInProgress || subOrder.status !== 'INCOMPLETE') return
    if (!window.confirm('Permanently delete sub-order?')) return
    setDeleteInProgress(true)
    try {
      await subOrderService.deleteSubOrder(subOrder.id)
      onSubOrderRemoved(subOrder.id)
      try {
        await syncOrderStatusAfterSubOrderAction()
      } catch {
        showError('Status could not be changed')
      }
    } catch {
      showError('Status could not be changed')
    } finally {
      setDeleteInProgress(false)
    }
  }

  const prodDisabled =
    !!subOrder && subOrder.status === 'PREPRESS_READY' && subOrder.customer_approval_required && !subOrder.customer_approval_granted
  const currentStampDetail = subOrder? subOrderDetailToFieldMap(subOrder.detail) : {}
  const completionBlockedByStock =
    !!subOrder &&
    subOrder.department === 'STAMP' &&
    subOrder.status === 'PRODUCTION_READY' &&
    hasStampModelLinked(currentStampDetail) &&
    isStampStockCritical(stampStock, padStock)
  const emergencyVisible =
    subOrder && subOrder.status !== 'QUOTE' && subOrder.status !== 'DONE' && nextEmergencyStatus(subOrder.status) !== subOrder.status
  const customerApprovalGrantVisible =
    !!subOrder &&
    subOrder.customer_approval_required &&
    !subOrder.customer_approval_granted &&
    orderFiles.length > 0

  const hints: string[] = []
  if (subOrder && subOrder.customer_approval_required && !subOrder.customer_approval_granted) {
    hints.push('Customer approval missing — production blocked')
  }
  if (subOrder?.is_emergency) {
    hints.push(`Emergency active: ${subOrder.emergency_reason ?? '—'}`)
  }
  if (subOrder && subOrder.status === 'PREPRESS_READY' && !subOrder.customer_approval_required) {
    hints.push('Ready for production release')
  }
  if (order.status === 'DONE') {
    hints.push('Order completed')
  }

  return (
    <div className="cp">
      <div className="cp-sektion">
        <h2>Status</h2>
        <div className="cp-status-komp">
          {subOrder && (
            <div className="cp-st-zeile">
              <StatusBadge status={subOrder.status} />
            </div>
          )}
          {subOrder?.is_emergency && (
            <div className="cp-st-notfall">
              <span className="badge badge-rot cp-badge-lg">!! EMERGENCY !!</span>
              {subOrder.emergency_reason && (
                <p className="cp-hinweis cp-hinweis--komp">{subOrder.emergency_reason}</p>
              )}
            </div>
          )}
          {subOrder?.department === 'STAMP' && hasStampModelLinked(currentStampDetail) && (
            <p className="cp-hinweis cp-hinweis--komp" style={{ marginTop: 6 }}>
              Stock: Stamp {stockDisplayValue(stampStock)} · Pad {stockDisplayValue(padStock)}
            </p>
          )}
        </div>
      </div>
      {(() => {
        if (!orderCustomer) return null
        const street = orderCustomer.street?.trim()
        const houseNumber = orderCustomer.house_number?.trim()
        const postalCode = orderCustomer.postal_code?.trim()
        const city = orderCustomer.city?.trim()
        const addressLine1 = [street, houseNumber].filter(Boolean).join(' ')
        const addressLine2 = [postalCode, city].filter(Boolean).join(' ')
        if (!addressLine1 && !addressLine2) return null
        return (
          <div className="cp-sektion">
            <h2>Customer</h2>
            {addressLine1 ? (
              <p className="cp-hinweis cp-hinweis--komp" style={{ margin: '0 0 4px' }}>
                {addressLine1}
              </p>
            ) : null}
            {addressLine2 ? <p className="cp-hinweis cp-hinweis--komp" style={{ margin: 0 }}>{addressLine2}</p> : null}
          </div>
        )
      })()}
      <div className="cp-sektion">
        <h2>Actions</h2>
        <div className="cp-gruppe">
          {order.status === 'QUOTE' && (
            <button
              type="button"
              className="cp-btn"
              disabled={busy}
              onClick={() => void handleInBearbeitung()}
            >
              Start processing
            </button>
          )}
          {order.status === 'QUOTE' && (
            <button
              type="button"
              className="cp-btn"
              disabled={busy}
              onClick={() => openCustomerDialog(orderCustomer)}
            >
              Edit customer
            </button>
          )}
          {order.status === 'DONE' && (
            <button type="button" className="cp-btn" disabled={busy} onClick={() => void handleAbrechnen()}>
              Mark as invoiced
            </button>
          )}
          {order.status !== 'INVOICED' && (
            <button type="button" className="cp-btn" disabled={busy} onClick={() => void handleArchiv()}>
              Archive
            </button>
          )}
          {canCancelOrder && (
            <button
              type="button"
              className="cp-btn cp-btn-rot"
              disabled={busy}
              onClick={() => void handleAuftragStornieren()}
            >
              Cancel order
            </button>
          )}
          {canDeleteOrder && (
            <button
              type="button"
              className="cp-btn cp-btn-rot"
              disabled={busy}
              onClick={() => void handleAuftragLoeschen()}
            >
              Delete order
            </button>
          )}
        </div>

        {subOrderActive && (
          <>
            <div className="cp-gruppe-trenn" />
            <div className="cp-gruppe">
              {subOrder.status === 'INCOMPLETE' && order.status !== 'QUOTE' && (
                <button
                  type="button"
                  className="cp-btn"
                  disabled={busy}
                  onClick={() => void handlePrepressFrei()}
                >
                  Release to PrePress
                </button>
              )}
              {subOrder.status === 'PREPRESS_READY' && (
                <>
                  <button
                    type="button"
                    className="cp-btn"
                    disabled={busy || prodDisabled}
                    onClick={() => void handleProduktionFrei()}
                  >
                    Release to Production
                  </button>
                  {prodDisabled && <p className="cp-sublabel">Customer approval missing</p>}
                </>
              )}
              {subOrder.status === 'PRODUCTION_READY' && (
                <>
                  <button
                    type="button"
                    className="cp-btn"
                    disabled={busy || completionBlockedByStock}
                    onClick={() => void handleFertigMelden()}
                  >
                    Mark as done
                  </button>
                  {completionBlockedByStock && (
                    <p className="cp-sublabel">
                      {completionBlockedHint(stampStock, padStock)}
                    </p>
                  )}
                </>
              )}
              {subOrderActive && subOrder.status !== 'QUOTE' && (
                <button
                  type="button"
                  className="cp-btn cp-btn-grau"
                  disabled={busy}
                  onClick={() =>
                    void (async () => {
                      const ok = await generateAndDownloadPdf(subOrder.id, order.id)
                      if (!ok) showError('PDF konnte nicht erstellt werden')
                    })()
                  }
                >
                  Download PDF
                </button>
              )}
            </div>
            <div className="cp-gruppe-trenn" />
            <div className="cp-gruppe">
              {emergencyVisible && (
                <button
                  type="button"
                  className="cp-btn cp-btn-rot"
                  disabled={busy}
                  onClick={handleNotfallOeffnen}
                >
                  Emergency
                </button>
              )}
              {subOrder.is_emergency && (
                <button
                  type="button"
                  className="cp-btn"
                  disabled={busy}
                  onClick={() => void handleNotfallZurueck()}
                >
                  Cancel emergency
                </button>
              )}
              {subOrder.status !== 'QUOTE' && (
                <label className="cp-toggle">
                  <input
                    type="checkbox"
                    checked={subOrder.customer_approval_required}
                    disabled={busy}
                    onChange={e => void handleCustomerApprovalToggle(e.target.checked)}
                  />
                  <span>Customer approval required</span>
                </label>
              )}
              {customerApprovalGrantVisible && (
                <button type="button" className="cp-btn" disabled={busy} onClick={handleCustomerApprovalFileOpen}>
                  Grant customer approval
                </button>
              )}
            </div>
            <div className="cp-gruppe-trenn" />
            <div className="cp-gruppe cp-gruppe--admin">
              <button
                type="button"
                className="cp-btn cp-btn-grau"
                disabled={cancelInProgress}
                onClick={() => void handleStorno()}
              >
                Cancel sub-order
              </button>
              <button
                type="button"
                className="cp-btn cp-btn-rot"
                disabled={subOrder.status !== 'INCOMPLETE' || deleteInProgress}
                onClick={() => void handleLoeschen()}
              >
                Delete sub-order
              </button>
              {subOrder.status !== 'INCOMPLETE' && (
                <p className="cp-sublabel">Only deletable in Incomplete status</p>
              )}
            </div>
          </>
        )}
        {order && (
          <FileList
            activeOrderId={order.id}
            files={orderFiles}
            filesLoading={false}
            onFileChanged={onFileChanged}
          />
        )}
      </div>

      {hints.length > 0 && (
        <div className="cp-sektion">
          <h2>Notes</h2>
          {hints.map((hint, i) => (
            <p key={i} className="cp-hinweis">
              {hint}
            </p>
          ))}
        </div>
      )}

      <div className="cp-sektion">
        <div className="cp-gruppe" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className="cp-btn cp-btn-grau"
            onClick={() => window.open('/stamp-stock', '_blank')}
            title="Open stamp stock management"
          >
            Stamp stock ↗
          </button>
          <button
            type="button"
            className="cp-btn cp-btn-grau"
            onClick={() => window.open('/textile-stock', '_blank')}
            title="Open textile stock"
          >
            Textile stock ↗
          </button>
        </div>
      </div>

      <HistoryPanel
        activeOrderId={order.id}
        contextRefreshTick={contextRefreshTick}
        subOrders={subOrderAreaList}
      />

      {emergencyDialogOpen && subOrder && (
        <div
          className="cp-modal-bg"
          role="dialog"
          aria-modal="true"
          aria-label="Emergency"
        >
          <div className="cp-modal">
            <h3>Emergency</h3>
            <p className="cp-hinweis">Reason (required). Status will be advanced one step.</p>
            <textarea
              className="cp-textarea"
              rows={3}
              value={emergencyReason}
              onChange={e => setEmergencyReason(e.target.value)}
              placeholder="Reason…"
            />
            <div className="cp-modal-bar">
              <button type="button" className="cp-btn" onClick={() => setEmergencyDialogOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="cp-btn"
                disabled={!emergencyReason.trim() || busy}
                onClick={() => void handleNotfallBestaetigt()}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {productionStockZeroDialogOpen && subOrder && (
        <div
          className="cp-modal-bg"
          role="dialog"
          aria-modal="true"
          aria-label="Stock"
        >
          <div className="cp-modal">
            <h3>{productionStockModalTitle(stampStock, padStock)}</h3>
            <p className="cp-hinweis">Release to production anyway?</p>
            <div className="cp-modal-bar">
              <button type="button" className="cp-btn" onClick={() => setProductionStockZeroDialogOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="cp-btn"
                disabled={busy}
                onClick={() => {
                  setProductionStockZeroDialogOpen(false)
                  void executeProductionRelease()
                }}
              >
                Release anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {dialogCustomerApprovalFile && subOrder && (
        <div
          className="cp-modal-bg"
          role="dialog"
          aria-modal="true"
          aria-label="Customer approval"
        >
          <div className="cp-modal">
            <h3>Grant customer approval</h3>
            <p className="cp-hinweis">Select file:</p>
            <select
              className="cp-select"
              value={customerApprovalFileId}
              onChange={e => setCustomerApprovalFileId(e.target.value)}
            >
              {orderFiles.map(d => (
                <option key={d.id} value={d.id}>
                  {d.display_name}
                </option>
              ))}
            </select>
            <div className="cp-modal-bar">
              <button type="button" className="cp-btn" onClick={() => setDialogCustomerApprovalFile(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="cp-btn"
                disabled={!customerApprovalFileId || busy}
                onClick={() => void handleCustomerApprovalFileConfirmed()}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
