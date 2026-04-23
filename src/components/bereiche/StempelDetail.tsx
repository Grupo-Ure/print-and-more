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
            {STEMPEL_TYPEN.map(x => (
              <option key={x} value={x}>
                {STEMPEL_TYP_ANZEIGE[x]}
              </option>
            ))}
          </select>
        }
      />

      <NmbStueckzahl {...p} />

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
              {STEMPEL_FARBE.map(fv => (
                <option key={fv} value={fv}>
                  {STEMPEL_FARBE_ANZEIGE[fv]}
                </option>
              ))}
            </select>
            {String((detail as Record<string, string>).farbe ?? '') === 'SONSTIGE' && (
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
              Änderungen nach Produktionsfreigabe setzen den Status zurück
            </p>
          </div>
        }
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
          const raw = e.target.value
          patchL({ stueckzahl: raw === '' ? null : parseInt(raw, 10) } as StempelDetailJson)
        }}
        onBlur={commit}
        min={1}
      />
    </BerZeile>
  )
}
