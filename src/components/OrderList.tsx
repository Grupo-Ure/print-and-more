import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { AUFTRAG_SPALTEN } from '../const/auftragSelect'
import { bereichKuerzel } from '../const/bereichKuerzel'
import { TEILAUFTRAG_SPALTEN } from '../const/teilauftragSelect'
import { formatDatumDe } from '../lib/formatDatum'
import { kundenName } from '../lib/kunde'
import {
  TEILAUFTRAG_BEREICHE,
  TEILAUFTRAG_BEREICH_ANZEIGE,
  type Auftrag,
  type AuftragStatus,
  type TeilauftragRow,
} from '../types/database'
import { DateInput } from './DateInput'
import { DuplizierenDialog } from './DuplizierenDialog'
import { useToast } from './Toast'
import './OrderList.css'

type OrderInPlace = { tick: number; id: string; status: AuftragStatus }

type Props = {
  orderInPlace: OrderInPlace
  aktiverAuftragId: string | null
  onAuftragWaehlen: (id: string) => void
  onNeuerAuftrag: () => void
}

const STATUS_ORDER: AuftragStatus[] = [
  'ANGEBOT',
  'UNVOLLSTAENDIG',
  'PREPRESS_BEREIT',
  'PRODUKTION_BEREIT',
  'FERTIG',
  'ABGERECHNET',
]

const DEFAULT_STATUS_TOGGLES: Record<AuftragStatus, boolean> = {
  ANGEBOT: true,
  UNVOLLSTAENDIG: true,
  PREPRESS_BEREIT: true,
  PRODUKTION_BEREIT: true,
  FERTIG: false,
  ABGERECHNET: false,
}

/** Anzeige in einer Zeile (kurz) */
const STATUS_CBX_KURZ: Record<AuftragStatus, string> = {
  ANGEBOT: 'Angebot',
  UNVOLLSTAENDIG: 'Unvollst.',
  PREPRESS_BEREIT: 'PrePress',
  PRODUKTION_BEREIT: 'Produkt.',
  FERTIG: 'Fertig',
  ABGERECHNET: 'Abgerech.',
}

type TeilBereichRow = { bereich: string; status: string }
type OrderListAuftragRow = {
  id: string
  auftragsnummer: string
  status: AuftragStatus
  erstellt_am: string
  termin: string | null
  prioritaet: 'NORMAL' | 'HOCH'
  notfall_aktiv: boolean
  kunde_id: string
  kunden: { name: string } | { name: string }[] | null
  teilauftraege: TeilBereichRow[] | null
}

function defaultFilterState() {
  return {
    searchInput: '',
    searchDebounced: '',
    statusAlle: false,
    statusToggles: { ...DEFAULT_STATUS_TOGGLES },
    terminVon: '',
    terminBis: '',
    annVon: '',
    annBis: '',
    bereich: 'Alle' as 'Alle' | (typeof TEILAUFTRAG_BEREICHE)[number],
  }
}

type FilterState = ReturnType<typeof defaultFilterState>

function statusTogglesToIn(toggles: Record<AuftragStatus, boolean>): AuftragStatus[] {
  return (Object.entries(toggles) as [AuftragStatus, boolean][])
    .filter(([, on]) => on)
    .map(([s]) => s)
}

function isFilterAktiv(f: FilterState): boolean {
  const d = defaultFilterState()
  if (f.searchInput.trim() !== '' || f.searchDebounced.trim() !== '') return true
  if (f.terminVon || f.terminBis || f.annVon || f.annBis) return true
  if (f.bereich !== 'Alle') return true
  if (f.statusAlle !== d.statusAlle) return true
  for (const s of STATUS_ORDER) {
    if (f.statusToggles[s] !== d.statusToggles[s]) return true
  }
  return false
}

function statusBadgeKlasse(s: AuftragStatus): string {
  switch (s) {
    case 'ANGEBOT':
      return 'badge-grau'
    case 'UNVOLLSTAENDIG':
      return 'badge-orange'
    case 'PREPRESS_BEREIT':
      return 'badge-blau'
    case 'PRODUKTION_BEREIT':
      return 'badge-lila'
    case 'FERTIG':
      return 'badge-gruen'
    default:
      return 'badge-grau'
  }
}

