import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { LFP_TEILTYP_ANZEIGE, LFP_TEILTYPEN, type LfpDetailJson } from '../../types/lfp'
import { validateLfpDetail } from '../../lib/lfp/validateLfpDetail'
import type { AuftragStatus, TeilauftragRow } from '../../types/database'
import '../WorkArea.css'

type Props = {
  teil: TeilauftragRow
  teilStatus: AuftragStatus
  onDetailPatch: (patch: { typ?: string | null; detail: LfpDetailJson | null }) => Promise<void>
}

function lfpRoh(teil: TeilauftragRow): LfpDetailJson {
  const d = teil.detail
  return d && typeof d === 'object' && !Array.isArray(d) ? { ...d } : {}
}

type BlK = {
  d: LfpDetailJson
  fe: (k: string) => string
  pruef: boolean
  f: Record<string, string>
  patchL: (p: LfpDetailJson) => void
  commit: () => void
  /** Komplettes detail in State schreiben und sofort persistieren (z. B. Bauzaunbanner-Defaults) */
  speichDetail: (d: LfpDetailJson) => void
}

export function LFPDetail({ teil, teilStatus, onDetailPatch }: Props) {
  const [typ, setTyp] = useState<string | null>(teil.typ)
  const [detail, setDetail] = useState<LfpDetailJson>(lfpRoh(teil))
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
    setDetail(lfpRoh(teil))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teil.id, teil.typ, teil.detail])

  const lfpFehler = validateLfpDetail(typ, detail, teilStatus)
  const pruef = teilStatus !== 'ANGEBOT'
  const fe = (k: string) => (pruef && lfpFehler[k] ? ' ber-inp--err' : '')

  const speich = useCallback(
    async (nextTyp: string | null, d: LfpDetailJson) => {
      setDetail(d)
      detailR.current = d
      setTyp(nextTyp)
      await onDetailPatch({ typ: nextTyp, detail: d })
    },
    [onDetailPatch]
  )

  const patchL = useCallback((p: LfpDetailJson) => {
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
    (d: LfpDetailJson) => {
      setDetail(d)
      detailR.current = d
      void speich(typR.current, d)
    },
    [speich]
  )

  const p: BlK = { d: detail, fe, pruef, f: lfpFehler, patchL, commit, speichDetail }

  return (
    <div className="ber-lfp td-bereich-sect">
      <div className="td-bereich-hd" aria-hidden>
        LFP
      </div>
      {typ === 'SONSTIGE_LFP' && (
        <p className="ber-hinweis">Bei „Sonstige LFP“ wird PREPRESS_BEREIT nur manuell gesetzt, nicht automatisch.</p>
      )}
      {typ === 'SCHILD_FOLIE' && detail.material === 'ACRYLGLAS' && (
        <p className="ber-hinweis">Bei Acrylglas: Rückseitenverklebung inkl., kein Zusatzfeld nötig.</p>
      )}

      <div className="ber-grid-2" style={{ marginTop: 4 }}>
        <BerZeile
          stack
          l="Typ"
          e={pruef && lfpFehler.typ ? lfpFehler.typ : undefined}
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
              {LFP_TEILTYPEN.map(x => (
                <option key={x} value={x}>
                  {LFP_TEILTYP_ANZEIGE[x]}
                </option>
              ))}
            </select>
          }
        />
        <NmbStueckzahl {...p} stack />
      </div>

      {typ === 'AUFKLEBER' && <Aufkleber {...p} />}
      {typ === 'SCHILD_UV' && <SchildUv {...p} />}
      {typ === 'SCHILD_FOLIE' && <SchildFolie {...p} />}
      {typ === 'FOLIENPLOTT' && <Folienplott {...p} />}
      {typ === 'BANNER' && <BannerF {...p} />}
      {typ === 'ROLLUP' && <RollupF {...p} />}
      {typ === 'FAHRZEUGBESCHRIFTUNG' && <FzB {...p} />}
      {typ === 'SONSTIGE_LFP' && <Sons {...p} />}
    </div>
  )
}

function BerZeile({
  l,
  c,
  e,
  children,
  stack,
}: {
  l: string
  c?: ReactNode
  e?: string
  children?: ReactNode
  stack?: boolean
}) {
  const inhalt = c ?? children
  return (
    <div className={stack ? 'ber-zeile-stack' : 'ber-zeile'}>
      <span className="ber-lbl">{l}</span>
      <div>
        {inhalt}
        {e && <p className="ber-err">{e}</p>}
      </div>
    </div>
  )
}

