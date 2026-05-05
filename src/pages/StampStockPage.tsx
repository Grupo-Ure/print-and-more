import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { Login } from '../components/Login'
import { useToast } from '../components/Toast'
import { teilJsonAlsFeldertabelle } from '../types/database'
import type { Database, Json } from '../types/supabase'

type StempelTyp =
  | 'TRODAT_PRINTY'
  | 'HOLZSTEMPEL'
  | 'STATIVSTEMPEL'
  | 'DATUMSSTEMPEL'
  | 'STEMPELKISSEN_PRODUKT'
  | 'TRODAT_KISSEN'

const STEMPEL_TYP_LABEL: Record<StempelTyp, string> = {
  TRODAT_PRINTY: 'Trodat Printy',
  HOLZSTEMPEL: 'Holzstempel',
  STATIVSTEMPEL: 'Stativstempel',
  DATUMSSTEMPEL: 'Datumsstempel',
  STEMPELKISSEN_PRODUKT: 'Stempelkissen',
  TRODAT_KISSEN: 'Trodat Kissen',
}

function typAnzeige(typ: string): string {
  return (STEMPEL_TYP_LABEL as Record<string, string>)[typ] ?? typ
}

const STEMPEL_TYP_FILTER_OPTIONS: { value: StempelTyp; label: string }[] = [
  { value: 'TRODAT_PRINTY', label: STEMPEL_TYP_LABEL.TRODAT_PRINTY },
  { value: 'HOLZSTEMPEL', label: STEMPEL_TYP_LABEL.HOLZSTEMPEL },
  { value: 'STATIVSTEMPEL', label: STEMPEL_TYP_LABEL.STATIVSTEMPEL },
  { value: 'DATUMSSTEMPEL', label: STEMPEL_TYP_LABEL.DATUMSSTEMPEL },
  { value: 'TRODAT_KISSEN', label: STEMPEL_TYP_LABEL.TRODAT_KISSEN },
  { value: 'STEMPELKISSEN_PRODUKT', label: STEMPEL_TYP_LABEL.STEMPELKISSEN_PRODUKT },
]

function fmtVkPreisNetto(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)
}

type StempelFarbeDb = 'SCHWARZ' | 'ROT' | 'BLAU' | 'GRUEN'

const STEMPEL_FARBE_ANZEIGE: Record<StempelFarbeDb, string> = {
  SCHWARZ: 'Schwarz',
  ROT: 'Rot',
  BLAU: 'Blau',
  GRUEN: 'Grün',
}

function farbeAnzeige(f: string | null | undefined): string {
  if (f == null || f === '') return '—'
  if ((Object.keys(STEMPEL_FARBE_ANZEIGE) as StempelFarbeDb[]).includes(f as StempelFarbeDb)) {
    return STEMPEL_FARBE_ANZEIGE[f as StempelFarbeDb]
  }
  return f
}

type StempelModellRow = {
  id: string
  name: string
  typ: StempelTyp
  max_breite_mm: number | null
  max_hoehe_mm: number | null
  druckflaeche: string | null
  artikelnummer: string | null
  bestand: number
  mindestbestand: number
  farbe: string | null
  vk_preis_netto: number | null
  aktiv: boolean
  notiz: string | null
  erstellt_am: string
}

type BewegungTyp = 'ZUGANG' | 'ABGANG' | 'AUTOABGANG'

type LagerBewegungRow = {
  id: string
  modell_id: string
  menge: number
  typ: BewegungTyp
  notiz: string | null
  person_id: string | null
  erstellt_am: string
  stempel_modelle?: { name: string } | { name: string }[] | null
}

type Tab = 'UEBERSICHT' | 'BEWEGUNGEN' | 'BESTELLLISTE'

type StempelModellBestellRow = {
  id: string
  name: string
  artikelnummer: string | null
  typ: StempelTyp
  farbe: string | null
  bestand: number
  mindestbestand: number
}

type BestelllisteZeile = StempelModellBestellRow & {
  offene_menge: number
  bestellmenge: number
}

function parseStueckzahlTeilauftrag(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const n = Math.floor(raw)
    return n >= 1 ? n : 1
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    const p = parseInt(raw, 10)
    if (Number.isFinite(p) && p >= 1) return p
  }
  return 1
}

