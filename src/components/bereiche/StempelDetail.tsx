import { useCallback, useEffect, useRef, useState } from 'react'
import {
  STEMPEL_FARBE,
  STEMPEL_FARBE_ANZEIGE,
  STEMPEL_TYPEN,
  STEMPEL_TYP_ANZEIGE,
  type StempelDetailJson,
} from '../../types/stempel'
import { validateStempelDetail } from '../../lib/stempel/validateStempelDetail'
import type { AuftragStatus, TeilauftragRow } from '../../types/database'
import { supabase } from '../../supabase'
import '../WorkArea.css'

type Props = {
  teil: TeilauftragRow
  teilStatus: AuftragStatus
  onDetailPatch: (patch: { typ?: string | null; detail: StempelDetailJson | null }) => Promise<void>
}

function stempelRoh(teil: TeilauftragRow): StempelDetailJson {
  const d = teil.detail
  return d && typeof d === 'object' && !Array.isArray(d) ? { ...d } : {}
}

type BlK = {
  d: StempelDetailJson
  fe: (k: string) => string
  pruef: boolean
  f: Record<string, string>
  patchL: (p: StempelDetailJson) => void
  commit: () => void
  speichDetail: (d: StempelDetailJson) => void
}

const EXTRA_TYPEN = ['NACHFUELLFARBE', 'STEMPELKISSEN', 'STEMPELPLATTE', 'TRODAT_KISSEN'] as const
const EXTRA_TYP_ANZEIGE: Record<(typeof EXTRA_TYPEN)[number], string> = {
  NACHFUELLFARBE: 'Nachfüllfarbe',
  STEMPELKISSEN: 'Stempelkissen',
  STEMPELPLATTE: 'Stempelplatte',
  TRODAT_KISSEN: 'Trodat Ersatzkissen',
}

const NACHFUELLFARBE_FARBEN = ['SCHWARZ', 'ROT', 'BLAU', 'GRUEN'] as const
const NACHFUELLFARBE_TINTE_TYP = ['NORMAL', 'HAUTVERTRAEGLICH', 'TEXTIL'] as const
const NACHFUELLFARBE_TINTE_TYP_ANZEIGE: Record<(typeof NACHFUELLFARBE_TINTE_TYP)[number], string> = {
  NORMAL: 'Normal',
  HAUTVERTRAEGLICH: 'Hautverträglich',
  TEXTIL: 'Textil',
}

const STEMPELKISSEN_GROESSE = ['KLEIN', 'MITTEL', 'GROSS'] as const
const STEMPELKISSEN_GROESSE_ANZEIGE: Record<(typeof STEMPELKISSEN_GROESSE)[number], string> = {
  KLEIN: 'Klein',
  MITTEL: 'Mittel',
  GROSS: 'Groß',
}

type StempelModell = {
  id: string
  name: string
  max_breite_mm: number | null
  max_hoehe_mm: number | null
  druckflaeche: string | null
  bestand: number | null
  ersatzkissen_artikelnummer: string | null
}

const ERSATZ_KISSEN_FARBEN_REIHE = ['SCHWARZ', 'ROT', 'BLAU', 'GRUEN'] as const

type ErsatzKissenZeile = { farbe: string; label: string; bestand: number }

type KissenArtikelRow = { artikelnummer: string; name: string }
type KissenFarbButton = { id: string; farbe: (typeof ERSATZ_KISSEN_FARBEN_REIHE)[number]; bestand: number }

function escIlike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

async function ladeKissenFarbzeilen(artikelnummer: string): Promise<KissenFarbButton[]> {
  const { data, error } = await supabase
    .from('stempel_modelle')
    .select('id, farbe, bestand')
    .eq('typ', 'TRODAT_KISSEN')
    .eq('artikelnummer', artikelnummer)
    .order('farbe', { ascending: true })
  if (error) {
    console.error(error)
    return ERSATZ_KISSEN_FARBEN_REIHE.map(farbe => ({ id: '', farbe, bestand: 0 }))
  }
  const list = (data ?? []) as { id: string; farbe: string | null; bestand: number | null }[]
  const byF = new Map<string, (typeof list)[0]>()
  for (const r of list) {
    if (r.farbe) byF.set(r.farbe, r)
  }
  return ERSATZ_KISSEN_FARBEN_REIHE.map(farbe => {
    const r = byF.get(farbe)
    return { id: r?.id && String(r.id) ? String(r.id) : '', farbe, bestand: r ? Number(r.bestand) || 0 : 0 }
  })
}

function toPosIntOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : parseInt(String(v), 10)
  if (!Number.isInteger(n) || n <= 0) return null
  return n
}

function typLabel(t: string): string {
  if ((EXTRA_TYPEN as readonly string[]).includes(t)) return EXTRA_TYP_ANZEIGE[t as (typeof EXTRA_TYPEN)[number]]
  if ((STEMPEL_TYPEN as readonly string[]).includes(t)) return STEMPEL_TYP_ANZEIGE[t as (typeof STEMPEL_TYPEN)[number]]
  return t
}

export function StempelDetail({ teil, teilStatus, onDetailPatch }: Props) {
  const [typ, setTyp] = useState<string | null>(teil.typ)
  const [detail, setDetail] = useState<StempelDetailJson>(stempelRoh(teil))
  const detailR = useRef(detail)
  const typR = useRef(typ)
  useEffect(() => {
    detailR.current = detail
  }, [detail])
  useEffect(() => {
    typR.current = typ
  }, [typ])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Eltern-Teil ersetzt (Speichern/Reload)
    setTyp(teil.typ)
    setDetail(stempelRoh(teil))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teil.id, teil.typ, teil.detail])

  const fehler = validateStempelDetail(typ, detail, teilStatus)
  const pruef = teilStatus !== 'ANGEBOT'
  const fe = (k: string) => (pruef && fehler[k] ? ' ber-inp--err' : '')

  const bVal = toPosIntOrNull(detail.format_breite)
  const hVal = toPosIntOrNull(detail.format_hoehe)
  const hatMass = (bVal ?? 0) > 0 || (hVal ?? 0) > 0

  const showMass = typ !== 'NACHFUELLFARBE' && typ !== 'STEMPELKISSEN' && typ !== 'TRODAT_KISSEN'
  const showBeschreibung =
    typ !== 'NACHFUELLFARBE' &&
    typ !== 'STEMPELKISSEN' &&
    typ !== 'TRODAT_KISSEN' &&
    typ !== 'STEMPELPLATTE' &&
    !!typ
  const showFarbe = showBeschreibung // alle "klassischen" Typen
  const showAnzahl = !!typ

  const [modelle, setModelle] = useState<StempelModell[]>([])
  const [modelleLaden, setModelleLaden] = useState(false)
  const [modelleFehler, setModelleFehler] = useState<string | null>(null)

  const modellName = String((detail as Record<string, unknown>).modell_name ?? '')

  const [gewaehltesModellId, setGewaehltesModellId] = useState<string | null>(
    String(((teil.detail as Record<string, unknown> | null) ?? {}).modell_id ?? '') || null
  )
  const [gewaehltesModellName, setGewaehltesModellName] = useState<string | null>(
    String(((teil.detail as Record<string, unknown> | null) ?? {}).modell_name ?? '') || null
  )

  const [ersatzKissen, setErsatzKissen] = useState<ErsatzKissenZeile[] | null>(null)

  const [kissenInput, setKissenInput] = useState('')
  const [kissenQDeb, setKissenQDeb] = useState('')
  const [kissenTreffer, setKissenTreffer] = useState<KissenArtikelRow[]>([])
  const [kissenSucheLaden, setKissenSucheLaden] = useState(false)
  const [kissenSucheFehler, setKissenSucheFehler] = useState<string | null>(null)
  const [kissenFarbOptionen, setKissenFarbOptionen] = useState<KissenFarbButton[]>([])

  useEffect(() => {
    const td = ((teil.detail as Record<string, unknown> | null) ?? {}) as Record<string, unknown>
    setGewaehltesModellId(String(td.modell_id ?? '') || null)
    setGewaehltesModellName(String(td.modell_name ?? '') || null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teil.id, teil.detail])

  useEffect(() => {
    const t = typR.current
    const d = detailR.current
    const b = toPosIntOrNull(d.format_breite)
    const h = toPosIntOrNull(d.format_hoehe)
    const has = (b ?? 0) > 0 || (h ?? 0) > 0
    const isVorschlagTyp = t === 'TRODAT_PRINTY' || t === 'HOLZSTEMPEL'
    if (!isVorschlagTyp || !has) {
      setModelle([])
      setModelleFehler(null)
      setModelleLaden(false)
      return
    }

    let alive = true
    setModelleLaden(true)
    setModelleFehler(null)

    const q0 = supabase
      .from('stempel_modelle')
      .select('id, name, max_breite_mm, max_hoehe_mm, druckflaeche, bestand, ersatzkissen_artikelnummer')
      .eq('typ', t as string)
      .eq('aktiv', true)

    void (async () => {
      try {
        const { data, error } = await q0
        if (!alive) return
        if (error) {
          setModelle([])
          setModelleFehler(error.message)
        } else {
          const breite = toPosIntOrNull(detailR.current.format_breite)
          const hoehe = toPosIntOrNull(detailR.current.format_hoehe)
          const breite0 = breite ?? 0
          const hoehe0 = hoehe ?? 0

          const list = ((data ?? []) as StempelModell[]).filter(m => {
            const mw = m.max_breite_mm ?? 0
            const mh = m.max_hoehe_mm ?? 0
            if (breite != null && hoehe != null) return mw >= breite && mh >= hoehe
            if (breite != null) return mw >= breite
            if (hoehe != null) return mh >= hoehe
            return true
          })

          const sorted = list
            .slice()
            .sort((a, b) => {
              const distA =
                Math.abs((a.max_breite_mm ?? 0) - breite0) + Math.abs((a.max_hoehe_mm ?? 0) - hoehe0)
              const distB =
                Math.abs((b.max_breite_mm ?? 0) - breite0) + Math.abs((b.max_hoehe_mm ?? 0) - hoehe0)
              return distA - distB
            })
            .slice(0, 8)

          setModelle(sorted)
          setModelleFehler(null)
        }
      } catch (e) {
        if (!alive) return
        setModelle([])
        setModelleFehler(e instanceof Error ? e.message : String(e))
      } finally {
        if (alive) setModelleLaden(false)
      }
    })()

    return () => {
      alive = false
    }
  }, [typ, bVal, hVal])

  useEffect(() => {
    if (!gewaehltesModellId) {
      setErsatzKissen(null)
      return
    }
    let alive = true
    void (async () => {
      const fromList = modelle.find(m => m.id === gewaehltesModellId)
      let art: string | null = (fromList?.ersatzkissen_artikelnummer && String(fromList.ersatzkissen_artikelnummer).trim()) || null
      if (!art) {
        const { data, error } = await supabase
          .from('stempel_modelle')
          .select('ersatzkissen_artikelnummer')
          .eq('id', gewaehltesModellId)
          .single()
        if (!alive) return
        if (error || !data) {
          setErsatzKissen(null)
          return
        }
        const raw = (data as { ersatzkissen_artikelnummer: string | null }).ersatzkissen_artikelnummer
        art = (raw && String(raw).trim()) || null
      }
      if (!art) {
        if (alive) setErsatzKissen(null)
        return
      }
      const { data: rows, error: e2 } = await supabase
        .from('stempel_modelle')
        .select('id, name, farbe, bestand')
        .eq('artikelnummer', art)
        .eq('typ', 'TRODAT_KISSEN')
        .order('farbe', { ascending: true })
      if (!alive) return
      if (e2) {
        setErsatzKissen(null)
        return
      }
      const list = (rows ?? []) as { id: string; name: string; farbe: string | null; bestand: number | null }[]
      const byFarbe = new Map<string, (typeof list)[0]>()
      for (const r of list) {
        if (r.farbe) byFarbe.set(r.farbe, r)
      }
      setErsatzKissen(
        ERSATZ_KISSEN_FARBEN_REIHE.map(farbe => {
          const r = byFarbe.get(farbe)
          return {
            farbe,
            label: STEMPEL_FARBE_ANZEIGE[farbe],
            bestand: r ? Number(r.bestand) || 0 : 0,
          }
        })
      )
    })()
    return () => {
      alive = false
    }
  }, [gewaehltesModellId, modelle])

  useEffect(() => {
    if (typ !== 'TRODAT_KISSEN') return
    const t = setTimeout(() => setKissenQDeb(kissenInput), 350)
    return () => clearTimeout(t)
  }, [kissenInput, typ])

  useEffect(() => {
    if (typ !== 'TRODAT_KISSEN') {
      setKissenTreffer([])
      setKissenSucheFehler(null)
      setKissenSucheLaden(false)
      return
    }
    const q = kissenQDeb.trim()
    if (q.length < 1) {
      setKissenTreffer([])
      setKissenSucheFehler(null)
      setKissenSucheLaden(false)
      return
    }
    let alive = true
    setKissenSucheLaden(true)
    setKissenSucheFehler(null)
    void (async () => {
      const esc = escIlike(q)
      const p = `%${esc}%`
      const { data, error } = await supabase
        .from('stempel_modelle')
        .select('id, name, artikelnummer, farbe, bestand, vk_preis_netto')
        .eq('typ', 'TRODAT_KISSEN')
        .eq('aktiv', true)
        .or(`name.ilike.${p},artikelnummer.ilike.${p}`)
        .order('artikelnummer', { ascending: true })
      if (!alive) return
      if (error) {
        setKissenTreffer([])
        setKissenSucheFehler(error.message)
      } else {
        const m = new Map<string, KissenArtikelRow>()
        for (const r of (data ?? []) as { id: string; name: string; artikelnummer: string | null }[]) {
          const aKey = (r.artikelnummer && String(r.artikelnummer).trim()) || r.id
          if (!m.has(aKey)) m.set(aKey, { artikelnummer: r.artikelnummer ? String(r.artikelnummer) : '', name: r.name })
        }
        setKissenTreffer(
          [...m.values()].sort(
            (a, b) => a.artikelnummer.localeCompare(b.artikelnummer) || a.name.localeCompare(b.name)
          )
        )
        setKissenSucheFehler(null)
      }
      setKissenSucheLaden(false)
    })()
    return () => {
      alive = false
    }
  }, [kissenQDeb, typ])

  useEffect(() => {
    if (typ !== 'TRODAT_KISSEN') {
      setKissenInput('')
      setKissenQDeb('')
      setKissenTreffer([])
      setKissenSucheFehler(null)
      setKissenFarbOptionen([])
      return
    }
  }, [typ])

  useEffect(() => {
    if (typ !== 'TRODAT_KISSEN') {
      setKissenFarbOptionen([])
      return
    }
    const d = (detail as Record<string, unknown>) ?? {}
    const art = String(d.kissen_artikelnummer ?? '').trim()
    if (!art) {
      setKissenFarbOptionen([])
      return
    }
    let a = true
    void ladeKissenFarbzeilen(art).then(rows => {
      if (a) setKissenFarbOptionen(rows)
    })
    return () => {
      a = false
    }
  }, [typ, detail, teil.id])

  const speich = useCallback(
    async (nextTyp: string | null, d: StempelDetailJson) => {
      setDetail(d)
      detailR.current = d
      setTyp(nextTyp)
      await onDetailPatch({ typ: nextTyp, detail: d })
    },
    [onDetailPatch]
  )

  const patchL = useCallback((p: StempelDetailJson) => {
    setDetail(d0 => {
      const n = { ...d0, ...p }
      detailR.current = n
      return n
    })
  }, [])

  const commit = useCallback(() => {
    void speich(typR.current, { ...detailR.current })
  }, [speich])

  const speichDetail = useCallback(
    (d: StempelDetailJson) => {
      setDetail(d)
      detailR.current = d
      void speich(typR.current, d)
    },
    [speich]
  )

  const p: BlK = { d: detail, fe, pruef, f: fehler, patchL, commit, speichDetail }

  const typOptionen = [...STEMPEL_TYPEN, ...EXTRA_TYPEN] as readonly string[]

  const dRec = (detail as Record<string, unknown>) ?? {}
  const trodatKissenArt = String(dRec.kissen_artikelnummer ?? '').trim()
  const trodatKissenModellId = String(dRec.kissen_modell_id ?? '').trim()
  const trodatBadgeBestand =
    (trodatKissenModellId && kissenFarbOptionen.find(f => f.id === trodatKissenModellId)?.bestand) ?? null
  const trodatFarbeLabel =
    dRec.farbe && typeof dRec.farbe === 'string' && dRec.farbe in STEMPEL_FARBE_ANZEIGE
      ? STEMPEL_FARBE_ANZEIGE[dRec.farbe as keyof typeof STEMPEL_FARBE_ANZEIGE]
      : String(dRec.farbe ?? '—')

  return (
    <div className="ber-lfp">
      <h3 className="ber-h3">Stempel-Details</h3>
      {typ === 'SONSTIGE_STEMPEL' && (
        <p className="ber-hinweis">
          Bei &apos;Sonstige Stempel&apos; wird PREPRESS_BEREIT nur manuell gesetzt.
        </p>
      )}

      <BerZeile
        l="Typ"
        e={pruef && fehler.typ ? fehler.typ : undefined}
        c={
          <select
            className={'ber-inp' + fe('typ')}
            value={typ ?? ''}
            onChange={e => {
              const v = e.target.value
              if (v !== (typ ?? '')) {
                setTyp(v || null)
                setDetail({})
                detailR.current = {}
                typR.current = v || null
                void speich(v || null, {})
              } else {
                setTyp(v || null)
                typR.current = v || null
              }
            }}
          >
            <option value="">—</option>
            {typOptionen.map(x => (
              <option key={x} value={x}>
                {typLabel(x)}
              </option>
            ))}
          </select>
        }
      />

      {typ === 'TRODAT_KISSEN' && (
        <>
          <BerZeile
            l="Suche"
            e={
              pruef && (fehler.kissen_artikelnummer || fehler.kissen_modell_id)
                ? [fehler.kissen_artikelnummer, fehler.kissen_modell_id].filter(Boolean).join(' — ')
                : undefined
            }
            c={
              <div>
                <input
                  type="search"
                  className={'ber-inp' + fe('kissen_artikelnummer')}
                  placeholder="Modell oder Artikelnummer…"
                  value={kissenInput}
                  onChange={e => setKissenInput(e.target.value)}
                />
                {kissenSucheLaden && <p className="ber-hinweis" style={{ marginTop: 6 }}>Suchen…</p>}
                {kissenSucheFehler && <p className="ber-err" style={{ marginTop: 6 }}>{kissenSucheFehler}</p>}
                {!kissenSucheLaden && !kissenSucheFehler && kissenQDeb.trim() !== '' && kissenTreffer.length === 0 && (
                  <p className="ber-hinweis" style={{ marginTop: 6 }}>
                    Kein Treffer
                  </p>
                )}
                {!kissenSucheLaden && kissenTreffer.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                    {kissenTreffer.map(zeile => (
                      <button
                        key={zeile.artikelnummer || zeile.name}
                        type="button"
                        className="wa-btn wa-btn--ghost"
                        onClick={() => {
                          void ladeKissenFarbzeilen(zeile.artikelnummer).then(rows => {
                            setKissenFarbOptionen(rows)
                            speichDetail({
                              ...detailR.current,
                              kissen_artikelnummer: zeile.artikelnummer,
                              kissen_name: zeile.name,
                              farbe: null,
                              kissen_modell_id: null,
                            } as StempelDetailJson)
                          })
                        }}
                        style={{ textAlign: 'left', padding: '6px 8px' }}
                      >
                        <span style={{ fontWeight: 600, marginRight: 8 }}>{zeile.artikelnummer || '—'}</span>
                        {zeile.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            }
          />
          {!!trodatKissenArt && kissenFarbOptionen.length > 0 && (
            <BerZeile
              l="Farbe"
              e={pruef && (fehler.farbe || fehler.kissen_modell_id) ? [fehler.farbe, fehler.kissen_modell_id].filter(Boolean).join(' — ') : undefined}
              c={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexWrap: 'wrap' }}>
                  {kissenFarbOptionen.map(fv => {
                    const waehl = trodatKissenModellId && fv.id && trodatKissenModellId === fv.id
                    const b0 = fv.bestand <= 0
                    return (
                      <button
                        key={fv.farbe}
                        type="button"
                        className="wa-btn wa-btn--ghost"
                        disabled={!fv.id}
                        onClick={() => {
                          if (!fv.id) return
                          speichDetail({
                            ...detailR.current,
                            farbe: fv.farbe,
                            kissen_modell_id: fv.id,
                          } as StempelDetailJson)
                        }}
                        style={{
                          textAlign: 'left',
                          border: waehl ? '1px solid rgba(59, 130, 246, 0.45)' : undefined,
                          background: waehl ? 'rgba(59, 130, 246, 0.12)' : undefined,
                          color: b0 ? '#f59e0b' : undefined,
                          fontWeight: b0 || waehl ? 600 : undefined,
                        }}
                      >
                        {STEMPEL_FARBE_ANZEIGE[fv.farbe]} (Bestand: {fv.bestand})
                      </button>
                    )
                  })}
                </div>
              }
            />
          )}
          <NmbStueckzahl {...p} label="Stückzahl" />
          {trodatKissenModellId && (
            <BerZeile l="Gewählt" e={undefined}>
              <div
                className="wa-badge"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 8px',
                  borderRadius: 999,
                  border: '1px solid rgba(255,255,255,0.18)',
                  background: 'rgba(255,255,255,0.06)',
                  fontSize: 12,
                }}
              >
                {dRec.kissen_artikelnummer != null && String(dRec.kissen_artikelnummer) !== '' ? String(dRec.kissen_artikelnummer) : '—'} {String(dRec.kissen_name ?? '')} · {trodatFarbeLabel} ·
                Bestand: {trodatBadgeBestand == null ? '—' : trodatBadgeBestand}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setKissenFarbOptionen([])
                    setKissenInput('')
                    speichDetail({
                      ...detailR.current,
                      kissen_artikelnummer: null,
                      kissen_name: null,
                      kissen_modell_id: null,
                      farbe: null,
                    } as StempelDetailJson)
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setKissenFarbOptionen([])
                      setKissenInput('')
                      speichDetail({
                        ...detailR.current,
                        kissen_artikelnummer: null,
                        kissen_name: null,
                        kissen_modell_id: null,
                        farbe: null,
                      } as StempelDetailJson)
                    }
                  }}
                  style={{ cursor: 'pointer', padding: '0 6px', userSelect: 'none', fontWeight: 700 }}
                  title="Abwählen"
                >
                  ×
                </span>
              </div>
            </BerZeile>
          )}
        </>
      )}

      {showAnzahl && typ !== 'TRODAT_KISSEN' && (
        <NmbStueckzahl {...p} label={typ === 'NACHFUELLFARBE' || typ === 'STEMPELKISSEN' ? 'Anzahl' : 'Stückzahl'} />
      )}

      {typ === 'STEMPELKISSEN' && (
        <BerZeile l="Größe" e={pruef && fehler.groesse ? fehler.groesse : undefined}>
          <select
            className={'ber-inp' + fe('groesse')}
            value={String((detail as Record<string, string>).groesse ?? '')}
            onChange={e =>
              speichDetail({ ...detail, groesse: e.target.value || null } as StempelDetailJson)
            }
          >
            <option value="">—</option>
            {STEMPELKISSEN_GROESSE.map(g => (
              <option key={g} value={g}>
                {STEMPELKISSEN_GROESSE_ANZEIGE[g]}
              </option>
            ))}
          </select>
        </BerZeile>
      )}

      {(showFarbe || typ === 'NACHFUELLFARBE' || typ === 'STEMPELKISSEN') &&
        typ !== 'STEMPELPLATTE' &&
        typ !== 'TRODAT_KISSEN' && (
        <BerZeile
          l="Farbe"
          e={
            (pruef && fehler.farbe) || (pruef && fehler.farbe_sonstige)
              ? [fehler.farbe, fehler.farbe_sonstige].filter(Boolean).join(' — ')
              : undefined
          }
          c={
            <div>
              <select
                className={'ber-inp' + fe('farbe')}
                value={String((detail as Record<string, string>).farbe ?? '')}
                onChange={e => {
                  const v = e.target.value
                  const next: StempelDetailJson = { ...detail, farbe: v || null }
                  if (v !== 'SONSTIGE') next.farbe_sonstige = null
                  speichDetail(next)
                }}
              >
                <option value="">—</option>
                {(typ === 'NACHFUELLFARBE' || typ === 'STEMPELKISSEN' ? NACHFUELLFARBE_FARBEN : STEMPEL_FARBE).map(
                  fv => (
                    <option key={fv} value={fv}>
                      {STEMPEL_FARBE_ANZEIGE[fv as (typeof STEMPEL_FARBE)[number]]}
                    </option>
                  )
                )}
              </select>
              {String((detail as Record<string, string>).farbe ?? '') === 'SONSTIGE' && typ !== 'NACHFUELLFARBE' && (
                <div style={{ marginTop: 8 }}>
                  <input
                    type="text"
                    className={'ber-inp' + fe('farbe_sonstige')}
                    placeholder="Farbe (Freitext)"
                    value={String((detail as Record<string, string>).farbe_sonstige ?? '')}
                    onChange={e => patchL({ farbe_sonstige: e.target.value || null } as StempelDetailJson)}
                    onBlur={commit}
                  />
                </div>
              )}
            </div>
          }
        />
      )}

      {typ === 'NACHFUELLFARBE' && (
        <BerZeile l="Typ" e={pruef && fehler.tinte_typ ? fehler.tinte_typ : undefined}>
          <select
            className={'ber-inp' + fe('tinte_typ')}
            value={String((detail as Record<string, string>).tinte_typ ?? '')}
            onChange={e =>
              speichDetail({ ...detail, tinte_typ: e.target.value || null } as StempelDetailJson)
            }
          >
            <option value="">—</option>
            {NACHFUELLFARBE_TINTE_TYP.map(tt => (
              <option key={tt} value={tt}>
                {NACHFUELLFARBE_TINTE_TYP_ANZEIGE[tt]}
              </option>
            ))}
          </select>
        </BerZeile>
      )}

      {showMass && (
        <BerZeile
          l="Format (mm)"
          e={
            pruef && (fehler.format || fehler.format_breite || fehler.format_hoehe)
              ? [fehler.format, fehler.format_breite, fehler.format_hoehe].filter(Boolean).join(' — ')
              : undefined
          }
          c={
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 140px', minWidth: 140 }}>
                <input
                  type="number"
                  className={'ber-inp' + fe('format_breite')}
                  placeholder="Breite"
                  value={bVal ?? ''}
                  onChange={e => {
                    const raw = e.target.value
                    patchL({ format_breite: raw === '' ? null : parseInt(raw, 10) } as StempelDetailJson)
                  }}
                  onBlur={commit}
                  min={1}
                />
              </div>
              <div style={{ flex: '1 1 140px', minWidth: 140 }}>
                <input
                  type="number"
                  className={'ber-inp' + fe('format_hoehe')}
                  placeholder="Höhe"
                  value={hVal ?? ''}
                  onChange={e => {
                    const raw = e.target.value
                    patchL({ format_hoehe: raw === '' ? null : parseInt(raw, 10) } as StempelDetailJson)
                  }}
                  onBlur={commit}
                  min={1}
                />
              </div>
            </div>
          }
        />
      )}

      {(typ === 'TRODAT_PRINTY' || typ === 'HOLZSTEMPEL') && showMass && hatMass && (
        <BerZeile l="Modellvorschlag">
          <div>
            {gewaehltesModellId && (
              <div style={{ marginBottom: 8 }}>
                <div
                  className="wa-badge"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 8px',
                    borderRadius: 999,
                    border: '1px solid rgba(255,255,255,0.18)',
                    background: 'rgba(255,255,255,0.06)',
                    fontSize: 12,
                  }}
                >
                  Gewählt: {gewaehltesModellName || modellName || 'Modell'}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setGewaehltesModellId(null)
                      setGewaehltesModellName(null)
                      speichDetail({ ...detailR.current, modell_id: null, modell_name: null })
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setGewaehltesModellId(null)
                        setGewaehltesModellName(null)
                        speichDetail({ ...detailR.current, modell_id: null, modell_name: null })
                      }
                    }}
                    style={{ cursor: 'pointer', padding: '0 6px', userSelect: 'none', fontWeight: 700 }}
                    title="Modell abwählen"
                  >
                    ×
                  </span>
                </div>
                {ersatzKissen && ersatzKissen.length > 0 && (
                  <div style={{ margin: '6px 0 0 0', fontSize: 12, opacity: 0.92 }}>
                    {ersatzKissen.map(z => (
                      <div
                        key={z.farbe}
                        style={{
                          color: z.bestand <= 0 ? '#f59e0b' : undefined,
                          fontWeight: z.bestand <= 0 ? 600 : undefined,
                        }}
                      >
                        {z.label}: Bestand {z.bestand}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {modelleLaden && <p className="ber-hinweis">Suche passende Modelle…</p>}
            {!modelleLaden && modelleFehler && <p className="ber-err">{modelleFehler}</p>}

            {!modelleLaden && !modelleFehler && modelle.length === 0 && (
              <p className="ber-hinweis">
                Kein passendes Modell gefunden — bitte Maße prüfen oder manuell erfassen
              </p>
            )}

            {!gewaehltesModellId && !modelleLaden && !modelleFehler && modelle.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {modelle.map(m => {
                  const keinBestand = (m.bestand ?? 0) <= 0
                  const isSel = m.id === gewaehltesModellId
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className="wa-btn wa-btn--ghost"
                      onClick={() => {
                        if (isSel) {
                          setGewaehltesModellId(null)
                          setGewaehltesModellName(null)
                          speichDetail({ ...detailR.current, modell_id: null, modell_name: null })
                          return
                        }
                        setGewaehltesModellId(m.id)
                        setGewaehltesModellName(m.name)
                        speichDetail({ ...detailR.current, modell_id: m.id, modell_name: m.name })
                      }}
                      style={{
                        textAlign: 'left',
                        display: 'flex',
                        gap: 10,
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        cursor: 'pointer',
                        background: isSel ? 'rgba(59, 130, 246, 0.18)' : undefined,
                        border: isSel ? '1px solid rgba(59, 130, 246, 0.45)' : undefined,
                      }}
                    >
                      <span style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        {isSel && <span title="Gewählt">✓</span>}
                        {m.name}
                      </span>
                      <span style={{ opacity: 0.8 }}>{m.druckflaeche ?? ''}</span>
                      <span style={{ opacity: 0.9, whiteSpace: 'nowrap' }}>
                        Bestand: {m.bestand ?? 0}
                        {keinBestand && (
                          <span style={{ marginLeft: 8, color: '#f59e0b', fontWeight: 600 }}>Kein Bestand vorhanden</span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </BerZeile>
      )}

      {showBeschreibung && (
        <BerZeile
          l="Beschreibung / Inhalt"
          e={pruef && fehler.beschreibung ? fehler.beschreibung : undefined}
          c={
            <div>
              <textarea
                className={'ber-inp' + fe('beschreibung')}
                rows={6}
                value={String((detail as Record<string, string>).beschreibung ?? '')}
                onChange={e => patchL({ beschreibung: e.target.value || null } as StempelDetailJson)}
                onBlur={commit}
              />
              <p className="ber-hinweis" style={{ marginTop: 6, marginBottom: 0 }}>
                Änderungen nach Produktionsfreigabe setzen den Status zurück (Beschreibung, Breite/Höhe)
              </p>
            </div>
          }
        />
      )}

      {(typ === 'NACHFUELLFARBE' || typ === 'STEMPELKISSEN') && (
        <BerZeile l="Hinweis" e={undefined}>
          <textarea
            className="ber-inp"
            rows={2}
            placeholder="Besonderheiten, Hinweise..."
            value={String((detail as Record<string, string>).hinweis ?? '')}
            onChange={e => patchL({ hinweis: e.target.value || null } as StempelDetailJson)}
            onBlur={commit}
          />
        </BerZeile>
      )}
    </div>
  )
}

function BerZeile({ l, c, e, children }: { l: string; c?: React.ReactNode; e?: string; children?: React.ReactNode }) {
  const inhalt = c ?? children
  return (
    <div className="ber-zeile">
      <span className="ber-lbl">{l}</span>
      <div>
        {inhalt}
        {e && <p className="ber-err">{e}</p>}
      </div>
    </div>
  )
}

function NmbStueckzahl(a: BlK & { label: string }) {
  const { d, fe, f, pruef, patchL, commit, label } = a
  const raw = d.stueckzahl
  let numForInput: number | '' = ''
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 1) numForInput = raw
  else if (typeof raw === 'string' && raw.trim() !== '') {
    const n = parseInt(raw, 10)
    if (Number.isInteger(n) && n >= 1) numForInput = n
  }
  return (
    <BerZeile l={label} e={pruef && f.stueckzahl ? f.stueckzahl : undefined}>
      <input
        type="number"
        className={'ber-inp' + fe('stueckzahl')}
        value={numForInput}
        onChange={e => {
          const raw = e.target.value
          patchL({ stueckzahl: raw === '' ? null : parseInt(raw, 10) } as StempelDetailJson)
        }}
        onBlur={commit}
        min={1}
      />
    </BerZeile>
  )
}
