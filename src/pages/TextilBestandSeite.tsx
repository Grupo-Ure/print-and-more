import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { Login } from '../components/Login'
import { useToast } from '../components/Toast'
import type { Database } from '../types/supabase'

type MarkeRow = Database['public']['Tables']['textil_marken']['Row']
type ProduktRow = Database['public']['Tables']['textil_produkte']['Row'] & {
  textil_marken?: { name: string } | { name: string }[] | null
}
type VarianteRow = Database['public']['Tables']['textil_varianten']['Row'] & {
  textil_produkte?: unknown
}
type Tab = 'PRODUKTE' | 'BESTAND' | 'BESTELLLISTE'

const STANDARD_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'] as const
const KIDS_SIZES = ['98/104', '110/116', '122/128', '134/146', '152/161'] as const

function joinName(x: unknown): string {
  if (!x) return ''
  if (Array.isArray(x)) return String((x[0] as { name?: string })?.name ?? '')
  return String((x as { name?: string }).name ?? '')
}

function oneNested<T>(x: T | T[] | null | undefined): T | null {
  if (x == null) return null
  return Array.isArray(x) ? (x[0] ?? null) : x
}

type ProduktNested = {
  name: string
  artikelnummer: string | null
  textil_marken?: unknown
}

function produktNested(v: VarianteRow): ProduktNested | null {
  const p = oneNested(v.textil_produkte as ProduktNested | ProduktNested[] | null)
  return p
}

function markeVonVariante(v: VarianteRow): string {
  const p = produktNested(v)
  if (!p) return ''
  return joinName(p.textil_marken)
}

function produktNameVonVariante(v: VarianteRow): string {
  const p = produktNested(v)
  return p?.name ?? '—'
}

function alsGanzzahl(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v)
  if (typeof v === 'string' && v.trim() !== '') {
    const p = parseInt(v, 10)
    if (Number.isFinite(p)) return p
  }
  return 0
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

/** Status für Bestand-Tab (ohne Muster: Farblogik; Muster: immer grau). */
function statusTextil(
  v: VarianteRow
): { cls: string; label: string; rank: number } {
  if (v.ist_muster) return { cls: 'badge-grau', label: 'Muster', rank: -1 }
  const b = v.bestand ?? 0
  const min = v.mindestbestand ?? 0
  if (b <= 0) return { cls: 'badge-rot', label: 'Leer', rank: 0 }
  if (b < min) return { cls: 'badge-rot', label: 'Nachbestellen', rank: 1 }
  if (b === min) return { cls: 'badge-orange', label: 'Minimum', rank: 2 }
  return { cls: 'badge-gruen', label: 'OK', rank: 3 }
}

type BestellZeile = VarianteRow & { offene_menge: number; bestellmenge: number }

