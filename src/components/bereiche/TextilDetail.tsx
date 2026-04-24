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
import '../WorkArea.css'

type Props = {
  teil: TeilauftragRow
  teilStatus: AuftragStatus
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

function one<T>(x: T | T[] | null | undefined): T | null {
  if (x == null) return null
  return Array.isArray(x) ? (x[0] ?? null) : x
}

function schriftKlasseLabel(v: string | null | undefined): string {
  if (!v) return '—'
  const s = SCHRIFTKLASSE.find(x => x.v === v)
  return s?.l ?? v
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

export function TextilDetail({ teil, teilStatus, auftragDateien, auftragKunde, onAktualisiert }: Props) {
  const teilR = useRef(teil)
  useEffect(() => {
    teilR.current = teil
  }, [teil])

  const [motive, setMotive] = useState<TextilMotiveRow[]>([])
  const [positionen, setPositionen] = useState<TextilPositionenRow[]>([])
  const [zuordnungen, setZuordnungen] = useState<TextilZuordnungRow[]>([])

  const [laden, setLaden] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)
  const [sMut, setSMut] = useState(false)

  const [mTyp, setMTyp] = useState<TextilMotivTyp>('TEXT')
  const [mInhalt, setMInhalt] = useState('')
  const [mFarbe, setMFarbe] = useState('')
  const [mSchriftkl, setMSchriftkl] = useState<TextilSchriftklasse>('SERIFENLOS')
  const [mSchriftart, setMSchriftart] = useState('')
  const [mDatei, setMDatei] = useState('')

  const [pHerk, setPHerk] = useState<TextilHerkunft>('KUNDENWARE')
  const [pKTyp, setPKTyp] = useState<TextilKundenKleidungTyp>('T_SHIRT')
  const [pFarbe, setPFarbe] = useState('')
  const [pSt, setPSt] = useState(1)
  const [pMarke, setPMarke] = useState('')
  const [pModell, setPModell] = useState('')
  const [pGroesse, setPGroesse] = useState('')

  const [zMot, setZMot] = useState('')
  const [zPos, setZPos] = useState('')
  const [zPlatz, setZPlatz] = useState<TextilPlatz>('BRUST_LINKS')
  const [zGrArt, setZGrArt] = useState<TextilGroesseEnum>('MITTEL')
  const [zGrFrei, setZGrFrei] = useState('')
  const [zDruck, setZDruck] = useState('')

  const [motivFormOffen, setMotivFormOffen] = useState(false)
  const [posFormOffen, setPosFormOffen] = useState(false)
  const [zuoFormOffen, setZuoFormOffen] = useState(false)

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
        nSt = nextTeilStatus(t.status, t, merged, voll, kOk)
      }
      setSMut(true)
      const { data, error } = await supabase
        .from('teilauftraege')
        .update({ status: nSt, detail: newDetail } as never)
        .eq('id', t.id)
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
    [auftragKunde, onAktualisiert]
  )

  const syncRef = useRef(syncTeil)
  syncRef.current = syncTeil

  const ladeAlles = useCallback(async () => {
    setLaden(true)
    setFehler(null)
    const tId = teilR.current.id
    const [mRes, pRes, zRes] = await Promise.all([
      supabase.from('textil_motive').select('*').eq('teilauftrag_id', tId),
      supabase.from('textil_positionen').select('*').eq('teilauftrag_id', tId),
      supabase
        .from('textil_zuordnungen')
        .select(
          'id, teilauftrag_id, motiv_id, position_id, platz, groesse, druckart, textil_motive(typ, inhalt, datei_id), textil_positionen(herkunft, typ, farbe, marke, modell, groesse)'
        )
        .eq('teilauftrag_id', tId),
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
    setLaden(false)
    await syncRef.current(m, p, z0, false)
  }, [])

  useEffect(() => {
    void ladeAlles()
  }, [ladeAlles, teil.id])

  useEffect(() => {
    setMotivFormOffen(false)
    setPosFormOffen(false)
    setZuoFormOffen(false)
  }, [teil.id])

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
  }
  const resetPForm = () => {
    setPHerk('KUNDENWARE')
    setPKTyp('T_SHIRT')
    setPFarbe('')
    setPSt(1)
    setPMarke('')
    setPModell('')
    setPGroesse('')
  }
  const resetZForm = () => {
    setZMot('')
    setZPos('')
    setZPlatz('BRUST_LINKS')
    setZGrArt('MITTEL')
    setZGrFrei('')
    setZDruck('')
  }

  const abbruchMotivForm = () => {
    resetMForm()
    setMotivFormOffen(false)
  }
  const abbruchPosForm = () => {
    resetPForm()
    setPosFormOffen(false)
  }
  const abbruchZuoForm = () => {
    resetZForm()
    setZuoFormOffen(false)
  }

  const addMotiv = async (e: FormEvent) => {
    e.preventDefault()
    setFehler(null)
    const tId = teil.id
    if (mTyp === 'TEXT') {
      if (!mInhalt.trim() || !mFarbe.trim()) {
        setFehler('Inhalt und Farbe sind erforderlich (Text).')
        return
      }
      setSMut(true)
      const { data, error } = await supabase
        .from('textil_motive')
        .insert({
          teilauftrag_id: tId,
          typ: 'TEXT',
          inhalt: mInhalt.trim(),
          farbe: mFarbe.trim(),
          schriftklasse: mSchriftkl,
          schriftart: mSchriftart.trim() || null,
          datei_id: null,
        } as never)
        .select('*')
        .single()
      setSMut(false)
      if (error) {
        setFehler(error.message)
        return
      }
      if (data) {
        const r = data as TextilMotiveRow
        const nextM = [...motive, r]
        setMotive(nextM)
        resetMForm()
        setMotivFormOffen(false)
        const prod = teilR.current.status === 'PRODUKTION_BEREIT' || teilR.current.status === 'FERTIG'
        void syncTeil(nextM, positionen, zuordnungen, prod)
      }
    } else {
      if (!mDatei) {
        setFehler('Bitte eine Datei wählen.')
        return
      }
      setSMut(true)
      const { data, error } = await supabase
        .from('textil_motive')
        .insert({
          teilauftrag_id: tId,
          typ: 'DATEI',
          inhalt: null,
          farbe: null,
          schriftklasse: null,
          schriftart: null,
          datei_id: mDatei,
        } as never)
        .select('*')
        .single()
      setSMut(false)
      if (error) {
        setFehler(error.message)
        return
      }
      if (data) {
        const r = data as TextilMotiveRow
        const nextM = [...motive, r]
        setMotive(nextM)
        resetMForm()
        setMotivFormOffen(false)
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
        } as never)
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
        resetPForm()
        setPosFormOffen(false)
        const prod = teilR.current.status === 'PRODUKTION_BEREIT' || teilR.current.status === 'FERTIG'
        void syncTeil(motive, nextP, zuordnungen, prod)
      }
    } else {
      if (!pMarke.trim() || !pModell.trim() || !pFarbe.trim() || !pGroesse.trim()) {
        setFehler('Marke, Modell, Farbe und Größe sind erforderlich.')
        return
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
        } as never)
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
        resetPForm()
        setPosFormOffen(false)
        const prod = teilR.current.status === 'PRODUKTION_BEREIT' || teilR.current.status === 'FERTIG'
        void syncTeil(motive, nextP, zuordnungen, prod)
      }
    }
  }

  const addZuordnung = async (e: FormEvent) => {
    e.preventDefault()
    setFehler(null)
    if (!zMot || !zPos) {
      setFehler('Motiv und Position wählen.')
      return
    }
    let gro: string
    if (zGrArt === 'FREI') {
      if (!zGrFrei.trim()) {
        setFehler('Bei Größe „Frei (mm)“ bitte Abmessung eintragen.')
        return
      }
      gro = buildFreiGroesseString(zGrFrei)
    } else {
      gro = zGrArt
    }
    setSMut(true)
    const { data, error } = await supabase
      .from('textil_zuordnungen')
      .insert({
        teilauftrag_id: teil.id,
        motiv_id: zMot,
        position_id: zPos,
        platz: zPlatz,
        groesse: gro,
        druckart: zDruck.trim() || null,
      } as never)
      .select(
        'id, teilauftrag_id, motiv_id, position_id, platz, groesse, druckart, textil_motive(typ, inhalt, datei_id), textil_positionen(herkunft, typ, farbe, marke, modell, groesse)'
      )
      .single()
    setSMut(false)
    if (error) {
      if (isUniqueViolation(error)) {
        setFehler('Dieser Platz ist für diese Position bereits belegt.')
        return
      }
      setFehler(error.message)
      return
    }
    if (data) {
      const r = data as unknown as TextilZuordnungRow
      const nextZ = [...zuordnungen, r]
      setZuordnungen(nextZ)
      resetZForm()
      setZuoFormOffen(false)
      const prod = teilR.current.status === 'PRODUKTION_BEREIT' || teilR.current.status === 'FERTIG'
      void syncTeil(motive, positionen, nextZ, prod)
    }
  }

  const delMotiv = async (id: string) => {
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

  const posKurz = (p: TextilPositionenRow) => {
    if (p.herkunft === 'KUNDENWARE') {
      return `${kleidungLabel(p.typ)} ${p.farbe?.trim() ?? ''}`.trim()
    }
    return `${(p.marke ?? '').trim()} ${(p.modell ?? '').trim()} ${(p.farbe ?? '').trim()} ${(p.groesse ?? '').trim()}`.trim()
  }

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
        {!motivFormOffen && (
          <p style={{ margin: '0 0 0.5rem' }}>
            <button
              type="button"
              className="wa-bereich-btn"
              onClick={() => setMotivFormOffen(true)}
              disabled={sMut || laden}
            >
              + Motiv hinzufügen
            </button>
          </p>
        )}
        {motivFormOffen && (
          <>
            <p className="ber-hinweis" style={{ fontStyle: 'normal', fontSize: '0.8rem' }}>
              Motivart wählen und mit + Hinzufügen speichern.
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
                <span className="ber-lbl" />
                <div className="ber-nmb" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                  <button type="submit" className="wa-bereich-btn" disabled={sMut || laden}>
                    + Hinzufügen
                  </button>
                  <button type="button" className="wa-ghost-btn" onClick={abbruchMotivForm} disabled={sMut || laden}>
                    Abbrechen
                  </button>
                </div>
              </div>
            </form>
          </>
        )}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {motive.map(m => (
            <li
              key={m.id}
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
                {m.typ}
              </span>
              {m.typ === 'TEXT' ? (
                <span>
                  {m.inhalt} · {m.farbe} · {schriftKlasseLabel(m.schriftklasse)}
                </span>
              ) : (
                <span>{dateiNameById.get(m.datei_id ?? '') ?? m.datei_id}</span>
              )}
              <button type="button" className="wa-ghost-btn" onClick={() => void delMotiv(m.id)} disabled={sMut}>
                Entfernen
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="ber-lfp" style={{ borderTop: '1px solid var(--border)' }}>
        <h3 className="ber-h3" style={{ marginTop: '0.35rem' }}>
          2. Positionen (Textilien)
        </h3>
        {!posFormOffen && (
          <p style={{ margin: '0 0 0.5rem' }}>
            <button
              type="button"
              className="wa-bereich-btn"
              onClick={() => setPosFormOffen(true)}
              disabled={sMut || laden}
            >
              + Position hinzufügen
            </button>
          </p>
        )}
        {posFormOffen && (
          <>
            <p className="ber-hinweis" style={{ fontSize: '0.8rem' }}>
              Eigenware: Jede Größe als eigene Position anlegen.
            </p>
            <form onSubmit={addPosition}>
              <div className="ber-zeile">
                <span className="ber-lbl">Herkunft</span>
                <div className="ber-nmb">
                  <label>
                    <input type="radio" name="pH" checked={pHerk === 'KUNDENWARE'} onChange={() => setPHerk('KUNDENWARE')} />
                    {HERKUNFT_ANZEIGE.KUNDENWARE}
                  </label>
                  <label>
                    <input type="radio" name="pH" checked={pHerk === 'EIGENWARE'} onChange={() => setPHerk('EIGENWARE')} />
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
                    <label className="ber-lbl" htmlFor="px-mk">
                      Marke
                    </label>
                    <input id="px-mk" className="ber-inp" value={pMarke} onChange={e => setPMarke(e.target.value)} />
                  </div>
                  <div className="ber-zeile">
                    <label className="ber-lbl" htmlFor="px-mo">
                      Modell
                    </label>
                    <input id="px-mo" className="ber-inp" value={pModell} onChange={e => setPModell(e.target.value)} />
                  </div>
                  <div className="ber-zeile">
                    <label className="ber-lbl" htmlFor="px-f2">
                      Farbe
                    </label>
                    <input id="px-f2" className="ber-inp" value={pFarbe} onChange={e => setPFarbe(e.target.value)} />
                  </div>
                  <div className="ber-zeile">
                    <label className="ber-lbl" htmlFor="px-gr">
                      Größe
                    </label>
                    <div>
                      <input id="px-gr" className="ber-inp" value={pGroesse} onChange={e => setPGroesse(e.target.value)} />
                    </div>
                  </div>
                </>
              )}
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
              <div className="ber-zeile">
                <span className="ber-lbl" />
                <div className="ber-nmb" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                  <button type="submit" className="wa-bereich-btn" disabled={sMut || laden}>
                    + Hinzufügen
                  </button>
                  <button type="button" className="wa-ghost-btn" onClick={abbruchPosForm} disabled={sMut || laden}>
                    Abbrechen
                  </button>
                </div>
              </div>
            </form>
          </>
        )}
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
              <span>
                {p.herkunft === 'KUNDENWARE'
                  ? `${kleidungLabel(p.typ)} · ${p.farbe} · ${p.stueckzahl} Stück`
                  : `${p.marke} · ${p.modell} · ${p.farbe} · ${p.groesse} · ${p.stueckzahl} Stück`}
              </span>
              <button type="button" className="wa-ghost-btn" onClick={() => void delPos(p.id)} disabled={sMut}>
                Entfernen
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="ber-lfp" style={{ borderTop: '1px solid var(--border)' }}>
        <h3 className="ber-h3" style={{ marginTop: '0.35rem' }}>
          3. Zuordnungen
        </h3>
        {!zuoFormOffen && (
          <p style={{ margin: '0 0 0.5rem' }}>
            <button
              type="button"
              className="wa-bereich-btn"
              onClick={() => setZuoFormOffen(true)}
              disabled={sMut || laden}
            >
              + Zuordnung hinzufügen
            </button>
          </p>
        )}
        {zuoFormOffen && (
          <form onSubmit={addZuordnung}>
            <div className="ber-zeile">
              <span className="ber-lbl">Motiv</span>
              <select className="ber-inp" value={zMot} onChange={e => setZMot(e.target.value)}>
                <option value="">—</option>
                {motive.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.typ === 'TEXT' ? m.inhalt : `Datei: ${dateiNameById.get(m.datei_id ?? '') ?? m.datei_id}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="ber-zeile">
              <span className="ber-lbl">Position</span>
              <select className="ber-inp" value={zPos} onChange={e => setZPos(e.target.value)}>
                <option value="">—</option>
                {positionen.map(p => (
                  <option key={p.id} value={p.id}>
                    {HERKUNFT_ANZEIGE[p.herkunft]} · {posKurz(p)}
                  </option>
                ))}
              </select>
            </div>
            <div className="ber-zeile">
              <span className="ber-lbl">Platz</span>
              <select className="ber-inp" value={zPlatz} onChange={e => setZPlatz(e.target.value as TextilPlatz)}>
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
                <select className="ber-inp" value={zGrArt} onChange={e => setZGrArt(e.target.value as TextilGroesseEnum)}>
                  {GROESSE_WAHL.map(g => (
                    <option key={g} value={g}>
                      {g === 'FREI' ? 'Frei (mm)' : GROESSE_ANZEIGE[g as 'KLEIN' | 'MITTEL' | 'GROSS']}
                    </option>
                  ))}
                </select>
                {zGrArt === 'FREI' && (
                  <input
                    className="ber-inp"
                    style={{ marginTop: 6, maxWidth: '14rem' }}
                    placeholder="z. B. 150x200"
                    value={zGrFrei}
                    onChange={e => setZGrFrei(e.target.value)}
                  />
                )}
              </div>
            </div>
            <div className="ber-zeile">
              <label className="ber-lbl" htmlFor="tx-dru">
                Druckart
              </label>
              <div>
                <input
                  id="tx-dru"
                  className="ber-inp"
                  placeholder="Wird durch PrePress festgelegt"
                  value={zDruck}
                  onChange={e => setZDruck(e.target.value)}
                />
              </div>
            </div>
            <div className="ber-zeile">
              <span className="ber-lbl" />
              <div className="ber-nmb" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                <button type="submit" className="wa-bereich-btn" disabled={sMut || laden}>
                  + Hinzufügen
                </button>
                <button type="button" className="wa-ghost-btn" onClick={abbruchZuoForm} disabled={sMut || laden}>
                  Abbrechen
                </button>
              </div>
            </div>
          </form>
        )}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {zuordnungen.map(z => {
            const mo = one(z.textil_motive) as { typ: TextilMotivTyp; inhalt: string | null; datei_id: string | null } | null
            const po = one(z.textil_positionen) as TextilPositionenRow | null
            const mLabel =
              mo?.typ === 'TEXT'
                ? (mo.inhalt ?? 'Text')
                : `Datei: ${dateiNameById.get(mo?.datei_id ?? '') ?? mo?.datei_id ?? '—'}`
            const pLabel = po
              ? po.herkunft === 'KUNDENWARE'
                ? `${po.herkunft} · ${kleidungLabel(po.typ)} · ${po.farbe ?? ''}`
                : `${po.herkunft} · ${po.marke} · ${po.modell} · ${po.farbe} · ${po.groesse ?? ''}`
              : z.position_id
            return (
              <li
                key={z.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 4,
                  padding: '0.5rem 0',
                  borderBottom: '1px solid var(--border)',
                  fontSize: '0.88rem',
                }}
              >
                <div>
                  {mLabel} <span style={{ opacity: 0.6 }}>→</span> {platzLabel(z.platz)} <span style={{ opacity: 0.6 }}>→</span> {pLabel}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text)' }}>
                  {groesseKurzLabel(z.groesse)}
                  {z.druckart ? ` · ${z.druckart}` : ''}
                </div>
                <button type="button" className="wa-ghost-btn" onClick={() => void delZ(z.id)} disabled={sMut}>
                  Entfernen
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
