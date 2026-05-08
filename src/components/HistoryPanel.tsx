import { useEffect, useState } from 'react'
import { historyService, type HistoryRow } from '../services/historyService'
import { employeeService } from '../services/employeeService'
import { subOrderDepartmentLabel } from '../types/database'
import { useToast } from './Toast'
import './ContextPanel.css'

type Props = {
  activeOrderId: string
  contextRefreshTick: number
  subOrders: { id: string; bereich: string }[]
}


const EVENT_LABELS: Record<string, string> = {
  AUFTRAG_ERSTELLT: 'Auftrag erstellt',
  IN_BEARBEITUNG_GENOMMEN: 'In Bearbeitung genommen',
  PREPRESS_BEREIT_AUTO: 'Prepress — automatisch',
  PREPRESS_BEREIT_MANUELL: 'Prepress — manuell',
  PRODUKTION_BEREIT_GESETZT: 'Produktion freigegeben',
  FERTIG_GEMELDET: 'Als fertig gemeldet',
  NOTFALL_AUSGELOEST: 'Notfall ausgelöst',
  KUNDENFREIGABE_AKTIVIERT: 'Kundenfreigabe aktiviert',
  KUNDENFREIGABE_ERTEILT: 'Kundenfreigabe erteilt',
  KUNDENFREIGABE_VERFALLEN: 'Kundenfreigabe verfallen',
  KUNDENFREIGABE_UEBERGANGEN: 'Kundenfreigabe übergangen',
  RUECKSPRUNG: 'Rücksprung',
  ERP_EXPORTIERT: 'ERP exportiert',
  STORNIERT: 'Auftrag storniert',
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
    return subOrders.find(subOrder => subOrder.id === subOrderId)?.bereich ?? null
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
              const staffName = entry.person_id ? staffById.get(entry.person_id) : ''
              const department = subOrderDepartment(entry.teilauftrag_id)
              return (
                <div key={entry.id} className="cp-hist-eintrag">
                  <div className="cp-hist-zeile" title={eventLabel(entry.ereignisart)}>
                    <span className="cp-hist-time">{formatHistoryTime(entry.erstellt_am)}</span>
                    <span className="cp-hist-evt">{eventLabel(entry.ereignisart)}</span>
                    <span className="cp-hist-who">{staffName || '—'}</span>
                  </div>
                  {entry.begruendung && <p className="cp-hist-sub">{entry.begruendung}</p>}
                  {department && <p className="cp-hist-tl">Teil: {subOrderDepartmentLabel(department)}</p>}
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
