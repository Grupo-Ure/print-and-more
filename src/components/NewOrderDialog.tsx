import { useCallback, useEffect, useState } from 'react'
import { schreibeHistorie } from '../lib/historie'
import { supabase } from '../supabase'
import type { LieferungWahl, AuftragStatus, Prioritaet } from '../types/database'
import type { Database } from '../types/supabase'
import type { Kunde } from '../lib/kunden'
import { KundeDialog } from './KundeDialog'
import { useToast } from './Toast'
import './ContextPanel.css'
import './WorkArea.css'

export type NewOrderInsertRow = {
  id: string
  auftragsnummer: string
  status: AuftragStatus
  erstellt_am: string
  kunde_id: string
  termin: string | null
  lieferung: LieferungWahl | null
  prioritaet: Prioritaet
  notfall_aktiv: boolean
  archiviert: boolean
  erp_exportiert: boolean
}

type Props = {
  offen: boolean
  onSchliessen: () => void
  onErfolg: (a: NewOrderInsertRow) => void
}

export function NewOrderDialog({ offen, onSchliessen, onErfolg }: Props) {
  const { fehler: toastFehler } = useToast()
  const [gewaehlterKunde, setGewaehlterKunde] = useState<Kunde | null>(null)
  const [suchBegr, setSuchBegr] = useState('')
  const [suchTreffer, setSuchTreffer] = useState<Kunde[]>([])
  const [suchLaden, setSuchLaden] = useState(false)
  const [anlegenLaeuft, setAnlegenLaeuft] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [kundeSubDialog, setKundeSubDialog] = useState<'neu' | 'bearbeiten' | null>(null)
  const [kundeFuerFormular, setKundeFuerFormular] = useState<Kunde | null>(null)
  const [kundeFuerBearbLaeuft, setKundeFuerBearbLaeuft] = useState(false)

  useEffect(() => {
    if (!offen) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset beim Öffnen
    setGewaehlterKunde(null)
    setSuchBegr('')
    setSuchTreffer([])
    setFehler(null)
    setKundeSubDialog(null)
    setKundeFuerFormular(null)
  }, [offen])

  const suche = useCallback(async (q: string) => {
    const t = q.trim()
    if (t.length === 0) {
      setSuchTreffer([])
      return
    }
    setSuchLaden(true)
    const { data, error } = await supabase
      .from('kunden')
      .select('id, name, email, telefon, notiz, strasse, hausnummer, plz, ort')
      .ilike('name', `%${t}%`)
      .eq('archiviert', false)
      .order('name')
      .limit(20)
    setSuchLaden(false)
    if (error) {
      toastFehler('Kundensuche fehlgeschlagen')
      setSuchTreffer([])
      return
    }
    const rows = (data ?? []) as Kunde[]
    setSuchTreffer(rows)
  }, [toastFehler])

  useEffect(() => {
    if (!offen) return
    const t = setTimeout(() => {
      void suche(suchBegr)
    }, 300)
    return () => clearTimeout(t)
  }, [suchBegr, suche, offen])

  const oeffneBearbeiten = async () => {
    if (!gewaehlterKunde) return
    setKundeFuerBearbLaeuft(true)
    const { data, error } = await supabase
      .from('kunden')
      .select('id, name, email, telefon, notiz, strasse, hausnummer, plz, ort')
      .eq('id', gewaehlterKunde.id)
      .single()
    setKundeFuerBearbLaeuft(false)
    if (error) {
      toastFehler('Kunde konnte nicht geladen werden')
      return
    }
    if (data) {
      setKundeFuerFormular(data as Kunde)
      setKundeSubDialog('bearbeiten')
    }
  }

  const handleKundeGespeichert = (k: Kunde) => {
    setKundeSubDialog(null)
    setKundeFuerFormular(null)
    setGewaehlterKunde(k)
  }

  const handleAuftragAnlegen = async () => {
    if (!gewaehlterKunde) return
    setFehler(null)
    setAnlegenLaeuft(true)
    const auftragInsert: Database['public']['Tables']['auftraege']['Insert'] = {
      kunde_id: gewaehlterKunde.id,
      status: 'ANGEBOT',
      termin: null,
      lieferung: 'ABHOLUNG',
      prioritaet: 'NORMAL',
    }
    const { data, error } = await supabase.from('auftraege').insert(auftragInsert)
      .select(
        'id, auftragsnummer, status, erstellt_am, kunde_id, termin, lieferung, prioritaet, notfall_aktiv, archiviert, erp_exportiert'
      )
      .single()
    setAnlegenLaeuft(false)
    if (error) {
      setFehler(error.message)
      return
    }
    if (data) {
      onErfolg(data as NewOrderInsertRow)
      try {
        await schreibeHistorie({
          auftrag_id: (data as NewOrderInsertRow).id,
          ereignisart: 'AUFTRAG_ERSTELLT',
        })
      } catch {
        console.error('Historie AUFTRAG_ERSTELLT fehlgeschlagen')
        toastFehler('Auftrag angelegt, aber Verlaufseintrag fehlgeschlagen')
      }
    }
  }

  if (!offen) return null

  return (
    <>
      <div className="cp-modal-bg" role="dialog" aria-modal="true" aria-label="Neuer Auftrag">
        <div className="cp-modal" style={{ maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
          <h3>Neuer Auftrag</h3>
          {fehler && (
            <p className="cp-hinweis" style={{ color: '#b91c1c' }}>
              {fehler}
            </p>
          )}

          <h4 className="ber-h3" style={{ marginTop: 0, fontSize: '0.8rem' }}>
            Kunde
          </h4>
          {gewaehlterKunde == null && (
            <>
              <input
                type="search"
                className="ber-inp"
                style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8 }}
                placeholder="Kundensuche …"
                value={suchBegr}
                onChange={e => setSuchBegr(e.target.value)}
              />
              {suchLaden && <p className="cp-hinweis">Suche…</p>}
              <div
                style={{
                  border: '1px solid #e5e5e5',
                  borderRadius: 6,
                  maxHeight: 200,
                  overflowY: 'auto',
                  marginBottom: 8,
                }}
              >
                {suchTreffer.length === 0 && !suchLaden && suchBegr.trim() && (
                  <p className="cp-hinweis" style={{ padding: 8, margin: 0 }}>
                    Keine Treffer
                  </p>
                )}
                {suchTreffer.map(k => (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setGewaehlterKunde(k)}
                    className="cp-btn"
                    style={{
                      border: 'none',
                      borderRadius: 0,
                      borderBottom: '1px solid #eee',
                    }}
                  >
                    <strong>{k.name}</strong>
                    <div className="cp-hinweis" style={{ margin: '4px 0 0' }}>
                      {k.email || k.telefon || '—'}
                    </div>
                  </button>
                ))}
              </div>
              <button type="button" className="cp-btn" onClick={() => { setKundeFuerFormular(null); setKundeSubDialog('neu') }}>
                + Neuer Kunde
              </button>
            </>
          )}

          {gewaehlterKunde && (
            <div
              style={{
                marginBottom: 12,
                padding: 10,
                background: '#f5f5f5',
                borderRadius: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{gewaehlterKunde.name}</div>
                  <div className="cp-hinweis" style={{ marginTop: 4 }}>
                    {gewaehlterKunde.email || gewaehlterKunde.telefon || '—'}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <button
                    type="button"
                    className="cp-btn"
                    style={{ width: 'auto' }}
                    disabled={kundeFuerBearbLaeuft}
                    onClick={() => { void oeffneBearbeiten() }}
                  >
                    {kundeFuerBearbLaeuft ? '…' : 'Ändern'}
                  </button>
                  <button
                    type="button"
                    className="cp-btn"
                    style={{ width: 'auto' }}
                    onClick={() => setGewaehlterKunde(null)}
                  >
                    Andere wählen
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="cp-modal-bar" style={{ marginTop: 16 }}>
            <button type="button" className="cp-btn" onClick={onSchliessen} disabled={anlegenLaeuft}>
              Abbrechen
            </button>
            <button
              type="button"
              className="cp-btn"
              disabled={!gewaehlterKunde || anlegenLaeuft}
              onClick={() => void handleAuftragAnlegen()}
            >
              Auftrag anlegen
            </button>
          </div>
        </div>
      </div>

      {kundeSubDialog === 'neu' && (
        <KundeDialog kunde={null} onGespeichert={handleKundeGespeichert} onAbbrechen={() => setKundeSubDialog(null)} />
      )}
      {kundeSubDialog === 'bearbeiten' && kundeFuerFormular && (
        <KundeDialog
          kunde={kundeFuerFormular}
          onGespeichert={handleKundeGespeichert}
          onAbbrechen={() => {
            setKundeSubDialog(null)
            setKundeFuerFormular(null)
          }}
        />
      )}
    </>
  )
}
