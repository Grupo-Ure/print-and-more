import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { kundenName } from '../lib/kunde'
import { synchronisiereAuftragsstatus } from '../lib/auftragsStatus'
import { bereichKuerzel } from '../const/bereichKuerzel'
import { AUFTRAG_SPALTEN } from '../const/auftragSelect'
import { TEILAUFTRAG_SPALTEN } from '../const/teilauftragSelect'
import {
  teilauftragBereichLabel,
  type Auftrag,
  type AuftragDetailRow,
  type AuftragStatus,
  type Bereich,
  type KundeKontaktJoin,
  type KundeKontaktRow,
  type LieferungWahl,
  type Prioritaet,
  type TeilauftragRow,
} from '../types/database'
import { useToast } from './Toast'
import { AddTeilauftragOverlay } from './AddTeilauftragOverlay'
import { DateInput } from './DateInput'
import type { Datei } from './DateiListe'
import { TeilauftragDetail } from './TeilauftragDetail'
import './WorkArea.css'

function ersteKontaktZeile(k: KundeKontaktJoin | null): KundeKontaktRow | null {
  if (k == null) return null
  const z = Array.isArray(k) ? (k[0] ?? null) : k
  return z ?? null
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
  onAuftragAktualisiert: (a: Auftrag) => void
  onKundeBearbeiten: () => void
}

