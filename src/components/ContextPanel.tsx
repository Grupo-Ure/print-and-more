import { useEffect, useState } from 'react'
import { type HistoryEvent } from '../services/historyService'
import { subOrderService } from '../services/subOrderService'
import { subOrderProductService } from '../services/subOrderProductService'
import { stampService } from '../services/stampService'
import { generateAndDownloadPdf } from '../lib/pdf/orderPdf'
import {
  useSetOrderStatus,
  useArchiveOrder,
  useArchiveOrderWithCancelledSubOrders,
  useMarkOrderBilled,
  useDeleteOrder,
} from '../queries/orderQueries'
import {
  useSetSubOrderStatus,
  useReleaseToProduction,
  useSetSubOrderEmergency,
  useSetCustomerApproval,
  useCancelSubOrder,
  useDeleteSubOrder,
} from '../queries/subOrderQueries'
import {
  type Auftrag,
  type Customer,
  type SubOrderRow,
} from '../types/database'
import { subOrderDetailToFieldMap } from '../lib/utils'
import { FileList } from './FileList'
import type { FileRow } from '../services/fileService'
import { HistoryPanel } from './HistoryPanel'
import { StatusBadge } from './StatusBadge'
import { useToast } from './Toast'
import { isSubOrderComplete, resolveEffectiveSubOrder } from '../lib/subOrderShared'
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

