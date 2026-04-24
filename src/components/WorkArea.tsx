import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { kundenName } from '../lib/kunde'
import { AUFTRAG_SPALTEN } from '../const/auftragSelect'
import { TEILAUFTRAG_SPALTEN } from '../const/teilauftragSelect'
import {
  teilauftragBereichLabel,
  type Auftrag,
  type AuftragDetailRow,
  type AuftragStatus,
  type Bereich,
  type KundeKontaktJoin,
  type LieferungWahl,
  type TeilauftragRow,
} from '../types/database'
import { AddTeilauftragOverlay } from './AddTeilauftragOverlay'
import { DateiListe, type Datei } from './DateiListe'
import { TeilauftragDetail } from './TeilauftragDetail'
import './WorkArea.css'

function kundeKontaktEineLinie(k: KundeKontaktJoin | null): string {
  if (k == null) return '—'
  const z = Array.isArray(k) ? (k[0] ?? null) : k
  if (!z) return '—'
  if (z.email?.trim()) return z.email.trim()
  if (z.telefon?.trim()) return z.telefon.trim()
  return '—'
}

function auftragStatusPillAuf(s: AuftragStatus): { cls: string; label: string } {
  const m: Record<AuftragStatus, { cls: string; label: string }> = {
    ANGEBOT: { cls: 'badge-grau', label: 'Angebot' },
    UNVOLLSTAENDIG: { cls: 'badge-orange', label: 'Unvollständig' },
    PREPRESS_BEREIT: { cls: 'badge-blau', label: 'PrePress' },
    PRODUKTION_BEREIT: { cls: 'badge-lila', label: 'Produktion' },
    FERTIG: { cls: 'badge-gruen', label: 'Fertig' },
  }
  return m[s] ?? { cls: 'badge-grau', label: s }
}

const TEIL_BEREICH_TAB_K: Record<string, string> = {
  LFP: 'LFP',
  COPYSHOP: 'CP',
  TEXTIL: 'TX',
  STEMPEL: 'ST',
  LASERGRAVUR: 'LA',
  SONSTIGE: 'SO',
}

function teilTabBereichKurz(b: string): string {
  return TEIL_BEREICH_TAB_K[b] ?? b
}

function teilStatusDotClass(s: AuftragStatus): string {
  switch (s) {
    case 'ANGEBOT':
      return 'td-dot td-dot--grau'
    case 'UNVOLLSTAENDIG':
      return 'td-dot td-dot--orange'
    case 'PREPRESS_BEREIT':
      return 'td-dot td-dot--blau'
    case 'PRODUKTION_BEREIT':
      return 'td-dot td-dot--lila'
    case 'FERTIG':
      return 'td-dot td-dot--gruen'
    default:
      return 'td-dot td-dot--grau'
  }
}

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
  const statusP = auftragStatusPillAuf(auftrag.status)
  const kontaktZeile = kundeKontaktEineLinie(auftrag.kunden)

  const prioritaetGlyph = (p: string) => {
    if (p === 'NIEDRIG') return '○'
    if (p === 'HOCH') return '▲'
    return '●'
  }

  return (
    <div className="wa">
      <header className="wa-kopf">
        <div className="wa-k1">
          <h1 className="wa-kunde-titel">{kunde}</h1>
          <span className="wa-auftr-nr">{auftrag.auftragsnummer}</span>
          <button
            type="button"
            className="wa-gear"
            onClick={onKundeBearbeiten}
            title="Kunde bearbeiten"
            aria-label="Kunde bearbeiten"
          >
            <span className="wa-gear-ico" aria-hidden>
              ⚙
            </span>
          </button>
        </div>
        <div className="wa-k2">
          <span className="wa-k2-kontakt" title={kontaktZeile}>
            {kontaktZeile}
          </span>
          <span className="wa-k2-sep" aria-hidden>
            |
          </span>
          <span className={`badge ${statusP.cls}`}>
            {statusP.label}
            {kopfSpeichert ? ' …' : ''}
          </span>
        </div>
        <div className="wa-kopf-metas">
          <label className="wa-inline-pill" title="Termin">
            <span aria-hidden>📅</span>
            <input
              type="date"
              className="wa-inline-date"
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
          </label>
          <label className="wa-inline-pill" title="Lieferung">
            <span aria-hidden>🚚</span>
            <select
              className="wa-inline-sel"
              value={kopfLieferung}
              onChange={e => {
                const v = e.target.value
                setKopfLieferung(v === '' ? '' : (v as LieferungWahl))
                const liefer = (v as LieferungWahl) || null
                if (liefer !== kopfSnap.current.lieferung) {
                  void speichereAuftragKopf({ lieferung: liefer })
                }
              }}
            >
              <option value="">—</option>
              <option value="ABHOLUNG">Abholung</option>
              <option value="VERSAND">Versand</option>
            </select>
          </label>
          <label className="wa-inline-pill" title="Priorität">
            <span className="wa-prio-glyph" aria-hidden>
              {prioritaetGlyph(kopfPrioritaet)}
            </span>
            <select
              className="wa-inline-sel"
              value={kopfPrioritaet}
              onChange={e => {
                const v = e.target.value
                setKopfPrioritaet(v)
                if (v !== kopfSnap.current.prioritaet) {
                  void speichereAuftragKopf({ prioritaet: v })
                }
              }}
            >
              {kopfPrioritaet === 'NIEDRIG' && <option value="NIEDRIG">Niedrig</option>}
              <option value="NORMAL">Normal</option>
              <option value="HOCH">Hoch</option>
            </select>
          </label>
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
            const bkz = teilTabBereichKurz(t.bereich)
            const ttitle = `${teilauftragBereichLabel(t.bereich)} · ${t.status}`
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                className={active ? 'wa-tab wa-tab--aktiv' : 'wa-tab'}
                aria-selected={active}
                onClick={() => setAktiverTeilauftragId(t.id)}
                title={ttitle}
              >
                <span className="wa-tab-kz">{bkz}</span>
                <span className="wa-tab-sep" aria-hidden>
                  {' '}
                  ·{' '}
                </span>
                <span
                  className={teilStatusDotClass(t.status)}
                  title={t.status}
                  aria-label={t.status}
                />
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