function NmbStueckzahl(a: BlK & { stack?: boolean }) {
  const { d, fe, f, pruef, patchL, commit, stack } = a
  const val = d.stueckzahl
  const s = val === null || val === undefined ? '' : String(val)
  return (
    <BerZeile stack={stack} l="Stückzahl" e={pruef && f.stueckzahl ? f.stueckzahl : undefined}>
      <input
        type="number"
        className={'ber-inp' + fe('stueckzahl')}
        min={1}
        step={1}
        value={s}
        onChange={e => {
          const raw = e.target.value
          patchL({
            stueckzahl: raw === '' ? null : parseInt(raw, 10),
          } as LfpDetailJson)
        }}
        onBlur={commit}
      />
    </BerZeile>
  )
}

function SelB(
  a: BlK & { k: string; l?: string; o: { v: string; t: string }[]; stack?: boolean },
) {
  const { k, o, d, fe, f, pruef, patchL, commit, l: lb, stack } = a
  return (
    <BerZeile stack={stack} l={lb ?? k} e={pruef ? f[k] : undefined}>
      <select
        className={'ber-inp' + fe(k)}
        value={String((d as Record<string, string>)[k] ?? '')}
        onChange={e => patchL({ [k]: e.target.value })}
        onBlur={commit}
      >
        <option value="">—</option>
        {o.map(x => (
          <option key={x.v} value={x.v}>
            {x.t}
          </option>
        ))}
      </select>
    </BerZeile>
  )
}

function boolSel(a: BlK & { k: string; l?: string }) {
  const { k, d, fe, f, pruef, patchL, commit, l: lb } = a
  const v = (d as Record<string, unknown>)[k]
  const s = v === true ? 'true' : v === false ? 'false' : ''
  return (
    <BerZeile l={lb ?? k} e={pruef ? f[k] : undefined}>
      <select
        className={'ber-inp' + fe(k)}
        value={s}
        onChange={e => {
          const t = e.target.value
          const b: true | false | undefined = t === 'true' ? true : t === 'false' ? false : undefined
          patchL({ [k]: b } as LfpDetailJson)
        }}
        onBlur={commit}
      >
        <option value="">—</option>
        <option value="true">Ja</option>
        <option value="false">Nein</option>
      </select>
    </BerZeile>
  )
}

function Txt(
  a: BlK & { k: string; l: string; rows?: number },
) {
  const { k, l, d, fe, f, pruef, patchL, commit, rows = 1 } = a
  const val = String((d as Record<string, string>)[k] ?? '')
  return (
    <BerZeile l={l} e={pruef ? f[k] : undefined}>
      {rows > 1 ? (
        <textarea
          className={'ber-inp ber-ta' + fe(k)}
          rows={rows}
          value={val}
          onChange={e => patchL({ [k]: e.target.value })}
          onBlur={commit}
        />
      ) : (
        <input
          type="text"
          className={'ber-inp' + fe(k)}
          value={val}
          onChange={e => patchL({ [k]: e.target.value })}
          onBlur={commit}
        />
      )}
    </BerZeile>
  )
}

function NmbInt(
  a: BlK & { k: string; l: string; suffix?: string; feKey?: string; min?: number },
) {
  const { k, l, d, fe, f, pruef, patchL, commit, suffix, feKey, min = 1 } = a
  const feK = feKey ?? k
  const val = (d as Record<string, number | null | string>)[k]
  const s = val === null || val === undefined ? '' : String(val)
  return (
    <BerZeile l={l} e={pruef ? f[feK] : undefined}>
      <div className="ber-nmb">
        <input
          type="number"
          className={'ber-inp' + fe(feK)}
          min={min}
          step={1}
          value={s}
          onChange={e => {
            const raw = e.target.value
            const n = raw === '' ? null : parseInt(raw, 10)
            patchL({ [k]: Number.isNaN(n as number) ? null : n } as LfpDetailJson)
          }}
          onBlur={commit}
        />
        {suffix && <span className="ber-suf">{suffix}</span>}
      </div>
    </BerZeile>
  )
}

