import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../supabase'

export type DateiRolle = 'PRODUKTIONSDATEI' | 'VORSCHAU' | 'KUNDENFREIGABE' | 'REFERENZ'

export type Datei = {
  id: string
  anzeigename: string
  pfad: string
  rolle: DateiRolle
  erstellt_am: string
}

const ROLLEN: { value: DateiRolle; label: string }[] = [
  { value: 'PRODUKTIONSDATEI', label: 'Produktionsdatei' },
  { value: 'VORSCHAU', label: 'Vorschau / Mockup' },
  { value: 'KUNDENFREIGABE', label: 'Kundenfreigabe' },
  { value: 'REFERENZ', label: 'Referenz / Altstand' },
]

const ROLLE_ANZEIGE: Record<DateiRolle, string> = {
  PRODUKTIONSDATEI: 'Produktionsdatei',
  VORSCHAU: 'Vorschau / Mockup',
  KUNDENFREIGABE: 'Kundenfreigabe',
  REFERENZ: 'Referenz / Altstand',
}

type Props = {
  aktiverAuftragId: string
}

function useDateienState(auftragId: string) {
  const [dateien, setDateien] = useState<Datei[]>([])
  const [laden, setLaden] = useState(true)
  const reload = useCallback(async () => {
    setLaden(true)
    const { data, error } = await supabase
      .from('dateien')
      .select('id, anzeigename, pfad, rolle, erstellt_am')
      .eq('auftrag_id', auftragId)
      .order('erstellt_am', { ascending: true })
    if (error) {
      setDateien([])
    } else {
      setDateien((data ?? []) as Datei[])
    }
    setLaden(false)
  }, [auftragId])

  useEffect(() => {
    void reload()
  }, [reload])

  return { dateien, setDateien, laden, reload }
}

export function useDateienFuerAuftrag(auftragId: string) {
  const { dateien, laden, reload } = useDateienState(auftragId)
  return { dateien, laden, reload }
}

function RolleBadge({ rolle }: { rolle: DateiRolle }) {
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: '0.68rem',
        fontWeight: 500,
        padding: '0.12rem 0.4rem',
        borderRadius: 4,
        border: '1px solid var(--border)',
        color: 'var(--text-h)',
        background: 'var(--code-bg, rgba(0,0,0,0.04))',
        flexShrink: 0,
        maxWidth: '11rem',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
      title={ROLLE_ANZEIGE[rolle]}
    >
      {ROLLE_ANZEIGE[rolle]}
    </span>
  )
}

export function DateiListe({ aktiverAuftragId }: Props) {
  const { dateien, setDateien, laden } = useDateienState(aktiverAuftragId)
  const [anzeigename, setAnzeigename] = useState('')
  const [pfad, setPfad] = useState('')
  const [rolle, setRolle] = useState<DateiRolle>('PRODUKTIONSDATEI')
  const [fehler, setFehler] = useState<string | null>(null)
  const [speichert, setSpeichert] = useState(false)
  const [entferntId, setEntferntId] = useState<string | null>(null)

  const handleHinzufuegen = async (e: FormEvent) => {
    e.preventDefault()
    setFehler(null)
    const n = anzeigename.trim()
    const p = pfad.trim()
    if (!n || !p) {
      setFehler('Anzeigename und Pfad sind erforderlich.')
      return
    }
    setSpeichert(true)
    const { data, error } = await supabase
      .from('dateien')
      .insert({
        auftrag_id: aktiverAuftragId,
        anzeigename: n,
        pfad: p,
        rolle,
      })
      .select('id, anzeigename, pfad, rolle, erstellt_am')
      .single()
    setSpeichert(false)
    if (error) {
      setFehler(error.message)
      return
    }
    if (data) {
      const row = data as Datei
      setDateien(list => {
        const next = [...list, row].sort(
          (a, b) => new Date(a.erstellt_am).getTime() - new Date(b.erstellt_am).getTime()
        )
        return next
      })
      setAnzeigename('')
      setPfad('')
      setRolle('PRODUKTIONSDATEI')
    }
  }

  const handleEntfernen = async (id: string) => {
    setFehler(null)
    setEntferntId(id)
    const { error } = await supabase.from('dateien').delete().eq('id', id)
    setEntferntId(null)
    if (error) {
      setFehler(error.message)
      return
    }
    setDateien(list => list.filter(d => d.id !== id))
  }

  return (
    <div className="ber-lfp" style={{ maxWidth: '100%' }}>
      <h3 className="ber-h3">Dateien dieses Auftrags</h3>
      {fehler && <p className="ber-err">{fehler}</p>}

      <form onSubmit={handleHinzufuegen} style={{ marginBottom: '1rem' }}>
        <div className="ber-zeile">
          <label className="ber-lbl" htmlFor="dl-anzeigename">
            Anzeigename
          </label>
          <div>
            <input
              id="dl-anzeigename"
              className="ber-inp"
              value={anzeigename}
              onChange={e => setAnzeigename(e.target.value)}
              required
              maxLength={500}
            />
          </div>
        </div>
        <div className="ber-zeile">
          <label className="ber-lbl" htmlFor="dl-pfad">
            Pfad
          </label>
          <div>
            <input
              id="dl-pfad"
              className="ber-inp"
              value={pfad}
              onChange={e => setPfad(e.target.value)}
              required
              placeholder="\\\\server\\auftraege\\..."
              maxLength={2000}
            />
          </div>
        </div>
        <div className="ber-zeile">
          <label className="ber-lbl" htmlFor="dl-rolle">
            Rolle
          </label>
          <div>
            <select
              id="dl-rolle"
              className="ber-inp"
              value={rolle}
              onChange={e => setRolle(e.target.value as DateiRolle)}
              required
            >
              {ROLLEN.map(r => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="ber-zeile" style={{ alignItems: 'center' }}>
          <span className="ber-lbl" />
          <div>
            <button type="submit" className="wa-bereich-btn" disabled={speichert}>
              {speichert ? 'Wird hinzugefügt …' : 'Hinzufügen'}
            </button>
          </div>
        </div>
      </form>

      {laden ? (
        <p className="ber-hinweis" style={{ fontStyle: 'normal' }}>
          Lädt Dateien …
        </p>
      ) : dateien.length === 0 ? (
        <p className="ber-hinweis">
          Noch keine Dateien — Pfad und Name eintragen um eine Datei zu verknüpfen.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {dateien.map(d => (
            <li
              key={d.id}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '0.5rem 0.75rem',
                padding: '0.55rem 0',
                borderBottom: '1px solid var(--border)',
                fontSize: '0.9rem',
              }}
            >
              <span style={{ fontWeight: 600, color: 'var(--text-h)' }}>{d.anzeigename}</span>
              <RolleBadge rolle={d.rolle} />
              <span
                className="td-mono"
                style={{
                  flex: 1,
                  minWidth: '6rem',
                  fontSize: '0.78rem',
                  color: 'var(--text)',
                  opacity: 0.8,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={d.pfad}
              >
                {d.pfad}
              </span>
              <button
                type="button"
                className="wa-ghost-btn"
                onClick={() => void handleEntfernen(d.id)}
                disabled={entferntId === d.id}
                style={{ marginLeft: 'auto', flexShrink: 0 }}
              >
                {entferntId === d.id ? '…' : 'Entfernen'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
