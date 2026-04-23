import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'
import type { LieferungWahl, AuftragStatus } from '../types/database'
import type { Kunde } from '../lib/kunden'
import { KundeDialog } from './KundeDialog'
import './ContextPanel.css'
import './WorkArea.css'

export type NeuerAuftragInsertRow = {
  id: string
  auftragsnummer: string
  status: AuftragStatus
  erstellt_am: string
  kunde_id: string
  termin: string | null
  lieferung: LieferungWahl | null
  prioritaet: string
  notfall_aktiv: boolean
  archiviert: boolean
  erp_exportiert: boolean
}

type Props = {
  offen: boolean
  onSchliessen: () => void
  onErfolg: (a: NeuerAuftragInsertRow) => void
}

function toOptionalDate(v: string): string | null {
  if (!v.trim()) return null
  return v
}

export function NeuerAuftragDialog({ offen, onSchliessen, onErfolg }: Props) {
  const [gewaehlterKunde, setGewaehlterKunde] = useState<Kunde | null>(null)
  const [suchBegr, setSuchBegr] = useState('')
  const [suchTreffer, setSuchTreffer] = useState<Kunde[]>([])
  const [suchLaden, setSuchLaden] = useState(false)
  const [termin, setTermin] = useState('')
  const [lieferung, setLieferung] = useState<LieferungWahl | ''>('')
  const [prioritaet, setPrioritaet] = useState<'NORMAL' | 'HOCH'>('NORMAL')
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
    setTermin('')
    setLieferung('')
    setPrioritaet('NORMAL')
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
      .select('id, name, email, telefon')
      .ilike('name', `%${t}%`)
      .eq('archiviert', false)
      .order('name')
      .limit(20)
    setSuchLaden(false)
    if (error) {
      console.error(error)
      setSuchTreffer([])
      return
    }
    const rows = (data ?? []) as { id: string; name: string; email: string | null; telefon: string | null }[]
    setSuchTreffer(
      rows.map(r => ({
        id: r.id,
        name: r.name,
        email: r.email,
        telefon: r.telefon,
        notiz: null,
      }))
    )
  }, [])

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
      .select('id, name, email, telefon, notiz')
      .eq('id', gewaehlterKunde.id)
      .single()
    setKundeFuerBearbLaeuft(false)
    if (error) {
      console.error(error)
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
    const t = toOptionalDate(termin)
    const l = lieferung === '' ? null : (lieferung as LieferungWahl)
    const { data, error } = await supabase
      .from('auftraege')
      .insert({
        kunde_id: gewaehlterKunde.id,
        status: 'ANGEBOT',
        termin: t,
        lieferung: l,
        prioritaet,
      } as never)
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
      onErfolg(data as NeuerAuftragInsertRow)
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
            Schritt 1: Kunde
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

          {gewaehlterKunde && (
            <>
              <h4 className="ber-h3" style={{ fontSize: '0.8rem' }}>
                Schritt 2: Auftragskopf
              </h4>
              <div className="ber-zeile">
                <span className="ber-lbl">Termin</span>
                <div>
                  <input
                    type="date"
                    className="ber-inp"
                    value={termin}
                    onChange={e => setTermin(e.target.value)}
                  />
                </div>
              </div>
              <div className="ber-zeile">
                <span className="ber-lbl">Lieferung</span>
                <div>
                  <select
                    className="ber-inp"
                    value={lieferung}
                    onChange={e => {
                      const v = e.target.value
                      setLieferung(v === '' ? '' : (v as LieferungWahl))
                    }}
                  >
                    <option value="">—</option>
                    <option value="ABHOLUNG">Abholung</option>
                    <option value="VERSAND">Versand</option>
                  </select>
                </div>
              </div>
              <div className="ber-zeile">
                <span className="ber-lbl">Priorität *</span>
                <div>
                  <select
                    className="ber-inp"
                    value={prioritaet}
                    onChange={e => setPrioritaet(e.target.value as 'NORMAL' | 'HOCH')}
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="HOCH">Hoch</option>
                  </select>
                </div>
              </div>
            </>
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
