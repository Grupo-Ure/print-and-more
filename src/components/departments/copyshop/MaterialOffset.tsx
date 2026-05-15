import type { ReactNode } from 'react'
import type { CopyShopDetailJson } from '../../../types/copyshop'
import '../../WorkArea.css'

export type MaterialOffsetProps = {
  detail: CopyShopDetailJson
  fieldErrorClass: (fieldName: string) => string
  validationErrors: Record<string, string>
  shouldValidate: boolean
  patchLocal: (patch: CopyShopDetailJson) => void
  commit: () => void
  applyDetail: (detail: CopyShopDetailJson) => void
}

function FieldRow({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="ber-zeile">
      <span className="ber-lbl">{label}</span>
      <div>
        {children}
        {error && <p className="ber-err">{error}</p>}
      </div>
    </div>
  )
}

export function MaterialOffset(props: MaterialOffsetProps) {
  const { detail, fieldErrorClass, validationErrors, shouldValidate, patchLocal, commit, applyDetail } = props
  const detailRecord = detail as Record<string, string | null | undefined>
  const offsetType = String(detailRecord.offset_art ?? '')

  const onArtChange = (selected: string) => {
    const base: CopyShopDetailJson = {
      ...detail,
      offset_art: selected || null,
      offset_grammatur: null,
      offset_oberflaeche: null,
      spezial_papier: null,
      spezial_sonstige: null,
      kaschierung: null,
      kaschierung_seiten: null,
      recycling_grammatur: null,
    } as CopyShopDetailJson
    applyDetail(base)
  }

  return (
    <>
      <FieldRow label="Offset type" error={shouldValidate && validationErrors.offset_art ? validationErrors.offset_art : undefined}>
        <select
          className={'ber-inp' + fieldErrorClass('offset_art')}
          value={offsetType}
          onChange={e => onArtChange(e.target.value)}
        >
          <option value="">—</option>
          <option value="STANDARD">Standard</option>
          <option value="OFFSET">Offset</option>
          <option value="SPEZIAL">Special</option>
        </select>
      </FieldRow>

      {offsetType === 'STANDARD' && (
        <>
          <FieldRow
            label="Weight"
            error={shouldValidate && validationErrors.offset_grammatur ? validationErrors.offset_grammatur : undefined}
          >
            <select
              className={'ber-inp' + fieldErrorClass('offset_grammatur')}
              value={String(detailRecord.offset_grammatur ?? '')}
              onChange={e =>
                applyDetail({ ...detail, offset_grammatur: e.target.value } as CopyShopDetailJson)
              }
            >
              <option value="">—</option>
              {(['115G', '135G', '170G', '250G', '300G', '350G', '400G'] as const).map(weight => (
                <option key={weight} value={weight}>
                  {weight}
                </option>
              ))}
            </select>
          </FieldRow>
          <FieldRow
            label="Finish"
            error={shouldValidate && validationErrors.offset_oberflaeche ? validationErrors.offset_oberflaeche : undefined}
          >
            <select
              className={'ber-inp' + fieldErrorClass('offset_oberflaeche')}
              value={String(detailRecord.offset_oberflaeche ?? '')}
              onChange={e =>
                applyDetail({ ...detail, offset_oberflaeche: e.target.value } as CopyShopDetailJson)
              }
            >
              <option value="">—</option>
              <option value="MATT">Matte</option>
              <option value="GLAENZEND">Glossy</option>
            </select>
          </FieldRow>
        </>
      )}

      {offsetType === 'OFFSET' && (
        <FieldRow
          label="Grammatur"
          error={shouldValidate && validationErrors.offset_grammatur ? validationErrors.offset_grammatur : undefined}
        >
          <select
            className={'ber-inp' + fieldErrorClass('offset_grammatur')}
            value={String(detailRecord.offset_grammatur ?? '')}
            onChange={e =>
              applyDetail({ ...detail, offset_grammatur: e.target.value } as CopyShopDetailJson)
            }
          >
            <option value="">—</option>
            {(['80G', '90G', '100G', '120G', '150G', '250G'] as const).map(weight => (
              <option key={weight} value={weight}>
                {weight}
              </option>
            ))}
          </select>
        </FieldRow>
      )}

      {offsetType === 'SPEZIAL' && (
        <>
          <FieldRow
            label="Paper"
            error={shouldValidate && validationErrors.spezial_papier ? validationErrors.spezial_papier : undefined}
          >
            <select
              className={'ber-inp' + fieldErrorClass('spezial_papier')}
              value={String(detailRecord.spezial_papier ?? '')}
              onChange={e => {
                const selected = e.target.value
                applyDetail({
                  ...detail,
                  spezial_papier: selected,
                  spezial_sonstige: selected === 'SONSTIGE' ? (detailRecord.spezial_sonstige ?? null) : null,
                  kaschierung: null,
                  kaschierung_seiten: null,
                  recycling_grammatur: null,
                } as CopyShopDetailJson)
              }}
            >
              <option value="">—</option>
              <option value="300G_FOLIENKASCHIERT">300g laminated</option>
              <option value="RECYCLING">Recycled</option>
              <option value="250G_LEINENSTRUKTUR">250g Linen texture</option>
              <option value="SONSTIGE">Other</option>
            </select>
          </FieldRow>
          {detailRecord.spezial_papier === '300G_FOLIENKASCHIERT' && (
            <>
              <FieldRow
                label="Lamination"
                error={shouldValidate && validationErrors.kaschierung ? validationErrors.kaschierung : undefined}
              >
                <select
                  className={'ber-inp' + fieldErrorClass('kaschierung')}
                  value={String(detailRecord.kaschierung ?? '')}
                  onChange={e =>
                    applyDetail({ ...detail, kaschierung: e.target.value } as CopyShopDetailJson)
                  }
                >
                  <option value="">—</option>
                  <option value="MATT">Matte</option>
                  <option value="GLAENZEND">Glossy</option>
                </select>
              </FieldRow>
              <FieldRow
                label="Sides"
                error={shouldValidate && validationErrors.kaschierung_seiten ? validationErrors.kaschierung_seiten : undefined}
              >
                <select
                  className={'ber-inp' + fieldErrorClass('kaschierung_seiten')}
                  value={String(detailRecord.kaschierung_seiten ?? '')}
                  onChange={e =>
                    applyDetail({ ...detail, kaschierung_seiten: e.target.value } as CopyShopDetailJson)
                  }
                >
                  <option value="">—</option>
                  <option value="EINSEITIG">Single-sided</option>
                  <option value="BEIDSEITIG">Double-sided</option>
                </select>
              </FieldRow>
            </>
          )}
          {detailRecord.spezial_papier === 'RECYCLING' && (
            <FieldRow
              label="Weight"
              error={shouldValidate && validationErrors.recycling_grammatur ? validationErrors.recycling_grammatur : undefined}
            >
              <select
                className={'ber-inp' + fieldErrorClass('recycling_grammatur')}
                value={String(detailRecord.recycling_grammatur ?? '')}
                onChange={e =>
                  applyDetail({ ...detail, recycling_grammatur: e.target.value } as CopyShopDetailJson)
                }
              >
                <option value="">—</option>
                {(['80G', '135G', '150G', '300G'] as const).map(weight => (
                  <option key={weight} value={weight}>
                    {weight}
                  </option>
                ))}
              </select>
            </FieldRow>
          )}
          {detailRecord.spezial_papier === 'SONSTIGE' && (
            <FieldRow
              label="Paper (other)"
              error={shouldValidate && validationErrors.spezial_sonstige ? validationErrors.spezial_sonstige : undefined}
            >
              <textarea
                className={'ber-inp ber-ta' + fieldErrorClass('spezial_sonstige')}
                rows={2}
                value={String(detailRecord.spezial_sonstige ?? '')}
                onChange={e => patchLocal({ spezial_sonstige: e.target.value } as CopyShopDetailJson)}
                onBlur={commit}
              />
            </FieldRow>
          )}
        </>
      )}
    </>
  )
}
