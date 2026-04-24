import { useCallback, useEffect, useRef, useState } from 'react'
import { validateSonstigeDetail } from '../../lib/sonstige/validateSonstigeDetail'
import type { AuftragStatus, TeilauftragRow } from '../../types/database'
import '../WorkArea.css'

export type SonstigeDetailJson = Record<string, unknown>

type Props = {
  teil: TeilauftragRow
  teilStatus: AuftragStatus
  onDetailPatch: (patch: { typ?: string | null; detail: SonstigeDetailJson | null }) => Promise<void>
}

const SONSTIGE_TYP = 'SONSTIGE' as const

function sonstigeRoh(teil: TeilauftragRow): SonstigeDetailJson {
  const d = teil.detail
  return d && typeof d === 'object' && !Array.isArray(d) ? { ...d } : {}
}

type BlK = {
  d: SonstigeDetailJson
  fe: (k: string) => string
  pruef: boolean
  f: Record<string, string>
  patchL: (p: SonstigeDetailJson) => void
  commit: () => void
  speichDetail: (d: SonstigeDetailJson) => void
}

export function SonstigeDetail({ teil, teilStatus, onDetailPatch }: Props) {
  const [detail, setDetail] = useState<SonstigeDetailJson>(sonstigeRoh(teil))
  const detailR = useRef(detail)
  useEffect(() => {
    detailR.current = detail
  }, [detail])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Eltern-Teil ersetzt
    setDetail(sonstigeRoh(teil))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teil.id, teil.detail])

  const fehler = validateSonstigeDetail(detail, teilStatus)
  const pruef = teilStatus !== 'ANGEBOT'
  const fe = (k: string) => (pruef && fehler[k] ? ' ber-inp--err' : '')

  const speich = useCallback(
    async (d: SonstigeDetailJson) => {
      setDetail(d)
      detailR.current = d
      await onDetailPatch({ typ: teil.typ?.trim() ? teil.typ : SONSTIGE_TYP, detail: d })
    },
    [onDetailPatch, teil.typ]
  )

  const patchL = useCallback((p: SonstigeDetailJson) => {
    setDetail(d0 => {
      const n = { ...d0, ...p }
      detailR.current = n
      return n
    })
  }, [])

  const commit = useCallback(() => {
    void speich({ ...detailR.current })
  }, [speich])

  const speichDetail = useCallback(
    (d: SonstigeDetailJson) => {
      setDetail(d)
      detailR.current = d
      void speich(d)
    },
    [speich]
  )

  const p: BlK = { d: detail, fe, pruef, f: fehler, patchL, commit, speichDetail }

  return (
    <div className="ber-lfp">
      <h3 className="ber-h3">Sonstige — Details</h3>
      <p className="ber-hinweis">Bei &apos;Sonstige&apos; wird PREPRESS_BEREIT nur manuell gesetzt.</p>

      <div className="ber-zeile" style={{ marginBottom: 8 }}>
        <span className="ber-lbl">Typ</span>
        <p className="td-wert td-mono" style={{ margin: 0 }}>
          {SONSTIGE_TYP}
        </p>
      </div>

      <BerZeile
        l="Beschreibung / Inhalt"
        e={pruef && fehler.beschreibung ? fehler.beschreibung : undefined}
        c={
          <div>
            <textarea
              className={'ber-inp' + fe('beschreibung')}
              rows={8}
              value={String(detail['beschreibung'] ?? '')}
              onChange={e => patchL({ beschreibung: e.target.value || null } as SonstigeDetailJson)}
              onBlur={commit}
            />
            <p className="ber-hinweis" style={{ marginTop: 6, marginBottom: 0 }}>
              Änderungen nach Produktionsfreigabe setzen den Status zurück
            </p>
          </div>
        }
      />

      <NmbStueckzahlOptional {...p} />
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

function NmbStueckzahlOptional(a: BlK) {
  const { d, fe, f, pruef, patchL, commit } = a
  const raw = d.stueckzahl
  let numForInput: number | '' = ''
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 1) numForInput = raw
  else if (typeof raw === 'string' && raw.trim() !== '') {
    const n = parseInt(raw, 10)
    if (Number.isInteger(n) && n >= 1) numForInput = n
  }
  return (
    <BerZeile
      l="Stückzahl (optional)"
      e={pruef && f.stueckzahl ? f.stueckzahl : undefined}
      c={
        <div>
          <input
            type="number"
            className={'ber-inp' + fe('stueckzahl')}
            value={numForInput}
            onChange={e => {
              const v = e.target.value
              patchL({ stueckzahl: v === '' ? null : parseInt(v, 10) } as SonstigeDetailJson)
            }}
            onBlur={commit}
            min={1}
            placeholder="—"
          />
          <p className="ber-hinweis" style={{ marginTop: 6, marginBottom: 0 }}>
            Falls relevant, Stückzahl hier oder in der Beschreibung angeben
          </p>
        </div>
      }
    />
  )
}
