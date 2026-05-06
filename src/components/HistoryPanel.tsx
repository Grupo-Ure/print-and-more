import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { teilauftragBereichLabel } from '../types/database'
import { useToast } from './Toast'
import './ContextPanel.css'

type Props = {
  activeOrderId: string
  contextRefreshTick: number
  subOrders: { id: string; bereich: string }[]
}

type HistoryRow = {
  id: string
  ereignisart: string
  begruendung: string | null
  meta: Record<string, unknown> | null
  erstellt_am: string
  teilauftrag_id: string | null
  person_id: string | null
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
    supabase
      .from('profile')
      .select('id, name')
      .then(({ data, error }) => {
        if (!alive) return
        if (error) {
          toastFehler('Mitarbeiterdaten konnten nicht geladen werden')
          return
        }
        const staffMap = new Map<string, string>()
        for (const staffMember of (data ?? []) as { id: string; name: string | null }[]) {
          staffMap.set(staffMember.id, staffMember.name ?? staffMember.id)
        }
        setStaffById(staffMap)
      })
    return () => {
      alive = false
    }
  }, [toastFehler])

  useEffect(() => {
    let alive = true
    void (async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('historie')
        .select('id, ereignisart, begruendung, meta, erstellt_am, teilauftrag_id, person_id')
        .eq('auftrag_id', activeOrderId)
        .order('erstellt_am', { ascending: false })
        .limit(50)
      if (!alive) return
      if (error) {
        toastFehler('Verlauf konnte nicht geladen werden')
        setEntries([])
      } else {
        setEntries((data ?? []) as HistoryRow[])
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
                  {department && <p className="cp-hist-tl">Teil: {teilauftragBereichLabel(department)}</p>}
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