/** Breite/Höhe: mindestens eines &gt; 0 – gemeinsame Fehlermeldung format_masse */
function MasseHoeheBreite(p: BlK) {
  const { d, fe, f, pruef, patchL, commit } = p
  const msg = pruef ? f.format_masse : undefined
  const b = d.format_breite
  const h = d.format_hoehe
  const sb = b === null || b === undefined ? '' : String(b)
  const sh = h === null || h === undefined ? '' : String(h)
  return (
    <div>
      <div className="ber-grid-2">
        <div className="ber-zeile-stack">
          <span className="ber-lbl">Format Breite (mm)</span>
          <div>
            <input
              type="number"
              className={'ber-inp' + fe('format_masse')}
              min={0.01}
              step={0.01}
              value={sb}
              onChange={e => {
                const raw = e.target.value
                patchL({
                  format_breite: raw === '' ? null : parseFloat(raw),
                } as LfpDetailJson)
              }}
              onBlur={commit}
            />
          </div>
        </div>
        <div className="ber-zeile-stack">
          <span className="ber-lbl">Format Höhe (mm)</span>
          <div>
            <input
              type="number"
              className={'ber-inp' + fe('format_masse')}
              min={0.01}
              step={0.01}
              value={sh}
              onChange={e => {
                const raw = e.target.value
                patchL({
                  format_hoehe: raw === '' ? null : parseFloat(raw),
                } as LfpDetailJson)
              }}
              onBlur={commit}
            />
          </div>
        </div>
      </div>
      {msg && <p className="ber-err ber-err--mass">{msg}</p>}
    </div>
  )
}

function Dat(a: BlK & { k: string; l: string }) {
  const { k, l, d, fe, f, pruef, patchL, commit } = a
  const v = (d as Record<string, string>)[k] ?? ''
  const iso = v ? (v.length > 10 ? v.slice(0, 10) : v) : ''
  return (
    <BerZeile l={l} e={pruef ? f[k] : undefined}>
      <input
        type="date"
        className={'ber-inp' + fe(k)}
        value={iso}
        onChange={e => patchL({ [k]: e.target.value })}
        onBlur={commit}
      />
    </BerZeile>
  )
}

function BesonderheitenUnten(p: BlK) {
  return <Txt {...p} k="besonderheiten" l="Besonderheiten" rows={3} />
}

