import type { CopyShopDetailJson } from '../../../types/copyshop'
import '../../WorkArea.css'

export type MatCcProps = {
  d: CopyShopDetailJson
  fe: (k: string) => string
  f: Record<string, string>
  pruef: boolean
  patchL: (p: CopyShopDetailJson) => void
  commit: () => void
  /** z. B. material_cc / cc_umschlag */
  kMat: string
  kSon: string
  label: string
}

const CC_GRAMM = ['80G', '100G', '120G', '160G', '200G', '250G', '300G', 'SONSTIGE'] as const

export function MaterialCC(p: MatCcProps) {
  const { d, fe, f, pruef, patchL, commit, kMat, kSon, label } = p
  const dr = d as Record<string, string | null | undefined>
  const mat = String(dr[kMat] ?? '')
  const feMat = fe(kMat)
  const feSon = fe(kSon)
  return (
    <>
      <div className="ber-zeile">
        <span className="ber-lbl">{label}</span>
        <div>
          <select
            className={'ber-inp' + feMat}
            value={mat}
            onChange={e => {
              const v = e.target.value
              if (v === 'SONSTIGE') patchL({ [kMat]: v } as CopyShopDetailJson)
              else patchL({ [kMat]: v, [kSon]: null } as CopyShopDetailJson)
            }}
            onBlur={commit}
          >
            <option value="">—</option>
            {CC_GRAMM.map(x => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
            <option value="SONSTIGE">Sonstige</option>
          </select>
          {pruef && f[kMat] && <p className="ber-err">{f[kMat]}</p>}
        </div>
      </div>
      {mat === 'SONSTIGE' && (
        <div className="ber-zeile">
          <span className="ber-lbl">{label} (sonstige)</span>
          <div>
            <textarea
              className={'ber-inp ber-ta' + feSon}
              rows={2}
              value={String(dr[kSon] ?? '')}
              onChange={e => patchL({ [kSon]: e.target.value } as CopyShopDetailJson)}
              onBlur={commit}
            />
            {pruef && f[kSon] && <p className="ber-err">{f[kSon]}</p>}
          </div>
        </div>
      )}
    </>
  )
}
