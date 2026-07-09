import { useEffect, useState } from 'react'
import { historyService, type HistoryRow } from '../services/historyService'
import { userService } from '../services/userService'
import { subOrderDepartmentLabel } from '../const/departmentAbbreviation'
import { useToast } from './Toast'
import './ContextPanel.css'

type Props = {
  activeOrderId: string
  contextRefreshTick: number
  subOrders: { id: string; department: string }[]
}


const EVENT_LABELS: Record<string, string> = {
  ORDER_CREATED: 'Order created',
  PROCESSING_STARTED: 'Processing started',
  PREPRESS_READY_AUTO: 'PrePress — automatic',
  PREPRESS_READY_MANUAL: 'PrePress — manual',
  PRODUCTION_READY_SET: 'Released to production',
  MARKED_DONE: 'Marked as done',
  EMERGENCY_TRIGGERED: 'Emergency triggered',
  CUSTOMER_APPROVAL_ACTIVATED: 'Customer approval activated',
  CUSTOMER_APPROVAL_GRANTED: 'Customer approval granted',
  CUSTOMER_APPROVAL_EXPIRED: 'Customer approval expired',
  CUSTOMER_APPROVAL_BYPASSED: 'Customer approval bypassed',
  ROLLED_BACK: 'Rolled back',
  ERP_EXPORTED: 'ERP exported',
  CANCELLED: 'Order cancelled',
}

function eventLabel(art: string): string {
  return EVENT_LABELS[art] ?? art.replace(/_/g, ' ')
}

function formatHistoryTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function HistoryPanel({ activeOrderId, contextRefreshTick, subOrders }: Props) {
  const { showError } = useToast()
  const [expanded, setExpanded] = useState(false)
  const [entries, setEntries] = useState<HistoryRow[]>([])
  const [staffById, setStaffById] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let alive = true
    userService.getUsers().then(
      users => {
        if (!alive) return
        const staffMap = new Map<string, string>()
        for (const user of users) {
          staffMap.set(user.id, user.name ?? user.id)
        }
        setStaffById(staffMap)
      },
      () => {
        if (alive) showError('Staff data could not be loaded')
      },
    )
    return () => {
      alive = false
    }
  }, [showError])

  useEffect(() => {
    let alive = true
    void (async () => {
      setLoading(true)
      try {
        const data = await historyService.getHistoryForOrder(activeOrderId)
        if (!alive) return
        setEntries(data)
      } catch {
        if (!alive) return
        showError('History could not be loaded')
        setEntries([])
      }
      if (alive) setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [activeOrderId, contextRefreshTick, showError])

  const subOrderDepartment = (subOrderId: string | null): string | null => {
    if (!subOrderId) return null
    return subOrders.find(subOrder => subOrder.id === subOrderId)?.department ?? null
  }

  return (
    <div className="cp-hist">
      <button
        type="button"
        className="cp-hist-btn"
        onClick={() => setExpanded(previous => !previous)}
        aria-expanded={expanded}
      >
        <span>History {expanded ? '▼' : '▶'}</span>
      </button>

      {expanded && (
        <div className="cp-hist-body">
          {loading && <p className="cp-hinweis" style={{ margin: '0.25rem 0' }}>Loading…</p>}
          {!loading && entries.length === 0 && (
            <p className="cp-hinweis" style={{ margin: '0.25rem 0' }}>
              No history entries yet
            </p>
          )}
          {!loading &&
            entries.map(entry => {
              const staffName = entry.user_id ? staffById.get(entry.user_id) : ''
              const department = subOrderDepartment(entry.sub_order_id)
              return (
                <div key={entry.id} className="cp-hist-eintrag">
                  <div className="cp-hist-zeile" title={eventLabel(entry.event_type)}>
                    <span className="cp-hist-time">{formatHistoryTime(entry.created_at)}</span>
                    <span className="cp-hist-evt">{eventLabel(entry.event_type)}</span>
                    <span className="cp-hist-who">{staffName || '—'}</span>
                  </div>
                  {entry.reason && <p className="cp-hist-sub">{entry.reason}</p>}
                  {department && <p className="cp-hist-tl">Sub-order: {subOrderDepartmentLabel(department)}</p>}
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