function Aufkleber(p: BlK) {
  const { d, fe, f, pruef, patchL, commit } = p
  return (
    <>
      <div className="ber-grid-2">
        <BerZeile stack l="Material" e={pruef ? f.material : undefined}>
          <select
            className={'ber-inp' + fe('material')}
            value={String((d as Record<string, string>).material ?? '')}
            onChange={e => {
              const v = e.target.value
              const patch: LfpDetailJson = { material: v }
              if (v !== '3551') patch.material_3551_variante = null
              patchL(patch)
            }}
            onBlur={commit}
          >
            <option value="">—</option>
            {['3551', 'ULTRATACK', 'MONSTERTACK', '3162'].map(x => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </BerZeile>
        <SelB
          {...p}
          stack
          k="konturschnitt"
          l="Konturschnitt"
          o={[
            { v: 'FREIFORM', t: 'Freiform' },
            { v: 'RECHTECK', t: 'Rechteck' },
          ]}
        />
      </div>
      {p.d.material === '3551' && (
        <div className="ber-col-voll" style={{ marginBottom: 6 }}>
          <BerZeile stack l="3551 Variante">
            <select
              className="ber-inp"
              value={String((d as Record<string, string | null>).material_3551_variante ?? '')}
              onChange={e =>
                patchL({ material_3551_variante: e.target.value || null } as LfpDetailJson)
              }
              onBlur={commit}
            >
              <option value="">— (keine)</option>
              <option value="RA">RA</option>
              <option value="T">T</option>
            </select>
          </BerZeile>
        </div>
      )}
      <div className="ber-grid-2">
        <SelB
          {...p}
          stack
          k="laminat"
          l="Laminat"
          o={[
            { v: 'NEIN', t: 'Nein' },
            { v: 'MATT', t: 'Matt' },
            { v: 'GLAENZEND', t: 'Glänzend' },
          ]}
        />
        <SelB
          {...p}
          stack
          k="ausgabe"
          l="Ausgabe"
          o={[
            { v: 'EINZEL', t: 'Einzel' },
            { v: 'BOGEN', t: 'Bogen' },
          ]}
        />
      </div>
      <MasseHoeheBreite {...p} />
      <BesonderheitenUnten {...p} />
    </>
  )
}

function SchildUv(p: BlK) {
  return (
    <>
      <div className="ber-grid-2">
        <SelB
          {...p}
          stack
          k="material"
          l="Material"
          o={[
            { v: 'ALUVERBUND', t: 'Alu-Verbund' },
            { v: 'PVC', t: 'PVC' },
            { v: 'ACRYLGLAS', t: 'Acrylglas' },
          ]}
        />
        <SelB
          {...p}
          stack
          k="druckseite"
          l="Druckseite"
          o={[
            { v: 'EINSEITIG', t: 'Einseitig' },
            { v: 'BEIDSEITIG', t: 'Beidseitig' },
          ]}
        />
      </div>
      {p.d.material === 'ACRYLGLAS' && (
        <SelB
          {...p}
          k="acryl_druckrichtung"
          l="Acryl Druckrichtung"
          o={[
            { v: 'VORDERSEITE', t: 'Vorderseite' },
            { v: 'RUECKSEITE', t: 'Rückseite' },
          ]}
        />
      )}
      <MasseHoeheBreite {...p} />
      {boolSel({ ...p, k: 'ecken_runden', l: 'Ecken runden' })}
      {boolSel({ ...p, k: 'bohrungen', l: 'Bohrungen' })}
      {p.d.bohrungen === true && (
        <>
          <NmbInt {...p} k="bohrungen_durchmesser" l="Bohrungen Ø (mm)" feKey="bohrungen_durchmesser" min={1} />
          <Txt {...p} k="bohrungen_position" l="Bohrungen Position" />
        </>
      )}
      <BesonderheitenUnten {...p} />
    </>
  )
}

function SchildFolie(p: BlK) {
  return (
    <>
      <div className="ber-grid-2">
        <SelB
          {...p}
          stack
          k="material"
          l="Material"
          o={[
            { v: 'ALUVERBUND', t: 'Alu-Verbund' },
            { v: 'PVC', t: 'PVC' },
            { v: 'ACRYLGLAS', t: 'Acrylglas' },
          ]}
        />
        <SelB
          {...p}
          stack
          k="druckseite"
          l="Druckseite"
          o={[
            { v: 'EINSEITIG', t: 'Einseitig' },
            { v: 'BEIDSEITIG', t: 'Beidseitig' },
          ]}
        />
      </div>
      <div style={{ maxWidth: '20rem' }}>
        <SelB
          {...p}
          stack
          k="laminat"
          l="Laminat"
          o={[
            { v: 'NEIN', t: 'Nein' },
            { v: 'MATT', t: 'Matt' },
            { v: 'GLAENZEND', t: 'Glänzend' },
          ]}
        />
      </div>
      <MasseHoeheBreite {...p} />
      {boolSel({ ...p, k: 'ecken_runden', l: 'Ecken runden' })}
      {boolSel({ ...p, k: 'bohrungen', l: 'Bohrungen' })}
      {p.d.bohrungen === true && (
        <>
          <NmbInt {...p} k="bohrungen_durchmesser" l="Bohrungen Ø (mm)" feKey="bohrungen_durchmesser" min={1} />
          <Txt {...p} k="bohrungen_position" l="Bohrungen Position" />
        </>
      )}
      <BesonderheitenUnten {...p} />
    </>
  )
}

function Folienplott(p: BlK) {
  return (
    <>
      <div className="ber-grid-2">
        <SelB
          {...p}
          stack
          k="material"
          l="Material"
          o={['751C', '631', '8510'].map(x => ({ v: x, t: x }))}
        />
        <SelB
          {...p}
          stack
          k="ausgabe"
          l="Ausgabe"
          o={[
            { v: 'EINZEL', t: 'Einzel' },
            { v: 'BOGEN', t: 'Bogen' },
          ]}
        />
      </div>
      <BesonderheitenUnten {...p} />
    </>
  )
}

function BannerF(p: BlK) {
  const { d, fe, f, pruef, patchL, commit, speichDetail } = p
  return (
    <>
      <BerZeile l="Material" e={pruef ? f.material : undefined}>
        <select
          className={'ber-inp' + fe('material')}
          value={String(d.material ?? '')}
          onChange={e => {
            const v = e.target.value
            if (v === 'BAUZAUNBANNER') {
              speichDetail({
                ...d,
                material: 'BAUZAUNBANNER',
                format_hoehe: 1730,
                format_breite: 3400,
                saum: true,
                oesen: true,
              })
            } else {
              patchL({ material: v })
            }
          }}
          onBlur={e => {
            if (e.target.value === 'BAUZAUNBANNER') return
            commit()
          }}
        >
          <option value="">—</option>
          {['PVC_FRONTLIT', 'MESH', 'BAUZAUNBANNER'].map(m => {
            const t =
              m === 'PVC_FRONTLIT' ? 'PVC Frontlit' : m === 'MESH' ? 'Mesh' : 'Bauzaunbanner'
            return (
              <option key={m} value={m}>
                {t}
              </option>
            )
          })}
        </select>
      </BerZeile>
      <MasseHoeheBreite {...p} />
      {boolSel({ ...p, k: 'saum', l: 'Saum' })}
      {p.d.saum === true && <Txt {...p} k="saum_seiten" l="Saum (Seiten)" />}
      {boolSel({ ...p, k: 'oesen', l: 'Ösen' })}
      {p.d.oesen === true && <Txt {...p} k="oesen_detail" l="Ösen Detail" />}
      <BesonderheitenUnten {...p} />
    </>
  )
}

function RollupF(p: BlK) {
  const br = (p.d as Record<string, number>).breite
  return (
    <>
      <SelB
        {...p}
        k="material"
        l="Material"
        o={[
          { v: 'PVC_FRONTLIT', t: 'PVC Frontlit' },
          { v: 'ROLLUP_FILM', t: 'Rollup-Film' },
        ]}
      />
      <SelB
        {...p}
        k="system"
        l="System"
        o={[
          { v: 'NEUE_KASSETTE', t: 'Neue Kassette' },
          { v: 'MOTIVTAUSCH', t: 'Motivtausch' },
        ]}
      />
      <BerZeile l="Breite" e={p.pruef ? p.f.breite : undefined}>
        <select
          className={'ber-inp' + p.fe('breite')}
          value={br === 85 || br === 100 ? String(br) : ''}
          onChange={e => {
            const n = e.target.value === '' ? null : parseInt(e.target.value, 10)
            p.patchL({ breite: n } as LfpDetailJson)
          }}
          onBlur={p.commit}
        >
          <option value="">—</option>
          <option value="85">85 cm</option>
          <option value="100">100 cm</option>
        </select>
      </BerZeile>
      <BesonderheitenUnten {...p} />
    </>
  )
}

function FzB(p: BlK) {
  const { d, fe, f, pruef, patchL, commit } = p
  return (
    <>
      <Txt {...p} k="marke" l="Marke" />
      <Txt {...p} k="modell" l="Modell" />
      {boolSel({ ...p, k: 'bereiche_seiten', l: 'Bereich Seiten' })}
      {boolSel({ ...p, k: 'bereiche_front', l: 'Bereich Front' })}
      {boolSel({ ...p, k: 'bereiche_heck', l: 'Bereich Heck' })}
      <BerZeile l="Montage" e={pruef ? f.montage : undefined}>
        <select
          className={'ber-inp' + fe('montage')}
          value={String((d as Record<string, string>).montage ?? '')}
          onChange={e => {
            const v = e.target.value
            if (v === 'OHNE') {
              patchL({ montage: 'OHNE', montagetermin: null, altbeklebung: null } as LfpDetailJson)
            } else {
              patchL({ montage: v } as LfpDetailJson)
            }
          }}
          onBlur={commit}
        >
          <option value="">—</option>
          <option value="MIT">Mit</option>
          <option value="OHNE">Ohne</option>
        </select>
      </BerZeile>
      {d.montage === 'MIT' && boolSel({ ...p, k: 'altbeklebung', l: 'Altbeklebung' })}
      {d.montage === 'MIT' && <Dat {...p} k="montagetermin" l="Montagetermin" />}
      <Txt {...p} k="besonderheiten" l="Besonderheiten" rows={3} />
    </>
  )
}

function Sons(p: BlK) {
  return <Txt {...p} k="beschreibung" l="Beschreibung" rows={6} />
}
