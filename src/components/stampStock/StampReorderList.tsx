import { useCallback, useEffect, useMemo, useState } from 'react'
import { jobService } from '../../services/jobService'
import { stampService } from '../../services/stampService'
import { departmentProductService } from '../../services/departmentProductService'
import { errorToString } from '../../lib/errorToString'
import { useToast } from '../Toast'
import { colorLabel, typeLabel, type OrderListRow } from './stampStockShared'

export function StampReorderList() {
  const { showError } = useToast()

  const [orderListRows, setOrderListRows] = useState<OrderListRow[]>([])
  const [orderListLoading, setOrderListLoading] = useState(true)
  const [orderListError, setOrderListError] = useState<string | null>(null)
  const [orderListCopied, setOrderListCopied] = useState(false)

  const fetchOrderList = useCallback(async () => {
    try {
      const activeModels = await stampService.getStampModels()
      const allJobs = await jobService.getActiveJobsByBereich('STAMP')
      const activeJobIds = allJobs
        .filter(job => job.status !== 'DONE' && !job.is_cancelled)
        .map(job => job.id)

      const activeModelIds = new Set(activeModels.map(model => model.id))
      const modelUsage = await departmentProductService.getStampModelUsageByJobs(activeJobIds)

      const demandByModelId = new Map<string, number>()
      for (const { modelId, quantity } of modelUsage) {
        if (!activeModelIds.has(modelId)) continue
        demandByModelId.set(modelId, (demandByModelId.get(modelId) ?? 0) + quantity)
      }

      const orderRows: OrderListRow[] = []
      for (const model of activeModels) {
        const openQuantity = demandByModelId.get(model.id) ?? 0
        const orderQuantity = Math.max(0, model.min_stock + openQuantity - model.stock)
        if (orderQuantity <= 0) continue
        orderRows.push({ ...model, openQuantity, orderQuantity })
      }
      orderRows.sort((firstRow, secondRow) => secondRow.orderQuantity - firstRow.orderQuantity)
      setOrderListRows(orderRows)
      setOrderListError(null)
    } catch (error) {
      showError('Data could not be loaded')
      setOrderListRows([])
      setOrderListError(errorToString(error))
    } finally {
      setOrderListLoading(false)
    }
  }, [showError])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- imperative fetch-on-mount, kept from the pre-split page; react-query migration is a follow-up
    void fetchOrderList()
  }, [fetchOrderList])

  const refreshOrderList = () => {
    setOrderListLoading(true)
    setOrderListError(null)
    void fetchOrderList()
  }

  const orderListClipboardText = useMemo(() => {
    const header = 'Article number | Name | Colour | Quantity'
    const body = orderListRows
      .map(orderRow => `${orderRow.article_number ?? '—'} | ${orderRow.name} | ${colorLabel(orderRow.color)} | ${orderRow.orderQuantity}`)
      .join('\n')
    return body ? `${header}\n${body}` : header
  }, [orderListRows])

  const copyOrderList = async () => {
    try {
      await navigator.clipboard.writeText(orderListClipboardText)
      setOrderListCopied(true)
      window.setTimeout(() => setOrderListCopied(false), 2000)
    } catch {
      showError('Copy failed')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <button
          type="button"
          className="cp-btn cp-btn-grau"
          onClick={refreshOrderList}
          disabled={orderListLoading}
        >
          Refresh
        </button>
        <button
          type="button"
          className="cp-btn"
          onClick={() => void copyOrderList()}
          disabled={orderListLoading || orderListRows.length === 0}
        >
          Copy
        </button>
        {orderListCopied && (
          <span style={{ fontSize: 13, color: '#15803d' }}>Copied to clipboard</span>
        )}
      </div>

      {orderListError && <p style={{ color: '#b91c1c' }}>{orderListError}</p>}
      {orderListLoading && <p style={{ opacity: 0.8 }}>Loading…</p>}

      {!orderListLoading && !orderListError && orderListRows.length === 0 && (
        <p style={{ margin: '12px 0', color: '#15803d', fontWeight: 600 }}>
          All in stock — no reorder needed
        </p>
      )}

      {orderListRows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '8px 6px' }}>Name</th>
                <th style={{ padding: '8px 6px' }}>Article number</th>
                <th style={{ padding: '8px 6px' }}>Type</th>
                <th style={{ padding: '8px 6px' }}>Colour</th>
                <th style={{ padding: '8px 6px' }}>Stock</th>
                <th style={{ padding: '8px 6px' }}>Open orders</th>
                <th style={{ padding: '8px 6px' }}>Min. stock</th>
                <th style={{ padding: '8px 6px' }}>Order</th>
              </tr>
            </thead>
            <tbody>
              {orderListRows.map(orderRow => (
                <tr key={orderRow.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 6px', fontWeight: 600 }}>{orderRow.name}</td>
                  <td style={{ padding: '8px 6px' }}>{orderRow.article_number ?? '—'}</td>
                  <td style={{ padding: '8px 6px', opacity: 0.9 }}>{typeLabel(orderRow.type)}</td>
                  <td style={{ padding: '8px 6px', opacity: 0.9 }}>{colorLabel(orderRow.color)}</td>
                  <td style={{ padding: '8px 6px' }}>{orderRow.stock}</td>
                  <td style={{ padding: '8px 6px' }}>{orderRow.openQuantity}</td>
                  <td style={{ padding: '8px 6px' }}>{orderRow.min_stock}</td>
                  <td
                    style={{
                      padding: '8px 6px',
                      fontWeight: 700,
                      color: '#b91c1c',
                    }}
                  >
                    {orderRow.orderQuantity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
