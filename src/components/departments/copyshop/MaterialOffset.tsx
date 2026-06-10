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
  const offsetType = String(detailRecord.offset_type ?? '')

  const onArtChange = (selected: string) => {
    const base: CopyShopDetailJson = {
      ...detail,
      offset_type: selected || null,
      offset_weight: null,
      offset_finish: null,
      special_paper: null,
      special_paper_other: null,
      lamination_finish: null,
      lamination_sides: null,
      recycling_weight: null,
    } as CopyShopDetailJson
    applyDetail(base)
  }

  return (
    <>
      <FieldRow label="Offset type" error={shouldValidate && validationErrors.offset_type ? validationErrors.offset_type : undefined}>
        <select
          className={'ber-inp' + fieldErrorClass('offset_type')}
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
            error={shouldValidate && validationErrors.offset_weight ? validationErrors.offset_weight : undefined}
          >
            <select
              className={'ber-inp' + fieldErrorClass('offset_weight')}
              value={String(detailRecord.offset_weight ?? '')}
              onChange={e =>
                applyDetail({ ...detail, offset_weight: e.target.value } as CopyShopDetailJson)
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
            error={shouldValidate && validationErrors.offset_finish ? validationErrors.offset_finish : undefined}
          >
            <select
              className={'ber-inp' + fieldErrorClass('offset_finish')}
              value={String(detailRecord.offset_finish ?? '')}
              onChange={e =>
                applyDetail({ ...detail, offset_finish: e.target.value } as CopyShopDetailJson)
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
          error={shouldValidate && validationErrors.offset_weight ? validationErrors.offset_weight : undefined}
        >
          <select
            className={'ber-inp' + fieldErrorClass('offset_weight')}
            value={String(detailRecord.offset_weight ?? '')}
            onChange={e =>
              applyDetail({ ...detail, offset_weight: e.target.value } as CopyShopDetailJson)
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
            error={shouldValidate && validationErrors.special_paper ? validationErrors.special_paper : undefined}
          >
            <select
              className={'ber-inp' + fieldErrorClass('special_paper')}
              value={String(detailRecord.special_paper ?? '')}
              onChange={e => {
                const selected = e.target.value
                applyDetail({
                  ...detail,
                  special_paper: selected,
                  special_paper_other: selected === 'SONSTIGE' ? (detailRecord.special_paper_other ?? null) : null,
                  lamination_finish: null,
                  lamination_sides: null,
                  recycling_weight: null,
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
          {detailRecord.special_paper === '300G_FOLIENKASCHIERT' && (
            <>
              <FieldRow
                label="Lamination"
                error={shouldValidate && validationErrors.lamination_finish ? validationErrors.lamination_finish : undefined}
              >
                <select
                  className={'ber-inp' + fieldErrorClass('lamination_finish')}
                  value={String(detailRecord.lamination_finish ?? '')}
                  onChange={e =>
                    applyDetail({ ...detail, lamination_finish: e.target.value } as CopyShopDetailJson)
                  }
                >
                  <option value="">—</option>
                  <option value="MATT">Matte</option>
                  <option value="GLAENZEND">Glossy</option>
                </select>
              </FieldRow>
              <FieldRow
                label="Sides"
                error={shouldValidate && validationErrors.lamination_sides ? validationErrors.lamination_sides : undefined}
              >
                <select
                  className={'ber-inp' + fieldErrorClass('lamination_sides')}
                  value={String(detailRecord.lamination_sides ?? '')}
                  onChange={e =>
                    applyDetail({ ...detail, lamination_sides: e.target.value } as CopyShopDetailJson)
                  }
                >
                  <option value="">—</option>
                  <option value="EINSEITIG">Single-sided</option>
                  <option value="BEIDSEITIG">Double-sided</option>
                </select>
              </FieldRow>
            </>
          )}
          {detailRecord.special_paper === 'RECYCLING' && (
            <FieldRow
              label="Weight"
              error={shouldValidate && validationErrors.recycling_weight ? validationErrors.recycling_weight : undefined}
            >
              <select
                className={'ber-inp' + fieldErrorClass('recycling_weight')}
                value={String(detailRecord.recycling_weight ?? '')}
                onChange={e =>
                  applyDetail({ ...detail, recycling_weight: e.target.value } as CopyShopDetailJson)
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
          {detailRecord.special_paper === 'SONSTIGE' && (
            <FieldRow
              label="Paper (other)"
              error={shouldValidate && validationErrors.special_paper_other ? validationErrors.special_paper_other : undefined}
            >
              <textarea
                className={'ber-inp ber-ta' + fieldErrorClass('special_paper_other')}
                rows={2}
                value={String(detailRecord.special_paper_other ?? '')}
                onChange={e => patchLocal({ special_paper_other: e.target.value } as CopyShopDetailJson)}
                onBlur={commit}
              />
            </FieldRow>
          )}
        </>
      )}
    </>
  )
}