function stockDisplayValue(stock: number | null): string {
  return stock === null ? '—' : String(stock)
}

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

  const setOrderStatusMutation = useSetOrderStatus()
  const archiveOrderMutation = useArchiveOrder()
  const cancelOrderMutation = useArchiveOrderWithCancelledSubOrders()
  const markBilledMutation = useMarkOrderBilled()
  const deleteOrderMutation = useDeleteOrder()
  const setSubStatusMutation = useSetSubOrderStatus()
  const releaseToProductionMutation = useReleaseToProduction()
  const setEmergencyMutation = useSetSubOrderEmergency()
  const setApprovalMutation = useSetCustomerApproval()
  const cancelSubMutation = useCancelSubOrder()
  const deleteSubMutation = useDeleteSubOrder()

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

  const handleStartProcessing = async () => {
    if (busy || order.status !== 'QUOTE') return
    setBusy(true)
    try {
      const updated = await setOrderStatusMutation.mutateAsync({
        id: order.id,
        status: 'INCOMPLETE',
        history: { event_type: 'PROCESSING_STARTED' },
      })
      onOrderUpdated({ ...order, status: updated.status })
    } catch {
      showError('Status could not be changed')
    } finally {
      setBusy(false)
    }
  }

  const handleArchive = async () => {
    if (busy) return
    if (!window.confirm('Archive order?\nIt will be hidden from the main list.')) return
    setBusy(true)
    try {
      await archiveOrderMutation.mutateAsync({ id: order.id })
      onOrderUpdated({ ...order, is_archived: true })
    } catch {
      showError('Status could not be changed')
    } finally {
      setBusy(false)
    }
  }

  const handleMarkInvoiced = async () => {
    if (busy) return
    if (!window.confirm('Mark order as invoiced?\nIt will be hidden from the list.')) return
    setBusy(true)
    try {
      await markBilledMutation.mutateAsync({ id: order.id })
      onOrderUpdated({ ...order, status: 'INVOICED', is_archived: true })
    } catch {
      showError('Status could not be changed')
    } finally {
      setBusy(false)
    }
  }

  const handleCancelOrder = async () => {
    if (busy) return
    if (
      !window.confirm(
        'Cancel order? All sub-orders will be cancelled and the order hidden.'
      )
    )
      return
    setBusy(true)
    try {
      await cancelOrderMutation.mutateAsync({ id: order.id })
      onOrderUpdated({ ...order, is_archived: true })
    } catch {
      showError('Status could not be changed')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteOrder = async () => {
    if (busy) return
    if (
      !window.confirm(
        'Permanently delete order?\nAll sub-orders and files will also be deleted.'
      )
    )
      return
    setBusy(true)
    try {
      await deleteOrderMutation.mutateAsync({ id: order.id })
      onOrderDeleted(order.id)
    } catch {
      showError('Status could not be changed')
    } finally {
      setBusy(false)
    }
  }

  const handleReleaseToPrepress = async () => {
    if (busy || !subOrder || subOrder.status !== 'INCOMPLETE') return
    if (order.status === 'QUOTE') {
      showError('Order must be started before releasing to PrePress')
      return
    }
    const products = await subOrderProductService.getProductsBySubOrderId(subOrder.id)
    const effective = resolveEffectiveSubOrder(subOrder, order)
    const isComplete = isSubOrderComplete(effective, effective.status, products.length > 0)
    if (!isComplete) {
      showError('Sub-order is not yet complete')
      return
    }
    setBusy(true)
    try {
      const data = await setSubStatusMutation.mutateAsync({
        id: subOrder.id,
        orderId: order.id,
        status: 'PREPRESS_READY',
        history: { event_type: 'PREPRESS_READY_MANUAL' },
      })
      onSubOrderUpdated(data)
      const pdfOk = await generateAndDownloadPdf(subOrder.id, order.id)
      if (!pdfOk) showError('PDF could not be generated')
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
      const data = await releaseToProductionMutation.mutateAsync({
        subOrder,
        orderId: order.id,
        orderNumber: order.order_number ?? null,
      })
      onSubOrderUpdated(data)
    } catch {
      showError('Status could not be changed')
    } finally {
      setBusy(false)
    }
  }

  const handleReleaseToProduction = () => {
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

  const handleMarkDone = async () => {
    if (busy || !subOrder || subOrder.status !== 'PRODUCTION_READY') return
    if (!window.confirm('Mark sub-order as done?')) return
    setBusy(true)
    try {
      const data = await setSubStatusMutation.mutateAsync({
        id: subOrder.id,
        orderId: order.id,
        status: 'DONE',
        history: { event_type: 'MARKED_DONE' },
      })
      onSubOrderUpdated(data)
    } catch {
      showError('Status could not be changed')
    } finally {
      setBusy(false)
    }
  }

  const handleOpenEmergency = () => {
    if (busy || !subOrder) return
    if (subOrder.status === 'QUOTE' || subOrder.status === 'DONE') return
    setEmergencyReason('')
    setEmergencyDialogOpen(true)
  }

  const handleConfirmEmergency = async () => {
    if (busy || !subOrder) return
    const reason = emergencyReason.trim()
    if (!reason) {
      showError('Please enter a reason')
      return
    }
    setBusy(true)
    setEmergencyDialogOpen(false)
    try {
      const data = await setEmergencyMutation.mutateAsync({
        id: subOrder.id,
        orderId: order.id,
        patch: { is_emergency: true, emergency_reason: reason },
        history: { event_type: 'EMERGENCY_TRIGGERED', reason },
      })
      onSubOrderUpdated(data)
    } catch {
      showError('Status could not be changed')
    } finally {
      setBusy(false)
    }
  }

  const handleRevertEmergency = async () => {
    if (busy || !subOrder || !subOrder.is_emergency) return
    setBusy(true)
    try {
      const data = await setEmergencyMutation.mutateAsync({
        id: subOrder.id,
        orderId: order.id,
        patch: { is_emergency: false, emergency_reason: null },
        history: { event_type: 'ROLLED_BACK' },
      })
      onSubOrderUpdated(data)
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
      // No CUSTOMER_APPROVAL_DEACTIVATED enum value exists; CUSTOMER_APPROVAL_EXPIRED is the closest match when disabling.
      const historyEvent: HistoryEvent = enabled ? 'CUSTOMER_APPROVAL_ACTIVATED' : 'CUSTOMER_APPROVAL_EXPIRED'
      const data = await setApprovalMutation.mutateAsync({
        id: subOrder.id,
        orderId: order.id,
        patch: approvalPatch,
        history: { event_type: historyEvent, meta: { active: enabled } },
      })
      onSubOrderUpdated(data)
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
      const data = await setApprovalMutation.mutateAsync({
        id: subOrder.id,
        orderId: order.id,
        patch: {
          customer_approval_granted: true,
          customer_approval_file_id: customerApprovalFileId,
        },
        history: { event_type: 'CUSTOMER_APPROVAL_GRANTED', meta: { datei_id: customerApprovalFileId } },
      })
      onSubOrderUpdated(data)
      showSuccess('Approval granted')
    } catch {
      showError('Status could not be changed')
    } finally {
      setBusy(false)
    }
  }

  const handleCancelSubOrder = async () => {
    if (!subOrder || cancelInProgress) return
    if (!window.confirm('Cancel sub-order? It will be hidden but not deleted.')) return
    setCancelInProgress(true)
    try {
      await cancelSubMutation.mutateAsync({ id: subOrder.id, orderId: order.id })
      onSubOrderRemoved(subOrder.id)
    } catch {
      showError('Status could not be changed')
    } finally {
      setCancelInProgress(false)
    }
  }

  const handleDeleteSubOrder = async () => {
    if (!subOrder || deleteInProgress || subOrder.status !== 'INCOMPLETE') return
    if (!window.confirm('Permanently delete sub-order?')) return
    setDeleteInProgress(true)
    try {
      await deleteSubMutation.mutateAsync({ id: subOrder.id, orderId: order.id })
      onSubOrderRemoved(subOrder.id)
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
    subOrder && subOrder.status !== 'QUOTE' && subOrder.status !== 'DONE' && !subOrder.is_emergency
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
              onClick={() => void handleStartProcessing()}
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
            <button type="button" className="cp-btn" disabled={busy} onClick={() => void handleMarkInvoiced()}>
              Mark as invoiced
            </button>
          )}
          {order.status !== 'INVOICED' && (
            <button type="button" className="cp-btn" disabled={busy} onClick={() => void handleArchive()}>
              Archive
            </button>
          )}
          {canCancelOrder && (
            <button
              type="button"
              className="cp-btn cp-btn-rot"
              disabled={busy}
              onClick={() => void handleCancelOrder()}
            >
              Cancel order
            </button>
          )}
          {canDeleteOrder && (
            <button
              type="button"
              className="cp-btn cp-btn-rot"
              disabled={busy}
              onClick={() => void handleDeleteOrder()}
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
                  onClick={() => void handleReleaseToPrepress()}
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
                    onClick={() => void handleReleaseToProduction()}
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
                    onClick={() => void handleMarkDone()}
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
                      if (!ok) showError('PDF could not be generated')
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
                  onClick={handleOpenEmergency}
                >
                  Emergency
                </button>
              )}
              {subOrder.is_emergency && (
                <button
                  type="button"
                  className="cp-btn"
                  disabled={busy}
                  onClick={() => void handleRevertEmergency()}
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
                onClick={() => void handleCancelSubOrder()}
              >
                Cancel sub-order
              </button>
              <button
                type="button"
                className="cp-btn cp-btn-rot"
                disabled={subOrder.status !== 'INCOMPLETE' || deleteInProgress}
                onClick={() => void handleDeleteSubOrder()}
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
                onClick={() => void handleConfirmEmergency()}
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
