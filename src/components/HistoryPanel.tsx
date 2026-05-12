import { useEffect, useState } from 'react'
import { historyService, type HistoryRow } from '../services/historyService'
import { employeeService } from '../services/employeeService'
import { subOrderDepartmentLabel } from '../const/departmentAbbreviation'
import { useToast } from './Toast'
import './ContextPanel.css'

type Props = {
  activeOrderId: string
  contextRefreshTick: number
  subOrders: { id: string; department: string }[]
}


const EVENT_LABELS: Record<string, string> = {
  ORDER_CREATED: 'Auftrag erstellt',
  PROCESSING_STARTED: 'In Bearbeitung genommen',
  PREPRESS_READY_AUTO: 'Prepress — automatisch',
  PREPRESS_READY_MANUAL: 'Prepress — manuell',
  PRODUCTION_READY_SET: 'Produktion freigegeben',
  MARKED_DONE: 'Als fertig gemeldet',
  EMERGENCY_TRIGGERED: 'Notfall ausgelöst',
  CUSTOMER_APPROVAL_ACTIVATED: 'Kundenfreigabe aktiviert',
  CUSTOMER_APPROVAL_GRANTED: 'Kundenfreigabe erteilt',
  CUSTOMER_APPROVAL_EXPIRED: 'Kundenfreigabe verfallen',
  CUSTOMER_APPROVAL_BYPASSED: 'Kundenfreigabe übergangen',
  ROLLED_BACK: 'Rücksprung',
  ERP_EXPORTED: 'ERP exportiert',
  CANCELLED: 'Auftrag storniert',
}

function eventLabel(art: string): string {
  return EVENT_LABELS[art] ?? art.replace(/_/g, ' ')
}

function formatHistoryTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function HistoryPanel({ activeOrderId, contextRefreshTick, subOrders }: Props) {
  const { fehler: toastFehler } = useToast()
  const [expanded, setExpanded] = useState(false)
  const [entries, setEntries] = useState<HistoryRow[]>([])
  const [staffById, setStaffById] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let alive = true
    employeeService.getAllProfiles().then(
      profiles => {
        if (!alive) return
        const staffMap = new Map<string, string>()
        for (const profile of profiles) {
          staffMap.set(profile.id, profile.name ?? profile.id)
        }
        setStaffById(staffMap)
      },
      () => {
        if (alive) toastFehler('Mitarbeiterdaten konnten nicht geladen werden')
      },
    )
    return () => {
      alive = false
    }
  }, [toastFehler])

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
        toastFehler('Verlauf konnte nicht geladen werden')
        setEntries([])
      }
      if (alive) setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [activeOrderId, contextRefreshTick, toastFehler])

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
        <span>Verlauf {expanded ? '▼' : '▶'}</span>
      </button>

      {expanded && (
        <div className="cp-hist-body">
          {loading && <p className="cp-hinweis" style={{ margin: '0.25rem 0' }}>Lädt …</p>}
          {!loading && entries.length === 0 && (
            <p className="cp-hinweis" style={{ margin: '0.25rem 0' }}>
              Noch keine Einträge im Verlauf
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
                  {department && <p className="cp-hist-tl">Teil: {subOrderDepartmentLabel(department)}</p>}
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
