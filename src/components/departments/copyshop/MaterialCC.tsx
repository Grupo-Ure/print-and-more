import type { CopyShopDetailJson } from '../../../types/copyshop'
import '../../WorkArea.css'

export type MatCcProps = {
  detail: CopyShopDetailJson
  fieldErrorClass: (fieldName: string) => string
  validationErrors: Record<string, string>
  shouldValidate: boolean
  patchLocal: (patch: CopyShopDetailJson) => void
  commit: () => void
  applyDetail: (detail: CopyShopDetailJson) => void
  /** z. B. material_cc / cc_umschlag */
  materialKey: string
  customKey: string
  label: string
}

const CC_GRAMM = ['80G', '100G', '120G', '160G', '200G', '250G', '300G', 'SONSTIGE'] as const

export function MaterialCC(props: MatCcProps) {
  const { detail, fieldErrorClass, validationErrors, shouldValidate, patchLocal, commit, applyDetail, materialKey, customKey, label } = props
  const dr = detail as Record<string, string | null | undefined>
  const mat = String(dr[materialKey] ?? '')
  const feMat = fieldErrorClass(materialKey)
  const feSon = fieldErrorClass(customKey)
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
              if (v === 'SONSTIGE')
                applyDetail({ ...detail, [materialKey]: v } as CopyShopDetailJson)
              else applyDetail({ ...detail, [materialKey]: v, [customKey]: null } as CopyShopDetailJson)
            }}
          >
            <option value="">—</option>
            {CC_GRAMM.map(x => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
            <option value="SONSTIGE">Sonstige</option>
          </select>
          {shouldValidate && validationErrors[materialKey] && <p className="ber-err">{validationErrors[materialKey]}</p>}
        </div>
      </div>
      {mat === 'SONSTIGE' && (
        <div className="ber-zeile">
          <span className="ber-lbl">{label} (sonstige)</span>
          <div>
            <textarea
              className={'ber-inp ber-ta' + feSon}
              rows={2}
              value={String(dr[customKey] ?? '')}
              onChange={e => patchLocal({ [customKey]: e.target.value } as CopyShopDetailJson)}
              onBlur={commit}
            />
            {shouldValidate && validationErrors[customKey] && <p className="ber-err">{validationErrors[customKey]}</p>}
          </div>
        </div>
      )}
    </>
  )
}
