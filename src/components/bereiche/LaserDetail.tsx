import { useCallback, useEffect, useRef, useState } from 'react'
import {
  LASER_HERKUNFT,
  LASER_HERKUNFT_ANZEIGE,
  LASER_MAT_SCHILD,
  LASER_MAT_SCHILD_ANZEIGE,
  LASER_TYPEN,
  LASER_TYP_ANZEIGE,
  type LaserDetailJson,
} from '../../types/laser'
import { validateLaserDetail } from '../../lib/laser/validateLaserDetail'
import type { AuftragStatus, TeilauftragRow } from '../../types/database'
import '../WorkArea.css'

type Props = {
  teil: TeilauftragRow
  teilStatus: AuftragStatus
  onDetailPatch: (patch: { typ?: string | null; detail: LaserDetailJson | null }) => Promise<void>
}

function laserRoh(teil: TeilauftragRow): LaserDetailJson {
  const d = teil.detail
  return d && typeof d === 'object' && !Array.isArray(d) ? { ...d } : {}
}

type BlK = {
  d: LaserDetailJson
  fe: (k: string) => string
  pruef: boolean
  f: Record<string, string>
  patchL: (p: LaserDetailJson) => void
  commit: () => void
  speichDetail: (d: LaserDetailJson) => void
}

const SCHILD_T = new Set(['SCHILD', 'POKALSCHILD', 'NAMENSSCHILD'])

