import { useCallback, useEffect, useMemo, useState } from 'react'
import { jobService } from '../../services/jobService'
import { stampService } from '../../services/stampService'
import { jobDetailToFieldMap } from '../../lib/utils'
import { cellText } from '../../lib/cellText'
import { errorToString } from '../../lib/errorToString'
import { toInteger, toNonNegativeInteger } from '../../lib/integers'
import { useToast } from '../Toast'
import type { Json } from '../../types/supabase'
import {
  colorLabel,
  parseJobQuantity,
  typeLabel,
  type OrderListRow,
} from './stampStockShared'

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
      const jobData = allJobs.filter(s => s.status !== 'DONE' && !s.is_cancelled)

      const modelIdSet = new Set(activeModels.map(model => model.id))
      const demandByModelId = new Map<string, number>()

      // Legacy job-detail JSONB: these are stored data keys, do not rename.
      for (const jobItem of (jobData ?? []) as { detail: Json }[]) {
        const fields = jobDetailToFieldMap(jobItem.detail)
        const quantity = parseJobQuantity(fields.stueckzahl)
        const modelId = fields.modell_id != null && String(fields.modell_id).trim() !== '' ? String(fields.modell_id) : null
        const cushionModelId = fields.kissen_modell_id != null && String(fields.kissen_modell_id).trim() !== '' ? String(fields.kissen_modell_id) : null
        if (modelId && modelIdSet.has(modelId)) {
          demandByModelId.set(modelId, (demandByModelId.get(modelId) ?? 0) + quantity)
        }
        if (cushionModelId && modelIdSet.has(cushionModelId)) {
          demandByModelId.set(cushionModelId, (demandByModelId.get(cushionModelId) ?? 0) + quantity)
        }
      }

      const orderRows: OrderListRow[] = []
      for (const model of activeModels) {
        const openQuantity = toInteger(demandByModelId.get(model.id))
        const stockLevel = toInteger(model.stock)
        const minimumStock = toInteger(model.min_stock)
        const orderQuantity = Math.max(0, minimumStock + openQuantity - stockLevel)
        if (orderQuantity <= 0) continue
        orderRows.push({
          ...model,
          openQuantity,
          orderQuantity: toInteger(orderQuantity),
        })
      }
      orderRows.sort((a, b) => b.orderQuantity - a.orderQuantity)
      setOrderListRows(orderRows)
      setOrderListError(null)
    } catch (e) {
      showError('Data could not be loaded')
      setOrderListRows([])
      setOrderListError(errorToString(e))
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
      .map(orderRow => {
        const art = cellText(orderRow.article_number, '—')
        const name = cellText(orderRow.name, '—')
        const colorValue = typeof orderRow.color === 'string' ? orderRow.color : null
        return `${art} | ${name} | ${colorLabel(colorValue)} | ${toNonNegativeInteger(orderRow.orderQuantity)}`
      })
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
              {orderListRows.map(orderRow => {
                const typeStr = typeof orderRow.type === 'string' ? orderRow.type : cellText(orderRow.type, '')
                const colorValue = typeof orderRow.color === 'string' ? orderRow.color : null
                return (
                <tr key={String(orderRow.id)} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 6px', fontWeight: 600 }}>{cellText(orderRow.name, '—')}</td>
                  <td style={{ padding: '8px 6px' }}>{cellText(orderRow.article_number, '—')}</td>
                  <td style={{ padding: '8px 6px', opacity: 0.9 }}>{typeLabel(typeStr)}</td>
                  <td style={{ padding: '8px 6px', opacity: 0.9 }}>{colorLabel(colorValue)}</td>
                  <td style={{ padding: '8px 6px' }}>{toNonNegativeInteger(orderRow.stock)}</td>
                  <td style={{ padding: '8px 6px' }}>{toNonNegativeInteger(orderRow.openQuantity)}</td>
                  <td style={{ padding: '8px 6px' }}>{toNonNegativeInteger(orderRow.min_stock)}</td>
                  <td
                    style={{
                      padding: '8px 6px',
                      fontWeight: 700,
                      color: '#b91c1c',
                    }}
                  >
                    {toNonNegativeInteger(orderRow.orderQuantity)}
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
