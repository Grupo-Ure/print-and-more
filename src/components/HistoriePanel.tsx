import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { teilauftragBereichLabel } from '../types/database'

type Props = {
  aktiverAuftragId: string
  kontextAktualisiert: number
  teilauftraege: { id: string; bereich: string }[]
}

type HistorieZeile = {
  id: string
  ereignisart: string
  begruendung: string | null
  meta: Record<string, unknown> | null
  erstellt_am: string
  teilauftrag_id: string | null
  person_id: string | null
}

type MitarbeiterZeile = {
  id: string
  email: string
}

const EREIGNIS_LABEL: Record<string, string> = {
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
}

function ereignisLabel(art: string): string {
  return EREIGNIS_LABEL[art] ?? art.replace(/_/g, ' ')
}

function formatZeitstempel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function HistoriePanel({ aktiverAuftragId, kontextAktualisiert, teilauftraege }: Props) {
  const [geoefnet, setGeoefnet] = useState(false)
  const [eintraege, setEintraege] = useState<HistorieZeile[]>([])
  const [mitarbeiterById, setMitarbeiterById] = useState<Map<string, string>>(new Map())
  const [laden, setLaden] = useState(false)

  useEffect(() => {
    supabase
      .from('mitarbeiter')
      .select('id, email')
      .then(({ data, error }) => {
        if (error) {
          console.error(error)
          return
        }
        const m = new Map<string, string>()
        for (const z of (data ?? []) as MitarbeiterZeile[]) {
          m.set(z.id, z.email)
        }
        setMitarbeiterById(m)
      })
  }, [])

  const ladeHistorie = useCallback(async () => {
    setLaden(true)
    const { data, error } = await supabase
      .from('historie')
      .select('id, ereignisart, begruendung, meta, erstellt_am, teilauftrag_id, person_id')
      .eq('auftrag_id', aktiverAuftragId)
      .order('erstellt_am', { ascending: false })
      .limit(50)
    if (error) {
      console.error(error)
      setEintraege([])
    } else {
      setEintraege((data ?? []) as HistorieZeile[])
    }
    setLaden(false)
  }, [aktiverAuftragId])

  useEffect(() => {
    void ladeHistorie()
  }, [ladeHistorie, kontextAktualisiert])

  const teilBereich = (teilId: string | null): string | null => {
    if (!teilId) return null
    return teilauftraege.find(t => t.id === teilId)?.bereich ?? null
  }

  return (
    <div
      style={{
        marginTop: '1rem',
        borderTop: '1px solid var(--border, #e5e5e5)',
        paddingTop: '0.75rem',
      }}
    >
      <button
        type="button"
        onClick={() => setGeoefnet(o => !o)}
        aria-expanded={geoefnet}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '0.35rem 0',
          border: 'none',
          background: 'transparent',
          font: 'inherit',
          fontSize: '0.9rem',
          fontWeight: 600,
          cursor: 'pointer',
          color: 'var(--text, #333)',
          textAlign: 'left',
        }}
      >
        <span>Verlauf</span>
        <span aria-hidden style={{ fontSize: '0.75rem', opacity: 0.7 }}>
          {geoefnet ? '▼' : '▶'}
        </span>
      </button>

      {geoefnet && (
        <div style={{ marginTop: '0.5rem' }}>
          {laden && <p className="wa-hint" style={{ margin: '0.25rem 0' }}>Lädt …</p>}
          {!laden && eintraege.length === 0 && (
            <p className="wa-hint" style={{ margin: '0.25rem 0' }}>
              Noch keine Einträge im Verlauf
            </p>
          )}
          {!laden &&
            eintraege.map(e => {
              const email = e.person_id ? mitarbeiterById.get(e.person_id) : undefined
              const tb = teilBereich(e.teilauftrag_id)
              return (
                <div
                  key={e.id}
                  style={{
                    padding: '0.5rem 0',
                    borderBottom: '1px solid var(--border, #eee)',
                    fontSize: '0.8125rem',
                  }}
                >
                  <div style={{ color: 'var(--text)', opacity: 0.85 }}>{formatZeitstempel(e.erstellt_am)}</div>
                  <div style={{ marginTop: 2, fontWeight: 500 }}>{ereignisLabel(e.ereignisart)}</div>
                  {email && (
                    <div style={{ marginTop: 2, fontSize: '0.8rem', fontFamily: 'var(--mono, monospace)' }}>
                      {email}
                    </div>
                  )}
                  {e.begruendung && (
                    <div style={{ marginTop: 4, fontStyle: 'italic', color: 'var(--text)', opacity: 0.9 }}>
                      {e.begruendung}
                    </div>
                  )}
                  {tb && (
                    <div style={{ marginTop: 4, fontSize: '0.8rem', color: 'var(--text)', opacity: 0.85 }}>
                      Teilauftrag: {teilauftragBereichLabel(tb)}
                    </div>
                  )}
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
