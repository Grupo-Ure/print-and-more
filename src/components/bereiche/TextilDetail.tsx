import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../../supabase'
import { TEILAUFTRAG_SPALTEN } from '../../const/teilauftragSelect'
import { kundeErfuelltPrepressKontakt } from '../../lib/kunde'
import { istTeilAuftragVollstaendig, nextTeilStatus } from '../../lib/teilGlobal'
import {
  buildFreiGroesseString,
  isUniqueViolation,
  textilDatensaetzeErlaubenPraepress,
} from '../../lib/textil/validateTextilDetail'
import type { AuftragStatus, KundeKontaktJoin, TeilauftragRow } from '../../types/database'
import type { Datei } from '../DateiListe'
import type {
  TextilGroesseEnum,
  TextilHerkunft,
  TextilKundenKleidungTyp,
  TextilMotiveRow,
  TextilMotivTyp,
  TextilPlatz,
  TextilPositionenRow,
  TextilSchriftklasse,
  TextilZuordnungRow,
} from '../../types/textil'
import type { Database, Json } from '../../types/supabase'
import '../WorkArea.css'

type TextilProduktMitMarkeEmbed = {
  name: string | null
  textil_marken?: { name: string | null } | { name: string | null }[] | null
}

type TextilVarianteQueryRow = Pick<
  Database['public']['Tables']['textil_varianten']['Row'],
  'id' | 'bestand' | 'farbe' | 'groesse' | 'ist_muster'
> & {
  textil_produkte?: TextilProduktMitMarkeEmbed | TextilProduktMitMarkeEmbed[] | null
}

type Props = {
  teil: TeilauftragRow
  teilStatus: AuftragStatus
  auftragStatus?: AuftragStatus
  auftragDateien: Datei[]
  auftragKunde: KundeKontaktJoin
  onAktualisiert: (t: TeilauftragRow) => void
}

const SCHRIFTKLASSE: { v: TextilSchriftklasse; l: string }[] = [
  { v: 'SERIFENLOS', l: 'Serifenlos' },
  { v: 'SERIFEN', l: 'Serifen' },
  { v: 'ELEGANT', l: 'Elegant' },
  { v: 'VERSPIELT', l: 'Verspielt' },
]

const HERKUNFT_ANZEIGE: Record<TextilHerkunft, string> = {
  KUNDENWARE: 'Kundenware',
  EIGENWARE: 'Eigenware',
}

const KLEID_TYP: { v: TextilKundenKleidungTyp; l: string }[] = [
  { v: 'T_SHIRT', l: 'T-Shirt' },
  { v: 'POLO', l: 'Polo' },
  { v: 'SWEATSHIRT', l: 'Sweatshirt' },
  { v: 'HOODIE', l: 'Hoodie' },
  { v: 'ZIP_HOODIE', l: 'Zip-Hoodie' },
  { v: 'JACKE', l: 'Jacke' },
  { v: 'SONSTIGES', l: 'Sonstiges' },
]

const PLATZ_OPT: { v: TextilPlatz; l: string }[] = [
  { v: 'BRUST_LINKS', l: 'Brust links' },
  { v: 'BRUST_MITTE', l: 'Brust mitte' },
  { v: 'BRUST_RECHTS', l: 'Brust rechts' },
  { v: 'RUECKEN', l: 'Rücken' },
  { v: 'ARM_LINKS', l: 'Arm links' },
  { v: 'ARM_RECHTS', l: 'Arm rechts' },
  { v: 'SONSTIGE', l: 'Sonstige' },
]

const GROESSE_ANZEIGE: Record<Exclude<TextilGroesseEnum, 'FREI'>, string> = {
  KLEIN: 'Klein',
  MITTEL: 'Mittel',
  GROSS: 'Groß',
}

const GROESSE_WAHL: TextilGroesseEnum[] = ['KLEIN', 'MITTEL', 'GROSS', 'FREI']

type EigenwareModus = 'STAMMDATEN' | 'FREITEXT'

function one<T>(x: T | T[] | null | undefined): T | null {
  if (x == null) return null
  return Array.isArray(x) ? (x[0] ?? null) : x
}

function kleidungLabel(v: string | null | undefined): string {
  if (!v) return '—'
  const s = KLEID_TYP.find(x => x.v === v)
  return s?.l ?? v
}

function platzLabel(p: string): string {
  const s = PLATZ_OPT.find(x => x.v === p)
  return s?.l ?? p
}

function groesseKurzLabel(g: string): string {
  if (GROESSE_WAHL.slice(0, 3).includes(g as 'KLEIN' | 'MITTEL' | 'GROSS')) {
    return GROESSE_ANZEIGE[g as 'KLEIN' | 'MITTEL' | 'GROSS']
  }
  if (g === 'FREI' || (typeof g === 'string' && g.startsWith('FREI:'))) {
    if (g === 'FREI') return 'Frei (mm)'
    if (g.startsWith('FREI:')) return `Frei: ${g.slice(5)}`
  }
  return g
}

/** DB-Wert `groesse` am Motiv → Formular Größenwahl + Freitext */
function splitGroesseDb(g: string | null | undefined): { art: TextilGroesseEnum; frei: string } {
  if (!g || g === 'KLEIN' || g === 'MITTEL' || g === 'GROSS') {
    return { art: (g as TextilGroesseEnum) || 'MITTEL', frei: '' }
  }
  if (g === 'FREI') return { art: 'FREI', frei: '' }
  if (g.startsWith('FREI:')) return { art: 'FREI', frei: g.slice(5) }
  return { art: 'MITTEL', frei: '' }
}

/** INSERT `textil_zuordnungen`: Trigger `PLATZ_KONFLIKT` vs. Unique-Constraint */
function fehlerNachZuordnungInsert(err: { message?: string; code?: string }): string {
  if ((err.message ?? '').includes('PLATZ_KONFLIKT')) {
    return 'Dieser Platz ist für diese Textilposition bereits durch ein anderes Motiv belegt.'
  }
  if (isUniqueViolation(err)) {
    return 'Diese Motiv-Position-Zuordnung existiert bereits.'
  }
  return err.message ?? ''
}

const ZUO_EMBED_SELECT =
  'id, teilauftrag_id, motiv_id, position_id, textil_motive(typ, inhalt, datei_id, platz, groesse, druckart), textil_positionen(herkunft, typ, farbe, marke, modell, groesse)'

const TEMP_POS_NEU = 'neu'

