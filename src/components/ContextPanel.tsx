import { useEffect, useState } from 'react'
import { jobService } from '../services/jobService'
import { stampService } from '../services/stampService'
import {
  useSetOrderStatus,
  useMarkOrderBilled,
} from '../queries/orderQueries'
import {
  useSetCustomerApproval,
} from '../queries/jobQueries'
import {
  type Auftrag,
  type Customer,
  type JobRow,
} from '../types/database'
import { jobDetailToFieldMap } from '../lib/utils'
import { FileList } from './FileList'
import type { FileRow } from '../services/fileService'
import { HistoryPanel } from './HistoryPanel'
import { useToast } from './Toast'
import { useConfirm } from './ConfirmDialog'
import { useOrderWorkspace } from '../context/order.context'
import './ContextPanel.css'

type Props = {
  order: Auftrag | null
  activeJob: JobRow | null
  orderCustomer: Customer | null
  orderFiles: FileRow[]
  onOrderUpdated: (updatedOrder: Auftrag) => void
  onOrderDeleted: (auftragId: string) => void
  onJobUpdated: (updatedJob: JobRow) => void
  onJobRemoved: (id: string) => void
  contextRefreshTick: number
  onFileChanged?: (newFileRow?: FileRow) => void | Promise<void>
}

function hasStampModelLinked(detail: Record<string, unknown>): boolean {
  const padModelId = detail.kissen_modell_id
  const stampModelId = detail.modell_id
  return !!(padModelId && String(padModelId).trim()) || !!(stampModelId && String(stampModelId).trim())
}

type StampPadStock = { stampStock: number | null; padStock: number | null }

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
  activeJob,
  orderCustomer,
  orderFiles,
  onOrderUpdated,
  onOrderDeleted,
  onJobUpdated,
  onJobRemoved,
  contextRefreshTick,
  onFileChanged = async () => {},
}: Props) {
  const { openCustomerDialog } = useOrderWorkspace()
  const [busy, setBusy] = useState(false)
  const [jobAreaList, setJobAreaList] = useState<{ id: string; department: string }[]>([])
  const [dialogCustomerApprovalFile, setDialogCustomerApprovalFile] = useState(false)
  const [customerApprovalFileId, setCustomerApprovalFileId] = useState('')
  const [stampStock, setStampStock] = useState<number | null>(null)
  const [padStock, setPadStock] = useState<number | null>(null)
  const { showError, showSuccess } = useToast()
  const confirm = useConfirm()

  const setOrderStatusMutation = useSetOrderStatus()
  const markBilledMutation = useMarkOrderBilled()
  const setApprovalMutation = useSetCustomerApproval()

  useEffect(() => {
    if (!activeJob || activeJob.department !== 'STAMP') {
      setStampStock(null)
      setPadStock(null)
      return
    }
    const stampDetail = jobDetailToFieldMap(activeJob.detail)
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
  }, [activeJob, contextRefreshTick])

  useEffect(() => {
    if (!order) {
      setJobAreaList([])
      return
    }
    let alive = true
    void (async () => {
      try {
        const summaries = await jobService.getJobSummariesForOrder(order.id).catch(() => null)
        if (!alive) return
        if (!summaries) {
          showError('Data could not be loaded')
          setJobAreaList([])
          return
        }
        setJobAreaList(summaries)
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

  const job = activeJob
  const jobActive = job && !job.is_cancelled
  const handleStartProcessing = async () => {
    if (busy || order.status !== 'QUOTE') return
    setBusy(true)
    try {
      const updated = await setOrderStatusMutation.mutateAsync({
        id: order.id,
        status: 'IN_PROGRESS',
        history: { event_type: 'PROCESSING_STARTED' },
      })
      onOrderUpdated({ ...order, status: updated.status })
    } catch {
      showError('Status could not be changed')
    } finally {
      setBusy(false)
    }
  }

  const handleMarkInvoiced = async () => {
    if (busy) return
    const confirmed = await confirm({
      title: 'Mark order as invoiced?',
      description: 'It will be hidden from the list.',
      confirmLabel: 'Mark invoiced',
    })
    if (!confirmed) return
    setBusy(true)
    try {
      await markBilledMutation.mutateAsync({ id: order.id })
      onOrderUpdated({ ...order, status: 'BILLED', is_archived: true })
    } catch {
      showError('Status could not be changed')
    } finally {
      setBusy(false)
    }
  }

  const handleCustomerApprovalFileOpen = () => {
    if (busy || !job) return
    setCustomerApprovalFileId(orderFiles[0]?.id ?? '')
    setDialogCustomerApprovalFile(true)
  }

  const handleCustomerApprovalFileConfirmed = async () => {
    if (busy || !job || !customerApprovalFileId) return
    setBusy(true)
    setDialogCustomerApprovalFile(false)
    try {
      const data = await setApprovalMutation.mutateAsync({
        id: job.id,
        orderId: order.id,
        patch: {
          customer_approval_granted: true,
          customer_approval_file_id: customerApprovalFileId,
        },
        history: { event_type: 'CUSTOMER_APPROVAL_GRANTED', meta: { datei_id: customerApprovalFileId } },
      })
      onJobUpdated(data)
      showSuccess('Approval granted')
    } catch {
      showError('Status could not be changed')
    } finally {
      setBusy(false)
    }
  }

  const currentStampDetail = job ? jobDetailToFieldMap(job.detail) : {}
  const customerApprovalGrantVisible =
    !!job &&
    job.customer_approval_required &&
    !job.customer_approval_granted &&
    orderFiles.length > 0

  const hints: string[] = []
  if (job && job.customer_approval_required && !job.customer_approval_granted) {
    hints.push('Customer approval missing — production blocked')
  }
  if (job && job.status === 'PREPRESS' && !job.customer_approval_required) {
    hints.push('Ready for production release')
  }
  if (order.status === 'FINISHED') {
    hints.push('Order completed')
  }

  return (
    <div className="cp">
      <div className="cp-sektion">
        <h2>Status</h2>
        <div className="cp-status-komp">
          {job?.department === 'STAMP' && hasStampModelLinked(currentStampDetail) && (
            <p className="cp-hinweis cp-hinweis--komp" style={{ marginTop: 6 }}>
              Stock: Stamp {stampStock ?? '—'} · Pad {padStock ?? '—'}
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
          {order.status === 'FINISHED' && (
            <button type="button" className="cp-btn" disabled={busy} onClick={() => void handleMarkInvoiced()}>
              Mark as invoiced
            </button>
          )}
        </div>

        {jobActive && (
          <>
            {customerApprovalGrantVisible && (
              <>
                <div className="cp-gruppe-trenn" />
                <div className="cp-gruppe">
                  <button type="button" className="cp-btn" disabled={busy} onClick={handleCustomerApprovalFileOpen}>
                    Grant customer approval
                  </button>
                </div>
              </>
            )}
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

      <HistoryPanel
        activeOrderId={order.id}
        contextRefreshTick={contextRefreshTick}
        jobs={jobAreaList}
      />

      {dialogCustomerApprovalFile && job && (
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
