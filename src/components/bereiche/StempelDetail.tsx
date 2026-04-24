import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

const EXTRA_TYPEN = ['NACHFUELLFARBE', 'STEMPELKISSEN', 'STEMPELPLATTE'] as const
const EXTRA_TYP_ANZEIGE: Record<(typeof EXTRA_TYPEN)[number], string> = {
  NACHFUELLFARBE: 'Nachfüllfarbe',
  STEMPELKISSEN: 'Stempelkissen',
  STEMPELPLATTE: 'Stempelplatte',
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

  const showMass = typ !== 'NACHFUELLFARBE' && typ !== 'STEMPELKISSEN'
  const showBeschreibung =
    typ !== 'NACHFUELLFARBE' && typ !== 'STEMPELKISSEN' && typ !== 'STEMPELPLATTE' && !!typ
  const showFarbe = showBeschreibung // alle "klassischen" Typen
  const showAnzahl = !!typ

  const [modelle, setModelle] = useState<StempelModell[]>([])
  const [modelleLaden, setModelleLaden] = useState(false)
  const [modelleFehler, setModelleFehler] = useState<string | null>(null)

  const modellId = String((detail as Record<string, unknown>).modell_id ?? '')
  const modellName = String((detail as Record<string, unknown>).modell_name ?? '')
  const modellGewaehlt = (modellId && modellId !== 'null') || (modellName && modellName !== 'null')

  const sortierteModelle = useMemo(() => {
    const b = bVal
    const h = hVal
    const hasB = b != null && b > 0
    const hasH = h != null && h > 0
    const withScore = modelle.map(m => {
      const mw = m.max_breite_mm ?? 0
      const mh = m.max_hoehe_mm ?? 0
      const exact = hasB && hasH && mw === b && mh === h
      const dist = (hasB ? Math.abs(mw - (b as number)) : 0) + (hasH ? Math.abs(mh - (h as number)) : 0)
      return { m, exact, dist }
    })
    withScore.sort((a, b) => {
      if (a.exact !== b.exact) return a.exact ? -1 : 1
      if (a.dist !== b.dist) return a.dist - b.dist
      return a.m.name.localeCompare(b.m.name)
    })
    return withScore.map(x => x.m)
  }, [modelle, bVal, hVal])

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
      .select('id, name, max_breite_mm, max_hoehe_mm, druckflaeche, bestand')
      .eq('typ', t as string)
      .eq('aktiv', true)

    let q = q0 as any
    if (b != null) q = q.gte('max_breite_mm', b)
    if (h != null) q = q.gte('max_hoehe_mm', h)

    void (async () => {
      try {
        const { data, error } = await q
          .order('max_breite_mm', { ascending: true })
          .order('max_hoehe_mm', { ascending: true })
        if (!alive) return
        if (error) {
          setModelle([])
          setModelleFehler(error.message)
        } else {
          setModelle((data ?? []) as StempelModell[])
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

      {showAnzahl && <NmbStueckzahl {...p} label={typ === 'NACHFUELLFARBE' || typ === 'STEMPELKISSEN' ? 'Anzahl' : 'Stückzahl'} />}

      {typ === 'STEMPELKISSEN' && (
        <BerZeile l="Größe" e={pruef && fehler.groesse ? fehler.groesse : undefined}>
          <select
            className={'ber-inp' + fe('groesse')}
            value={String((detail as Record<string, string>).groesse ?? '')}
            onChange={e => patchL({ groesse: e.target.value || null } as StempelDetailJson)}
            onBlur={commit}
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

      {(showFarbe || typ === 'NACHFUELLFARBE' || typ === 'STEMPELKISSEN') && typ !== 'STEMPELPLATTE' && (
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
                  const next: StempelDetailJson = { ...detailR.current, farbe: v || null }
                  if (v !== 'SONSTIGE') next.farbe_sonstige = null
                  patchL(next)
                }}
                onBlur={commit}
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
            onChange={e => patchL({ tinte_typ: e.target.value || null } as StempelDetailJson)}
            onBlur={commit}
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
            {modellGewaehlt && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <span
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
                  Gewählt: {modellName || 'Modell'}
                  <button
                    type="button"
                    className="wa-btn wa-btn--sm"
                    onClick={() => {
                      patchL({ modell_id: null, modell_name: null } as StempelDetailJson)
                      commit()
                    }}
                    style={{ padding: '0 6px' }}
                    title="Modell abwählen"
                  >
                    ×
                  </button>
                </span>
              </div>
            )}

            {modelleLaden && <p className="ber-hinweis">Suche passende Modelle…</p>}
            {!modelleLaden && modelleFehler && <p className="ber-err">{modelleFehler}</p>}

            {!modelleLaden && !modelleFehler && modelle.length === 0 && (
              <p className="ber-hinweis">
                Kein passendes Modell gefunden — bitte Maße prüfen oder manuell erfassen
              </p>
            )}

            {!modelleLaden && !modelleFehler && modelle.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {sortierteModelle.map(m => {
                  const keinBestand = (m.bestand ?? 0) <= 0
                  const isSel = modellId && modellId !== 'null' ? m.id === modellId : modellName ? m.name === modellName : false
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className="wa-btn wa-btn--ghost"
                      onClick={() => {
                        patchL({ modell_id: m.id, modell_name: m.name } as StempelDetailJson)
                        commit()
                      }}
                      style={{
                        textAlign: 'left',
                        display: 'flex',
                        gap: 10,
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
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