export function TextilDetail({
  teil,
  teilStatus,
  auftragStatus,
  auftragDateien,
  auftragKunde,
  onAktualisiert,
}: Props) {
  const teilR = useRef(teil)
  useEffect(() => {
    teilR.current = teil
  }, [teil])

  const [motive, setMotive] = useState<TextilMotiveRow[]>([])
  const [positionen, setPositionen] = useState<TextilPositionenRow[]>([])
  const [zuordnungen, setZuordnungen] = useState<TextilZuordnungRow[]>([])
  const [varianteInfoById, setVarianteInfoById] = useState<
    Map<string, { bestand: number; farbe: string; groesse: string; ist_muster: boolean; produkt: string; marke: string }>
  >(new Map())

  const [laden, setLaden] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)
  const [sMut, setSMut] = useState(false)

  const [mTyp, setMTyp] = useState<TextilMotivTyp>('TEXT')
  const [mInhalt, setMInhalt] = useState('')
  const [mFarbe, setMFarbe] = useState('')
  const [mSchriftkl, setMSchriftkl] = useState<TextilSchriftklasse>('SERIFENLOS')
  const [mSchriftart, setMSchriftart] = useState('')
  const [mDatei, setMDatei] = useState('')
  const [mPlatz, setMPlatz] = useState<TextilPlatz>('BRUST_LINKS')
  const [mGrArt, setMGrArt] = useState<TextilGroesseEnum>('MITTEL')
  const [mGrFrei, setMGrFrei] = useState('')
  const [mDruckart, setMDruckart] = useState('')

  const [pHerk, setPHerk] = useState<TextilHerkunft>('KUNDENWARE')
  const [pKTyp, setPKTyp] = useState<TextilKundenKleidungTyp>('T_SHIRT')
  const [pFarbe, setPFarbe] = useState('')
  const [pSt, setPSt] = useState(1)
  const [pMarke, setPMarke] = useState('')
  const [pModell, setPModell] = useState('')
  const [pGroesse, setPGroesse] = useState('')

  // Eigenware-Modus (in Teilauftrag-Detail gespeichert)
  const [eigenwareModus, setEigenwareModus] = useState<EigenwareModus>('STAMMDATEN')

  const [motivEditId, setMotivEditId] = useState<string | null>(null)
  const [posEditId, setPosEditId] = useState<string | null>(null)

  const [posMotivIds, setPosMotivIds] = useState<Record<string, string[]>>({})

  const posSlotKey = posEditId ?? TEMP_POS_NEU

  const syncTeil = useCallback(
    async (motiveL: TextilMotiveRow[], posL: TextilPositionenRow[], zuoL: TextilZuordnungRow[], afterProdMutation: boolean) => {
      const t = teilR.current
      const vollData = textilDatensaetzeErlaubenPraepress(motiveL, posL, zuoL)
      const oldD =
        t.detail && typeof t.detail === 'object' && !Array.isArray(t.detail) ? { ...(t.detail as object) } : {}
      const newDetail = { ...oldD, textil: { voll: vollData } }
      const merged: TeilauftragRow = { ...t, detail: newDetail } as TeilauftragRow
      const kOk = kundeErfuelltPrepressKontakt(auftragKunde)
      const voll = istTeilAuftragVollstaendig(merged, t.status)
      let nSt: AuftragStatus
      if (afterProdMutation && (t.status === 'PRODUKTION_BEREIT' || t.status === 'FERTIG')) {
        nSt = 'UNVOLLSTAENDIG'
      } else {
        nSt = nextTeilStatus(t.status, t, merged, voll, kOk, auftragStatus)
      }
      setSMut(true)
      const teilSyncPatch: Database['public']['Tables']['teilauftraege']['Update'] = {
        status: nSt,
        detail: newDetail as Json,
      }
      const { data, error } = await supabase.from('teilauftraege').update(teilSyncPatch).eq('id', t.id)
        .select(TEILAUFTRAG_SPALTEN)
        .single()
      setSMut(false)
      if (error) {
        setFehler(error.message)
        return
      }
      if (data) {
        const row = data as TeilauftragRow
        teilR.current = row
        onAktualisiert(row)
      }
    },
    [auftragKunde, auftragStatus, onAktualisiert]
  )

  const syncRef = useRef(syncTeil)
  useEffect(() => {
    syncRef.current = syncTeil
  })

  const lastLoadTeilId = useRef<string | null>(null)

  const ladeAlles = useCallback(async () => {
    setLaden(true)
    setFehler(null)
    const tId = teilR.current.id
    const [mRes, pRes, zRes] = await Promise.all([
      supabase.from('textil_motive').select('*').eq('teilauftrag_id', tId),
      supabase.from('textil_positionen').select('*').eq('teilauftrag_id', tId),
      supabase.from('textil_zuordnungen').select(ZUO_EMBED_SELECT).eq('teilauftrag_id', tId),
    ])
    if (mRes.error) setFehler(mRes.error.message)
    if (pRes.error) setFehler(pRes.error.message)
    if (zRes.error) setFehler(zRes.error.message)
    const m = (mRes.data ?? []) as TextilMotiveRow[]
    const p = (pRes.data ?? []) as TextilPositionenRow[]
    const z0 = (zRes.data ?? []) as unknown as TextilZuordnungRow[]
    setMotive(m)
    setPositionen(p)
    setZuordnungen(z0)

    // Variante-Infos für Positionsliste (Bestand/Labels) laden
    try {
      const ids = Array.from(
        new Set(
          p.map(r => r.variante_id).filter((x): x is string => typeof x === 'string' && x.trim() !== '')
        )
      )
      if (ids.length === 0) {
        setVarianteInfoById(new Map())
      } else {
        const { data: vData, error: vErr } = await supabase
          .from('textil_varianten')
          .select('id, bestand, farbe, groesse, ist_muster, textil_produkte(name, textil_marken(name))')
          .in('id', ids)
        if (vErr) throw vErr
        const map = new Map<
          string,
          { bestand: number; farbe: string; groesse: string; ist_muster: boolean; produkt: string; marke: string }
        >()
        for (const r of (vData ?? []) as unknown as TextilVarianteQueryRow[]) {
          const produkt = one(r.textil_produkte)
          const marke = produkt ? one(produkt.textil_marken) : null
          map.set(String(r.id), {
            bestand: Number(r.bestand) || 0,
            farbe: String(r.farbe ?? ''),
            groesse: String(r.groesse ?? ''),
            ist_muster: Boolean(r.ist_muster),
            produkt: String(produkt?.name ?? ''),
            marke: String(marke?.name ?? ''),
          })
        }
        setVarianteInfoById(map)
      }
    } catch {
      // optional: Bestand-Infos sind nice-to-have; Fehler nicht blockierend
      setVarianteInfoById(new Map())
    }

    setLaden(false)
    // Guard: Beim reinen Laden nur dann DB-Sync auslösen, wenn sich der "voll"-Wert tatsächlich ändert.
    // Sonst kann das (je nach Parent-Update-Strategie) unnötige Updates/Reloads auslösen.
    const vollData = textilDatensaetzeErlaubenPraepress(m, p, z0)
    const det = teilR.current.detail
    const detObj = det && typeof det === 'object' && !Array.isArray(det) ? (det as Record<string, unknown>) : null
    const textilObj =
      detObj && detObj.textil && typeof detObj.textil === 'object' && !Array.isArray(detObj.textil)
        ? (detObj.textil as Record<string, unknown>)
        : null
    const altVoll = textilObj && typeof textilObj.voll === 'boolean' ? (textilObj.voll as boolean) : null
    if (altVoll !== vollData) {
      await syncRef.current(m, p, z0, false)
    }
  }, [])

  useEffect(() => {
    // Guard gegen Endlosschleifen: nur 1× pro Teilauftrag-ID laden.
    if (lastLoadTeilId.current === teil.id) return
    lastLoadTeilId.current = teil.id
    void ladeAlles()
  }, [ladeAlles, teil.id])

  useEffect(() => {
    setMotivEditId(null)
    setPosEditId(null)
    setPosMotivIds({})
  }, [teil.id])

  useEffect(() => {
    const d = teil.detail
    const obj = d && typeof d === 'object' && !Array.isArray(d) ? (d as Record<string, unknown>) : {}
    const raw = obj.eigenware_modus
    if (raw === 'FREITEXT' || raw === 'STAMMDATEN') {
      setEigenwareModus(raw)
    } else {
      setEigenwareModus('STAMMDATEN')
    }
  }, [teil.id, teil.detail])

  const speichereEigenwareModus = useCallback(
    async (modus: EigenwareModus) => {
      const t = teilR.current
      const d = t.detail
      const oldD = d && typeof d === 'object' && !Array.isArray(d) ? { ...(d as Record<string, unknown>) } : {}
      const newDetail = { ...oldD, eigenware_modus: modus }
      setSMut(true)
      const eigenwarePatch: Database['public']['Tables']['teilauftraege']['Update'] = {
        detail: newDetail as Json,
      }
      const { data, error } = await supabase.from('teilauftraege').update(eigenwarePatch).eq('id', t.id)
        .select(TEILAUFTRAG_SPALTEN)
        .single()
      setSMut(false)
      if (error) {
        setFehler(error.message)
        return
      }
      if (data) {
        const row = data as TeilauftragRow
        teilR.current = row
        onAktualisiert(row)
      }
    },
    [onAktualisiert]
  )

  // Stammdaten-Auswahl (nur Eigenware + STAMMDATEN)
  const [sdMarken, setSdMarken] = useState<{ id: string; name: string }[]>([])
  const [sdProdukte, setSdProdukte] = useState<{ id: string; name: string; artikelnummer: string | null }[]>([])
  const [sdFarben, setSdFarben] = useState<{ farbe: string; farbe_hex: string | null }[]>([])
  const [sdGroessen, setSdGroessen] = useState<{ id: string; groesse: string; bestand: number; ist_muster: boolean }[]>([])
  const [sdMarkeId, setSdMarkeId] = useState('')
  const [sdProduktId, setSdProduktId] = useState('')
  const [sdFarbe, setSdFarbe] = useState('')
  const [sdVarianteId, setSdVarianteId] = useState('') // wird bei Größenwahl gesetzt
  const [sdLaden, setSdLaden] = useState(false)

  useEffect(() => {
    if (pHerk !== 'EIGENWARE') return
    if (eigenwareModus !== 'STAMMDATEN') return
    setSdLaden(true)
    void Promise.resolve(
      supabase.from('textil_marken').select('id, name').eq('aktiv', true).order('name'),
    )
      .then(({ data, error }) => {
        if (error) return
        setSdMarken((data ?? []) as { id: string; name: string }[])
      })
      .finally(() => setSdLaden(false))
  }, [eigenwareModus, pHerk])

  useEffect(() => {
    if (pHerk !== 'EIGENWARE') return
    if (eigenwareModus !== 'STAMMDATEN') return
    if (!sdMarkeId) {
      setSdProdukte([])
      setSdProduktId('')
      setSdFarben([])
      setSdGroessen([])
      setSdFarbe('')
      setSdVarianteId('')
      return
    }
    setSdLaden(true)
    void Promise.resolve(
      supabase
        .from('textil_produkte')
        .select('id, name, artikelnummer')
        .eq('marke_id', sdMarkeId)
        .eq('aktiv', true)
        .order('name'),
    )
      .then(({ data, error }) => {
        if (error) return
        setSdProdukte((data ?? []) as { id: string; name: string; artikelnummer: string | null }[])
      })
      .finally(() => setSdLaden(false))
  }, [eigenwareModus, pHerk, sdMarkeId])

  useEffect(() => {
    if (pHerk !== 'EIGENWARE') return
    if (eigenwareModus !== 'STAMMDATEN') return
    if (!sdProduktId) {
      setSdFarben([])
      setSdGroessen([])
      setSdFarbe('')
      setSdVarianteId('')
      return
    }
    setSdLaden(true)
    void Promise.resolve(
      supabase
        .from('textil_varianten')
        .select('farbe, farbe_hex')
        .eq('produkt_id', sdProduktId)
        .eq('aktiv', true)
        .order('farbe'),
    )
      .then(res => {
        const { data, error } = res
        if (error) return
        const rows = (data ?? []) as { farbe: string | null; farbe_hex: string | null }[]
        const seen = new Set<string>()
        const out: { farbe: string; farbe_hex: string | null }[] = []
        for (const r of rows) {
          const f = String(r.farbe ?? '').trim()
          if (!f) continue
          const key = f.toLowerCase()
          if (seen.has(key)) continue
          seen.add(key)
          out.push({ farbe: f, farbe_hex: r.farbe_hex ?? null })
        }
        setSdFarben(out)
      })
      .finally(() => setSdLaden(false))
  }, [eigenwareModus, pHerk, sdProduktId])

  useEffect(() => {
    if (pHerk !== 'EIGENWARE') return
    if (eigenwareModus !== 'STAMMDATEN') return
    if (!sdProduktId || !sdFarbe) {
      setSdGroessen([])
      setSdVarianteId('')
      return
    }
    setSdLaden(true)
    void Promise.resolve(
      supabase
        .from('textil_varianten')
        .select('id, groesse, bestand, ist_muster')
        .eq('produkt_id', sdProduktId)
        .eq('farbe', sdFarbe)
        .eq('aktiv', true)
        .order('sort_order'),
    )
      .then(({ data, error }) => {
        if (error) return
        const rows = (data ?? []) as { id: string; groesse: string | null; bestand: number | null; ist_muster: boolean | null }[]
        setSdGroessen(
          rows.map(r => ({
            id: String(r.id),
            groesse: String(r.groesse ?? ''),
            bestand: Number(r.bestand) || 0,
            ist_muster: Boolean(r.ist_muster),
          }))
        )
      })
      .finally(() => setSdLaden(false))
  }, [eigenwareModus, pHerk, sdFarbe, sdProduktId])

  const dateiNameById = new Map<string, string>()
  for (const d of auftragDateien) {
    dateiNameById.set(d.id, d.anzeigename)
  }

  const resetMForm = () => {
    setMInhalt('')
    setMFarbe('')
    setMSchriftkl('SERIFENLOS')
    setMSchriftart('')
    setMDatei('')
    setMTyp('TEXT')
    setMPlatz('BRUST_LINKS')
    setMGrArt('MITTEL')
    setMGrFrei('')
    setMDruckart('')
  }
  const resetPForm = () => {
    setPHerk('KUNDENWARE')
    setPKTyp('T_SHIRT')
    setPFarbe('')
    setPSt(1)
    setPMarke('')
    setPModell('')
    setPGroesse('')
    setSdMarkeId('')
    setSdProduktId('')
    setSdFarbe('')
    setSdVarianteId('')
  }
  const abbruchMotivForm = () => {
    setMotivEditId(null)
    resetMForm()
  }
  const abbruchPosForm = () => {
    const pid = posEditId
    setPosEditId(null)
    if (pid) {
      setPosMotivIds(prev => {
        const n = { ...prev }
        delete n[pid]
        return n
      })
    }
    resetPForm()
  }

  const motivBearbeiten = (m: TextilMotiveRow) => {
    setFehler(null)
    setMotivEditId(m.id)
    setMTyp(m.typ)
    setMInhalt(m.inhalt ?? '')
    setMFarbe(m.farbe ?? '')
    setMSchriftkl((m.schriftklasse as TextilSchriftklasse) || 'SERIFENLOS')
    setMSchriftart(m.schriftart ?? '')
    setMDatei(m.datei_id ?? '')
    const pl = String(m.platz ?? 'BRUST_LINKS')
    setMPlatz((PLATZ_OPT.some(o => o.v === pl) ? pl : 'BRUST_LINKS') as TextilPlatz)
    const { art, frei } = splitGroesseDb(m.groesse)
    setMGrArt(art)
    setMGrFrei(frei)
    setMDruckart(m.druckart ?? '')
  }

  const bearbeitePosition = async (p: TextilPositionenRow) => {
    setFehler(null)
    setPosEditId(p.id)
    setPHerk(p.herkunft)
    setPSt(p.stueckzahl)
    setPMarke(p.marke ?? '')
    setPModell(p.modell ?? '')
    setPFarbe(p.farbe ?? '')
    setPGroesse(p.groesse ?? '')
    if (p.herkunft === 'KUNDENWARE') {
      setPKTyp((p.typ as TextilKundenKleidungTyp) || 'T_SHIRT')
    } else {
      if (p.variante_id) {
        setEigenwareModus('STAMMDATEN')
        const { data: vr, error: ve } = await supabase
          .from('textil_varianten')
          .select('id, produkt_id, farbe, groesse')
          .eq('id', p.variante_id)
          .maybeSingle()
        if (ve || !vr) {
          setEigenwareModus('FREITEXT')
          setSdMarkeId('')
          setSdProduktId('')
          setSdFarbe('')
          setSdVarianteId('')
        } else {
          const { data: pr } = await supabase
            .from('textil_produkte')
            .select('id, marke_id')
            .eq('id', vr.produkt_id)
            .maybeSingle()
          if (pr?.marke_id) {
            setSdMarkeId(String(pr.marke_id))
            setSdProduktId(String(pr.id))
            setSdFarbe(String(vr.farbe ?? ''))
            setSdVarianteId(String(vr.id))
          } else {
            setEigenwareModus('FREITEXT')
            setSdMarkeId('')
            setSdProduktId('')
            setSdFarbe('')
            setSdVarianteId('')
          }
        }
      } else {
        setEigenwareModus('FREITEXT')
        setSdMarkeId('')
        setSdProduktId('')
        setSdFarbe('')
        setSdVarianteId('')
      }
    }
    const mids = zuordnungen.filter(z => z.position_id === p.id).map(z => z.motiv_id)
    setPosMotivIds(prev => ({ ...prev, [p.id]: mids.length > 0 ? mids : [''] }))
  }

  async function syncZuordnungenFuerPosition(
    posId: string,
    desiredMotivIds: string[],
    zStart: TextilZuordnungRow[]
  ): Promise<{ ok: true; zuoNext: TextilZuordnungRow[] } | { ok: false; message: string }> {
    const wanted = [...new Set(desiredMotivIds.map(id => String(id).trim()).filter(Boolean))]
    let zcur = zStart
    const had = zcur.filter(z => z.position_id === posId)
    const wantSet = new Set(wanted)
    for (const z of had) {
      if (!wantSet.has(z.motiv_id)) {
        const { error } = await supabase.from('textil_zuordnungen').delete().eq('id', z.id)
        if (error) return { ok: false, message: error.message }
        zcur = zcur.filter(x => x.id !== z.id)
      }
    }
    const hadMot = new Set(zcur.filter(x => x.position_id === posId).map(x => x.motiv_id))
    for (const mid of wanted) {
      if (hadMot.has(mid)) continue
      const { data: zData, error: zErr } = await supabase
        .from('textil_zuordnungen')
        .insert({
          teilauftrag_id: teil.id,
          motiv_id: mid,
          position_id: posId,
        })
        .select(ZUO_EMBED_SELECT)
        .single()
      if (zErr) return { ok: false, message: fehlerNachZuordnungInsert(zErr) }
      if (zData) zcur = [...zcur, zData as unknown as TextilZuordnungRow]
    }
    return { ok: true, zuoNext: zcur }
  }
  const addMotiv = async (e: FormEvent) => {
    e.preventDefault()
    setFehler(null)
    const tId = teil.id
    const editId = motivEditId
    let groesseDb: string
    if (mGrArt === 'FREI') {
      if (!mGrFrei.trim()) {
        setFehler('Bei Größe „Frei (mm)“ bitte Abmessung eintragen.')
        return
      }
      groesseDb = buildFreiGroesseString(mGrFrei)
    } else {
      groesseDb = mGrArt
    }
    if (mTyp === 'TEXT') {
      if (!mInhalt.trim() || !mFarbe.trim()) {
        setFehler('Inhalt und Farbe sind erforderlich (Text).')
        return
      }
      setSMut(true)
      const q = editId
        ? supabase
            .from('textil_motive')
            .update({
              typ: 'TEXT',
              platz: mPlatz,
              groesse: groesseDb,
              druckart: mDruckart.trim() || null,
              inhalt: mInhalt.trim(),
              farbe: mFarbe.trim(),
              schriftklasse: mSchriftkl,
              schriftart: mSchriftart.trim() || null,
              datei_id: null,
            })
            .eq('id', editId)
            .select('*')
            .single()
        : supabase
            .from('textil_motive')
            .insert({
              teilauftrag_id: tId,
              typ: 'TEXT',
              platz: mPlatz,
              groesse: groesseDb,
              druckart: mDruckart.trim() || null,
              inhalt: mInhalt.trim(),
              farbe: mFarbe.trim(),
              schriftklasse: mSchriftkl,
              schriftart: mSchriftart.trim() || null,
              datei_id: null,
            })
            .select('*')
            .single()
      const { data, error } = await q
      setSMut(false)
      if (error) {
        setFehler(error.message)
        return
      }
      if (data) {
        const r = data as TextilMotiveRow
        const nextM = editId ? motive.map(x => (x.id === editId ? r : x)) : [...motive, r]
        setMotive(nextM)
        setMotivEditId(null)
        resetMForm()
        const prod = teilR.current.status === 'PRODUKTION_BEREIT' || teilR.current.status === 'FERTIG'
        void syncTeil(nextM, positionen, zuordnungen, prod)
      }
    } else {
      if (!mDatei) {
        setFehler('Bitte eine Datei wählen.')
        return
      }
      setSMut(true)
      const q2 = editId
        ? supabase
            .from('textil_motive')
            .update({
              typ: 'DATEI',
              platz: mPlatz,
              groesse: groesseDb,
              druckart: mDruckart.trim() || null,
              inhalt: null,
              farbe: null,
              schriftklasse: null,
              schriftart: null,
              datei_id: mDatei,
            })
            .eq('id', editId)
            .select('*')
            .single()
        : supabase
            .from('textil_motive')
            .insert({
              teilauftrag_id: tId,
              typ: 'DATEI',
              platz: mPlatz,
              groesse: groesseDb,
              druckart: mDruckart.trim() || null,
              inhalt: null,
              farbe: null,
              schriftklasse: null,
              schriftart: null,
              datei_id: mDatei,
            })
            .select('*')
            .single()
      const { data, error } = await q2
      setSMut(false)
      if (error) {
        setFehler(error.message)
        return
      }
      if (data) {
        const r = data as TextilMotiveRow
        const nextM = editId ? motive.map(x => (x.id === editId ? r : x)) : [...motive, r]
        setMotive(nextM)
        setMotivEditId(null)
        resetMForm()
        const prod = teilR.current.status === 'PRODUKTION_BEREIT' || teilR.current.status === 'FERTIG'
        void syncTeil(nextM, positionen, zuordnungen, prod)
      }
    }
  }

  const addPosition = async (e: FormEvent) => {
    e.preventDefault()
    setFehler(null)
    if (pSt < 1 || !Number.isInteger(pSt)) {
      setFehler('Stückzahl: ganze Zahl ≥ 1.')
      return
    }
    const tId = teil.id
    const editId = posEditId
    const slotKey = editId ?? TEMP_POS_NEU
    const motivSlots = posMotivIds[slotKey] ?? ['']
    const motivIdsDesired = motivSlots.map(id => String(id).trim()).filter(Boolean)

    const nachPosSpeichern = (nextP: TextilPositionenRow[], zuoNext: TextilZuordnungRow[]) => {
      resetPForm()
      setPosEditId(null)
      setPosMotivIds(prev => {
        const n = { ...prev }
        delete n[slotKey]
        return n
      })
      const prod = teilR.current.status === 'PRODUKTION_BEREIT' || teilR.current.status === 'FERTIG'
      void syncTeil(motive, nextP, zuoNext, prod)
    }

    if (editId) {
      if (pHerk === 'KUNDENWARE') {
        if (!pFarbe.trim() || !pKTyp) {
          setFehler('Typ und Farbe sind erforderlich.')
          return
        }
        setSMut(true)
        const { error: upErr } = await supabase
          .from('textil_positionen')
          .update({
            herkunft: 'KUNDENWARE',
            typ: pKTyp,
            farbe: pFarbe.trim(),
            stueckzahl: pSt,
            marke: null,
            modell: null,
            groesse: null,
            variante_id: null,
          })
          .eq('id', editId)
        if (upErr) {
          setSMut(false)
          setFehler(upErr.message)
          return
        }
        const syncRes = await syncZuordnungenFuerPosition(editId, motivIdsDesired, zuordnungen)
        if (!syncRes.ok) {
          setSMut(false)
          setFehler(syncRes.message)
          void ladeAlles()
          return
        }
        const prevP = positionen.find(x => x.id === editId)
        if (!prevP) {
          setSMut(false)
          setFehler('Position nicht gefunden.')
          return
        }
        const updatedP: TextilPositionenRow = {
          ...prevP,
          herkunft: 'KUNDENWARE',
          typ: pKTyp,
          farbe: pFarbe.trim(),
          stueckzahl: pSt,
          marke: null,
          modell: null,
          groesse: null,
          variante_id: null,
        }
        const nextP = positionen.map(p => (p.id === editId ? updatedP : p))
        setPositionen(nextP)
        setZuordnungen(syncRes.zuoNext)
        setSMut(false)
        nachPosSpeichern(nextP, syncRes.zuoNext)
        return
      }

      if (eigenwareModus === 'STAMMDATEN') {
        if (!sdMarkeId || !sdProduktId || !sdVarianteId) {
          setFehler('Bitte Marke, Produkt und Variante aus Stammdaten wählen.')
          return
        }
        const markeName = sdMarken.find(x => x.id === sdMarkeId)?.name ?? ''
        const produktName = sdProdukte.find(x => x.id === sdProduktId)?.name ?? ''
        const gro = sdGroessen.find(x => x.id === sdVarianteId)?.groesse ?? ''
        if (!markeName || !produktName || !sdFarbe || !gro) {
          setFehler('Stammdaten-Auswahl unvollständig.')
          return
        }
        setPMarke(markeName)
        setPModell(produktName)
        setPFarbe(sdFarbe)
        setPGroesse(gro)
      } else {
        if (!pMarke.trim() || !pModell.trim() || !pFarbe.trim() || !pGroesse.trim()) {
          setFehler('Marke, Modell, Farbe und Größe sind erforderlich.')
          return
        }
      }
      setSMut(true)
      const { error: upEw } = await supabase
        .from('textil_positionen')
        .update({
          herkunft: 'EIGENWARE',
          typ: null,
          farbe: pFarbe.trim(),
          stueckzahl: pSt,
          marke: pMarke.trim(),
          modell: pModell.trim(),
          groesse: pGroesse.trim(),
          variante_id: eigenwareModus === 'STAMMDATEN' ? (sdVarianteId || null) : null,
        })
        .eq('id', editId)
      if (upEw) {
        setSMut(false)
        setFehler(upEw.message)
        return
      }
      const syncResEw = await syncZuordnungenFuerPosition(editId, motivIdsDesired, zuordnungen)
      if (!syncResEw.ok) {
        setSMut(false)
        setFehler(syncResEw.message)
        void ladeAlles()
        return
      }
      const prevEw = positionen.find(x => x.id === editId)
      if (!prevEw) {
        setSMut(false)
        setFehler('Position nicht gefunden.')
        return
      }
      const updatedEw: TextilPositionenRow = {
        ...prevEw,
        herkunft: 'EIGENWARE',
        typ: null,
        farbe: pFarbe.trim(),
        stueckzahl: pSt,
        marke: pMarke.trim(),
        modell: pModell.trim(),
        groesse: pGroesse.trim(),
        variante_id: eigenwareModus === 'STAMMDATEN' ? (sdVarianteId || null) : null,
      }
      const nextPEw = positionen.map(p => (p.id === editId ? updatedEw : p))
      setPositionen(nextPEw)
      setZuordnungen(syncResEw.zuoNext)
      if (eigenwareModus === 'STAMMDATEN' && sdVarianteId) {
        const markeName = sdMarken.find(x => x.id === sdMarkeId)?.name ?? ''
        const produktName = sdProdukte.find(x => x.id === sdProduktId)?.name ?? ''
        const v = sdGroessen.find(x => x.id === sdVarianteId) ?? null
        if (v && markeName && produktName) {
          setVarianteInfoById(prev => {
            const m = new Map(prev)
            m.set(sdVarianteId, {
              bestand: v.bestand,
              farbe: sdFarbe,
              groesse: v.groesse,
              ist_muster: v.ist_muster,
              produkt: produktName,
              marke: markeName,
            })
            return m
          })
        }
      }
      setSMut(false)
      nachPosSpeichern(nextPEw, syncResEw.zuoNext)
      return
    }

    if (pHerk === 'KUNDENWARE') {
      if (!pFarbe.trim() || !pKTyp) {
        setFehler('Typ und Farbe sind erforderlich.')
        return
      }
      setSMut(true)
      const { data, error } = await supabase
        .from('textil_positionen')
        .insert({
          teilauftrag_id: tId,
          herkunft: 'KUNDENWARE',
          typ: pKTyp,
          farbe: pFarbe.trim(),
          stueckzahl: pSt,
          marke: null,
          modell: null,
          groesse: null,
        })
        .select('*')
        .single()
      setSMut(false)
      if (error) {
        setFehler(error.message)
        return
      }
      if (data) {
        const r = data as TextilPositionenRow
        const nextP = [...positionen, r]
        setPositionen(nextP)

        let zuoAcc = zuordnungen
        const motivIdsNeu = motivIdsDesired
        if (motivIdsNeu.length > 0) {
          setSMut(true)
          try {
            for (const mid of motivIdsNeu) {
              const { data: zData, error: zErr } = await supabase
                .from('textil_zuordnungen')
                .insert({
                  teilauftrag_id: teil.id,
                  motiv_id: mid,
                  position_id: r.id,
                })
                .select(ZUO_EMBED_SELECT)
                .single()
              if (zErr) {
                await supabase.from('textil_zuordnungen').delete().eq('position_id', r.id)
                await supabase.from('textil_positionen').delete().eq('id', r.id)
                setPositionen(positionen)
                setZuordnungen(zuordnungen)
                setFehler(fehlerNachZuordnungInsert(zErr))
                resetPForm()
                setPosMotivIds(prev => ({ ...prev, [TEMP_POS_NEU]: [] }))
                const prod = teilR.current.status === 'PRODUKTION_BEREIT' || teilR.current.status === 'FERTIG'
                void syncTeil(motive, positionen, zuordnungen, prod)
                return
              }
              if (zData) zuoAcc = [...zuoAcc, zData as unknown as TextilZuordnungRow]
            }
            setZuordnungen(zuoAcc)
          } finally {
            setSMut(false)
          }
        }

        setPosMotivIds(prev => ({ ...prev, [TEMP_POS_NEU]: [] }))
        resetPForm()
        const prod = teilR.current.status === 'PRODUKTION_BEREIT' || teilR.current.status === 'FERTIG'
        void syncTeil(motive, nextP, zuoAcc, prod)
      }
    } else {
      if (eigenwareModus === 'STAMMDATEN') {
        if (!sdMarkeId || !sdProduktId || !sdVarianteId) {
          setFehler('Bitte Marke, Produkt und Variante aus Stammdaten wählen.')
          return
        }
        const markeName = sdMarken.find(x => x.id === sdMarkeId)?.name ?? ''
        const produktName = sdProdukte.find(x => x.id === sdProduktId)?.name ?? ''
        const gro = sdGroessen.find(x => x.id === sdVarianteId)?.groesse ?? ''
        if (!markeName || !produktName || !sdFarbe || !gro) {
          setFehler('Stammdaten-Auswahl unvollständig.')
          return
        }
        setPMarke(markeName)
        setPModell(produktName)
        setPFarbe(sdFarbe)
        setPGroesse(gro)
      } else {
        if (!pMarke.trim() || !pModell.trim() || !pFarbe.trim() || !pGroesse.trim()) {
          setFehler('Marke, Modell, Farbe und Größe sind erforderlich.')
          return
        }
      }
      setSMut(true)
      const { data, error } = await supabase
        .from('textil_positionen')
        .insert({
          teilauftrag_id: tId,
          herkunft: 'EIGENWARE',
          typ: null,
          farbe: pFarbe.trim(),
          stueckzahl: pSt,
          marke: pMarke.trim(),
          modell: pModell.trim(),
          groesse: pGroesse.trim(),
          variante_id: eigenwareModus === 'STAMMDATEN' ? (sdVarianteId || null) : null,
        })
        .select('*')
        .single()
      setSMut(false)
      if (error) {
        setFehler(error.message)
        return
      }
      if (data) {
        const r = data as TextilPositionenRow
        const nextP = [...positionen, r]
        setPositionen(nextP)
        if (eigenwareModus === 'STAMMDATEN' && sdVarianteId) {
          const markeName = sdMarken.find(x => x.id === sdMarkeId)?.name ?? ''
          const produktName = sdProdukte.find(x => x.id === sdProduktId)?.name ?? ''
          const v = sdGroessen.find(x => x.id === sdVarianteId) ?? null
          if (v && markeName && produktName) {
            setVarianteInfoById(prev => {
              const m = new Map(prev)
              m.set(sdVarianteId, {
                bestand: v.bestand,
                farbe: sdFarbe,
                groesse: v.groesse,
                ist_muster: v.ist_muster,
                produkt: produktName,
                marke: markeName,
              })
              return m
            })
          }
        }

        let zuoAcc = zuordnungen
        const motivIdsNeuEw = motivIdsDesired
        if (motivIdsNeuEw.length > 0) {
          setSMut(true)
          try {
            for (const mid of motivIdsNeuEw) {
              const { data: zData, error: zErr } = await supabase
                .from('textil_zuordnungen')
                .insert({
                  teilauftrag_id: teil.id,
                  motiv_id: mid,
                  position_id: r.id,
                })
                .select(ZUO_EMBED_SELECT)
                .single()
              if (zErr) {
                await supabase.from('textil_zuordnungen').delete().eq('position_id', r.id)
                await supabase.from('textil_positionen').delete().eq('id', r.id)
                setPositionen(positionen)
                setZuordnungen(zuordnungen)
                setFehler(fehlerNachZuordnungInsert(zErr))
                resetPForm()
                setPosMotivIds(prev => ({ ...prev, [TEMP_POS_NEU]: [] }))
                const prodEw = teilR.current.status === 'PRODUKTION_BEREIT' || teilR.current.status === 'FERTIG'
                void syncTeil(motive, positionen, zuordnungen, prodEw)
                return
              }
              if (zData) zuoAcc = [...zuoAcc, zData as unknown as TextilZuordnungRow]
            }
            setZuordnungen(zuoAcc)
          } finally {
            setSMut(false)
          }
        }

        setPosMotivIds(prev => ({ ...prev, [TEMP_POS_NEU]: [] }))
        resetPForm()
        const prod = teilR.current.status === 'PRODUKTION_BEREIT' || teilR.current.status === 'FERTIG'
        void syncTeil(motive, nextP, zuoAcc, prod)
      }
    }
  }

  const delMotiv = async (id: string) => {
    if (motivEditId === id) abbruchMotivForm()
    setFehler(null)
    const { data: inUse, error: cErr } = await supabase
      .from('textil_zuordnungen')
      .select('id')
      .eq('motiv_id', id)
      .limit(1)
    if (cErr) {
      setFehler(cErr.message)
      return
    }
    if (inUse && inUse.length > 0) {
      setFehler('Motiv wird noch in einer Zuordnung verwendet.')
      return
    }
    setSMut(true)
    const { error } = await supabase.from('textil_motive').delete().eq('id', id)
    setSMut(false)
    if (error) {
      setFehler(error.message)
      return
    }
    const next = motive.filter(m => m.id !== id)
    setMotive(next)
    const zuo2 = zuordnungen.filter(z => z.motiv_id !== id)
    setZuordnungen(zuo2)
    const prod = teilR.current.status === 'PRODUKTION_BEREIT' || teilR.current.status === 'FERTIG'
    void syncTeil(next, positionen, zuo2, prod)
  }

  const delPos = async (id: string) => {
    if (posEditId === id) abbruchPosForm()
    setFehler(null)
    const { data: inUse, error: cErr } = await supabase
      .from('textil_zuordnungen')
      .select('id')
      .eq('position_id', id)
      .limit(1)
    if (cErr) {
      setFehler(cErr.message)
      return
    }
    if (inUse && inUse.length > 0) {
      setFehler('Position wird noch in einer Zuordnung verwendet.')
      return
    }
    setSMut(true)
    const { error } = await supabase.from('textil_positionen').delete().eq('id', id)
    setSMut(false)
    if (error) {
      setFehler(error.message)
      return
    }
    const next = positionen.filter(p => p.id !== id)
    setPositionen(next)
    const zuo2 = zuordnungen.filter(z => z.position_id !== id)
    setZuordnungen(zuo2)
    const prod = teilR.current.status === 'PRODUKTION_BEREIT' || teilR.current.status === 'FERTIG'
    void syncTeil(motive, next, zuo2, prod)
  }

  const delZ = async (id: string) => {
    setFehler(null)
    setSMut(true)
    const { error } = await supabase.from('textil_zuordnungen').delete().eq('id', id)
    setSMut(false)
    if (error) {
      setFehler(error.message)
      return
    }
    const next = zuordnungen.filter(z => z.id !== id)
    setZuordnungen(next)
    const prod = teilR.current.status === 'PRODUKTION_BEREIT' || teilR.current.status === 'FERTIG'
    void syncTeil(motive, positionen, next, prod)
  }

  useEffect(() => {
    if (posEditId !== null) return
    setPosMotivIds(prev => {
      const cur = prev[TEMP_POS_NEU]
      if (cur && cur.length > 0) return prev
      return { ...prev, [TEMP_POS_NEU]: [''] }
    })
  }, [posEditId])

  const pruef = teilStatus !== 'ANGEBOT'

  return (
    <div className="ber-lfp" style={{ maxWidth: '100%' }}>
      <h3 className="ber-h3">Textil-Details</h3>
      {pruef && kundeErfuelltPrepressKontakt(auftragKunde) === false && (
        <p className="ber-hinweis">Für Auto-PREPRESS: Kunde braucht Name und E-Mail oder Telefon.</p>
      )}
      {fehler && <p className="ber-err">{fehler}</p>}

      {laden && <p className="ber-hinweis" style={{ fontStyle: 'normal' }}>Lädt Textildaten …</p>}

      <div className="ber-lfp" style={{ borderTop: '1px solid var(--border)', marginTop: '0.5rem', paddingTop: '0.35rem' }}>
        <h3 className="ber-h3" style={{ marginTop: 0 }}>
          1. Motive
        </h3>
        <p className="ber-hinweis" style={{ fontStyle: 'normal', fontSize: '0.8rem' }}>
          {motivEditId ? 'Eintrag bearbeiten und speichern.' : 'Neues Motiv anlegen und mit + Hinzufügen speichern.'}
        </p>
        <form onSubmit={addMotiv}>
              <div className="ber-zeile">
                <span className="ber-lbl">Typ</span>
                <div className="ber-nmb">
                  <label>
                    <input type="radio" name="mtyp" checked={mTyp === 'TEXT'} onChange={() => setMTyp('TEXT')} /> Text
                  </label>
                  <label>
                    <input type="radio" name="mtyp" checked={mTyp === 'DATEI'} onChange={() => setMTyp('DATEI')} /> Datei
                  </label>
                </div>
              </div>
              {mTyp === 'TEXT' && (
                <>
                  <div className="ber-zeile">
                    <label className="ber-lbl" htmlFor="tx-inh">
                      Inhalt
                    </label>
                    <input id="tx-inh" className="ber-inp" value={mInhalt} onChange={e => setMInhalt(e.target.value)} />
                  </div>
                  <div className="ber-zeile">
                    <label className="ber-lbl" htmlFor="tx-fa">
                      Farbe
                    </label>
                    <input id="tx-fa" className="ber-inp" value={mFarbe} onChange={e => setMFarbe(e.target.value)} />
                  </div>
                  <div className="ber-zeile">
                    <span className="ber-lbl">Schriftklasse</span>
                    <select
                      className="ber-inp"
                      value={mSchriftkl}
                      onChange={e => setMSchriftkl(e.target.value as TextilSchriftklasse)}
                    >
                      {SCHRIFTKLASSE.map(s => (
                        <option key={s.v} value={s.v}>
                          {s.l}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="ber-zeile">
                    <label className="ber-lbl" htmlFor="tx-sa">
                      Schriftart
                    </label>
                    <input
                      id="tx-sa"
                      className="ber-inp"
                      placeholder="Konkrete Schriftart"
                      value={mSchriftart}
                      onChange={e => setMSchriftart(e.target.value)}
                    />
                  </div>
                </>
              )}
              {mTyp === 'DATEI' && (
                <div className="ber-zeile">
                  <span className="ber-lbl">Datei</span>
                  <div>
                    {auftragDateien.length === 0 ? (
                      <p className="ber-hinweis" style={{ fontStyle: 'normal' }}>
                        Zuerst Dateien am Auftrag hinterlegen (Abschnitt &apos;Dateien dieses Auftrags&apos;).
                      </p>
                    ) : (
                      <select className="ber-inp" value={mDatei} onChange={e => setMDatei(e.target.value)} required>
                        <option value="">—</option>
                        {auftragDateien.map(d => (
                          <option key={d.id} value={d.id}>
                            {d.anzeigename}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              )}
              <div className="ber-zeile">
                <span className="ber-lbl">Platz</span>
                <select className="ber-inp" value={mPlatz} onChange={e => setMPlatz(e.target.value as TextilPlatz)}>
                  {PLATZ_OPT.map(p => (
                    <option key={p.v} value={p.v}>
                      {p.l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ber-zeile">
                <span className="ber-lbl">Größe</span>
                <div>
                  <select
                    className="ber-inp"
                    value={mGrArt}
                    onChange={e => setMGrArt(e.target.value as TextilGroesseEnum)}
                  >
                    {GROESSE_WAHL.map(g => (
                      <option key={g} value={g}>
                        {g === 'FREI' ? 'Frei (mm)' : GROESSE_ANZEIGE[g as 'KLEIN' | 'MITTEL' | 'GROSS']}
                      </option>
                    ))}
                  </select>
                  {mGrArt === 'FREI' && (
                    <input
                      className="ber-inp"
                      style={{ marginTop: 6, maxWidth: '14rem' }}
                      placeholder="z. B. 150x200"
                      value={mGrFrei}
                      onChange={e => setMGrFrei(e.target.value)}
                    />
                  )}
                </div>
              </div>
              <div className="ber-zeile">
                <label className="ber-lbl" htmlFor="m-druckart">
                  Druckart
                </label>
                <input
                  id="m-druckart"
                  className="ber-inp"
                  placeholder="optional"
                  value={mDruckart}
                  onChange={e => setMDruckart(e.target.value)}
                />
              </div>
              <div className="ber-zeile">
                <span className="ber-lbl" />
                <div className="ber-nmb" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                  <button type="submit" className="wa-bereich-btn" disabled={sMut || laden}>
                    {motivEditId ? 'Speichern' : '+ Hinzufügen'}
                  </button>
                  {motivEditId && (
                    <button type="button" className="wa-ghost-btn" onClick={abbruchMotivForm} disabled={sMut || laden}>
                      Abbrechen
                    </button>
                  )}
                </div>
              </div>
            </form>
        <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.65rem', paddingTop: '0.5rem' }}>
          <p style={{ margin: '0 0 0.35rem', fontSize: '0.82rem', fontWeight: 600 }}>Bestehende Motive</p>
          {motive.length === 0 && (
            <div
              style={{
                border: '1px dashed var(--border)',
                borderRadius: 6,
                padding: '0.75rem',
                marginBottom: '0.5rem',
                fontSize: '0.85rem',
                color: 'var(--text)',
                opacity: 0.9,
              }}
            >
              Noch kein Motiv angelegt.
            </div>
          )}
          {motive.map((m, idx) => (
            <div
              key={m.id}
              style={{
                marginBottom: '0.5rem',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '0.5rem 0.65rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: '0.88rem',
                }}
              >
                <strong>Motiv {idx + 1}</strong>
                <span style={{ opacity: 0.75 }}>|</span>
                <span>{m.typ}</span>
                <span style={{ opacity: 0.75 }}>|</span>
                <span>{platzLabel(String(m.platz ?? '')) || '—'}</span>
                <span style={{ opacity: 0.75 }}>|</span>
                <span>{groesseKurzLabel(m.groesse ?? '—')}</span>
                <span style={{ opacity: 0.75 }}>|</span>
                <span>{m.druckart?.trim() ? m.druckart : '—'}</span>
                <button type="button" className="wa-ghost-btn" onClick={() => motivBearbeiten(m)} disabled={sMut}>
                  Bearbeiten
                </button>
                <button type="button" className="wa-ghost-btn" onClick={() => void delMotiv(m.id)} disabled={sMut}>
                  Entfernen
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="ber-lfp" style={{ borderTop: '1px solid var(--border)' }}>
        <h3 className="ber-h3" style={{ marginTop: '0.35rem' }}>
          2. Textilien
        </h3>
        <p className="ber-hinweis" style={{ fontSize: '0.8rem' }}>
          {posEditId ? 'Position bearbeiten und speichern.' : 'Neue Position anlegen.'} Eigenware: Jede Größe als eigene Position.
        </p>
        <form onSubmit={addPosition}>
              <div className="ber-zeile">
                <span className="ber-lbl">Herkunft</span>
                <div className="ber-nmb">
                  <label>
                    <input
                      type="radio"
                      name="pH"
                      checked={pHerk === 'KUNDENWARE'}
                      onChange={() => setPHerk('KUNDENWARE')}
                      disabled={posEditId !== null}
                    />
                    {HERKUNFT_ANZEIGE.KUNDENWARE}
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="pH"
                      checked={pHerk === 'EIGENWARE'}
                      onChange={() => setPHerk('EIGENWARE')}
                      disabled={posEditId !== null}
                    />
                    {HERKUNFT_ANZEIGE.EIGENWARE}
                  </label>
                </div>
              </div>
              {pHerk === 'KUNDENWARE' && (
                <>
                  <div className="ber-zeile">
                    <span className="ber-lbl">Typ</span>
                    <select className="ber-inp" value={pKTyp} onChange={e => setPKTyp(e.target.value as TextilKundenKleidungTyp)}>
                      {KLEID_TYP.map(x => (
                        <option key={x.v} value={x.v}>
                          {x.l}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="ber-zeile">
                    <label className="ber-lbl" htmlFor="px-fa">
                      Farbe
                    </label>
                    <input id="px-fa" className="ber-inp" value={pFarbe} onChange={e => setPFarbe(e.target.value)} />
                  </div>
                </>
              )}
              {pHerk === 'EIGENWARE' && (
                <>
                  <div className="ber-zeile">
                    <span className="ber-lbl">Eigenware-Modus</span>
                    <div className="ber-nmb" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                      <label>
                        <input
                          type="radio"
                          name="ewm"
                          checked={eigenwareModus === 'STAMMDATEN'}
                          onChange={() => {
                            setEigenwareModus('STAMMDATEN')
                            void speichereEigenwareModus('STAMMDATEN')
                            setSdMarkeId('')
                            setSdProduktId('')
                            setSdVarianteId('')
                          }}
                        />{' '}
                        Aus Stammdaten wählen
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="ewm"
                          checked={eigenwareModus === 'FREITEXT'}
                          onChange={() => {
                            setEigenwareModus('FREITEXT')
                            void speichereEigenwareModus('FREITEXT')
                            setSdMarkeId('')
                            setSdProduktId('')
                            setSdVarianteId('')
                          }}
                        />{' '}
                        Freitext (Artikel nicht in Stammdaten)
                      </label>
                    </div>
                  </div>

                  {eigenwareModus === 'STAMMDATEN' && (
                    <>
                      <div className="ber-zeile">
                        <span className="ber-lbl">Marke</span>
                        <div>
                          <select
                            className="ber-inp"
                            value={sdMarkeId}
                            onChange={e => {
                              setSdMarkeId(e.target.value)
                              setSdProduktId('')
                              setSdFarbe('')
                              setSdVarianteId('')
                            }}
                            required
                          >
                            <option value="">—</option>
                            {sdMarken.map(m => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                          {sdLaden && <p className="ber-hinweis">Lädt Stammdaten …</p>}
                        </div>
                      </div>

                      {sdMarkeId && (
                        <div className="ber-zeile">
                          <span className="ber-lbl">Produkt</span>
                          <select
                            className="ber-inp"
                            value={sdProduktId}
                            onChange={e => {
                              setSdProduktId(e.target.value)
                              setSdFarbe('')
                              setSdVarianteId('')
                            }}
                            required
                          >
                            <option value="">—</option>
                            {sdProdukte.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                                {p.artikelnummer ? ` (${p.artikelnummer})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {sdProduktId && (
                        <div className="ber-zeile">
                          <span className="ber-lbl">Farbe</span>
                          <div>
                            <select
                              className="ber-inp"
                              value={sdFarbe}
                              onChange={e => {
                                const f = e.target.value
                                setSdFarbe(f)
                                setSdVarianteId('')
                                if (f) {
                                  const markeName = sdMarken.find(x => x.id === sdMarkeId)?.name ?? ''
                                  const produktName = sdProdukte.find(x => x.id === sdProduktId)?.name ?? ''
                                  setPMarke(markeName)
                                  setPModell(produktName)
                                  setPFarbe(f)
                                  setPGroesse('')
                                } else {
                                  setPFarbe('')
                                  setPGroesse('')
                                }
                              }}
                              required
                            >
                              <option value="">—</option>
                              {sdFarben.map(v => (
                                <option key={v.farbe} value={v.farbe}>
                                  {v.farbe_hex ? '● ' : ''}
                                  {v.farbe}
                                </option>
                              ))}
                            </select>
                            {sdFarbe && (
                              <p
                                className="ber-hinweis"
                                style={{
                                  fontStyle: 'normal',
                                }}
                              >
                                Auswahl: {pMarke} · {pModell} · {sdFarbe}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {sdProduktId && sdFarbe && (
                        <div className="ber-zeile">
                          <span className="ber-lbl">Größe</span>
                          <div>
                            <select
                              className="ber-inp"
                              value={sdVarianteId}
                              onChange={e => {
                                const vId = e.target.value
                                setSdVarianteId(vId)
                                const v = sdGroessen.find(x => x.id === vId) ?? null
                                if (v) {
                                  setPGroesse(v.groesse)
                                } else {
                                  setPGroesse('')
                                }
                              }}
                              required
                            >
                              <option value="">—</option>
                              {sdGroessen.map(v => (
                                <option key={v.id} value={v.id}>
                                  {(v.bestand ?? 0) <= 0 ? '⚠ ' : ''}
                                  {v.groesse} (Bestand: {v.bestand ?? 0}){v.ist_muster ? ' · Muster' : ''}
                                </option>
                              ))}
                            </select>
                            {sdVarianteId && (
                              <p
                                className="ber-hinweis"
                                style={{
                                  fontStyle: 'normal',
                                  color: (sdGroessen.find(x => x.id === sdVarianteId)?.bestand ?? 0) <= 0 ? '#f59e0b' : undefined,
                                }}
                              >
                                Auswahl: {pMarke} · {pModell} · {sdFarbe} · {pGroesse}
                              </p>
                            )}
                            {!sdVarianteId && sdGroessen.length > 0 && (
                              <p className="ber-hinweis" style={{ fontStyle: 'normal' }}>
                                Größe wählen (Pflicht)
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {eigenwareModus === 'FREITEXT' && (
                    <>
                      <div className="ber-zeile">
                        <label className="ber-lbl" htmlFor="px-mk">
                          Marke
                        </label>
                        <input
                          id="px-mk"
                          className="ber-inp"
                          value={pMarke}
                          onChange={e => setPMarke(e.target.value)}
                        />
                      </div>
                      <div className="ber-zeile">
                        <label className="ber-lbl" htmlFor="px-mo">
                          Modell
                        </label>
                        <input
                          id="px-mo"
                          className="ber-inp"
                          value={pModell}
                          onChange={e => setPModell(e.target.value)}
                        />
                      </div>
                      <div className="ber-zeile">
                        <label className="ber-lbl" htmlFor="px-f2">
                          Farbe
                        </label>
                        <input
                          id="px-f2"
                          className="ber-inp"
                          value={pFarbe}
                          onChange={e => setPFarbe(e.target.value)}
                        />
                      </div>
                      <div className="ber-zeile">
                        <label className="ber-lbl" htmlFor="px-gr">
                          Größe
                        </label>
                        <div>
                          <input
                            id="px-gr"
                            className="ber-inp"
                            value={pGroesse}
                            onChange={e => setPGroesse(e.target.value)}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
              {(pHerk !== 'EIGENWARE' || eigenwareModus !== 'STAMMDATEN' || sdVarianteId) && (
                <div className="ber-zeile">
                  <label className="ber-lbl" htmlFor="px-st">
                    Stückzahl
                  </label>
                  <input
                    id="px-st"
                    type="number"
                    className="ber-inp"
                    min={1}
                    step={1}
                    value={pSt}
                    onChange={e => setPSt(parseInt(e.target.value, 10) || 0)}
                  />
                </div>
              )}
              {(posMotivIds[posSlotKey] ?? ['']).map((slotVal, slotIx) => (
                <div key={`mot-slot-${posSlotKey}-${slotIx}`} className="ber-zeile">
                  <span className="ber-lbl">{slotIx === 0 ? 'Motiv zuordnen' : ''}</span>
                  <div>
                    <select
                      className="ber-inp"
                      value={slotVal}
                      onChange={e => {
                        const v = e.target.value
                        setPosMotivIds(prev => {
                          const row = [...(prev[posSlotKey] ?? [''])]
                          row[slotIx] = v
                          return { ...prev, [posSlotKey]: row }
                        })
                      }}
                    >
                      <option value="">— Motiv wählen —</option>
                      {motive.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.typ === 'TEXT'
                            ? (m.inhalt ?? 'Text-Motiv')
                            : `Datei-Motiv ${motive.indexOf(m) + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
              <div className="ber-zeile">
                <span className="ber-lbl" />
                <button
                  type="button"
                  className="wa-ghost-btn"
                  onClick={() =>
                    setPosMotivIds(prev => ({
                      ...prev,
                      [posSlotKey]: [...(prev[posSlotKey] ?? ['']), ''],
                    }))
                  }
                  disabled={sMut || laden}
                >
                  + weiteres Motiv
                </button>
              </div>
              <div className="ber-zeile">
                <span className="ber-lbl" />
                <div className="ber-nmb" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                  <button
                    type="submit"
                    className="wa-bereich-btn"
                    disabled={sMut || laden || (pHerk === 'EIGENWARE' && eigenwareModus === 'STAMMDATEN' && !sdVarianteId)}
                    title={pHerk === 'EIGENWARE' && eigenwareModus === 'STAMMDATEN' && !sdVarianteId ? 'Bitte Größe wählen' : undefined}
                  >
                    {posEditId ? 'Speichern' : '+ Hinzufügen'}
                  </button>
                  {posEditId && (
                    <button type="button" className="wa-ghost-btn" onClick={abbruchPosForm} disabled={sMut || laden}>
                      Abbrechen
                    </button>
                  )}
                </div>
              </div>
            </form>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {positionen.map(p => (
            <li
              key={p.id}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 8,
                padding: '0.45rem 0',
                borderBottom: '1px solid var(--border)',
                fontSize: '0.88rem',
              }}
            >
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  padding: '0.12rem 0.4rem',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                }}
              >
                {p.herkunft === 'KUNDENWARE' ? 'KUNDE' : 'EIGEN'}
              </span>
              {p.herkunft === 'EIGENWARE' && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '0.12rem 0.4rem',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    background: p.variante_id ? '#dcfce7' : '#f1f5f9',
                    color: p.variante_id ? '#166534' : '#475569',
                  }}
                >
                  {p.variante_id ? 'Stammdaten' : 'Freitext'}
                </span>
              )}
              <span>
                {p.herkunft === 'KUNDENWARE' ? (
                  `${kleidungLabel(p.typ)} · ${p.farbe} · Stückzahl: ${p.stueckzahl}`
                ) : p.variante_id ? (
                  (() => {
                    const vid = String(p.variante_id)
                    const v = varianteInfoById.get(vid)
                    const marke = v?.marke || (p.marke ?? '')
                    const prod = v?.produkt || (p.modell ?? '')
                    const farbe = v?.farbe || (p.farbe ?? '')
                    const gr = v?.groesse || (p.groesse ?? '')
                    const best = v ? v.bestand : null
                    return `${marke} ${prod} ${farbe} / ${gr} · Bestand: ${best == null ? '—' : best} · Stückzahl: ${p.stueckzahl}`
                  })()
                ) : (
                  `${p.marke} ${p.modell} ${p.farbe} / ${p.groesse} · Stückzahl: ${p.stueckzahl}`
                )}
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                {zuordnungen
                  .filter(z => z.position_id === p.id)
                  .map(z => {
                    const mo = motive.find(m => m.id === z.motiv_id)
                    const lab =
                      mo?.typ === 'TEXT'
                        ? (mo.inhalt ?? 'Text-Motiv')
                        : mo
                          ? `Datei-Motiv ${motive.indexOf(mo) + 1}`
                          : z.motiv_id
                    return (
                      <span
                        key={z.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: '0.65rem',
                          fontWeight: 600,
                          padding: '0.1rem 0.35rem',
                          border: '1px solid var(--border)',
                          borderRadius: 4,
                          background: 'var(--accent-bg, rgba(170, 59, 255, 0.08))',
                        }}
                      >
                        <span>{lab}</span>
                        <button
                          type="button"
                          title="Zuordnung entfernen"
                          onClick={() => void delZ(z.id)}
                          disabled={sMut}
                          style={{
                            font: 'inherit',
                            fontSize: '0.75rem',
                            lineHeight: 1,
                            padding: '0 0.15rem',
                            border: 'none',
                            background: 'transparent',
                            cursor: sMut ? 'not-allowed' : 'pointer',
                            color: 'var(--text)',
                          }}
                        >
                          ×
                        </button>
                      </span>
                    )
                  })}
              </div>
              <button type="button" className="wa-ghost-btn" onClick={() => void bearbeitePosition(p)} disabled={sMut}>
                Bearbeiten
              </button>
              <button type="button" className="wa-ghost-btn" onClick={() => void delPos(p.id)} disabled={sMut}>
                Entfernen
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