function statusLabel(s: AuftragStatus): string {
  const m: Record<AuftragStatus, string> = {
    ANGEBOT: 'Angebot',
    UNVOLLSTAENDIG: 'Unvollständig',
    PREPRESS_BEREIT: 'PrePress',
    PRODUKTION_BEREIT: 'Produktion',
    FERTIG: 'Fertig',
    ABGERECHNET: 'Abgerechnet',
  }
  return m[s] ?? s
}

export function OrderList({ orderInPlace, aktiverAuftragId, onAuftragWaehlen, onNeuerAuftrag }: Props) {
  const [filter, setFilter] = useState<FilterState>(() => defaultFilterState())
  const { searchInput, searchDebounced, statusAlle, statusToggles, terminVon, terminBis, annVon, annBis, bereich } =
    filter
  const [sucheOffen, setSucheOffen] = useState(false)
  const [filterPopOffen, setFilterPopOffen] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => {
      setFilter(f => (f.searchInput === searchInput ? { ...f, searchDebounced: searchInput } : f))
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const setSearchInput = (v: string) => setFilter(f => ({ ...f, searchInput: v }))

  const [quelle, setQuelle] = useState<OrderListAuftragRow[]>([])
  const quelleRef = useRef(quelle)
  useEffect(() => {
    quelleRef.current = quelle
  }, [quelle])
  const [initLaden, setInitLaden] = useState(true)
  const [aktualisiere, setAktualisiere] = useState(false)
  const mindestensEinmalGeladen = useRef(false)
  const ladeAuftraegeRequestIdRef = useRef(0)
  const filterAktiv = isFilterAktiv(filter)
  const { fehler } = useToast()

  const ladeAuftraege = useCallback(
    async (opts?: { abgebrochen?: { v: boolean } }) => {
      const meineRequestId = ++ladeAuftraegeRequestIdRef.current
      const isStale = () =>
        (opts?.abgebrochen?.v ?? false) || meineRequestId !== ladeAuftraegeRequestIdRef.current

      if (mindestensEinmalGeladen.current) setAktualisiere(true)
      const qtrim = searchDebounced.trim()
      let kundenIds: string[] | null = null
      if (qtrim) {
        const { data: kunden, error: ek } = await supabase
          .from('kunden')
          .select('id')
          .ilike('name', `%${qtrim}%`)
        if (isStale()) return
        if (ek) {
          fehler('Aufträge konnten nicht geladen werden')
          setQuelle([])
          mindestensEinmalGeladen.current = true
          setInitLaden(false)
          setAktualisiere(false)
          return
        }
        kundenIds = (kunden ?? []).map(r => r.id)
        if (kundenIds.length === 0) {
          if (isStale()) return
          setQuelle([])
          mindestensEinmalGeladen.current = true
          setInitLaden(false)
          setAktualisiere(false)
          return
        }
      }

      const chosen = statusTogglesToIn(statusToggles)
      if (!statusAlle && chosen.length === 0) {
        if (isStale()) return
        setQuelle([])
        mindestensEinmalGeladen.current = true
        setInitLaden(false)
        setAktualisiere(false)
        return
      }

      if (isStale()) return

      let query = supabase
        .from('auftraege')
        .select(
          'id, auftragsnummer, status, erstellt_am, termin, prioritaet, notfall_aktiv, kunde_id, kunden(name), teilauftraege(bereich, status)',
        )
        .order('erstellt_am', { ascending: false })

      if (statusAlle) {
        query = query.eq('archiviert', false)
      } else {
        const abgerechnetGewaehlt = chosen.includes('ABGERECHNET')
        const andereGewaehlt = chosen.some(s => s !== 'ABGERECHNET')
        if (abgerechnetGewaehlt && andereGewaehlt) {
          // kein archiviert-Filter — zeigt beide
        } else if (abgerechnetGewaehlt) {
          query = query.eq('archiviert', true)
        } else {
          query = query.eq('archiviert', false)
        }
      }

      if (kundenIds) query = query.in('kunde_id', kundenIds)
      if (!statusAlle)
        query = query.in('status', chosen as string[] as unknown as readonly AuftragStatus[])
      if (terminVon) query = query.gte('termin', terminVon)
      if (terminBis) query = query.lte('termin', terminBis)
      if (annVon) query = query.gte('erstellt_am', `${annVon}T00:00:00`)
      if (annBis) query = query.lte('erstellt_am', `${annBis}T23:59:59.999`)

      const { data, error } = await query
      if (isStale()) return
      if (error) {
        fehler('Aufträge konnten nicht geladen werden')
        setQuelle([])
      } else {
        setQuelle((data as OrderListAuftragRow[]) ?? [])
      }
      if (isStale()) return
      mindestensEinmalGeladen.current = true
      setInitLaden(false)
      setAktualisiere(false)
    },
    [annBis, annVon, fehler, searchDebounced, statusAlle, statusToggles, terminBis, terminVon]
  )

  useEffect(() => {
    const ab = { v: false }
    const abort = new AbortController()
    void ladeAuftraege({ abgebrochen: ab })
    return () => {
      ab.v = true
      abort.abort()
    }
  }, [ladeAuftraege])

  useEffect(() => {
    if (orderInPlace.tick === 0) return
    setQuelle(q =>
      q.map(r => (r.id === orderInPlace.id ? { ...r, status: orderInPlace.status } : r))
    )
  }, [orderInPlace])

  const refreshAuftragEintrag = useCallback(async (auftragId: string) => {
    const { data, error } = await supabase
      .from('auftraege')
      .select(
        'id, auftragsnummer, status, erstellt_am, termin, prioritaet, notfall_aktiv, kunde_id, kunden(name), teilauftraege(bereich, status)',
      )
      .eq('id', auftragId)
      .single()
    if (error) {
      console.warn('refreshAuftragEintrag fehlgeschlagen:', auftragId)
      return
    }
    if (!data) return
    const row = data as OrderListAuftragRow
    setQuelle(list => list.map(x => (x.id === auftragId ? row : x)))
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('orderlist-kunden-refresh')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'kunden' },
        payload => {
          const kundeId = (payload.new as { id?: string } | null)?.id
          if (!kundeId) return
          const ids = quelleRef.current.filter(a => a.kunde_id === kundeId).map(a => a.id)
          for (const id of ids) void refreshAuftragEintrag(id)
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'kunden' },
        payload => {
          const kundeId = (payload.new as { id?: string } | null)?.id
          if (!kundeId) return
          const ids = quelleRef.current.filter(a => a.kunde_id === kundeId).map(a => a.id)
          for (const id of ids) void refreshAuftragEintrag(id)
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'kunden' },
        payload => {
          const kundeId = (payload.old as { id?: string } | null)?.id
          if (!kundeId) return
          const ids = quelleRef.current.filter(a => a.kunde_id === kundeId).map(a => a.id)
          for (const id of ids) void refreshAuftragEintrag(id)
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [refreshAuftragEintrag])

  const auftraege = useMemo(() => {
    if (bereich === 'Alle') return quelle
    return quelle.filter(
      a => a.teilauftraege?.some(t => t.bereich === bereich) ?? false,
    )
  }, [quelle, bereich])

  const filterZuruecksetzen = () => {
    setFilter(defaultFilterState())
  }

  const leer = !initLaden && auftraege.length === 0

  const [duplOffen, setDuplOffen] = useState(false)
  const [duplBusy, setDuplBusy] = useState(false)
  const [duplFehler, setDuplFehler] = useState<string | null>(null)
  const [duplAuftrag, setDuplAuftrag] = useState<Auftrag | null>(null)
  const [duplTeil, setDuplTeil] = useState<TeilauftragRow[]>([])

  const openDuplizieren = useCallback(
    async (auftragId: string) => {
      if (duplBusy) return
      setDuplBusy(true)
      setDuplFehler(null)
      try {
        const { data: a, error: e1 } = await supabase
          .from('auftraege')
          .select(AUFTRAG_SPALTEN)
          .eq('id', auftragId)
          .single()
        if (e1) throw e1
        const { data: t, error: e2 } = await supabase
          .from('teilauftraege')
          .select(TEILAUFTRAG_SPALTEN)
          .eq('auftrag_id', auftragId)
        if (e2) throw e2
        setDuplAuftrag(a as Auftrag)
        setDuplTeil((t ?? []) as TeilauftragRow[])
        setDuplOffen(true)
      } catch (e) {
        fehler('Aufträge konnten nicht geladen werden')
        setDuplFehler(e instanceof Error ? e.message : String(e))
      } finally {
        setDuplBusy(false)
      }
    },
    [duplBusy, fehler]
  )

  return (
    <div className="ol-root">
      <div className="ol-head">
        <div className="ol-head-row">
          <h1 className="ol-title">Auftragsliste</h1>
          <div className="ol-head-btns">
            <button
              type="button"
              className="ol-icon-btn"
              title="Kunde suchen"
              aria-label="Kunde suchen"
              aria-pressed={sucheOffen}
              onClick={() => {
                setSucheOffen(o => !o)
                if (filterPopOffen) setFilterPopOffen(false)
              }}
            >
              🔍
            </button>
            <button
              type="button"
              className={`ol-icon-btn${filterAktiv ? ' ol-icon-btn--badge' : ''}`}
              title="Filter"
              aria-label="Filter"
              aria-pressed={filterPopOffen}
              onClick={() => {
                setFilterPopOffen(o => !o)
                if (sucheOffen) setSucheOffen(false)
              }}
            >
              ⚙
            </button>
          </div>
        </div>

        {sucheOffen && (
          <div className="ol-suche">
            <input
              className="input-compact"
              type="search"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Kunde suchen..."
              aria-label="Kunde suchen"
            />
          </div>
        )}

        {filterPopOffen && (
          <div className="ol-filter-pop">
            <div className="ol-filter-inhalt">
              <div className="ol-filter-row">
                <span className="ol-label">Status</span>
                <div className="ol-status-row">
                  <label className="ol-cb">
                    <input
                      type="checkbox"
                      checked={statusAlle}
                      onChange={e => {
                        const c = e.target.checked
                        setFilter(f => ({ ...f, statusAlle: c }))
                      }}
                    />
                    Alle
                  </label>
                  {!statusAlle &&
                    STATUS_ORDER.map(s => (
                      <label key={s} className="ol-cb" title={s}>
                        <input
                          type="checkbox"
                          checked={statusToggles[s]}
                          onChange={e => {
                            const c = e.target.checked
                            setFilter(f => ({
                              ...f,
                              statusAlle: false,
                              statusToggles: { ...f.statusToggles, [s]: c },
                            }))
                          }}
                        />
                        {STATUS_CBX_KURZ[s]}
                      </label>
                    ))}
                </div>
              </div>

              <div className="ol-filter-row">
                <label className="ol-label" htmlFor="ol-bereich">
                  Bereich
                </label>
                <select
                  id="ol-bereich"
                  className="input-compact"
                  value={bereich}
                  onChange={e =>
                    setFilter(f => ({ ...f, bereich: e.target.value as FilterState['bereich'] }))
                  }
                  style={{ width: '100%', boxSizing: 'border-box' }}
                >
                  <option value="Alle">Alle</option>
                  {TEILAUFTRAG_BEREICHE.map(b => (
                    <option key={b} value={b}>
                      {TEILAUFTRAG_BEREICH_ANZEIGE[b]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ol-filter-row">
                <span className="ol-label">Termin (von / bis)</span>
                <div className="ol-filter-dates">
                  <DateInput
                    className="input-compact"
                    value={terminVon}
                    onChange={e => setFilter(f => ({ ...f, terminVon: e.target.value }))}
                  />
                  <DateInput
                    className="input-compact"
                    value={terminBis}
                    onChange={e => setFilter(f => ({ ...f, terminBis: e.target.value }))}
                  />
                </div>
              </div>

              <div className="ol-filter-row">
                <span className="ol-label">Annahme (von / bis)</span>
                <div className="ol-filter-dates">
                  <DateInput
                    className="input-compact"
                    value={annVon}
                    onChange={e => setFilter(f => ({ ...f, annVon: e.target.value }))}
                  />
                  <DateInput
                    className="input-compact"
                    value={annBis}
                    onChange={e => setFilter(f => ({ ...f, annBis: e.target.value }))}
                  />
                </div>
              </div>

              <button type="button" className="ol-filter-reset" onClick={filterZuruecksetzen}>
                Filter zurücksetzen
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="ol-body" style={{ opacity: aktualisiere && !initLaden ? 0.5 : 1, transition: 'opacity 0.15s' }}>
        {initLaden && <div className="ol-leer">Lädt...</div>}
        {leer && (
          <div className="ol-leer">
            <div style={{ marginBottom: 8 }}>Keine Aufträge gefunden</div>
            <button type="button" className="ol-filter-reset" onClick={filterZuruecksetzen}>
              Filter zurücksetzen
            </button>
          </div>
        )}
        {aktualisiere && !initLaden && <div className="ol-aktual">Aktualisiere…</div>}
        {!initLaden &&
          auftraege.map(a => {
            const aktiv = a.id === aktiverAuftragId
            const orderSeen = new Set<string>()
            const uniqueBereiche: string[] = []
            for (const t of a.teilauftraege ?? []) {
              const b = t.bereich
              if (!b || orderSeen.has(b)) continue
              orderSeen.add(b)
              uniqueBereiche.push(b)
            }
            const maxTag = 4
            const tagLabels = uniqueBereiche.map(b => bereichKuerzel(b))
            const sichtTags = tagLabels.slice(0, maxTag)
            const mehr = tagLabels.length - maxTag
            return (
              <div
                key={a.id}
                className={aktiv ? 'ol-eintrag ol-eintrag--aktiv' : 'ol-eintrag'}
                onClick={() => onAuftragWaehlen(a.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onAuftragWaehlen(a.id)
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="ol-eintrag-in">
                  <div className="ol-ze1">
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        minWidth: 0,
                        flex: 1,
                        gap: 4,
                      }}
                    >
                      <span className="ol-kunde">{kundenName(a.kunden)}</span>
                      {a.notfall_aktiv && (
                        <span className="ol-alarm" title="Notfall" aria-label="Notfall">
                          !
                        </span>
                      )}
                      {a.prioritaet === 'HOCH' && (
                        <span className="ol-prio" title="Priorität hoch" aria-label="Priorität hoch">
                          ↑
                        </span>
                      )}
                    </div>
                    <span className="ol-datum">{formatDatumDe(a.erstellt_am)}</span>
                  </div>
                  <div className="ol-ze2">
                    <span className={`badge ${statusBadgeKlasse(a.status)}`}>{statusLabel(a.status)}</span>
                    {sichtTags.map(b => (
                      <span key={b} className="ol-bereich-tag">
                        {b}
                      </span>
                    ))}
                    {mehr > 0 && <span className="ol-bereich-tag">+{mehr}</span>}
                  </div>

                  {aktiv && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="ol-icon-btn"
                        title="Auftrag duplizieren"
                        aria-label="Auftrag duplizieren"
                        disabled={duplBusy}
                        onClick={e => {
                          e.stopPropagation()
                          void openDuplizieren(a.id)
                        }}
                      >
                        ⎘
                      </button>
                      <button
                        type="button"
                        className="ol-filter-reset"
                        disabled={duplBusy}
                        onClick={e => {
                          e.stopPropagation()
                          void openDuplizieren(a.id)
                        }}
                        style={{ padding: '6px 10px' }}
                      >
                        Auftrag duplizieren
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
      </div>

      <div className="ol-foot">
        <button type="button" className="ol-btn-neu" onClick={onNeuerAuftrag}>
          + Neuer Auftrag
        </button>
      </div>

      {duplFehler && <div className="ol-aktual">{duplFehler}</div>}

      {duplOffen && duplAuftrag && (
        <DuplizierenDialog
          auftrag={duplAuftrag}
          teilauftraege={duplTeil}
          onAbbrechen={() => setDuplOffen(false)}
          onErfolg={neu => {
            setDuplOffen(false)
            ladeAuftraege()
            onAuftragWaehlen(neu.id)
          }}
        />
      )}
    </div>
  )
}