export function LaserDetail({ teil, teilStatus, onDetailPatch }: Props) {
  const [typ, setTyp] = useState<string | null>(teil.typ)
  const [detail, setDetail] = useState<LaserDetailJson>(laserRoh(teil))
  const detailR = useRef(detail)
  const typR = useRef(typ)
  useEffect(() => {
    detailR.current = detail
  }, [detail])
  useEffect(() => {
    typR.current = typ
  }, [typ])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Eltern-Teil ersetzt
    setTyp(teil.typ)
    setDetail(laserRoh(teil))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teil.id, teil.typ, teil.detail])

  const fehler = validateLaserDetail(typ, detail, teilStatus)
  const pruef = teilStatus !== 'ANGEBOT'
  const fe = (k: string) => (pruef && fehler[k] ? ' ber-inp--err' : '')

  const speich = useCallback(
    async (nextTyp: string | null, d: LaserDetailJson) => {
      let out = d
      if (nextTyp === 'NAMENSSCHILD' && d && typeof d === 'object') {
        out = { ...d }
        delete (out as Record<string, unknown>).selbstklebend
      }
      setDetail(out)
      detailR.current = out
      setTyp(nextTyp)
      await onDetailPatch({ typ: nextTyp, detail: out })
    },
    [onDetailPatch]
  )

  const patchL = useCallback((p: LaserDetailJson) => {
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
    (d: LaserDetailJson) => {
      setDetail(d)
      detailR.current = d
      void speich(typR.current, d)
    },
    [speich]
  )

  const p: BlK = { d: detail, fe, pruef, f: fehler, patchL, commit, speichDetail }

  return (
    <div className="ber-lfp">
      <h3 className="ber-h3">Lasergravur-Details</h3>
      {typ === 'SONSTIGE_LASER' && (
        <p className="ber-hinweis">Bei &apos;Sonstige Laser&apos; wird PREPRESS_BEREIT nur manuell gesetzt.</p>
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
            {LASER_TYPEN.map(x => (
              <option key={x} value={x}>
                {LASER_TYP_ANZEIGE[x]}
              </option>
            ))}
          </select>
        }
      />

      <NmbStueckzahl {...p} />

      {typ && SCHILD_T.has(typ) && <SchildGruppe p={p} schildTyp={typ} />}
      {typ === 'GESCHENKARTIKEL' && <GeschenkGruppe p={p} />}
      {typ === 'SONSTIGE_LASER' && <SonstigeLaserGruppe p={p} />}

      <Txt
        {...p}
        k="besonderheiten"
        l="Besonderheiten (optional)"
        rows={3}
        optional
      />
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

function NmbStueckzahl(a: BlK) {
  const { d, fe, f, pruef, patchL, commit } = a
  const raw = d.stueckzahl
  let numForInput: number | '' = ''
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 1) numForInput = raw
  else if (typeof raw === 'string' && raw.trim() !== '') {
    const n = parseInt(raw, 10)
    if (Number.isInteger(n) && n >= 1) numForInput = n
  }
  return (
    <BerZeile l="Stückzahl" e={pruef && f.stueckzahl ? f.stueckzahl : undefined}>
      <input
        type="number"
        className={'ber-inp' + fe('stueckzahl')}
        value={numForInput}
        onChange={e => {
          const v = e.target.value
          patchL({ stueckzahl: v === '' ? null : parseInt(v, 10) } as LaserDetailJson)
        }}
        onBlur={commit}
        min={1}
      />
    </BerZeile>
  )
}

function boolSel(a: BlK & { k: string; l: string }) {
  const { k, d, fe, f, pruef, speichDetail, l: lb } = a
  const v = (d as Record<string, unknown>)[k]
  const s = v === true ? 'true' : v === false ? 'false' : ''
  return (
    <BerZeile l={lb} e={pruef ? f[k] : undefined}>
      <select
        className={'ber-inp' + fe(k)}
        value={s}
        onChange={e => {
          const t = e.target.value
          const b: true | false | undefined = t === 'true' ? true : t === 'false' ? false : undefined
          speichDetail({ ...d, [k]: b } as LaserDetailJson)
        }}
      >
        <option value="">—</option>
        <option value="true">Ja</option>
        <option value="false">Nein</option>
      </select>
    </BerZeile>
  )
}

function Txt(
  a: BlK & { k: string; l: string; rows?: number; optional?: boolean },
) {
  const { k, l, d, fe, f, pruef, patchL, commit, rows = 1, optional } = a
  const val = String((d as Record<string, string>)[k] ?? '')
  const err = pruef && f[k] && !optional ? f[k] : undefined
  return (
    <BerZeile l={l} e={err}>
      {rows > 1 ? (
        <textarea
          className={'ber-inp' + (pruef && f[k] && !optional ? fe(k) : '')}
          rows={rows}
          value={val}
          onChange={e => patchL({ [k]: e.target.value } as LaserDetailJson)}
          onBlur={commit}
        />
      ) : (
        <input
          type="text"
          className={'ber-inp' + (pruef && f[k] && !optional ? fe(k) : '')}
          value={val}
          onChange={e => patchL({ [k]: e.target.value } as LaserDetailJson)}
          onBlur={commit}
        />
      )}
    </BerZeile>
  )
}

function MasseBreiteHoeheMm(p: BlK) {
  const { d, fe, f, pruef, patchL, commit } = p
  const msg = pruef ? f.format_masse : undefined
  const r = d as Record<string, number | null | undefined>
  const b = r.format_breite
  const h = r.format_hoehe
  const sb = b === null || b === undefined ? '' : String(b)
  const sh = h === null || h === undefined ? '' : String(h)
  return (
    <div>
      <div className="ber-zeile">
        <span className="ber-lbl">Format Breite (mm)</span>
        <div>
          <input
            type="number"
            className={'ber-inp' + fe('format_masse')}
            min={1}
            step={1}
            value={sb}
            onChange={e => {
              const raw = e.target.value
              const n = raw === '' ? null : parseInt(raw, 10)
              patchL({
                format_breite: n === null || Number.isNaN(n) ? null : n,
              } as LaserDetailJson)
            }}
            onBlur={commit}
          />
        </div>
      </div>
      <div className="ber-zeile">
        <span className="ber-lbl">Format Höhe (mm)</span>
        <div>
          <input
            type="number"
            className={'ber-inp' + fe('format_masse')}
            min={1}
            step={1}
            value={sh}
            onChange={e => {
              const raw = e.target.value
              const n = raw === '' ? null : parseInt(raw, 10)
              patchL({
                format_hoehe: n === null || Number.isNaN(n) ? null : n,
              } as LaserDetailJson)
            }}
            onBlur={commit}
          />
        </div>
      </div>
      {msg && <p className="ber-err">{msg}</p>}
    </div>
  )
}

function SchildGruppe({ p, schildTyp }: { p: BlK; schildTyp: string }) {
  const d = p.d as Record<string, string | null | boolean | number | undefined>
  const m = String(d.material ?? '')
  return (
    <>
      <BerZeile
        l="Material"
        e={p.pruef && (p.f.material || p.f.material_sonstige) ? p.f.material || p.f.material_sonstige : undefined}
        c={
          <div>
            <select
              className={'ber-inp' + p.fe('material')}
              value={m}
              onChange={e => {
                const v = e.target.value
                p.speichDetail({
                  ...p.d,
                  material: v || null,
                  material_sonstige: v === 'SONSTIGE' ? d.material_sonstige : null,
                } as LaserDetailJson)
              }}
            >
              <option value="">—</option>
              {LASER_MAT_SCHILD.map(fv => (
                <option key={fv} value={fv}>
                  {LASER_MAT_SCHILD_ANZEIGE[fv]}
                </option>
              ))}
            </select>
            {m === 'SONSTIGE' && (
              <div style={{ marginTop: 8 }}>
                <input
                  type="text"
                  className={'ber-inp' + p.fe('material_sonstige')}
                  placeholder="Material (Freitext)"
                  value={String(d.material_sonstige ?? '')}
                  onChange={e => p.patchL({ material_sonstige: e.target.value || null } as LaserDetailJson)}
                  onBlur={p.commit}
                />
              </div>
            )}
          </div>
        }
      />
      <MasseBreiteHoeheMm {...p} />
      {boolSel({ ...p, k: 'ecken_runden', l: 'Ecken runden' })}
      {schildTyp !== 'NAMENSSCHILD' && boolSel({ ...p, k: 'selbstklebend', l: 'Selbstklebend' })}
      <Txt {...p} k="motiv" l="Motiv / Inhalt" rows={5} />
    </>
  )
}

function GeschenkGruppe({ p }: { p: BlK }) {
  const d = p.d as Record<string, string>
  return (
    <>
      <Txt {...p} k="material_freitext" l="Material" rows={2} />
      <BerZeile
        l="Herkunft"
        e={p.pruef && p.f.herkunft ? p.f.herkunft : undefined}
        c={
          <select
            className={'ber-inp' + p.fe('herkunft')}
            value={d.herkunft ?? ''}
            onChange={e =>
              p.speichDetail({ ...p.d, herkunft: e.target.value || null } as LaserDetailJson)
            }
          >
            <option value="">—</option>
            {LASER_HERKUNFT.map(hk => (
              <option key={hk} value={hk}>
                {LASER_HERKUNFT_ANZEIGE[hk]}
              </option>
            ))}
          </select>
        }
      />
      <Txt {...p} k="motiv" l="Motiv / Inhalt" rows={5} />
    </>
  )
}

function SonstigeLaserGruppe({ p }: { p: BlK }) {
  const d = p.d as Record<string, string>
  return (
    <>
      <Txt {...p} k="material_freitext" l="Material (optional)" optional rows={2} />
      {boolSel({ ...p, k: 'selbstklebend', l: 'Selbstklebend' })}
      <BerZeile
        l="Herkunft"
        e={p.pruef && p.f.herkunft ? p.f.herkunft : undefined}
        c={
          <select
            className={'ber-inp' + p.fe('herkunft')}
            value={d.herkunft ?? ''}
            onChange={e =>
              p.speichDetail({ ...p.d, herkunft: e.target.value || null } as LaserDetailJson)
            }
          >
            <option value="">—</option>
            {LASER_HERKUNFT.map(hk => (
              <option key={hk} value={hk}>
                {LASER_HERKUNFT_ANZEIGE[hk]}
              </option>
            ))}
          </select>
        }
      />
      <Txt {...p} k="motiv" l="Motiv / Inhalt" rows={5} />
    </>
  )
}
