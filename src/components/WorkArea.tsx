import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { kundenName } from '../lib/kunde'
import { AUFTRAG_SPALTEN } from '../const/auftragSelect'
import { TEILAUFTRAG_SPALTEN } from '../const/teilauftragSelect'
import {
  teilauftragBereichLabel,
  type Auftrag,
  type AuftragDetailRow,
  type Bereich,
  type KundeKontaktJoin,
  type LieferungWahl,
  type TeilauftragRow,
} from '../types/database'
import { AddTeilauftragOverlay } from './AddTeilauftragOverlay'
import { DateiListe, type Datei } from './DateiListe'
import { TeilauftragDetail } from './TeilauftragDetail'
import './WorkArea.css'

type Props = {
  aktiverAuftragId: string | null
  kontextAktualisiert: number
  onAktiverTeilauftragGeaendert: (t: TeilauftragRow | null) => void
  onAuftragKundeGeladen: (k: KundeKontaktJoin | null) => void
  onAuftragVomArbeitsbereich: (a: Auftrag | null) => void
  onAuftragDateienGeaendert: (d: Datei[]) => void
  onKundeBearbeiten: () => void
}

export function WorkArea({
  aktiverAuftragId,
  kontextAktualisiert,
  onAktiverTeilauftragGeaendert,
  onAuftragKundeGeladen,
  onAuftragVomArbeitsbereich,
  onAuftragDateienGeaendert,
  onKundeBearbeiten,
}: Props) {
  const [auftrag, setAuftrag] = useState<AuftragDetailRow | null>(null)
  const [teilauftraege, setTeilauftraege] = useState<TeilauftragRow[]>([])
  const [aktiverTeilauftragId, setAktiverTeilauftragId] = useState<string | null>(null)
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [overlayOffen, setOverlayOffen] = useState(false)
  const [speichert, setSpeichert] = useState(false)
  const [dateien, setDateien] = useState<Datei[]>([])
  const [dateienLaden, setDateienLaden] = useState(false)
  const [kopfTermin, setKopfTermin] = useState('')
  const [kopfLieferung, setKopfLieferung] = useState<LieferungWahl | ''>('')
  const [kopfPrioritaet, setKopfPrioritaet] = useState('NORMAL')
  const [kopfSpeichert, setKopfSpeichert] = useState(false)
  const kopfSnap = useRef({ termin: null as string | null, lieferung: null as LieferungWahl | null, prioritaet: 'NORMAL' })

  const reloadDateien = useCallback(async () => {
    if (!aktiverAuftragId) return
    setDateienLaden(true)
    const { data, error } = await supabase
      .from('dateien')
      .select('id, anzeigename, pfad, rolle, erstellt_am')
      .eq('auftrag_id', aktiverAuftragId)
      .order('erstellt_am', { ascending: true })
    if (error) {
      setDateien([])
    } else {
      setDateien((data ?? []) as Datei[])
    }
    setDateienLaden(false)
  }, [aktiverAuftragId])

  useEffect(() => {
    if (!aktiverAuftragId) {
      setDateien([])
      setDateienLaden(false)
      return
    }
    void reloadDateien()
  }, [aktiverAuftragId, reloadDateien])

  const ladeAuftragUndTeilauftraege = useCallback(
    async (auftragId: string) => {
      setFehler(null)
      setLaden(true)
      const [aufRes, tRes] = await Promise.all([
        supabase
          .from('auftraege')
          .select(AUFTRAG_SPALTEN)
          .eq('id', auftragId)
          .single(),
        supabase
          .from('teilauftraege')
          .select(TEILAUFTRAG_SPALTEN)
          .eq('auftrag_id', auftragId)
          .order('id', { ascending: true }),
      ])

      if (aufRes.error) {
        setFehler(aufRes.error.message)
        setAuftrag(null)
        setTeilauftraege([])
        setAktiverTeilauftragId(null)
        setLaden(false)
        return
      }
      if (tRes.error) {
        setFehler(tRes.error.message)
        setAuftrag(aufRes.data)
        setTeilauftraege([])
        setAktiverTeilauftragId(null)
        setLaden(false)
        return
      }

      setAuftrag(aufRes.data)
      const teile = tRes.data ?? []
      setTeilauftraege(teile)
      setAktiverTeilauftragId(t => {
        const sichtbar = teile.filter(x => !x.storniert)
        if (t && sichtbar.some(x => x.id === t)) return t
        return sichtbar[0]?.id ?? null
      })
      setLaden(false)
    },
    []
  )

  useEffect(() => {
    if (!aktiverAuftragId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Supabase-Abfrage; setState erst nach await in ladeAuftragUndTeilauftraege
    void ladeAuftragUndTeilauftraege(aktiverAuftragId)
  }, [aktiverAuftragId, ladeAuftragUndTeilauftraege, kontextAktualisiert])

  useEffect(() => {
    if (!auftrag) return
    const raw = auftrag.termin
    const iso =
      raw && raw.length > 0
        ? raw.length > 10
          ? raw.slice(0, 10)
          : raw
        : ''
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Formular spiegelt Server-Zeile
    setKopfTermin(iso)
    setKopfLieferung(auftrag.lieferung ?? '')
    setKopfPrioritaet(auftrag.prioritaet?.trim() ? auftrag.prioritaet : 'NORMAL')
    kopfSnap.current = {
      termin: raw,
      lieferung: auftrag.lieferung,
      prioritaet: auftrag.prioritaet,
    }
  }, [auftrag])

  const speichereAuftragKopf = useCallback(
    async (patch: Partial<Pick<AuftragDetailRow, 'termin' | 'lieferung' | 'prioritaet'>>) => {
      if (!aktiverAuftragId) return
      setKopfSpeichert(true)
      const { data, error } = await supabase
        .from('auftraege')
        .update(patch)
        .eq('id', aktiverAuftragId)
        .select(AUFTRAG_SPALTEN)
        .single()
      setKopfSpeichert(false)
      if (error) {
        console.error(error)
        return
      }
      if (data) {
        const row = data as AuftragDetailRow
        setAuftrag(row)
        onAuftragVomArbeitsbereich(row)
        onAuftragKundeGeladen(row.kunden)
        kopfSnap.current = {
          termin: row.termin,
          lieferung: row.lieferung,
          prioritaet: row.prioritaet,
        }
      }
    },
    [aktiverAuftragId, onAuftragVomArbeitsbereich, onAuftragKundeGeladen]
  )

  const sichtbareTeile = useMemo(
    () => teilauftraege.filter(t => !t.storniert),
    [teilauftraege]
  )
  const aktiverTeilFuerKontext = useMemo((): TeilauftragRow | null => {
    if (aktiverTeilauftragId == null) return null
    return sichtbareTeile.find(t => t.id === aktiverTeilauftragId) ?? null
  }, [sichtbareTeile, aktiverTeilauftragId])

  useEffect(() => {
    if (aktiverAuftragId == null) {
      onAuftragVomArbeitsbereich(null)
      onAuftragKundeGeladen(null)
      onAktiverTeilauftragGeaendert(null)
      onAuftragDateienGeaendert([])
      return
    }
    if (laden || !auftrag || auftrag.id !== aktiverAuftragId) return
    onAuftragVomArbeitsbereich(auftrag)
    onAuftragKundeGeladen(auftrag.kunden)
    onAktiverTeilauftragGeaendert(aktiverTeilFuerKontext)
    onAuftragDateienGeaendert(dateien)
  }, [
    aktiverAuftragId,
    laden,
    auftrag,
    dateien,
    aktiverTeilFuerKontext,
    onAuftragVomArbeitsbereich,
    onAuftragKundeGeladen,
    onAktiverTeilauftragGeaendert,
    onAuftragDateienGeaendert,
  ])

  const handleNeuerTeilauftrag = async (bereich: Bereich) => {
    if (!aktiverAuftragId) return
    setSpeichert(true)
    setFehler(null)
    const { data, error } = await supabase
      .from('teilauftraege')
      .insert({
        auftrag_id: aktiverAuftragId,
        bereich,
        status: 'UNVOLLSTAENDIG',
        prioritaet: 'NORMAL',
        detail: {} as never,
        lieferung: null,
        notfall_aktiv: false,
        notfall_begruendung: null,
        storniert: false,
        kundenfreigabe_erforderlich: false,
        kundenfreigabe_liegt_vor: false,
        kundenfreigabe_datei_id: null,
      } as never)
      .select(TEILAUFTRAG_SPALTEN)
      .single()

    setSpeichert(false)
    if (error) {
      setFehler(error.message)
      return
    }
    if (data) {
      setTeilauftraege(list => {
        const next = [...list, data as TeilauftragRow].sort((a, b) =>
          a.id < b.id ? -1 : a.id > b.id ? 1 : 0
        )
        return next
      })
      setAktiverTeilauftragId(data.id)
    }
    setOverlayOffen(false)
  }

  if (!aktiverAuftragId) {
    return (
      <div className="wa">
        <p className="wa-hint">Wählen Sie links einen Auftrag aus, um Details und Teilaufträge zu bearbeiten.</p>
      </div>
    )
  }

  if (laden) {
    return (
      <div className="wa">
        <p className="wa-laden">Lädt Auftrag …</p>
      </div>
    )
  }

  if (fehler && !auftrag) {
    return (
      <div className="wa">
        <p className="wa-fehler">{fehler}</p>
      </div>
    )
  }

  if (!auftrag) {
    return (
      <div className="wa">
        <p className="wa-hint">Auftrag nicht gefunden.</p>
      </div>
    )
  }

  const kunde = kundenName(auftrag.kunden)
  const aktiverTeil = aktiverTeilFuerKontext
  const termSlice = (t: string | null) => (t && t.length > 10 ? t.slice(0, 10) : t || '')

  return (
    <div className="wa">
      <header className="wa-kopf">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <h1 style={{ margin: 0 }}>{kunde}</h1>
          <button
            type="button"
            className="wa-pen"
            onClick={onKundeBearbeiten}
            title="Kunde bearbeiten"
            aria-label="Kunde bearbeiten"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>
        <div className="wa-kopf-meta">
          {auftrag.auftragsnummer} · {auftrag.status}
          {kopfSpeichert ? ' · …' : ''}
        </div>
        <div style={{ marginTop: '0.75rem' }}>
          <div className="ber-zeile">
            <span className="ber-lbl">Termin</span>
            <div>
              <input
                type="date"
                className="ber-inp"
                value={kopfTermin}
                onChange={e => setKopfTermin(e.target.value)}
                onBlur={e => {
                  const v = e.target.value || null
                  const s = termSlice(kopfSnap.current.termin)
                  if ((v || '') !== (s || '')) {
                    void speichereAuftragKopf({ termin: v })
                  }
                }}
              />
            </div>
          </div>
          <div className="ber-zeile">
            <span className="ber-lbl">Lieferung</span>
            <div>
              <select
                className="ber-inp"
                value={kopfLieferung}
                onChange={e => {
                  const v = e.target.value
                  setKopfLieferung(v === '' ? '' : (v as LieferungWahl))
                }}
                onBlur={e => {
                  const v = (e.target.value as LieferungWahl) || null
                  if (v !== kopfSnap.current.lieferung) {
                    void speichereAuftragKopf({ lieferung: v })
                  }
                }}
              >
                <option value="">—</option>
                <option value="ABHOLUNG">Abholung</option>
                <option value="VERSAND">Versand</option>
              </select>
            </div>
          </div>
          <div className="ber-zeile">
            <span className="ber-lbl">Priorität</span>
            <div>
              <select
                className="ber-inp"
                value={kopfPrioritaet}
                onChange={e => setKopfPrioritaet(e.target.value)}
                onBlur={e => {
                  if (e.target.value !== kopfSnap.current.prioritaet) {
                    void speichereAuftragKopf({ prioritaet: e.target.value })
                  }
                }}
              >
                {kopfPrioritaet === 'NIEDRIG' && <option value="NIEDRIG">Niedrig</option>}
                <option value="NORMAL">Normal</option>
                <option value="HOCH">Hoch</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {fehler && <p className="wa-fehler">{fehler}</p>}

      <DateiListe
        aktiverAuftragId={aktiverAuftragId}
        dateien={dateien}
        dateienLaden={dateienLaden}
        onDateiGeaendert={reloadDateien}
      />

      <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.5rem' }} aria-hidden="true" />

      <div className="wa-leiste">
        <div className="wa-tabs" role="tablist" aria-label="Teilaufträge">
          {sichtbareTeile.map(t => {
            const active = t.id === aktiverTeilauftragId
            const label = `${teilauftragBereichLabel(t.bereich)} · ${t.status}`
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                className={active ? 'wa-tab wa-tab--aktiv' : 'wa-tab'}
                aria-selected={active}
                onClick={() => setAktiverTeilauftragId(t.id)}
                title={label}
              >
                {label}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          className="wa-add"
          onClick={() => setOverlayOffen(true)}
          aria-label="Teilauftrag hinzufügen"
        >
          +
        </button>
      </div>

      <div className="wa-inhalt" role="tabpanel">
        {aktiverTeil ? (
          <TeilauftragDetail
            teil={aktiverTeil}
            auftragKunde={auftrag.kunden}
            auftragDateien={dateien}
            onAktualisiert={row =>
              setTeilauftraege(list => list.map(t => (t.id === row.id ? row : t)))
            }
          />
        ) : (
          <p className="wa-hint">Noch keine Teilaufträge. Nutzen Sie +, um einen Bereich anzulegen.</p>
        )}
      </div>

      <AddTeilauftragOverlay
        offen={overlayOffen}
        speichert={speichert}
        onBereich={handleNeuerTeilauftrag}
        onSchliessen={() => !speichert && setOverlayOffen(false)}
      />
    </div>
  )
}