/** Sichere Ganzzahl aus DB/JSON; verhindert [object Object] in Berechnungen. */
function alsGanzzahl(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v)
  if (typeof v === 'string' && v.trim() !== '') {
    const p = parseInt(v, 10)
    if (Number.isFinite(p)) return p
  }
  return 0
}

function bestelllisteZahlFuerAnzeige(v: unknown): number {
  const n = alsGanzzahl(v)
  return n < 0 ? 0 : n
}

function bestelllisteTextZelle(v: unknown, leer: string = '—'): string {
  if (v == null) return leer
  if (typeof v === 'string') return v.trim() === '' ? leer : v
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (typeof v === 'boolean') return v ? 'ja' : 'nein'
  if (typeof v === 'object') return leer
  return String(v)
}

function fehlerAlsString(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) {
    const m = (e as { message: unknown }).message
    if (typeof m === 'string') return m
  }
  try {
    return JSON.stringify(e)
  } catch {
    return 'Unbekannter Fehler'
  }
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
}

function joinName(x: unknown): string {
  if (!x) return ''
  if (Array.isArray(x)) {
    const v = x[0]
    return typeof v === 'object' && v && 'name' in v
      ? String((v as Record<string, unknown>).name ?? '')
      : ''
  }
  return typeof x === 'object' && x && 'name' in x ? String((x as Record<string, unknown>).name ?? '') : ''
}

function statusInfo(m: StempelModellRow): { cls: string; label: string; rank: number } {
  const b = m.bestand ?? 0
  const min = m.mindestbestand ?? 0
  if (b <= 0) return { cls: 'badge-rot', label: 'Leer', rank: 0 }
  if (b < min) return { cls: 'badge-rot', label: 'Nachbestellen', rank: 0 }
  if (b === min) return { cls: 'badge-orange', label: 'Minimum', rank: 1 }
  return { cls: 'badge-gruen', label: 'OK', rank: 2 }
}