export function TextilBestandSeite() {
  const { fehler, erfolg } = useToast()
  const [session, setSession] = useState<Session | null>(null)
  const [laden, setLaden] = useState(true)
  const [tab, setTab] = useState<Tab>('PRODUKTE')

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
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!alive) return
      setSession(s)
    })
    return () => {
      alive = false
      data.subscription.unsubscribe()
    }
  }, [])

  const userEmail = session?.user?.email ?? session?.user?.id ?? ''

  // ——— Marken / Produkte (Tab Produkte) ———
  const [marken, setMarken] = useState<MarkeRow[]>([])
  const [markenLaden, setMarkenLaden] = useState(false)
  const [neueMarkeName, setNeueMarkeName] = useState('')
  const [markeNeuFormOffen, setMarkeNeuFormOffen] = useState(false)
  const [editingMarkeId, setEditingMarkeId] = useState<string | null>(null)
  const [editMarkeName, setEditMarkeName] = useState('')
  const [editMarkeAktiv, setEditMarkeAktiv] = useState(true)

  const ladeMarken = useCallback(async () => {
    setMarkenLaden(true)
    const { data, error: err } = await supabase.from('textil_marken').select('*').order('name')
    setMarkenLaden(false)
    if (err) {
      fehler('Marken konnten nicht geladen werden')
      return
    }
    setMarken((data ?? []) as MarkeRow[])
  }, [fehler])

  useEffect(() => {
    if (!session) return
    if (tab !== 'PRODUKTE') return
    void ladeMarken()
  }, [session, tab, ladeMarken])

  const [markeIdProdukte, setMarkeIdProdukte] = useState<string>('')
  const [produkte, setProdukte] = useState<ProduktRow[]>([])
  const [produkteLaden, setProdukteLaden] = useState(false)
  const [produktIdVarianten, setProduktIdVarianten] = useState<string>('')

  const ladeProdukteFuerMarke = useCallback(
    async (mId: string) => {
      if (!mId) {
        setProdukte([])
        return
      }
      setProdukteLaden(true)
      const { data, error: err } = await supabase
        .from('textil_produkte')
        .select('*, textil_marken(name)')
        .eq('marke_id', mId)
        .order('name')
      setProdukteLaden(false)
      if (err) {
        fehler('Produkte konnten nicht geladen werden')
        return
      }
      setProdukte((data ?? []) as ProduktRow[])
    },
    [fehler]
  )

  useEffect(() => {
    if (tab !== 'PRODUKTE') return
    void ladeProdukteFuerMarke(markeIdProdukte)
  }, [tab, markeIdProdukte, ladeProdukteFuerMarke])

  const [neuesProdukt, setNeuesProdukt] = useState({
    marke_id: '',
    name: '',
    artikelnummer: '',
    beschreibung: '',
  })
  const [produktFormOffen, setProduktFormOffen] = useState(false)
  const [editProdukt, setEditProdukt] = useState<ProduktRow | null>(null)
  const [editProduktName, setEditProduktName] = useState('')
  const [editProduktArt, setEditProduktArt] = useState('')
  const [editProduktBesch, setEditProduktBesch] = useState('')
  const [editProduktAktiv, setEditProduktAktiv] = useState(true)

  const [varianten, setVarianten] = useState<VarianteRow[]>([])
  const [variantenLaden, setVariantenLaden] = useState(false)

  const ladeVariantenFuerProdukt = useCallback(
    async (pId: string) => {
      if (!pId) {
        setVarianten([])
        return
      }
      setVariantenLaden(true)
      const { data, error: err } = await supabase
        .from('textil_varianten')
        .select(
          '*, textil_produkte(name, artikelnummer, textil_marken(name))'
        )
        .eq('produkt_id', pId)
        .order('sort_order')
      setVariantenLaden(false)
      if (err) {
        fehler('Varianten konnten nicht geladen werden')
        return
      }
      setVarianten((data ?? []) as VarianteRow[])
    },
    [fehler]
  )

  useEffect(() => {
    if (tab !== 'PRODUKTE') return
    void ladeVariantenFuerProdukt(produktIdVarianten)
  }, [tab, produktIdVarianten, ladeVariantenFuerProdukt])

  const [neueVariante, setNeueVariante] = useState({
    farbe: '',
    farbcode: '' as string,
    groesse: '',
    ist_muster: false,
    mindestbestand: '0',
  })
  const [varianteFormOffen, setVarianteFormOffen] = useState(false)
  const [editVariante, setEditVariante] = useState<VarianteRow | null>(null)
  const [editVarFarbe, setEditVarFarbe] = useState('')
  const [editVarFarbcode, setEditVarFarbcode] = useState('')
  const [editVarGroesse, setEditVarGroesse] = useState('')
  const [editVarMuster, setEditVarMuster] = useState(false)
  const [editVarMin, setEditVarMin] = useState('0')
  const [editVarAktiv, setEditVarAktiv] = useState(true)

  // Matrix-Anlegen (Farben × Größen)
  type MatrixFarbe = { name: string; hex: string }
  const [matrixFarben, setMatrixFarben] = useState<MatrixFarbe[]>([])
  const [matrixFarbName, setMatrixFarbName] = useState('')
  const [matrixFarbHex, setMatrixFarbHex] = useState('#000000')
  const [matrixSelectedSizes, setMatrixSelectedSizes] = useState<string[]>([])
  const [matrixCustomSizes, setMatrixCustomSizes] = useState<string[]>([])
  const [matrixCustomInput, setMatrixCustomInput] = useState('')
  const [matrixEigeneOffen, setMatrixEigeneOffen] = useState(false)
  const [matrixMin, setMatrixMin] = useState('0')
  const [matrixAlleMuster, setMatrixAlleMuster] = useState(false)
  const [matrixBusy, setMatrixBusy] = useState(false)
  const [zeigeEinzelVariante, setZeigeEinzelVariante] = useState(false)

  const [buchMenge, setBuchMenge] = useState<Record<string, string>>({})
  const [buchBusyId, setBuchBusyId] = useState<string | null>(null)
  const [buchFehler, setBuchFehler] = useState<Record<string, string | null>>({})
  const [minEdit, setMinEdit] = useState<Record<string, string>>({})

  const buchen = async (
    v: VarianteRow,
    typ: 'ZUGANG' | 'ABGANG',
    onSuccess?: (nextBestand: number) => void
  ) => {
    if (!session?.user) return
    if (buchBusyId) return
    const raw = (buchMenge[v.id] ?? '').trim()
    setBuchFehler(m => ({ ...m, [v.id]: null }))
    const menge = parseInt(raw, 10)
    if (!Number.isInteger(menge) || menge < 1) {
      setBuchFehler(m => ({ ...m, [v.id]: 'Menge: ganze Zahl ≥ 1' }))
      return
    }
    const delta = typ === 'ZUGANG' ? menge : -menge
    const nextBestand = (v.bestand ?? 0) + delta
    if (nextBestand < 0) {
      setBuchFehler(m => ({ ...m, [v.id]: 'Menge überschreitet aktuellen Bestand' }))
      return
    }
    setBuchBusyId(v.id)
    try {
      const { error: e1 } = await supabase
        .from('textil_varianten')
        .update({ bestand: nextBestand })
        .eq('id', v.id)
      if (e1) throw e1

      const { error: e2 } = await supabase.from('textil_lager_bewegungen').insert({
        variante_id: v.id,
        menge,
        typ,
        person_id: session.user.id,
      })
      if (e2) throw e2

      if (onSuccess) {
        onSuccess(nextBestand)
      } else {
        setVarianten(list => list.map(x => (x.id === v.id ? { ...x, bestand: nextBestand } : x)))
      }
      setBuchMenge(m => ({ ...m, [v.id]: '' }))
    } catch (e) {
      fehler('Buchung fehlgeschlagen')
      setBuchFehler(m => ({ ...m, [v.id]: fehlerAlsString(e) }))
    } finally {
      setBuchBusyId(null)
    }
  }

  const buchenBestandTab = async (v: VarianteRow, typ: 'ZUGANG' | 'ABGANG') => {
    await buchen(v, typ, nextBestand => {
      setVariantenGlobal(list => list.map(x => (x.id === v.id ? { ...x, bestand: nextBestand } : x)))
    })
  }

  const speichereMindest = async (v: VarianteRow) => {
    const raw = (minEdit[v.id] ?? String(v.mindestbestand ?? 0)).trim()
    const n = raw === '' ? 0 : parseInt(raw, 10)
    if (!Number.isInteger(n) || n < 0) return
    if (n === (v.mindestbestand ?? 0)) return
    const { error: err } = await supabase
      .from('textil_varianten')
      .update({ mindestbestand: n })
      .eq('id', v.id)
    if (err) {
      fehler('Mindestbestand konnte nicht gespeichert werden')
      return
    }
    setVarianten(list => list.map(x => (x.id === v.id ? { ...x, mindestbestand: n } : x)))
    setVariantenGlobal(list => list.map(x => (x.id === v.id ? { ...x, mindestbestand: n } : x)))
  }

  // ——— Bestand-Tab: alle Varianten ———
  const [variantenGlobal, setVariantenGlobal] = useState<VarianteRow[]>([])
  const [globalLaden, setGlobalLaden] = useState(false)
  const [bestandSuche, setBestandSuche] = useState('')
  const [bestandMarke, setBestandMarke] = useState<string>('ALLE')
  const [filterNachbestellen, setFilterNachbestellen] = useState(false)
  const [filterNurMuster, setFilterNurMuster] = useState(false)
  type SortKeyB =
    | 'marke'
    | 'produkt'
    | 'farbe'
    | 'groesse'
    | 'muster'
    | 'bestand'
    | 'mindestbestand'
    | 'status'
  const [sortB, setSortB] = useState<{ key: SortKeyB; dir: 'asc' | 'desc' } | null>(null)

  const toggleSortB = (key: SortKeyB) => {
    setSortB(s => {
      if (!s || s.key !== key) return { key, dir: 'asc' }
      if (s.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

  const ladeVariantenGlobal = useCallback(async () => {
    setGlobalLaden(true)
    const { data, error: err } = await supabase
      .from('textil_varianten')
      .select('*, textil_produkte(name, artikelnummer, textil_marken(name))')
      .eq('aktiv', true)
      .order('sort_order')
    setGlobalLaden(false)
    if (err) {
      fehler('Bestand konnte nicht geladen werden')
      return
    }
    setVariantenGlobal((data ?? []) as VarianteRow[])
  }, [fehler])

  useEffect(() => {
    if (!session) return
    if (tab !== 'BESTAND' && tab !== 'BESTELLLISTE') return
    void ladeVariantenGlobal()
  }, [session, tab, ladeVariantenGlobal])

  const markenOptionsBestand = useMemo(() => {
    const set = new Set<string>()
    for (const v of variantenGlobal) {
      const m = markeVonVariante(v)
      if (m) set.add(m)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'de'))
  }, [variantenGlobal])

  const variantenGefiltert = useMemo(() => {
    let list = variantenGlobal.slice()
    if (bestandMarke !== 'ALLE') {
      list = list.filter(v => markeVonVariante(v) === bestandMarke)
    }
    if (filterNurMuster) list = list.filter(v => v.ist_muster)
    if (filterNachbestellen) {
      list = list.filter(v => {
        if (v.ist_muster) return false
        const b = v.bestand ?? 0
        const min = v.mindestbestand ?? 0
        return b < min
      })
    }
    const q = bestandSuche.trim().toLowerCase()
    if (q) {
      list = list.filter(v => {
        const marke = markeVonVariante(v).toLowerCase()
        const pr = produktNameVonVariante(v).toLowerCase()
        const farbe = String(v.farbe ?? '').toLowerCase()
        const gr = String(v.groesse ?? '').toLowerCase()
        return marke.includes(q) || pr.includes(q) || farbe.includes(q) || gr.includes(q)
      })
    }
    if (sortB) {
      const dir = sortB.dir === 'asc' ? 1 : -1
      const key = sortB.key
      list = list.slice().sort((a, b) => {
        const ar =
          key === 'marke'
            ? markeVonVariante(a)
            : key === 'produkt'
              ? produktNameVonVariante(a)
              : key === 'farbe'
                ? a.farbe
                : key === 'groesse'
                  ? a.groesse
                  : key === 'muster'
                    ? (a.ist_muster ? 1 : 0)
                    : key === 'bestand'
                      ? a.bestand ?? 0
                      : key === 'mindestbestand'
                        ? a.mindestbestand ?? 0
                        : statusTextil(a).rank
        const br =
          key === 'marke'
            ? markeVonVariante(b)
            : key === 'produkt'
              ? produktNameVonVariante(b)
              : key === 'farbe'
                ? b.farbe
                : key === 'groesse'
                  ? b.groesse
                  : key === 'muster'
                    ? (b.ist_muster ? 1 : 0)
                    : key === 'bestand'
                      ? b.bestand ?? 0
                      : key === 'mindestbestand'
                        ? b.mindestbestand ?? 0
                        : statusTextil(b).rank
        if (typeof ar === 'number' && typeof br === 'number') {
          if (ar !== br) return (ar - br) * dir
        } else {
          const c = String(ar).localeCompare(String(br), 'de')
          if (c !== 0) return c * dir
        }
        return a.id.localeCompare(b.id)
      })
    }
    return list
  }, [
    variantenGlobal,
    bestandMarke,
    bestandSuche,
    filterNachbestellen,
    filterNurMuster,
    sortB,
  ])

  // ——— Bestellliste ———
  const [bestellZeilen, setBestellZeilen] = useState<BestellZeile[]>([])
  const [bestellLaden, setBestellLaden] = useState(false)
  const [bestellFehler, setBestellFehler] = useState<string | null>(null)
  const [bestellKopiert, setBestellKopiert] = useState(false)

  const ladeBestellliste = useCallback(async () => {
    setBestellLaden(true)
    setBestellFehler(null)
    try {
      const { data: vData, error: eV } = await supabase
        .from('textil_varianten')
        .select('*, textil_produkte(name, artikelnummer, textil_marken(name))')
        .eq('aktiv', true)
        .order('sort_order')
      if (eV) throw eV
      const variantenAktiv = (vData ?? []) as VarianteRow[]
      const vIds = new Set(variantenAktiv.map(v => v.id))

      const { data: teilData, error: eT } = await supabase
        .from('teilauftraege')
        .select('id')
        .eq('bereich', 'TEXTIL')
        .eq('storniert', false)
        .neq('status', 'FERTIG')
      if (eT) throw eT
      const teilIds = (teilData ?? []).map((t: { id: string }) => t.id)
      const bedarf = new Map<string, number>()

      const chunk = 200
      for (let i = 0; i < teilIds.length; i += chunk) {
        const sl = teilIds.slice(i, i + chunk)
        if (sl.length === 0) continue
        const { data: posData, error: eP } = await supabase
          .from('textil_positionen')
          .select('variante_id, stueckzahl')
          .eq('herkunft', 'EIGENWARE')
          .not('variante_id', 'is', null)
          .in('teilauftrag_id', sl)
        if (eP) throw eP
        for (const row of (posData ?? []) as { variante_id: string | null; stueckzahl: number }[]) {
          const vid = row.variante_id
          if (!vid || !vIds.has(vid)) continue
          const add = alsGanzzahl(row.stueckzahl)
          bedarf.set(vid, (bedarf.get(vid) ?? 0) + add)
        }
      }

      const zeilen: BestellZeile[] = []
      for (const v of variantenAktiv) {
        const offene = alsGanzzahl(bedarf.get(v.id))
        const best = alsGanzzahl(v.bestand)
        const min = alsGanzzahl(v.mindestbestand)
        const bestellmenge = Math.max(0, min + offene - best)
        if (bestellmenge <= 0) continue
        zeilen.push({ ...v, offene_menge: offene, bestellmenge: alsGanzzahl(bestellmenge) })
      }
      zeilen.sort((a, b) => b.bestellmenge - a.bestellmenge)
      setBestellZeilen(zeilen)
    } catch (e) {
      fehler('Bestellliste konnte nicht geladen werden')
      setBestellZeilen([])
      setBestellFehler(fehlerAlsString(e))
    } finally {
      setBestellLaden(false)
    }
  }, [fehler])

  useEffect(() => {
    if (!session) return
    if (tab !== 'BESTELLLISTE') return
    void ladeBestellliste()
  }, [session, tab, ladeBestellliste])

  const bestellTextFuerKopie = useMemo(() => {
    const header = 'Marke | Produkt | Farbe | Größe | Bestand | Offen | Mindestbestand | Bestellen'
    const body = bestellZeilen
      .map(z => {
        return [
          bestelllisteTextZelle(markeVonVariante(z), ''),
          bestelllisteTextZelle(produktNameVonVariante(z), ''),
          bestelllisteTextZelle(z.farbe, ''),
          bestelllisteTextZelle(z.groesse, ''),
          bestelllisteZahlFuerAnzeige(z.bestand),
          bestelllisteZahlFuerAnzeige(z.offene_menge),
          bestelllisteZahlFuerAnzeige(z.mindestbestand),
          bestelllisteZahlFuerAnzeige(z.bestellmenge),
        ].join(' | ')
      })
      .join('\n')
    return body ? `${header}\n${body}` : header
  }, [bestellZeilen])

  const kopiereBestell = async () => {
    try {
      await navigator.clipboard.writeText(bestellTextFuerKopie)
      setBestellKopiert(true)
      window.setTimeout(() => setBestellKopiert(false), 2000)
    } catch {
      fehler('Kopieren fehlgeschlagen')
    }
  }

  const logout = async () => {
    await supabase.auth.signOut()
  }

  const speichereMarke = async () => {
    const n = neueMarkeName.trim()
    if (!n) return
    const { error: err } = await supabase.from('textil_marken').insert({ name: n, aktiv: true })
    if (err) {
      fehler('Marke konnte nicht angelegt werden')
      return
    }
    setNeueMarkeName('')
    setMarkeNeuFormOffen(false)
    void ladeMarken()
  }

  const updateMarke = async () => {
    if (!editingMarkeId) return
    const n = editMarkeName.trim()
    if (!n) return
    const zuletztBearbeitet = editingMarkeId
    const { error: err } = await supabase
      .from('textil_marken')
      .update({ name: n, aktiv: editMarkeAktiv })
      .eq('id', editingMarkeId)
    if (err) {
      fehler('Marke konnte nicht gespeichert werden')
      return
    }
    setEditingMarkeId(null)
    void ladeMarken()
    if (markeIdProdukte === zuletztBearbeitet) void ladeProdukteFuerMarke(markeIdProdukte)
  }

  const speichereProdukt = async () => {
    const mId = neuesProdukt.marke_id || markeIdProdukte
    const n = neuesProdukt.name.trim()
    if (!mId || !n) {
      fehler('Marke und Name sind Pflicht')
      return
    }
    const { error: err } = await supabase.from('textil_produkte').insert({
      marke_id: mId,
      name: n,
      artikelnummer: neuesProdukt.artikelnummer.trim() || null,
      beschreibung: neuesProdukt.beschreibung.trim() || null,
      aktiv: true,
    })
    if (err) {
      fehler('Produkt konnte nicht angelegt werden')
      return
    }
    setNeuesProdukt({ marke_id: '', name: '', artikelnummer: '', beschreibung: '' })
    setProduktFormOffen(false)
    if (mId === markeIdProdukte) void ladeProdukteFuerMarke(markeIdProdukte)
  }

  const updateProdukt = async () => {
    if (!editProdukt) return
    const n = editProduktName.trim()
    if (!n) return
    const { error: err } = await supabase
      .from('textil_produkte')
      .update({
        name: n,
        artikelnummer: editProduktArt.trim() || null,
        beschreibung: editProduktBesch.trim() || null,
        aktiv: editProduktAktiv,
      })
      .eq('id', editProdukt.id)
    if (err) {
      fehler('Produkt konnte nicht gespeichert werden')
      return
    }
    setEditProdukt(null)
    void ladeProdukteFuerMarke(markeIdProdukte)
    if (produktIdVarianten) void ladeVariantenFuerProdukt(produktIdVarianten)
  }

  const speichereVariante = async () => {
    if (!produktIdVarianten) {
      fehler('Produkt wählen')
      return
    }
    const farbe = neueVariante.farbe.trim()
    const groesse = neueVariante.groesse.trim()
    if (!farbe || !groesse) {
      fehler('Farbe und Größe sind Pflicht')
      return
    }
    const minRaw = neueVariante.mindestbestand.trim()
    const min = minRaw === '' ? 0 : parseInt(minRaw, 10)
    if (!Number.isInteger(min) || min < 0) {
      fehler('Mindestbestand ungültig')
      return
    }
    const { data: maxRow } = await supabase
      .from('textil_varianten')
      .select('sort_order')
      .eq('produkt_id', produktIdVarianten)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    const nextSort = alsGanzzahl((maxRow as { sort_order: number } | null)?.sort_order) + 1
    const { error: err } = await supabase.from('textil_varianten').insert({
      produkt_id: produktIdVarianten,
      farbe,
      farbcode: neueVariante.farbcode.trim() || null,
      groesse,
      ist_muster: neueVariante.ist_muster,
      mindestbestand: min,
      bestand: 0,
      sort_order: nextSort,
      aktiv: true,
    })
    if (err) {
      fehler('Variante konnte nicht angelegt werden')
      return
    }
    setNeueVariante({
      farbe: '',
      farbcode: '',
      groesse: '',
      ist_muster: false,
      mindestbestand: '0',
    })
    setVarianteFormOffen(false)
    void ladeVariantenFuerProdukt(produktIdVarianten)
  }

  const resetMatrix = () => {
    setMatrixFarben([])
    setMatrixFarbName('')
    setMatrixFarbHex('#000000')
    setMatrixSelectedSizes([])
    setMatrixCustomSizes([])
    setMatrixCustomInput('')
    setMatrixEigeneOffen(false)
    setMatrixMin('0')
    setMatrixAlleMuster(false)
  }

  const matrixSizeOrder = useMemo(() => {
    const base = [...STANDARD_SIZES, ...KIDS_SIZES] as string[]
    const all = [...base, ...matrixCustomSizes]
    // unique, stable
    const seen = new Set<string>()
    const out: string[] = []
    for (const s of all) {
      const t = String(s).trim()
      if (!t || seen.has(t)) continue
      seen.add(t)
      out.push(t)
    }
    return out
  }, [matrixCustomSizes])

  const toggleMatrixSize = (s: string) => {
    setMatrixSelectedSizes(prev => (prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]))
  }

  const addMatrixRun = (sizes: readonly string[]) => {
    setMatrixSelectedSizes(prev => {
      const set = new Set(prev)
      for (const s of sizes) set.add(s)
      return Array.from(set)
    })
  }

  const addCustomSize = () => {
    const raw = matrixCustomInput.trim()
    if (!raw) return
    const clean = raw.replace(/\s+/g, ' ')
    setMatrixCustomSizes(prev => (prev.includes(clean) ? prev : [...prev, clean]))
    setMatrixSelectedSizes(prev => (prev.includes(clean) ? prev : [...prev, clean]))
    setMatrixCustomInput('')
  }

  const removeCustomSize = (s: string) => {
    setMatrixCustomSizes(prev => prev.filter(x => x !== s))
    setMatrixSelectedSizes(prev => prev.filter(x => x !== s))
  }

  const addMatrixFarbe = () => {
    const name = matrixFarbName.trim()
    if (!name) return
    const hex = (matrixFarbHex || '#000000').toUpperCase()
    const key = name.toLowerCase()
    setMatrixFarben(prev => {
      if (prev.some(f => f.name.toLowerCase() === key)) return prev
      return [...prev, { name, hex }]
    })
    setMatrixFarbName('')
  }

  const removeMatrixFarbe = (name: string) => {
    setMatrixFarben(prev => prev.filter(f => f.name !== name))
  }

  const legeVariantenMatrixAn = async () => {
    if (!produktIdVarianten) return
    if (matrixBusy) return

    const farben = matrixFarben.slice()
    const groessen = matrixSelectedSizes.map(s => s.trim()).filter(Boolean)
    if (farben.length === 0) {
      fehler('Mindestens 1 Farbe hinzufügen')
      return
    }
    if (groessen.length === 0) {
      fehler('Mindestens 1 Größe auswählen')
      return
    }
    const minRaw = matrixMin.trim()
    const min = minRaw === '' ? 0 : parseInt(minRaw, 10)
    if (!Number.isInteger(min) || min < 0) {
      fehler('Mindestbestand ungültig')
      return
    }

    setMatrixBusy(true)
    try {
      // vorhandene Kombinationen laden (Duplikate überspringen)
      const { data: exist, error: eExist } = await supabase
        .from('textil_varianten')
        .select('farbe, groesse')
        .eq('produkt_id', produktIdVarianten)
        .in('farbe', farben.map(f => f.name))
        .in('groesse', groessen)
      if (eExist) throw eExist

      const existSet = new Set<string>()
      for (const r of (exist ?? []) as { farbe: string; groesse: string }[]) {
        existSet.add(`${r.farbe}|||${r.groesse}`)
      }

      const orderIndex = new Map<string, number>()
      for (let i = 0; i < matrixSizeOrder.length; i++) orderIndex.set(matrixSizeOrder[i], i)

      const inserts: Database['public']['Tables']['textil_varianten']['Insert'][] = []
      for (const f of farben) {
        for (const g of groessen) {
          const k = `${f.name}|||${g}`
          if (existSet.has(k)) continue
          inserts.push({
            produkt_id: produktIdVarianten,
            farbe: f.name,
            farbcode: f.hex,
            groesse: g,
            ist_muster: matrixAlleMuster,
            mindestbestand: min,
            bestand: 0,
            sort_order: orderIndex.get(g) ?? 0,
            aktiv: true,
          })
        }
      }

      if (inserts.length === 0) {
        erfolg('Keine neuen Varianten — alles vorhanden')
        return
      }

      const { error: eIns } = await supabase.from('textil_varianten').insert(inserts as any)
      if (eIns) throw eIns

      erfolg(`${inserts.length} Varianten angelegt`)
      resetMatrix()
      setZeigeEinzelVariante(false)
      void ladeVariantenFuerProdukt(produktIdVarianten)
    } catch (e) {
      fehler(fehlerAlsString(e))
    } finally {
      setMatrixBusy(false)
    }
  }

  const updateVariante = async () => {
    if (!editVariante) return
    const farbe = editVarFarbe.trim()
    const groesse = editVarGroesse.trim()
    if (!farbe || !groesse) {
      fehler('Farbe und Größe sind Pflicht')
      return
    }
    const minRaw = editVarMin.trim()
    const min = minRaw === '' ? 0 : parseInt(minRaw, 10)
    if (!Number.isInteger(min) || min < 0) return
    const { error: err } = await supabase
      .from('textil_varianten')
      .update({
        farbe,
        farbcode: editVarFarbcode.trim() || null,
        groesse,
        ist_muster: editVarMuster,
        mindestbestand: min,
        aktiv: editVarAktiv,
      })
      .eq('id', editVariante.id)
    if (err) {
      fehler('Variante konnte nicht gespeichert werden')
      return
    }
    setEditVariante(null)
    void ladeVariantenFuerProdukt(produktIdVarianten)
    void ladeVariantenGlobal()
  }

  if (laden) return null
  if (!session) return <Login />

  const inVariantenStufe = Boolean(produktIdVarianten)
  const inProdukteStufe = Boolean(markeIdProdukte) && !inVariantenStufe
  const markeNameAktuell = marken.find(m => m.id === markeIdProdukte)?.name ?? '—'
  const produktNameBreadcrumb = produkte.find(p => p.id === produktIdVarianten)?.name ?? '—'

  const buchFeld = (v: VarianteRow, onBook: (x: VarianteRow, t: 'ZUGANG' | 'ABGANG') => void) => {
    const mengeStr = (buchMenge[v.id] ?? '').slice(0, 3)
    const menge = mengeStr.trim() === '' ? null : parseInt(mengeStr, 10)
    const mengeOk = menge != null && Number.isInteger(menge) && menge >= 1
    const abgangDisabled = !mengeOk || buchBusyId != null || (mengeOk && (menge as number) > (v.bestand ?? 0))
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={999}
          step={1}
          value={mengeStr}
          onChange={e => {
            const cleaned = e.target.value.replace(/[^\d]/g, '').slice(0, 3)
            setBuchMenge(s => ({ ...s, [v.id]: cleaned }))
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
          style={{ width: 34, padding: '6px 0' }}
          disabled={!mengeOk || buchBusyId != null}
          onClick={() => void onBook(v, 'ZUGANG')}
          title="Zugang"
        >
          +
        </button>
        <button
          type="button"
          className="cp-btn cp-btn-grau"
          style={{ width: 34, padding: '6px 0' }}
          disabled={abgangDisabled}
          onClick={() => void onBook(v, 'ABGANG')}
          title="Abgang"
        >
          −
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 18 }}>Textilien — Bestandspflege</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, opacity: 0.85 }}>{userEmail}</span>
          <button type="button" className="cp-btn cp-btn-grau" onClick={() => void logout()}>
            Logout
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14, marginBottom: 14, flexWrap: 'wrap' }}>
        <button
          type="button"
          className={tab === 'PRODUKTE' ? 'cp-btn' : 'cp-btn cp-btn-grau'}
          onClick={() => setTab('PRODUKTE')}
        >
          Produkte
        </button>
        <button
          type="button"
          className={tab === 'BESTAND' ? 'cp-btn' : 'cp-btn cp-btn-grau'}
          onClick={() => setTab('BESTAND')}
        >
          Bestand
        </button>
        <button
          type="button"
          className={tab === 'BESTELLLISTE' ? 'cp-btn' : 'cp-btn cp-btn-grau'}
          onClick={() => setTab('BESTELLLISTE')}
        >
          Bestellliste
        </button>
      </div>

      {tab === 'PRODUKTE' && (
        <div>
          {/* Stufe 1: Marken — immer sichtbar */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 6,
              marginBottom: 16,
            }}
          >
            {markenLaden && <span style={{ fontSize: 13, opacity: 0.75 }}>Lädt…</span>}
            {marken.map(m => {
              if (editingMarkeId === m.id) {
                return (
                  <div
                    key={m.id}
                    style={{
                      display: 'inline-flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 8px',
                      border: '1px solid #1d4ed8',
                      borderRadius: 8,
                      background: '#eff6ff',
                    }}
                  >
                    <input
                      className="cp-select"
                      value={editMarkeName}
                      onChange={e => setEditMarkeName(e.target.value)}
                      style={{ minWidth: 120, maxWidth: 200 }}
                    />
                    <label style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 12 }}>
                      <input
                        type="checkbox"
                        checked={editMarkeAktiv}
                        onChange={e => setEditMarkeAktiv(e.target.checked)}
                      />
                      aktiv
                    </label>
                    <button type="button" className="cp-btn" style={{ padding: '4px 10px' }} onClick={() => void updateMarke()}>
                      Speichern
                    </button>
                    <button
                      type="button"
                      className="cp-btn cp-btn-grau"
                      style={{ padding: '4px 10px' }}
                      onClick={() => setEditingMarkeId(null)}
                    >
                      Abbrechen
                    </button>
                  </div>
                )
              }
              return (
                <div key={m.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                  <button
                    type="button"
                    className={markeIdProdukte === m.id ? 'cp-btn' : 'cp-btn cp-btn-grau'}
                    style={{ fontWeight: markeIdProdukte === m.id ? 600 : 400 }}
                    onClick={() => {
                      setMarkeIdProdukte(m.id)
                      setProduktIdVarianten('')
                      setEditProdukt(null)
                      setProduktFormOffen(false)
                      setEditVariante(null)
                      setVarianteFormOffen(false)
                    }}
                    title={m.aktiv ? m.name : `${m.name} (inaktiv)`}
                  >
                    {m.name}
                  </button>
                  <button
                    type="button"
                    className="cp-btn cp-btn-grau"
                    style={{ padding: '2px 6px', minWidth: 0, fontSize: 12 }}
                    onClick={e => {
                      e.stopPropagation()
                      setEditingMarkeId(m.id)
                      setEditMarkeName(m.name)
                      setEditMarkeAktiv(m.aktiv)
                    }}
                    title="Marke bearbeiten"
                    aria-label={`Marke ${m.name} bearbeiten`}
                  >
                    ✎
                  </button>
                </div>
              )
            })}
            {!markeNeuFormOffen ? (
              <button
                type="button"
                className="cp-btn cp-btn-grau"
                onClick={() => {
                  setMarkeNeuFormOffen(true)
                  setNeueMarkeName('')
                }}
                title="Neue Marke"
              >
                + Neu
              </button>
            ) : (
              <div
                style={{
                  display: 'inline-flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 8px',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                }}
              >
                <input
                  className="cp-select"
                  placeholder="Name"
                  value={neueMarkeName}
                  onChange={e => setNeueMarkeName(e.target.value)}
                  style={{ minWidth: 120, maxWidth: 200 }}
                />
                <button type="button" className="cp-btn" style={{ padding: '4px 10px' }} onClick={() => void speichereMarke()}>
                  Speichern
                </button>
                <button
                  type="button"
                  className="cp-btn cp-btn-grau"
                  style={{ padding: '4px 10px' }}
                  onClick={() => setMarkeNeuFormOffen(false)}
                >
                  Abbrechen
                </button>
              </div>
            )}
            <button
              type="button"
              className="cp-btn cp-btn-grau"
              style={{ marginLeft: 4, padding: '4px 10px' }}
              onClick={() => void ladeMarken()}
              disabled={markenLaden}
              title="Marken neu laden"
            >
              ↻
            </button>
          </div>

          {/* Stufe 2: Produkte — nur wenn Marke & nicht in Varianten-Ansicht */}
          {inProdukteStufe && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  className="cp-btn cp-btn-grau"
                  onClick={() => {
                    setProduktFormOffen(o => {
                      const n = !o
                      if (n) setNeuesProdukt(s => ({ ...s, marke_id: markeIdProdukte }))
                      return n
                    })
                  }}
                >
                  + Produkt hinzufügen
                </button>
                <button
                  type="button"
                  className="cp-btn cp-btn-grau"
                  onClick={() => void ladeProdukteFuerMarke(markeIdProdukte)}
                  disabled={produkteLaden}
                >
                  Neu laden
                </button>
              </div>
              {produktFormOffen && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: 8,
                    marginBottom: 12,
                    padding: 10,
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                  }}
                >
                  <input
                    className="cp-select"
                    placeholder="Name (Pflicht)"
                    value={neuesProdukt.name}
                    onChange={e => setNeuesProdukt(s => ({ ...s, name: e.target.value }))}
                  />
                  <input
                    className="cp-select"
                    placeholder="Artikelnummer"
                    value={neuesProdukt.artikelnummer}
                    onChange={e => setNeuesProdukt(s => ({ ...s, artikelnummer: e.target.value }))}
                  />
                  <input
                    className="cp-select"
                    placeholder="Beschreibung"
                    value={neuesProdukt.beschreibung}
                    onChange={e => setNeuesProdukt(s => ({ ...s, beschreibung: e.target.value }))}
                    style={{ gridColumn: '1 / -1' }}
                  />
                  <button type="button" className="cp-btn" onClick={() => void speichereProdukt()}>
                    Speichern
                  </button>
                </div>
              )}
              {produkteLaden && <p style={{ opacity: 0.8, margin: '0 0 8px' }}>Lädt…</p>}
              {!produkteLaden && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                        <th style={{ padding: '8px 6px' }}>Name</th>
                        <th style={{ padding: '8px 6px' }}>Artikelnummer</th>
                        <th style={{ padding: '8px 6px' }}>Aktionen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {produkte.map(p => (
                        <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 6px', fontWeight: 600 }}>{p.name}</td>
                          <td style={{ padding: '8px 6px' }}>{p.artikelnummer ?? '—'}</td>
                          <td style={{ padding: '8px 6px' }}>
                            <button
                              type="button"
                              className="cp-btn cp-btn-grau"
                              onClick={() => {
                                setEditProdukt(p)
                                setEditProduktName(p.name)
                                setEditProduktArt(p.artikelnummer ?? '')
                                setEditProduktBesch(p.beschreibung ?? '')
                                setEditProduktAktiv(p.aktiv)
                              }}
                            >
                              Bearbeiten
                            </button>
                            <button
                              type="button"
                              className="cp-btn"
                              style={{ marginLeft: 8 }}
                              onClick={() => {
                                setProduktIdVarianten(p.id)
                                setEditProdukt(null)
                                setProduktFormOffen(false)
                                setEditVariante(null)
                                setVarianteFormOffen(false)
                              }}
                            >
                              Varianten
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {editProdukt && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    maxWidth: 560,
                  }}
                >
                  <h3 style={{ fontSize: 14, marginTop: 0 }}>Produkt bearbeiten</h3>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                      gap: 8,
                    }}
                  >
                    <input
                      className="cp-select"
                      value={editProduktName}
                      onChange={e => setEditProduktName(e.target.value)}
                    />
                    <input
                      className="cp-select"
                      value={editProduktArt}
                      onChange={e => setEditProduktArt(e.target.value)}
                      placeholder="Artikelnummer"
                    />
                    <input
                      className="cp-select"
                      value={editProduktBesch}
                      onChange={e => setEditProduktBesch(e.target.value)}
                      placeholder="Beschreibung"
                      style={{ gridColumn: '1 / -1' }}
                    />
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={editProduktAktiv}
                        onChange={e => setEditProduktAktiv(e.target.checked)}
                      />
                      Aktiv
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="cp-btn" onClick={() => void updateProdukt()}>
                        Speichern
                      </button>
                      <button type="button" className="cp-btn cp-btn-grau" onClick={() => setEditProdukt(null)}>
                        Abbrechen
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Stufe 3: Varianten — nur in Varianten-Ansicht (ersetzt Stufe 2) */}
          {inVariantenStufe && markeIdProdukte && (
            <div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <button
                  type="button"
                  className="cp-btn cp-btn-grau"
                  onClick={() => {
                    setProduktIdVarianten('')
                    setEditVariante(null)
                    setVarianteFormOffen(false)
                    setZeigeEinzelVariante(false)
                  }}
                >
                  ← Produkte
                </button>
                <span style={{ fontSize: 13, color: '#64748b' }}>
                  {markeNameAktuell} <span aria-hidden>›</span> {produktNameBreadcrumb} <span aria-hidden>›</span> Varianten
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="cp-btn cp-btn-grau"
                  onClick={() => void ladeVariantenFuerProdukt(produktIdVarianten)}
                  disabled={variantenLaden || matrixBusy}
                >
                  Neu laden
                </button>
              </div>

              {/* Matrix: Farben × Größen */}
              <div
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 12,
                  background: '#fff',
                }}
              >
                <div style={{ display: 'grid', gap: 12 }}>
                  {/* Schritt 1: Farben */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Schritt 1: Farben</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      <input
                        className="cp-select"
                        placeholder="Farbname"
                        value={matrixFarbName}
                        onChange={e => setMatrixFarbName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addMatrixFarbe()
                          }
                        }}
                        style={{ minWidth: 180 }}
                      />
                      <input
                        type="color"
                        value={matrixFarbHex}
                        onChange={e => setMatrixFarbHex(e.target.value)}
                        style={{ width: 44, height: 32, padding: 0, border: 'none' }}
                        aria-label="Farbwähler"
                      />
                      <button
                        type="button"
                        className="cp-btn cp-btn-grau"
                        onClick={() => addMatrixFarbe()}
                        disabled={matrixBusy}
                      >
                        + Hinzufügen
                      </button>
                    </div>
                    {matrixFarben.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                        {matrixFarben.map(f => (
                          <span
                            key={f.name}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 8,
                              border: '1px solid #e5e7eb',
                              borderRadius: 999,
                              padding: '6px 10px',
                              fontSize: 13,
                              background: '#f8fafc',
                            }}
                          >
                            <span
                              aria-hidden
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: 999,
                                background: f.hex,
                                border: '1px solid rgba(0,0,0,0.15)',
                              }}
                            />
                            {f.name} <span style={{ opacity: 0.75 }}>{f.hex.toUpperCase()}</span>
                            <button
                              type="button"
                              onClick={() => removeMatrixFarbe(f.name)}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                fontSize: 14,
                                lineHeight: 1,
                                padding: 0,
                                opacity: 0.75,
                              }}
                              aria-label={`${f.name} entfernen`}
                              disabled={matrixBusy}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Schritt 2: Größenlauf */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Schritt 2: Größenlauf</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <button
                        type="button"
                        className="cp-btn cp-btn-grau"
                        onClick={() => addMatrixRun(STANDARD_SIZES)}
                        disabled={matrixBusy}
                      >
                        Standard
                      </button>
                      <button
                        type="button"
                        className="cp-btn cp-btn-grau"
                        onClick={() => addMatrixRun(KIDS_SIZES)}
                        disabled={matrixBusy}
                      >
                        Kids
                      </button>
                      <button
                        type="button"
                        className="cp-btn cp-btn-grau"
                        onClick={() => addMatrixRun(STANDARD_SIZES)}
                        disabled={matrixBusy}
                      >
                        Unisex
                      </button>
                      <button
                        type="button"
                        className={matrixEigeneOffen ? 'cp-btn' : 'cp-btn cp-btn-grau'}
                        onClick={() => setMatrixEigeneOffen(o => !o)}
                        disabled={matrixBusy}
                      >
                        Eigene…
                      </button>
                    </div>

                    {matrixEigeneOffen && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                        <input
                          className="cp-select"
                          placeholder="Größe tippen + Enter"
                          value={matrixCustomInput}
                          onChange={e => setMatrixCustomInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              addCustomSize()
                            }
                          }}
                          style={{ minWidth: 220 }}
                        />
                        <button
                          type="button"
                          className="cp-btn cp-btn-grau"
                          onClick={() => addCustomSize()}
                          disabled={matrixBusy}
                        >
                          + Hinzufügen
                        </button>
                        {matrixCustomSizes.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {matrixCustomSizes.map(s => (
                              <span
                                key={s}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  border: '1px solid #e5e7eb',
                                  borderRadius: 999,
                                  padding: '6px 10px',
                                  fontSize: 13,
                                  background: '#f8fafc',
                                }}
                              >
                                {s}
                                <button
                                  type="button"
                                  onClick={() => removeCustomSize(s)}
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    fontSize: 14,
                                    lineHeight: 1,
                                    padding: 0,
                                    opacity: 0.75,
                                  }}
                                  aria-label={`${s} entfernen`}
                                  disabled={matrixBusy}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {matrixSizeOrder.map(s => {
                        const on = matrixSelectedSizes.includes(s)
                        return (
                          <button
                            key={s}
                            type="button"
                            className={on ? 'cp-btn' : 'cp-btn cp-btn-grau'}
                            style={{ padding: '4px 10px' }}
                            onClick={() => toggleMatrixSize(s)}
                            disabled={matrixBusy}
                            title={on ? 'Abwählen' : 'Auswählen'}
                          >
                            {s}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Schritt 3: Optionen */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Schritt 3: Optionen</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                      <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                        Mindestbestand
                        <input
                          type="number"
                          className="cp-select"
                          min={0}
                          value={matrixMin}
                          onChange={e => setMatrixMin(e.target.value)}
                          style={{ maxWidth: 100 }}
                          disabled={matrixBusy}
                        />
                      </label>
                      <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                        <input
                          type="checkbox"
                          checked={matrixAlleMuster}
                          onChange={e => setMatrixAlleMuster(e.target.checked)}
                          disabled={matrixBusy}
                        />
                        Alle als Muster markieren
                      </label>
                    </div>
                  </div>

                  {/* Schritt 4: Vorschau + Anlegen */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: '#64748b' }}>
                      [{matrixFarben.length}] Farben × [{matrixSelectedSizes.length}] Größen ={' '}
                      <strong>{matrixFarben.length * matrixSelectedSizes.length}</strong> Varianten werden angelegt
                    </span>
                    <button
                      type="button"
                      className="cp-btn"
                      onClick={() => void legeVariantenMatrixAn()}
                      disabled={matrixBusy || matrixFarben.length === 0 || matrixSelectedSizes.length === 0}
                    >
                      Varianten anlegen
                    </button>
                    <button
                      type="button"
                      className="cp-btn cp-btn-grau"
                      onClick={() => resetMatrix()}
                      disabled={matrixBusy}
                    >
                      Zurücksetzen
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setZeigeEinzelVariante(o => !o)
                      setVarianteFormOffen(o => !o)
                    }}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      cursor: 'pointer',
                      color: '#2563eb',
                      fontSize: 13,
                      textDecoration: 'underline',
                      alignSelf: 'flex-start',
                    }}
                    disabled={matrixBusy}
                  >
                    {zeigeEinzelVariante ? 'Einzel-Variante schließen' : 'Einzelne Variante hinzufügen'}
                  </button>
                </div>
              </div>

              {/* Einzelvariante (Ausnahme) */}
              {zeigeEinzelVariante && varianteFormOffen && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: 8,
                    marginBottom: 12,
                    padding: 10,
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    alignItems: 'end',
                  }}
                >
                  <input
                    className="cp-select"
                    placeholder="Farbe (Pflicht)"
                    value={neueVariante.farbe}
                    onChange={e => setNeueVariante(s => ({ ...s, farbe: e.target.value }))}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12 }}>Farbcode</span>
                    <input
                      type="color"
                      value={neueVariante.farbcode || '#000000'}
                      onChange={e => setNeueVariante(s => ({ ...s, farbcode: e.target.value }))}
                      style={{ width: 44, height: 32, padding: 0, border: 'none' }}
                    />
                  </div>
                  <input
                    className="cp-select"
                    placeholder="Größe (Pflicht)"
                    value={neueVariante.groesse}
                    onChange={e => setNeueVariante(s => ({ ...s, groesse: e.target.value }))}
                  />
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={neueVariante.ist_muster}
                      onChange={e => setNeueVariante(s => ({ ...s, ist_muster: e.target.checked }))}
                    />
                    Ist Muster
                  </label>
                  <input
                    type="number"
                    className="cp-select"
                    min={0}
                    value={neueVariante.mindestbestand}
                    onChange={e => setNeueVariante(s => ({ ...s, mindestbestand: e.target.value }))}
                    placeholder="Mindestbestand"
                  />
                  <button type="button" className="cp-btn" onClick={() => void speichereVariante()} disabled={matrixBusy}>
                    Speichern
                  </button>
                </div>
              )}
              {variantenLaden && <p style={{ opacity: 0.8 }}>Lädt…</p>}
              {!variantenLaden && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                        <th style={{ padding: '8px 6px' }}>Farbe</th>
                        <th style={{ padding: '8px 6px' }}>Farbcode</th>
                        <th style={{ padding: '8px 6px' }}>Größe</th>
                        <th style={{ padding: '8px 6px' }}>Muster</th>
                        <th style={{ padding: '8px 6px' }}>Bestand</th>
                        <th style={{ padding: '8px 6px' }}>Mindestbestand</th>
                        <th style={{ padding: '8px 6px' }}>Bearb.</th>
                        <th style={{ padding: '8px 6px' }}>Buchung</th>
                      </tr>
                    </thead>
                    <tbody>
                      {varianten.map(v => {
                        const minRaw = minEdit[v.id]
                        const minVal = minRaw != null ? minRaw : String(v.mindestbestand ?? 0)
                        return (
                          <tr key={v.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 6px' }}>{v.farbe}</td>
                            <td style={{ padding: '8px 6px' }}>{v.farbcode || '—'}</td>
                            <td style={{ padding: '8px 6px' }}>{v.groesse}</td>
                            <td style={{ padding: '8px 6px' }}>
                              {v.ist_muster ? <span className="badge badge-grau">Muster</span> : '—'}
                            </td>
                            <td style={{ padding: '8px 6px' }}>{v.bestand ?? 0}</td>
                            <td style={{ padding: '8px 6px' }}>
                              <input
                                type="number"
                                className="cp-select"
                                value={minVal}
                                min={0}
                                onChange={e => setMinEdit(s => ({ ...s, [v.id]: e.target.value }))}
                                onBlur={() => void speichereMindest(v)}
                                style={{ maxWidth: 100 }}
                              />
                            </td>
                            <td style={{ padding: '8px 6px' }}>
                              <button
                                type="button"
                                className="cp-btn cp-btn-grau"
                                style={{ padding: '2px 8px', fontSize: 12 }}
                                onClick={() => {
                                  setEditVariante(v)
                                  setEditVarFarbe(v.farbe)
                                  setEditVarFarbcode(v.farbcode ?? '')
                                  setEditVarGroesse(v.groesse)
                                  setEditVarMuster(v.ist_muster)
                                  setEditVarMin(String(v.mindestbestand ?? 0))
                                  setEditVarAktiv(v.aktiv)
                                }}
                              >
                                …
                              </button>
                            </td>
                            <td style={{ padding: '8px 6px' }}>
                              {buchFeld(v, (x, t) => void buchen(x, t))}
                              {buchFehler[v.id] && (
                                <div style={{ color: '#b91c1c', fontSize: 12, marginTop: 4 }}>{buchFehler[v.id]}</div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {editVariante && produktIdVarianten && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    maxWidth: 560,
                  }}
                >
                  <h3 style={{ fontSize: 14, marginTop: 0 }}>Variante bearbeiten</h3>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                      gap: 8,
                      alignItems: 'end',
                    }}
                  >
                    <input
                      className="cp-select"
                      value={editVarFarbe}
                      onChange={e => setEditVarFarbe(e.target.value)}
                      placeholder="Farbe"
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="color"
                        value={editVarFarbcode || '#000000'}
                        onChange={e => setEditVarFarbcode(e.target.value)}
                        style={{ width: 44, height: 32, padding: 0, border: 'none' }}
                      />
                    </div>
                    <input
                      className="cp-select"
                      value={editVarGroesse}
                      onChange={e => setEditVarGroesse(e.target.value)}
                      placeholder="Größe"
                    />
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={editVarMuster}
                        onChange={e => setEditVarMuster(e.target.checked)}
                      />
                      Muster
                    </label>
                    <input
                      type="number"
                      className="cp-select"
                      min={0}
                      value={editVarMin}
                      onChange={e => setEditVarMin(e.target.value)}
                    />
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={editVarAktiv}
                        onChange={e => setEditVarAktiv(e.target.checked)}
                      />
                      Aktiv
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="cp-btn" onClick={() => void updateVariante()}>
                        Speichern
                      </button>
                      <button type="button" className="cp-btn cp-btn-grau" onClick={() => setEditVariante(null)}>
                        Abbrechen
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {!markeIdProdukte && (
            <p style={{ fontSize: 13, color: '#64748b', margin: '8px 0 0' }}>Zuerst eine Marke wählen.</p>
          )}
        </div>
      )}

      {tab === 'BESTAND' && (
        <div>
          <div
            style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <input
              type="search"
              className="cp-select"
              placeholder="Marke, Produkt, Farbe, Größe…"
              value={bestandSuche}
              onChange={e => setBestandSuche(e.target.value)}
              style={{ minWidth: 220, maxWidth: 320 }}
            />
            <select
              className="cp-select"
              value={bestandMarke}
              onChange={e => setBestandMarke(e.target.value)}
            >
              <option value="ALLE">Alle Marken</option>
              {markenOptionsBestand.map(m => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={filterNachbestellen}
                onChange={e => setFilterNachbestellen(e.target.checked)}
              />
              Nur Nachbestellen
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={filterNurMuster}
                onChange={e => setFilterNurMuster(e.target.checked)}
              />
              Nur Muster
            </label>
            <button
              type="button"
              className="cp-btn cp-btn-grau"
              onClick={() => void ladeVariantenGlobal()}
              disabled={globalLaden}
            >
              Neu laden
            </button>
          </div>
          {globalLaden && <p style={{ opacity: 0.8 }}>Lädt…</p>}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                  <th
                    style={{ padding: '8px 6px', cursor: 'pointer' }}
                    onClick={() => toggleSortB('marke')}
                  >
                    Marke
                    {sortB?.key === 'marke' ? (sortB.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                  <th
                    style={{ padding: '8px 6px', cursor: 'pointer' }}
                    onClick={() => toggleSortB('produkt')}
                  >
                    Produkt
                    {sortB?.key === 'produkt' ? (sortB.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                  <th
                    style={{ padding: '8px 6px', cursor: 'pointer' }}
                    onClick={() => toggleSortB('farbe')}
                  >
                    Farbe
                    {sortB?.key === 'farbe' ? (sortB.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                  <th
                    style={{ padding: '8px 6px', cursor: 'pointer' }}
                    onClick={() => toggleSortB('groesse')}
                  >
                    Größe
                    {sortB?.key === 'groesse' ? (sortB.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                  <th
                    style={{ padding: '8px 6px', cursor: 'pointer' }}
                    onClick={() => toggleSortB('muster')}
                  >
                    Muster
                    {sortB?.key === 'muster' ? (sortB.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                  <th
                    style={{ padding: '8px 6px', cursor: 'pointer' }}
                    onClick={() => toggleSortB('bestand')}
                  >
                    Bestand
                    {sortB?.key === 'bestand' ? (sortB.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                  <th
                    style={{ padding: '8px 6px', cursor: 'pointer' }}
                    onClick={() => toggleSortB('mindestbestand')}
                  >
                    Mindestbestand
                    {sortB?.key === 'mindestbestand' ? (sortB.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                  <th
                    style={{ padding: '8px 6px', cursor: 'pointer' }}
                    onClick={() => toggleSortB('status')}
                  >
                    Status
                    {sortB?.key === 'status' ? (sortB.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                  <th style={{ padding: '8px 6px' }}>Buchung</th>
                </tr>
              </thead>
              <tbody>
                {variantenGefiltert.map(v => {
                  const st = statusTextil(v)
                  const minR = minEdit[v.id]
                  const minVal = minR != null ? minR : String(v.mindestbestand ?? 0)
                  return (
                    <tr key={v.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 6px' }}>{markeVonVariante(v)}</td>
                      <td style={{ padding: '8px 6px', fontWeight: 600 }}>{produktNameVonVariante(v)}</td>
                      <td style={{ padding: '8px 6px' }}>{v.farbe}</td>
                      <td style={{ padding: '8px 6px' }}>{v.groesse}</td>
                      <td style={{ padding: '8px 6px' }}>
                        {v.ist_muster ? <span className="badge badge-grau">Muster</span> : '—'}
                      </td>
                      <td style={{ padding: '8px 6px' }}>{v.bestand ?? 0}</td>
                      <td style={{ padding: '8px 6px' }}>
                        <input
                          type="number"
                          className="cp-select"
                          min={0}
                          value={minVal}
                          onChange={e => setMinEdit(s => ({ ...s, [v.id]: e.target.value }))}
                          onBlur={() => void speichereMindest(v)}
                          style={{ maxWidth: 100 }}
                        />
                      </td>
                      <td style={{ padding: '8px 6px' }}>
                        <span className={`badge ${st.cls}`}>{st.label}</span>
                      </td>
                      <td style={{ padding: '8px 6px' }}>
                        {buchFeld(v, (x, t) => void buchenBestandTab(x, t))}
                        {buchFehler[v.id] && (
                          <div style={{ color: '#b91c1c', fontSize: 12, marginTop: 4 }}>{buchFehler[v.id]}</div>
                        )}
                      </td>
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
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
            <button
              type="button"
              className="cp-btn cp-btn-grau"
              onClick={() => void ladeBestellliste()}
              disabled={bestellLaden}
            >
              Aktualisieren
            </button>
            <button
              type="button"
              className="cp-btn"
              onClick={() => void kopiereBestell()}
              disabled={bestellLaden || bestellZeilen.length === 0}
            >
              In Zwischenablage kopieren
            </button>
            {bestellKopiert && <span style={{ fontSize: 13, color: '#15803d' }}>Kopiert</span>}
          </div>
          {bestellFehler && <p style={{ color: '#b91c1c' }}>{bestellFehler}</p>}
          {bestellLaden && <p style={{ opacity: 0.8 }}>Lädt…</p>}
          {!bestellLaden && !bestellFehler && bestellZeilen.length === 0 && (
            <p style={{ margin: '12px 0', color: '#15803d', fontWeight: 600 }}>
              Alles auf Lager — keine Bestellung nötig
            </p>
          )}
          {bestellZeilen.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '8px 6px' }}>Marke</th>
                    <th style={{ padding: '8px 6px' }}>Produkt</th>
                    <th style={{ padding: '8px 6px' }}>Farbe</th>
                    <th style={{ padding: '8px 6px' }}>Größe</th>
                    <th style={{ padding: '8px 6px' }}>Bestand</th>
                    <th style={{ padding: '8px 6px' }}>Offen</th>
                    <th style={{ padding: '8px 6px' }}>Mindestbestand</th>
                    <th style={{ padding: '8px 6px' }}>Bestellen</th>
                  </tr>
                </thead>
                <tbody>
                  {bestellZeilen.map(z => (
                    <tr key={z.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 6px' }}>{bestelllisteTextZelle(markeVonVariante(z), '—')}</td>
                      <td style={{ padding: '8px 6px', fontWeight: 600 }}>
                        {bestelllisteTextZelle(produktNameVonVariante(z), '—')}
                      </td>
                      <td style={{ padding: '8px 6px' }}>{bestelllisteTextZelle(z.farbe, '—')}</td>
                      <td style={{ padding: '8px 6px' }}>{bestelllisteTextZelle(z.groesse, '—')}</td>
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
