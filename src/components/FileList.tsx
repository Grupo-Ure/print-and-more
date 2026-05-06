import { useCallback, useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import { useToast } from './Toast'

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

const ROLLE_KURZ: Record<DateiRolle, string> = {
  PRODUKTIONSDATEI: 'Produkt.',
  VORSCHAU: 'Vorschau',
  KUNDENFREIGABE: 'Freigabe',
  REFERENZ: 'Referenz',
}

type Props = {
  activeOrderId: string
  files: Datei[]
  filesLoading: boolean
  onFileChanged: (neueDatei?: Datei) => void | Promise<void>
}

export function FileList({ activeOrderId, files, filesLoading, onFileChanged }: Props) {
  const laden = filesLoading
  const { erfolg } = useToast()
  const [anzeigename, setAnzeigename] = useState('')
  const [pfad, setPfad] = useState('')
  const [rolle, setRolle] = useState<DateiRolle>('PRODUKTIONSDATEI')
  const [fehler, setFehler] = useState<string | null>(null)
  const [speichert, setSpeichert] = useState(false)
  const [entferntId, setEntferntId] = useState<string | null>(null)
  const [formOffen, setFormOffen] = useState(false)

  const openParentFolder = useCallback(
    async (rawPfad: string) => {
      const p = (rawPfad ?? '').trim()
      if (!p) return
      const norm = p.replace(/\\/g, '/').replace(/\/+$/g, '')
      const idx = norm.lastIndexOf('/')
      const parentPath = idx > 0 ? norm.slice(0, idx) : norm
      try {
        window.location.href = 'file://' + parentPath
      } catch {
        try {
          await navigator.clipboard.writeText(p)
          erfolg('Pfad in Zwischenablage kopiert')
        } catch {
          // Clipboard kann im Browser blockiert sein
        }
      }
    },
    [erfolg],
  )

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
        auftrag_id: activeOrderId,
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
      setAnzeigename('')
      setPfad('')
      setRolle('PRODUKTIONSDATEI')
      setFormOffen(false)
      void onFileChanged(data as Datei)
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
    void onFileChanged()
  }

  return (
    <div className="wa-dl">
      <div className="wa-dl-top">
        <h3 className="wa-dl-titel">Dateien</h3>
        <button
          type="button"
          className="wa-dl-add"
          onClick={() => setFormOffen(o => !o)}
        >
          {formOffen ? 'Abbrechen' : '+ Hinzufügen'}
        </button>
      </div>
      {fehler && <p className="wa-dl-err">{fehler}</p>}

      {formOffen && (
        <form onSubmit={e => void handleHinzufuegen(e)} className="wa-dl-form">
          <div className="wa-dl-formzeile">
            <input
              className="ber-inp"
              value={anzeigename}
              onChange={e => setAnzeigename(e.target.value)}
              placeholder="Anzeigename"
              required
              maxLength={500}
              aria-label="Anzeigename"
            />
            <input
              className="ber-inp"
              value={pfad}
              onChange={e => setPfad(e.target.value)}
              required
              placeholder="Pfad (UNC …)"
              maxLength={2000}
              title={pfad}
              aria-label="Pfad"
            />
            <select
              className="ber-inp wa-dl-rolle"
              value={rolle}
              onChange={e => setRolle(e.target.value as DateiRolle)}
              required
              aria-label="Rolle"
            >
              {ROLLEN.map(r => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <button type="submit" className="wa-dl-submit" disabled={speichert} title="Hinzufügen">
              {speichert ? '…' : '+'}
            </button>
          </div>
        </form>
      )}

      {laden ? (
        <p className="ber-hinweis" style={{ fontStyle: 'normal', fontSize: 12, margin: '4px 0' }}>
          Lädt Dateien …
        </p>
      ) : dateien.length === 0 ? (
        <p className="ber-hinweis" style={{ fontSize: 12, margin: '4px 0' }}>
          Noch keine Dateien.
        </p>
      ) : (
        <ul className="wa-dl-list">
          {dateien.map(d => (
            <li key={d.id} className="wa-dl-item">
              <button
                type="button"
                className="wa-dl-name"
                title={`${d.anzeigename}\n${d.pfad}`}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  font: 'inherit',
                  padding: 0,
                  textAlign: 'left',
                }}
                onClick={() => void openParentFolder(d.pfad)}
              >
                <span aria-hidden>📄</span> {d.anzeigename}
              </button>
              <span className="badge badge-grau" title={ROLLEN.find(r => r.value === d.rolle)?.label ?? d.rolle}>
                {ROLLE_KURZ[d.rolle]}
              </span>
              <span className="wa-dl-pfad" title={d.pfad}>
                {d.pfad}
              </span>
              <button
                type="button"
                className="wa-dl-rm"
                onClick={() => void handleEntfernen(d.id)}
                disabled={entferntId === d.id}
                title="Entfernen"
                aria-label={`Entfernen: ${d.anzeigename}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