export function StampStockPage() {
  const { fehler } = useToast()
  const [session, setSession] = useState<Session | null>(null)
  const [laden, setLaden] = useState(true)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (!alive) return
        setSession(data.session)
      } finally {
        if (alive) setLaden(false)
      }
    })()
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!alive) return
      setSession(s)
    })
    return () => {
      alive = false
      data.subscription.unsubscribe()
    }
  }, [])

  const userEmail = session?.user?.email ?? session?.user?.id ?? ''

  const [tab, setTab] = useState<Tab>('UEBERSICHT')

  // Shared: Mitarbeiter map
  const [mitarbeiterEmailById, setMitarbeiterEmailById] = useState<Map<string, string>>(new Map())
  useEffect(() => {
    if (!session) return
    let alive = true
    void Promise.resolve(supabase.from('mitarbeiter').select('id, email')).then(({ data, error }) => {
      if (!alive) return
      if (error) {
        fehler('Mitarbeiterdaten konnten nicht geladen werden')
        return
      }
      const m = new Map<string, string>()
      for (const r of (data ?? []) as { id: string; email: string }[]) m.set(r.id, r.email)
      setMitarbeiterEmailById(m)
    })
    return () => {
      alive = false
    }
  }, [fehler, session])

  // ------------------------------------------------------------
  // Tab 1: Übersicht
  // ------------------------------------------------------------
  const [modelle, setModelle] = useState<StempelModellRow[]>([])
  const [modelleLaden, setModelleLaden] = useState(false)
  const [modelleFehler, setModelleFehler] = useState<string | null>(null)

  const [filterNachbestellen, setFilterNachbestellen] = useState(false)
  const [filterTyp, setFilterTyp] = useState<string>('ALLE')
  const [filterFarbe, setFilterFarbe] = useState<string>('ALLE')
  const [uebersichtSuche, setUebersichtSuche] = useState('')

  type SortKey = 'name' | 'farbe' | 'druckflaeche' | 'typ' | 'bestand' | 'mindestbestand' | 'status'
  const [sortierung, setSortierung] = useState<{ key: SortKey; dir: 'asc' | 'desc' } | null>(null)

  const toggleSort = (key: SortKey) => {
    setSortierung(s => {
      if (!s || s.key !== key) return { key, dir: 'asc' }
      if (s.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

  const ladeModelle = async () => {
    setModelleLaden(true)
    setModelleFehler(null)
    try {
      const { data, error } = await supabase
        .from('stempel_modelle')
        .select('*')
        .eq('aktiv', true)
      if (error) throw error
      const list = ((data ?? []) as StempelModellRow[]).slice()
      // Standardsortierung genau 1× beim ersten Laden anwenden (danach stabil).
      list.sort((a, b) => {
        const sa = statusInfo(a)
        const sb = statusInfo(b)
        if (sa.rank !== sb.rank) return sa.rank - sb.rank
        return a.name.localeCompare(b.name)
      })
      setModelle(list)
    } catch (e) {
      fehler('Daten konnten nicht geladen werden')
      setModelle([])
      setModelleFehler(e instanceof Error ? e.message : String(e))
    } finally {
      setModelleLaden(false)
    }
  }

  useEffect(() => {
    if (!session) return
    if (tab !== 'UEBERSICHT') return
    void ladeModelle()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, tab])

  const modelleGefiltert = useMemo(() => {
    let list = modelle.slice()
    if (filterTyp !== 'ALLE') list = list.filter(m => m.typ === filterTyp)
    if (
      filterFarbe !== 'ALLE' &&
      (filterTyp === 'TRODAT_KISSEN' || filterTyp === 'STEMPELKISSEN_PRODUKT')
    ) {
      list = list.filter(m => m.farbe === filterFarbe)
    }
    if (filterNachbestellen) {
      list = list.filter(m => {
        const b = m.bestand ?? 0
        const min = m.mindestbestand ?? 0
        return b <= min
      })
    }
    const qUe = uebersichtSuche.trim().toLowerCase()
    if (qUe) {
      list = list.filter(m => {
        const name = String(m.name ?? '').toLowerCase()
        const art = String(m.artikelnummer ?? '').toLowerCase()
        return name.includes(qUe) || art.includes(qUe)
      })
    }
    if (sortierung) {
      const dir = sortierung.dir === 'asc' ? 1 : -1
      const key = sortierung.key
      list = list.slice().sort((a, b) => {
        const av =
          key === 'name'
            ? a.name
            : key === 'farbe'
              ? (a.farbe ?? '')
              : key === 'druckflaeche'
              ? (a.druckflaeche ?? '')
              : key === 'typ'
                ? a.typ
                : key === 'bestand'
                  ? a.bestand ?? 0
                  : key === 'mindestbestand'
                    ? a.mindestbestand ?? 0
                    : statusInfo(a).rank
        const bv =
          key === 'name'
            ? b.name
            : key === 'farbe'
              ? (b.farbe ?? '')
              : key === 'druckflaeche'
              ? (b.druckflaeche ?? '')
              : key === 'typ'
                ? b.typ
                : key === 'bestand'
                  ? b.bestand ?? 0
                  : key === 'mindestbestand'
                    ? b.mindestbestand ?? 0
                    : statusInfo(b).rank

        if (typeof av === 'number' && typeof bv === 'number') {
          if (av !== bv) return (av - bv) * dir
        } else {
          const as = String(av)
          const bs = String(bv)
          const c = as.localeCompare(bs)
          if (c !== 0) return c * dir
        }
        // stabiler Tie-Breaker
        return a.name.localeCompare(b.name)
      })
    }
    return list
  }, [filterFarbe, filterNachbestellen, filterTyp, modelle, sortierung, uebersichtSuche])

  const [buchMenge, setBuchMenge] = useState<Record<string, string>>({})
  const [buchBusyId, setBuchBusyId] = useState<string | null>(null)
  const [buchFehler, setBuchFehler] = useState<Record<string, string | null>>({})

  const buchen = async (modell: StempelModellRow, typ: 'ZUGANG' | 'ABGANG') => {
    if (!session?.user) return
    if (buchBusyId) return
    const raw = (buchMenge[modell.id] ?? '').trim()
    setBuchFehler(m => ({ ...m, [modell.id]: null }))
    const menge = parseInt(raw, 10)
    if (!Number.isInteger(menge) || menge < 1) {
      setBuchFehler(m => ({ ...m, [modell.id]: 'Menge: ganze Zahl ≥ 1' }))
      return
    }
    const delta = typ === 'ZUGANG' ? menge : -menge
    const nextBestand = (modell.bestand ?? 0) + delta
    if (nextBestand < 0) {
      setBuchFehler(m => ({ ...m, [modell.id]: 'Menge überschreitet aktuellen Bestand' }))
      return
    }
    setBuchBusyId(modell.id)
    try {
      const stempelBestandPatch: Database['public']['Tables']['stempel_modelle']['Update'] = {
        bestand: nextBestand,
      }
      const { error: e1 } = await supabase.from('stempel_modelle').update(stempelBestandPatch).eq('id', modell.id)
      if (e1) throw e1

      const lagerBewegungInsert: Database['public']['Tables']['lager_bewegungen']['Insert'] = {
        modell_id: modell.id,
        menge,
        typ,
        person_id: session.user.id,
      }
      const { error: e2 } = await supabase.from('lager_bewegungen').insert(lagerBewegungInsert)
      if (e2) throw e2

      setModelle(list => list.map(m => (m.id === modell.id ? { ...m, bestand: nextBestand } : m)))
      setBuchMenge(m => ({ ...m, [modell.id]: '' }))
    } catch (e) {
      fehler('Buchung fehlgeschlagen')
      setBuchFehler(m => ({ ...m, [modell.id]: e instanceof Error ? e.message : String(e) }))
    } finally {
      setBuchBusyId(null)
    }
  }

  const [minEdit, setMinEdit] = useState<Record<string, string>>({})
  const saveMindestbestand = async (modell: StempelModellRow) => {
    const raw = (minEdit[modell.id] ?? String(modell.mindestbestand ?? 0)).trim()
    const n = raw === '' ? 0 : parseInt(raw, 10)
    if (!Number.isInteger(n) || n < 0) return
    if (n === (modell.mindestbestand ?? 0)) return
    const mindestPatch: Database['public']['Tables']['stempel_modelle']['Update'] = { mindestbestand: n }
    const { error } = await supabase.from('stempel_modelle').update(mindestPatch).eq('id', modell.id)
    if (error) {
      fehler('Bestand konnte nicht aktualisiert werden')
      return
    }
    setModelle(list => list.map(m => (m.id === modell.id ? { ...m, mindestbestand: n } : m)))
  }

  // ------------------------------------------------------------
  // Tab 2: Bewegungen
  // ------------------------------------------------------------
  const [bewegungen, setBewegungen] = useState<LagerBewegungRow[]>([])
  const [bewegungenLaden, setBewegungenLaden] = useState(false)
  const [bewegungenFehler, setBewegungenFehler] = useState<string | null>(null)
  const [movTyp, setMovTyp] = useState<'ALLE' | BewegungTyp>('ALLE')
  const [movSuche, setMovSuche] = useState('')

  const ladeBewegungen = async () => {
    setBewegungenLaden(true)
    setBewegungenFehler(null)
    try {
      const { data, error } = await supabase
        .from('lager_bewegungen')
        .select('*, stempel_modelle(name)')
        .order('erstellt_am', { ascending: false })
        .limit(200)
      if (error) throw error
      setBewegungen((data ?? []) as LagerBewegungRow[])
    } catch (e) {
      fehler('Daten konnten nicht geladen werden')
      setBewegungen([])
      setBewegungenFehler(e instanceof Error ? e.message : String(e))
    } finally {
      setBewegungenLaden(false)
    }
  }

  useEffect(() => {
    if (!session) return
    if (tab !== 'BEWEGUNGEN') return
    void ladeBewegungen()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, tab])

  const bewegungenGefiltert = useMemo(() => {
    const q = movSuche.trim().toLowerCase()
    return bewegungen.filter(b => {
      if (movTyp !== 'ALLE' && b.typ !== movTyp) return false
      if (!q) return true
      const name = joinName(b.stempel_modelle).toLowerCase()
      const notiz = String(b.notiz ?? '').toLowerCase()
      return name.includes(q) || notiz.includes(q)
    })
  }, [bewegungen, movSuche, movTyp])

  // ------------------------------------------------------------
  // Tab 3: Bestellliste
  // ------------------------------------------------------------
  const [bestelllisteZeilen, setBestelllisteZeilen] = useState<BestelllisteZeile[]>([])
  const [bestelllisteLaden, setBestelllisteLaden] = useState(false)
  const [bestelllisteFehler, setBestelllisteFehler] = useState<string | null>(null)
  const [bestelllisteKopiert, setBestelllisteKopiert] = useState(false)

  const ladeBestellliste = async () => {
    setBestelllisteLaden(true)
    setBestelllisteFehler(null)
    try {
      const { data: modData, error: eMod } = await supabase
        .from('stempel_modelle')
        .select('id, name, artikelnummer, typ, farbe, bestand, mindestbestand')
        .eq('aktiv', true)
      if (eMod) throw eMod

      const { data: teilData, error: eTeil } = await supabase
        .from('teilauftraege')
        .select('id, status, bereich, detail, storniert')
        .eq('bereich', 'STEMPEL')
        .neq('status', 'FERTIG')
        .eq('storniert', false)
      if (eTeil) throw eTeil

      const modelleAktiv = ((modData ?? []) as StempelModellBestellRow[]).slice()
      const idSet = new Set(modelleAktiv.map(m => m.id))
      const bedarf = new Map<string, number>()

      for (const t of (teilData ?? []) as { detail: Json }[]) {
        const det = teilJsonAlsFeldertabelle(t.detail)
        const menge = parseStueckzahlTeilauftrag(det.stueckzahl)
        const mid = det.modell_id != null && String(det.modell_id).trim() !== '' ? String(det.modell_id) : null
        const kid = det.kissen_modell_id != null && String(det.kissen_modell_id).trim() !== '' ? String(det.kissen_modell_id) : null
        if (mid && idSet.has(mid)) {
          bedarf.set(mid, (bedarf.get(mid) ?? 0) + menge)
        }
        if (kid && idSet.has(kid)) {
          bedarf.set(kid, (bedarf.get(kid) ?? 0) + menge)
        }
      }

      const zeilen: BestelllisteZeile[] = []
      for (const m of modelleAktiv) {
        const offene_menge = alsGanzzahl(bedarf.get(m.id))
        const bestand = alsGanzzahl(m.bestand)
        const mindest = alsGanzzahl(m.mindestbestand)
        const bestellmenge = Math.max(0, mindest + offene_menge - bestand)
        if (bestellmenge <= 0) continue
        zeilen.push({
          ...m,
          offene_menge,
          bestellmenge: alsGanzzahl(bestellmenge),
        })
      }
      zeilen.sort((a, b) => b.bestellmenge - a.bestellmenge)
      setBestelllisteZeilen(zeilen)
    } catch (e) {
      fehler('Daten konnten nicht geladen werden')
      setBestelllisteZeilen([])
      setBestelllisteFehler(fehlerAlsString(e))
    } finally {
      setBestelllisteLaden(false)
    }
  }

  useEffect(() => {
    if (!session) return
    if (tab !== 'BESTELLLISTE') return
    void ladeBestellliste()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, tab])

  const bestelllisteTextFuerKopie = useMemo(() => {
    const header = 'Artikelnummer | Name | Farbe | Menge'
    const body = bestelllisteZeilen
      .map(z => {
        const art = bestelllisteTextZelle(z.artikelnummer, '—')
        const name = bestelllisteTextZelle(z.name, '—')
        const fr = typeof z.farbe === 'string' ? z.farbe : null
        return `${art} | ${name} | ${farbeAnzeige(fr)} | ${bestelllisteZahlFuerAnzeige(z.bestellmenge)}`
      })
      .join('\n')
    return body ? `${header}\n${body}` : header
  }, [bestelllisteZeilen])

  const kopiereBestellliste = async () => {
    try {
      await navigator.clipboard.writeText(bestelllisteTextFuerKopie)
      setBestelllisteKopiert(true)
      window.setTimeout(() => setBestelllisteKopiert(false), 2000)
    } catch {
      fehler('Kopieren fehlgeschlagen')
    }
  }

  const logout = async () => {
    await supabase.auth.signOut()
  }

  if (laden) return null
  if (!session) return <Login />

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 18 }}>Stempel — Bestandspflege</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, opacity: 0.85 }}>{userEmail}</span>
          <button type="button" className="cp-btn cp-btn-grau" onClick={() => void logout()}>
            Logout
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14, marginBottom: 14 }}>
        <button
          type="button"
          className={tab === 'UEBERSICHT' ? 'cp-btn' : 'cp-btn cp-btn-grau'}
          onClick={() => setTab('UEBERSICHT')}
        >
          Übersicht
        </button>
        <button
          type="button"
          className={tab === 'BEWEGUNGEN' ? 'cp-btn' : 'cp-btn cp-btn-grau'}
          onClick={() => setTab('BEWEGUNGEN')}
        >
          Bewegungen
        </button>
        <button
          type="button"
          className={tab === 'BESTELLLISTE' ? 'cp-btn' : 'cp-btn cp-btn-grau'}
          onClick={() => setTab('BESTELLLISTE')}
        >
          Bestellliste
        </button>
      </div>

      {tab === 'UEBERSICHT' && (
        <div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <input
              type="search"
              className="cp-select"
              placeholder="Name oder Artikelnummer…"
              value={uebersichtSuche}
              onChange={e => setUebersichtSuche(e.target.value)}
              aria-label="Suche Name oder Artikelnummer"
              style={{ minWidth: 220, maxWidth: 320 }}
            />
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={filterNachbestellen}
                onChange={e => setFilterNachbestellen(e.target.checked)}
              />
              Nur Nachbestellen
            </label>
            <select
              className="cp-select"
              value={filterTyp}
              onChange={e => {
                const v = e.target.value
                setFilterTyp(v)
                if (v !== 'TRODAT_KISSEN' && v !== 'STEMPELKISSEN_PRODUKT') setFilterFarbe('ALLE')
              }}
              style={{ maxWidth: 260 }}
            >
              <option value="ALLE">Alle Typen</option>
              {STEMPEL_TYP_FILTER_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {(filterTyp === 'TRODAT_KISSEN' || filterTyp === 'STEMPELKISSEN_PRODUKT') && (
              <select
                className="cp-select"
                value={filterFarbe}
                onChange={e => setFilterFarbe(e.target.value)}
                style={{ maxWidth: 200 }}
                aria-label="Filter Farbe"
              >
                <option value="ALLE">Alle Farben</option>
                {(Object.keys(STEMPEL_FARBE_ANZEIGE) as StempelFarbeDb[]).map(f => (
                  <option key={f} value={f}>
                    {STEMPEL_FARBE_ANZEIGE[f]}
                  </option>
                ))}
              </select>
            )}
            <button type="button" className="cp-btn cp-btn-grau" onClick={() => void ladeModelle()} disabled={modelleLaden}>
              Neu laden
            </button>
          </div>

          {modelleFehler && <p style={{ color: '#b91c1c' }}>{modelleFehler}</p>}
          {modelleLaden && <p style={{ opacity: 0.8 }}>Lädt…</p>}

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                  <th
                    style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => toggleSort('name')}
                    title="Sortieren"
                  >
                    Name{sortierung?.key === 'name' ? (sortierung.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                  <th
                    style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => toggleSort('farbe')}
                    title="Sortieren"
                  >
                    Farbe{sortierung?.key === 'farbe' ? (sortierung.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                  <th
                    style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => toggleSort('druckflaeche')}
                    title="Sortieren"
                  >
                    Druckfläche{sortierung?.key === 'druckflaeche' ? (sortierung.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                  <th
                    style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => toggleSort('typ')}
                    title="Sortieren"
                  >
                    Typ{sortierung?.key === 'typ' ? (sortierung.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                  <th
                    style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => toggleSort('bestand')}
                    title="Sortieren"
                  >
                    Bestand{sortierung?.key === 'bestand' ? (sortierung.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                  <th
                    style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => toggleSort('mindestbestand')}
                    title="Sortieren"
                  >
                    Mindestbestand
                    {sortierung?.key === 'mindestbestand' ? (sortierung.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                  <th style={{ padding: '8px 6px' }}>VK-Preis</th>
                  <th
                    style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => toggleSort('status')}
                    title="Sortieren"
                  >
                    Status{sortierung?.key === 'status' ? (sortierung.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                </tr>
              </thead>
              <tbody>
                {modelleGefiltert.map(m => {
                  const st = statusInfo(m)
                  const minRaw = minEdit[m.id]
                  const minVal = minRaw != null ? minRaw : String(m.mindestbestand ?? 0)
                  const mengeStr = (buchMenge[m.id] ?? '').slice(0, 3)
                  const menge = mengeStr.trim() === '' ? null : parseInt(mengeStr, 10)
                  const mengeOk = menge != null && Number.isInteger(menge) && menge >= 1
                  const zugangDisabled = !mengeOk || buchBusyId != null
                  const abgangDisabled = !mengeOk || buchBusyId != null || (mengeOk && (menge as number) > (m.bestand ?? 0))
                  return (
                    <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 6px', fontWeight: 600 }}>{m.name}</td>
                      <td style={{ padding: '8px 6px', opacity: 0.9 }}>{farbeAnzeige(m.farbe)}</td>
                      <td style={{ padding: '8px 6px', opacity: 0.85 }}>{m.druckflaeche ?? ''}</td>
                      <td style={{ padding: '8px 6px', opacity: 0.9 }}>{typAnzeige(m.typ)}</td>
                      <td style={{ padding: '8px 6px' }}>{m.bestand ?? 0}</td>
                      <td style={{ padding: '8px 6px' }}>
                        <input
                          type="number"
                          className="cp-select"
                          value={minVal}
                          min={0}
                          step={1}
                          onChange={e => setMinEdit(s => ({ ...s, [m.id]: e.target.value }))}
                          onBlur={() => void saveMindestbestand(m)}
                          style={{ maxWidth: 110 }}
                        />
                      </td>
                      <td style={{ padding: '8px 6px' }}>{fmtVkPreisNetto(m.vk_preis_netto)}</td>
                      <td style={{ padding: '8px 6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span className={`badge ${st.cls}`}>{st.label}</span>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <input
                              type="number"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              min={1}
                              max={999}
                              step={1}
                              value={mengeStr}
                              onChange={e => {
                                const v = e.target.value
                                const cleaned = v.replace(/[^\d]/g, '').slice(0, 3)
                                setBuchMenge(s => ({ ...s, [m.id]: cleaned }))
                              }}
                              style={{
                                width: 52,
                                padding: '6px 8px',
                                border: '1px solid #d4d4d4',
                                borderRadius: 6,
                                fontSize: 13,
                                appearance: 'textfield',
                              }}
                            />
                            <button
                              type="button"
                              className="cp-btn cp-btn-grau"
                              style={{ width: 34, padding: '6px 0', textAlign: 'center' }}
                              disabled={zugangDisabled}
                              onClick={() => void buchen(m, 'ZUGANG')}
                              title="Zugang buchen"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              className="cp-btn cp-btn-grau"
                              style={{ width: 34, padding: '6px 0', textAlign: 'center' }}
                              disabled={abgangDisabled}
                              onClick={() => void buchen(m, 'ABGANG')}
                              title="Abgang buchen"
                            >
                              -
                            </button>
                          </div>
                        </div>
                        {buchFehler[m.id] && <div style={{ marginTop: 6, color: '#b91c1c' }}>{buchFehler[m.id]}</div>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'BEWEGUNGEN' && (
        <div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <select
              className="cp-select"
              value={movTyp}
              onChange={e => {
                const v = (e.target as HTMLSelectElement).value
                if (v === 'ALLE') setMovTyp('ALLE')
                else if (v === 'ZUGANG' || v === 'ABGANG' || v === 'AUTOABGANG') setMovTyp(v)
              }}
              style={{ maxWidth: 220 }}
            >
              <option value="ALLE">Alle</option>
              <option value="ZUGANG">Zugang</option>
              <option value="ABGANG">Abgang</option>
              <option value="AUTOABGANG">Auto-Abgang</option>
            </select>
            <input
              type="text"
              className="cp-select"
              placeholder="Modell suchen…"
              value={movSuche}
              onChange={e => setMovSuche(e.target.value)}
              style={{ minWidth: 280 }}
            />
            <button type="button" className="cp-btn cp-btn-grau" onClick={() => void ladeBewegungen()} disabled={bewegungenLaden}>
              Neu laden
            </button>
          </div>

          {bewegungenFehler && <p style={{ color: '#b91c1c' }}>{bewegungenFehler}</p>}
          {bewegungenLaden && <p style={{ opacity: 0.8 }}>Lädt…</p>}

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '8px 6px' }}>Datum</th>
                  <th style={{ padding: '8px 6px' }}>Modell</th>
                  <th style={{ padding: '8px 6px' }}>Typ</th>
                  <th style={{ padding: '8px 6px' }}>Menge</th>
                  <th style={{ padding: '8px 6px' }}>Notiz</th>
                  <th style={{ padding: '8px 6px' }}>Person</th>
                </tr>
              </thead>
              <tbody>
                {bewegungenGefiltert.map(b => {
                  const typBadge =
                    b.typ === 'ZUGANG'
                      ? { cls: 'badge-gruen', label: 'Zugang' }
                      : b.typ === 'ABGANG'
                      ? { cls: 'badge-grau', label: 'Abgang' }
                      : { cls: 'badge-blau', label: 'Auto-Abgang' }
                  const person = b.person_id ? mitarbeiterEmailById.get(b.person_id) ?? b.person_id : ''
                  return (
                    <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 6px' }}>{fmtDateTime(b.erstellt_am)}</td>
                      <td style={{ padding: '8px 6px', fontWeight: 600 }}>{joinName(b.stempel_modelle)}</td>
                      <td style={{ padding: '8px 6px' }}>
                        <span className={`badge ${typBadge.cls}`}>{typBadge.label}</span>
                      </td>
                      <td style={{ padding: '8px 6px' }}>{b.menge}</td>
                      <td style={{ padding: '8px 6px', opacity: 0.9 }}>{b.notiz ?? ''}</td>
                      <td style={{ padding: '8px 6px', opacity: 0.85 }}>{person}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'BESTELLLISTE' && (
        <div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <button
              type="button"
              className="cp-btn cp-btn-grau"
              onClick={() => void ladeBestellliste()}
              disabled={bestelllisteLaden}
            >
              Aktualisieren
            </button>
            <button
              type="button"
              className="cp-btn"
              onClick={() => void kopiereBestellliste()}
              disabled={bestelllisteLaden || bestelllisteZeilen.length === 0}
            >
              Kopieren
            </button>
            {bestelllisteKopiert && (
              <span style={{ fontSize: 13, color: '#15803d' }}>In Zwischenablage kopiert</span>
            )}
          </div>

          {bestelllisteFehler && <p style={{ color: '#b91c1c' }}>{bestelllisteFehler}</p>}
          {bestelllisteLaden && <p style={{ opacity: 0.8 }}>Lädt…</p>}

          {!bestelllisteLaden && !bestelllisteFehler && bestelllisteZeilen.length === 0 && (
            <p style={{ margin: '12px 0', color: '#15803d', fontWeight: 600 }}>
              Alles auf Lager — keine Bestellung nötig
            </p>
          )}

          {bestelllisteZeilen.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '8px 6px' }}>Name</th>
                    <th style={{ padding: '8px 6px' }}>Artikelnummer</th>
                    <th style={{ padding: '8px 6px' }}>Typ</th>
                    <th style={{ padding: '8px 6px' }}>Farbe</th>
                    <th style={{ padding: '8px 6px' }}>Bestand</th>
                    <th style={{ padding: '8px 6px' }}>Offene Aufträge</th>
                    <th style={{ padding: '8px 6px' }}>Mindestbestand</th>
                    <th style={{ padding: '8px 6px' }}>Bestellen</th>
                  </tr>
                </thead>
                <tbody>
                  {bestelllisteZeilen.map(z => {
                    const typStr = typeof z.typ === 'string' ? z.typ : bestelllisteTextZelle(z.typ, '')
                    const fr = typeof z.farbe === 'string' ? z.farbe : null
                    return (
                    <tr key={String(z.id)} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 6px', fontWeight: 600 }}>{bestelllisteTextZelle(z.name, '—')}</td>
                      <td style={{ padding: '8px 6px' }}>{bestelllisteTextZelle(z.artikelnummer, '—')}</td>
                      <td style={{ padding: '8px 6px', opacity: 0.9 }}>{typAnzeige(typStr)}</td>
                      <td style={{ padding: '8px 6px', opacity: 0.9 }}>{farbeAnzeige(fr)}</td>
                      <td style={{ padding: '8px 6px' }}>{bestelllisteZahlFuerAnzeige(z.bestand)}</td>
                      <td style={{ padding: '8px 6px' }}>{bestelllisteZahlFuerAnzeige(z.offene_menge)}</td>
                      <td style={{ padding: '8px 6px' }}>{bestelllisteZahlFuerAnzeige(z.mindestbestand)}</td>
                      <td
                        style={{
                          padding: '8px 6px',
                          fontWeight: 700,
                          color: '#b91c1c',
                        }}
                      >
                        {bestelllisteZahlFuerAnzeige(z.bestellmenge)}
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