export function WorkArea({
  aktiverAuftragId,
  kontextAktualisiert,
  onAktiverTeilauftragGeaendert,
  onAuftragKundeGeladen,
  onAuftragVomArbeitsbereich,
  onAuftragDateienGeaendert,
  onAuftragAktualisiert,
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
  const [kopfTermin, setKopfTermin] = useState('')
  const [kopfLieferung, setKopfLieferung] = useState<LieferungWahl | ''>('')
  const [kopfPrioritaet, setKopfPrioritaet] = useState<Prioritaet>('NORMAL')
  const [verantwortlicherName, setVerantwortlicherName] = useState<string | null>(null)
  const kopfSnap = useRef<{
    termin: string | null
    lieferung: LieferungWahl | null
    prioritaet: Prioritaet
  }>({ termin: null, lieferung: null, prioritaet: 'NORMAL' })
  const { fehler: toastFehler } = useToast()
  const ladeAuftragRequestIdRef = useRef(0)

  const reloadDateien = useCallback(async () => {
    if (!aktiverAuftragId) return
    const { data, error } = await supabase
      .from('dateien')
      .select('id, anzeigename, pfad, rolle, erstellt_am')
      .eq('auftrag_id', aktiverAuftragId)
      .order('erstellt_am', { ascending: true })
    if (error) {
      setDateien([])
      toastFehler('Dateien konnten nicht geladen werden')
    } else {
      setDateien((data ?? []) as Datei[])
    }
  }, [aktiverAuftragId, toastFehler])

  useEffect(() => {
    if (!aktiverAuftragId) {
      setDateien([])
      return
    }
    void reloadDateien()
  }, [aktiverAuftragId, kontextAktualisiert, reloadDateien])

  useEffect(() => {
    if (!aktiverAuftragId) {
      setAuftrag(null)
      setTeilauftraege([])
      setAktiverTeilauftragId(null)
      setFehler(null)
      setLaden(false)
      return
    }

    const meineRequestId = ++ladeAuftragRequestIdRef.current
    const isStale = () => meineRequestId !== ladeAuftragRequestIdRef.current
    const auftragId = aktiverAuftragId

    const laden = async () => {
      setFehler(null)
      setLaden(true)
      try {
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
        if (isStale()) return

        if (aufRes.error) {
          if (isStale()) return
          setFehler(aufRes.error.message)
          toastFehler('Auftrag konnte nicht geladen werden')
          setAuftrag(null)
          setTeilauftraege([])
          setAktiverTeilauftragId(null)
          return
        }
        if (tRes.error) {
          if (isStale()) return
          setFehler(tRes.error.message)
          toastFehler('Auftrag konnte nicht geladen werden')
          setAuftrag(aufRes.data as AuftragDetailRow)
          setTeilauftraege([])
          setAktiverTeilauftragId(null)
          return
        }

        if (isStale()) return
        setAuftrag(aufRes.data as AuftragDetailRow)
        const teile = tRes.data ?? []
        setTeilauftraege(teile)
        setAktiverTeilauftragId(t => {
          const sichtbar = teile.filter(x => !x.storniert)
          if (t && sichtbar.some(x => x.id === t)) return t
          return sichtbar[0]?.id ?? null
        })
      } catch (err) {
        if (isStale()) return
        setFehler(err instanceof Error ? err.message : String(err))
        toastFehler('Auftrag konnte nicht geladen werden')
        setAuftrag(null)
        setTeilauftraege([])
        setAktiverTeilauftragId(null)
      } finally {
        if (!isStale()) {
          setLaden(false)
        }
      }
    }

    void laden()
    return () => {}
  }, [aktiverAuftragId, kontextAktualisiert, toastFehler])

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
    setKopfPrioritaet(auftrag.prioritaet)
    kopfSnap.current = {
      termin: raw,
      lieferung: auftrag.lieferung,
      prioritaet: auftrag.prioritaet,
    }
  }, [auftrag])

  const speichereAuftragKopf = useCallback(
    async (patch: Partial<Pick<AuftragDetailRow, 'termin' | 'lieferung' | 'prioritaet'>>) => {
      if (!aktiverAuftragId) return
      const { data, error } = await supabase
        .from('auftraege')
        .update(patch)
        .eq('id', aktiverAuftragId)
        .select(AUFTRAG_SPALTEN)
        .single()
      if (error) {
        toastFehler('Auftrag konnte nicht gespeichert werden')
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
    [aktiverAuftragId, onAuftragVomArbeitsbereich, onAuftragKundeGeladen, toastFehler]
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
    const vid = aktiverTeilFuerKontext?.verantwortlicher_id ?? null
    if (!vid) {
      setVerantwortlicherName(null)
      return
    }
    let alive = true
    void (async () => {
      const { data, error } = await supabase
        .from('profile')
        .select('id, name')
        .eq('id', vid)
        .single()
      if (!alive) return
      if (error) {
        console.error(error)
        return
      }
      const row = data as { name: string | null } | null
      setVerantwortlicherName(row?.name ?? null)
    })()
    return () => {
      alive = false
    }
  }, [aktiverTeilFuerKontext?.verantwortlicher_id])

  const handhabeTeilAktualisiert = useCallback(
    (t: TeilauftragRow) => {
      setTeilauftraege(list => list.map(x => (x.id === t.id ? t : x)))
      onAktiverTeilauftragGeaendert(t)
    },
    [onAktiverTeilauftragGeaendert]
  )

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
    if (!aktiverAuftragId || !auftrag) return
    setSpeichert(true)
    setFehler(null)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) {
      setFehler('Nicht angemeldet')
      setSpeichert(false)
      return
    }
    const heute = new Date()
    const terminIso = auftrag.termin
      ? auftrag.termin.length > 10
        ? auftrag.termin.slice(0, 10)
        : auftrag.termin
      : `${heute.getFullYear()}-${String(heute.getMonth() + 1).padStart(2, '0')}-${String(heute.getDate()).padStart(2, '0')}`
    const priorVal = auftrag.prioritaet
    const lief = auftrag.lieferung ?? 'ABHOLUNG'
    const { data, error } = await supabase
      .from('teilauftraege')
      .insert({
        auftrag_id: aktiverAuftragId,
        bereich,
        status: 'UNVOLLSTAENDIG',
        prioritaet: priorVal,
        detail: {},
        termin: terminIso,
        lieferung: lief,
        verantwortlicher_id: user.id,
        notfall_aktiv: false,
        notfall_begruendung: null,
        storniert: false,
        kundenfreigabe_erforderlich: false,
        kundenfreigabe_liegt_vor: false,
        kundenfreigabe_datei_id: null,
      })
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

      try {
        const a = await synchronisiereAuftragsstatus(auftrag.id)
        setAuftrag(prev => (prev ? ({ ...prev, status: a.status } as AuftragDetailRow) : prev))
        onAuftragAktualisiert({ ...(auftrag as unknown as Auftrag), status: a.status })
      } catch {
        toastFehler('Auftragsstatus konnte nicht aktualisiert werden')
      }
    }
    setOverlayOffen(false)
  }

  if (!aktiverAuftragId) {
    return (
      <div className="work-area work-area--empty">
        <p className="wa-hint">Wählen Sie links einen Auftrag aus, um Details und Teilaufträge zu bearbeiten.</p>
      </div>
    )
  }

  if (laden) {
    return (
      <div className="work-area work-area--empty">
        <p className="wa-laden">Lädt Auftrag …</p>
      </div>
    )
  }

  if (fehler && !auftrag) {
    return (
      <div className="work-area work-area--empty">
        <p className="wa-fehler">{fehler}</p>
      </div>
    )
  }

  if (!auftrag) {
    return (
      <div className="work-area work-area--empty">
        <p className="wa-hint">Auftrag nicht gefunden.</p>
      </div>
    )
  }

  const kunde = kundenName(auftrag.kunden)
  const aktiverTeil = aktiverTeilFuerKontext
  const termSlice = (t: string | null) => (t && t.length > 10 ? t.slice(0, 10) : t || '')
  const kontakt = ersteKontaktZeile(auftrag.kunden)
  const telStr = kontakt?.telefon?.trim() ?? ''
  const mailStr = kontakt?.email?.trim() ?? ''

  const prioritaetGlyph = (p: Prioritaet) => (p === 'HOCH' ? '▲' : '●')

  return (
    <div className="work-area">
      <header
        className="work-area__header"
        style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px 12px',
              flexWrap: 'wrap',
              minWidth: 0,
            }}
          >
            <h1 className="work-area__kunde" style={{ margin: 0 }}>
              {kunde}
            </h1>
            <span className="work-area__auftragsnummer">{auftrag.auftragsnummer}</span>
            <button
              type="button"
              className="wa-gear"
              style={{ marginLeft: 0 }}
              onClick={onKundeBearbeiten}
              title="Kunde bearbeiten"
              aria-label="Kunde bearbeiten"
            >
              <span className="wa-gear-ico" aria-hidden>
                ⚙
              </span>
            </button>
          </div>
          <div className="work-area__verantwortlich" aria-hidden style={{ flexShrink: 0, textAlign: 'right' }}>
            {verantwortlicherName ?? ''}
          </div>
        </div>
        {(telStr || mailStr) ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              width: '100%',
              fontSize: 12,
              color: '#6b7280',
              lineHeight: 1.35,
            }}
          >
            <span style={{ minWidth: 0 }} title={telStr || undefined}>
              {telStr || '—'}
            </span>
            <span style={{ minWidth: 0, textAlign: 'right' }} title={mailStr || undefined}>
              {mailStr || '—'}
            </span>
          </div>
        ) : null}
      </header>

      {fehler && <p className="wa-fehler">{fehler}</p>}

      <section className="work-area__meta" aria-label="Auftrags-Meta">
        <label className="meta-pill" title="Termin">
          <span aria-hidden>📅</span>
          <DateInput
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
        <label className="meta-pill" title="Lieferung">
          <span aria-hidden>🚚</span>
          <select
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
        <label className="meta-pill" title="Priorität">
          <span className="wa-prio-glyph" aria-hidden>
            {prioritaetGlyph(kopfPrioritaet)}
          </span>
          <select
            value={kopfPrioritaet}
            onChange={e => {
              const v = e.target.value
              if (v === 'NORMAL' || v === 'HOCH') {
                setKopfPrioritaet(v)
                if (v !== kopfSnap.current.prioritaet) {
                  void speichereAuftragKopf({ prioritaet: v })
                }
              }
            }}
          >
            <option value="NORMAL">Normal</option>
            <option value="HOCH">Hoch</option>
          </select>
        </label>
      </section>

      <div className="work-area__tabs" role="tablist" aria-label="Teilaufträge">
        {sichtbareTeile.map(t => {
          const active = t.id === aktiverTeilauftragId
          const bkz = bereichKuerzel(t.bereich)
          const ttitle = `${teilauftragBereichLabel(t.bereich)} · ${t.status}`
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              className={active ? 'tab-btn tab-btn--active' : 'tab-btn'}
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
        <button
          type="button"
          className="tab-add-btn"
          onClick={() => setOverlayOffen(true)}
          aria-label="Teilauftrag hinzufügen"
        >
          +
        </button>
      </div>

      <div className="work-area__formular" role="tabpanel">
        {aktiverTeil ? (
          <TeilauftragDetail
            teil={aktiverTeil}
            auftragStatus={auftrag.status}
            auftragTermin={auftrag.termin}
            auftragLieferung={auftrag.lieferung}
            auftragPrioritaet={auftrag.prioritaet}
            auftragKunde={auftrag.kunden}
            auftragDateien={dateien}
            onAktualisiert={handhabeTeilAktualisiert}
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
