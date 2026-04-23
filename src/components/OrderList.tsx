import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { supabase } from '../supabase'
import { kundenName } from '../lib/kunde'
import {
  TEILAUFTRAG_BEREICHE,
  TEILAUFTRAG_BEREICH_ANZEIGE,
  type AuftragStatus,
} from '../types/database'

type Props = {
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
]

const DEFAULT_STATUS_TOGGLES: Record<AuftragStatus, boolean> = {
  ANGEBOT: false,
  UNVOLLSTAENDIG: true,
  PREPRESS_BEREIT: true,
  PRODUKTION_BEREIT: true,
  FERTIG: false,
}

const BEREICH_KURZ: Record<string, string> = {
  LFP: 'LFP',
  COPYSHOP: 'CP',
  TEXTIL: 'TX',
  STEMPEL: 'ST',
  LASERGRAVUR: 'LG',
  SONSTIGE: 'S',
}

type TeilBereichRow = { bereich: string; status: string }
type OrderListAuftragRow = {
  id: string
  auftragsnummer: string
  status: AuftragStatus
  erstellt_am: string
  termin: string | null
  prioritaet: string
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

function statusTogglesToIn(toggles: Record<AuftragStatus, boolean>): AuftragStatus[] {
  return (Object.entries(toggles) as [AuftragStatus, boolean][])
    .filter(([, on]) => on)
    .map(([s]) => s)
}

function formatDeDatum(s: string | null): string {
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function OrderList({ aktiverAuftragId, onAuftragWaehlen, onNeuerAuftrag }: Props) {
  const [filter, setFilter] = useState(() => defaultFilterState())
  const { searchInput, searchDebounced, statusAlle, statusToggles, terminVon, terminBis, annVon, annBis, bereich } =
    filter

  // Debounce Suchfeld (300 ms)
  useEffect(() => {
    const t = window.setTimeout(() => {
      setFilter(f =>
        f.searchInput === searchInput ? { ...f, searchDebounced: searchInput } : f,
      )
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const setSearchInput = (v: string) => setFilter(f => ({ ...f, searchInput: v }))

  const [quelle, setQuelle] = useState<OrderListAuftragRow[]>([])
  const [initLaden, setInitLaden] = useState(true)
  const [aktualisiere, setAktualisiere] = useState(false)
  const mindestensEinmalGeladen = useRef(false)

  const ladeAuftraege = useCallback(async () => {
    if (mindestensEinmalGeladen.current) setAktualisiere(true)
    const qtrim = searchDebounced.trim()
    let kundenIds: string[] | null = null
    if (qtrim) {
      const { data: kunden, error: ek } = await supabase
        .from('kunden')
        .select('id')
        .ilike('name', `%${qtrim}%`)
      if (ek) {
        console.error(ek)
        setQuelle([])
        mindestensEinmalGeladen.current = true
        setInitLaden(false)
        setAktualisiere(false)
        return
      }
      kundenIds = (kunden ?? []).map(r => r.id)
      if (kundenIds.length === 0) {
        setQuelle([])
        mindestensEinmalGeladen.current = true
        setInitLaden(false)
        setAktualisiere(false)
        return
      }
    }

    const chosen = statusTogglesToIn(statusToggles)
    if (!statusAlle && chosen.length === 0) {
      setQuelle([])
      mindestensEinmalGeladen.current = true
      setInitLaden(false)
      setAktualisiere(false)
      return
    }

    let query = supabase
      .from('auftraege')
      .select(
        'id, auftragsnummer, status, erstellt_am, termin, prioritaet, notfall_aktiv, kunde_id, kunden(name), teilauftraege(bereich, status)',
      )
      .eq('archiviert', false)
      .order('erstellt_am', { ascending: false })

    if (kundenIds) query = query.in('kunde_id', kundenIds)
    if (!statusAlle) query = query.in('status', chosen)
    if (terminVon) query = query.gte('termin', terminVon)
    if (terminBis) query = query.lte('termin', terminBis)
    if (annVon) query = query.gte('erstellt_am', `${annVon}T00:00:00`)
    if (annBis) query = query.lte('erstellt_am', `${annBis}T23:59:59.999`)

    const { data, error } = await query
    if (error) {
      console.error(error)
      setQuelle([])
    } else {
      setQuelle((data as OrderListAuftragRow[]) ?? [])
    }
    mindestensEinmalGeladen.current = true
    setInitLaden(false)
    setAktualisiere(false)
  }, [annBis, annVon, searchDebounced, statusAlle, statusToggles, terminBis, terminVon])

  useEffect(() => {
    ladeAuftraege()
  }, [ladeAuftraege])

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

  const badgeStyle: CSSProperties = {
    display: 'inline-block',
    fontSize: 10,
    fontWeight: 500,
    padding: '1px 6px',
    borderRadius: 4,
    textTransform: 'none' as const,
  }

  return (
    <div>
      <div
        style={{
          padding: 12,
          borderBottom: '1px solid #e5e5e5',
          position: 'sticky',
          top: 0,
          background: '#fafafa',
          zIndex: 1,
        }}
      >
        <button
          type="button"
          onClick={onNeuerAuftrag}
          style={{
            width: '100%',
            padding: '8px 10px',
            fontSize: 13,
            border: '1px solid #d4d4d4',
            borderRadius: 6,
            background: '#111',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: 500,
            marginBottom: 10,
          }}
        >
          + Neuer Auftrag
        </button>

        <div style={{ marginBottom: 8 }}>
          <input
            type="search"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Kunde suchen..."
            aria-label="Kunde suchen"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '6px 8px',
              fontSize: 13,
              border: '1px solid #d4d4d4',
              borderRadius: 6,
            }}
          />
        </div>

        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>Status</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <FilterChip
              aktiv={statusAlle}
              onClick={() => setFilter(f => ({ ...f, statusAlle: true }))}
              label="Alle"
            />
            {STATUS_ORDER.map(s => (
              <FilterChip
                key={s}
                aktiv={!statusAlle && statusToggles[s]}
                onClick={() =>
                  setFilter(f => {
                    const next = { ...f.statusToggles, [s]: !f.statusToggles[s] }
                    return { ...f, statusAlle: false, statusToggles: next }
                  })
                }
                label={s.replace(/_/g, ' ')}
              />
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 6 }}>
          <label htmlFor="ol-bereich" style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 4 }}>
            Bereich
          </label>
          <select
            id="ol-bereich"
            value={bereich}
            onChange={e =>
              setFilter(f => ({
                ...f,
                bereich: e.target.value as typeof f.bereich,
              }))
            }
            style={{
              width: '100%',
              padding: '5px 6px',
              fontSize: 12,
              border: '1px solid #d4d4d4',
              borderRadius: 6,
            }}
          >
            <option value="Alle">Alle</option>
            {TEILAUFTRAG_BEREICHE.map(b => (
              <option key={b} value={b}>
                {TEILAUFTRAG_BEREICH_ANZEIGE[b]}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>Termin von</div>
            <input
              type="date"
              value={terminVon}
              onChange={e => setFilter(f => ({ ...f, terminVon: e.target.value }))}
              style={{ width: '100%', boxSizing: 'border-box', fontSize: 12, padding: 4, border: '1px solid #d4d4d4', borderRadius: 6 }}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>Termin bis</div>
            <input
              type="date"
              value={terminBis}
              onChange={e => setFilter(f => ({ ...f, terminBis: e.target.value }))}
              style={{ width: '100%', boxSizing: 'border-box', fontSize: 12, padding: 4, border: '1px solid #d4d4d4', borderRadius: 6 }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>Annahme von</div>
            <input
              type="date"
              value={annVon}
              onChange={e => setFilter(f => ({ ...f, annVon: e.target.value }))}
              style={{ width: '100%', boxSizing: 'border-box', fontSize: 12, padding: 4, border: '1px solid #d4d4d4', borderRadius: 6 }}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>Annahme bis</div>
            <input
              type="date"
              value={annBis}
              onChange={e => setFilter(f => ({ ...f, annBis: e.target.value }))}
              style={{ width: '100%', boxSizing: 'border-box', fontSize: 12, padding: 4, border: '1px solid #d4d4d4', borderRadius: 6 }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={filterZuruecksetzen}
          style={{
            width: '100%',
            padding: '6px 8px',
            fontSize: 12,
            border: '1px solid #d4d4d4',
            borderRadius: 6,
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          Filter zurücksetzen
        </button>
      </div>
      {initLaden && <div style={{ padding: 16, color: '#888', fontSize: 13 }}>Lädt...</div>}
      {leer && (
        <div style={{ padding: 16, color: '#888', fontSize: 13 }}>
          <div style={{ marginBottom: 8 }}>Keine Aufträge gefunden</div>
          <button
            type="button"
            onClick={filterZuruecksetzen}
            style={{
              padding: '6px 10px',
              fontSize: 12,
              border: '1px solid #d4d4d4',
              borderRadius: 6,
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            Filter zurücksetzen
          </button>
        </div>
      )}
      {aktualisiere && !initLaden && (
        <div style={{ padding: '4px 16px', fontSize: 11, color: '#999' }}>Aktualisiere…</div>
      )}
      <div style={{ opacity: aktualisiere && !initLaden ? 0.5 : 1, transition: 'opacity 0.15s' }}>
        {!initLaden &&
          auftraege.map(a => {
            const aktiv = a.id === aktiverAuftragId
            const uniqueBereiche = [
              ...new Set((a.teilauftraege ?? []).map(t => t.bereich).filter(Boolean)),
            ]
            return (
              <div
                key={a.id}
                onClick={() => onAuftragWaehlen(a.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onAuftragWaehlen(a.id)
                  }
                }}
                role="button"
                tabIndex={0}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #e5e5e5',
                  cursor: 'pointer',
                  background: aktiv ? '#111' : 'transparent',
                  color: aktiv ? '#fff' : 'inherit',
                }}
              >
                <div style={{ fontWeight: 600 }}>{kundenName(a.kunden)}</div>
                <div
                  style={{
                    fontSize: 12,
                    color: aktiv ? 'rgba(255,255,255,0.85)' : '#444',
                    marginTop: 4,
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>{a.auftragsnummer}</span>
                  <span
                    style={{
                      ...badgeStyle,
                      background: aktiv ? 'rgba(255,255,255,0.2)' : '#e8e8e8',
                      color: aktiv ? '#fff' : '#333',
                    }}
                  >
                    {a.status.replace(/_/g, ' ')}
                  </span>
                </div>
                {a.termin && (
                  <div
                    style={{
                      fontSize: 12,
                      marginTop: 4,
                      color: aktiv ? 'rgba(255,255,255,0.8)' : '#666',
                    }}
                  >
                    Termin: {formatDeDatum(a.termin)}
                  </div>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4, alignItems: 'center' }}>
                  {a.prioritaet === 'HOCH' && (
                    <span
                      style={{
                        ...badgeStyle,
                        background: aktiv ? 'rgba(255,200,100,0.35)' : '#f5a623',
                        color: aktiv ? '#fff' : '#1a1a1a',
                      }}
                    >
                      Priorität hoch
                    </span>
                  )}
                  {a.notfall_aktiv && (
                    <span
                      style={{
                        ...badgeStyle,
                        background: aktiv ? 'rgba(220,50,50,0.5)' : '#c62828',
                        color: '#fff',
                      }}
                    >
                      Notfall
                    </span>
                  )}
                </div>
                {uniqueBereiche.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 3,
                      marginTop: 6,
                    }}
                  >
                    {uniqueBereiche.map(b => (
                      <span
                        key={b}
                        title={TEILAUFTRAG_BEREICH_ANZEIGE[b as keyof typeof TEILAUFTRAG_BEREICH_ANZEIGE] ?? b}
                        style={{
                          fontSize: 9,
                          fontWeight: 600,
                          padding: '2px 5px',
                          borderRadius: 3,
                          border: aktiv ? '1px solid rgba(255,255,255,0.35)' : '1px solid #ccc',
                          color: aktiv ? 'rgba(255,255,255,0.95)' : '#555',
                          background: aktiv ? 'rgba(255,255,255,0.1)' : '#f0f0f0',
                        }}
                      >
                        {BEREICH_KURZ[b] ?? b}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
      </div>
    </div>
  )
}

function FilterChip({
  aktiv,
  label,
  onClick,
}: {
  aktiv: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontSize: 9,
        lineHeight: 1.2,
        padding: '3px 5px',
        borderRadius: 4,
        border: `1px solid ${aktiv ? '#111' : '#d4d4d4'}`,
        background: aktiv ? '#111' : '#fff',
        color: aktiv ? '#fff' : '#444',
        cursor: 'pointer',
        maxWidth: '100%',
        textAlign: 'left' as const,
        whiteSpace: 'nowrap' as const,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {label}
    </button>
  )
}
