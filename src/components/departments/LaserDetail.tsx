import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { subOrderProductService, type SubOrderProductRow } from '../../services/subOrderProductService'
import {
  LASER_ORIGINS,
  LASER_ORIGIN_LABELS,
  LASER_SIGN_MATERIALS,
  LASER_SIGN_MATERIAL_LABELS,
  LASER_TYPES,
  LASER_TYPE_LABELS,
  type LaserDetailJson,
} from '../../types/laser'
import { validateLaserDetail } from '../../lib/laser/validateLaserDetail'
import type { OrderStatus, SubOrderRow } from '../../types/database'
import type { Database, Json } from '../../types/supabase'
import type { FileRow } from '../../services/fileService'
import { useToast } from '../Toast'
import '../WorkArea.css'

type Props = {
  subOrder: SubOrderRow
  subOrderStatus: OrderStatus
  orderFiles?: FileRow[]
}

type ProductRow = {
  id: string
  sub_order_id: string
  department: string
  detail: LaserDetailJson
  sort_order: number | null
  created_at: string | null
}

type DetailBlockProps = {
  detail: LaserDetailJson
  fieldErrorClass: (fieldKey: string) => string
  shouldValidate: boolean
  validationErrors: Record<string, string>
  patchLocal: (patch: LaserDetailJson) => void
  commit: () => void
  applyDetail: (newDetail: LaserDetailJson) => void
}

const SIGN_TYPES = new Set(['SIGN', 'TROPHY_PLATE', 'NAME_TAG'])

type ProductFileAssignment = { assignmentId: string; fileId: string }

export function LaserDetail({
  subOrder,
  subOrderStatus,
  orderFiles = [],
}: Props) {
  const { showError } = useToast()

  const [products, setProducts] = useState<ProductRow[]>([])
  const [productFiles, setProductFiles] = useState<Record<string, ProductFileAssignment[]>>({})
  const productFilesRef = useRef(productFiles)
  productFilesRef.current = productFiles
  const [productsLoading, setProductsLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [unlocked, setUnlocked] = useState(false)
  const [formFileRecordIds, setFormFileRecordIds] = useState<string[]>([])

  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [detail, setDetail] = useState<LaserDetailJson>({})
  const detailRef = useRef(detail)
  const typeRef = useRef(selectedType)
  useEffect(() => {
    detailRef.current = detail
  }, [detail])
  useEffect(() => {
    typeRef.current = selectedType
  }, [selectedType])

  useEffect(() => {
    setEditingId(null)
    setFormFileRecordIds([])
    setUnlocked(false)
    setSelectedType(null)
    setDetail({})
    detailRef.current = {}
    typeRef.current = null
  }, [subOrder.id])

  const loadFilesForProducts = useCallback(
    async (productRows: ProductRow[]) => {
      const ids = productRows.map(productRow => productRow.id)
      if (ids.length === 0) {
        setProductFiles({})
        return
      }
      let rows: Awaited<ReturnType<typeof subOrderProductService.getFilesByProductIds>>
      try {
        rows = await subOrderProductService.getFilesByProductIds(ids)
      } catch {
        showError('File assignments could not be loaded')
        setProductFiles({})
        return
      }
      const next: Record<string, ProductFileAssignment[]> = {}
      for (const row of rows) {
        const list = next[row.product_id] ?? (next[row.product_id] = [])
        list.push({ assignmentId: row.id, fileId: row.file_id })
      }
      setProductFiles(next)
    },
    [showError],
  )

  const reloadProducts = useCallback(async (): Promise<ProductRow[]> => {
    if (!subOrder.id) {
      await loadFilesForProducts([])
      return []
    }
    setProductsLoading(true)
    let rows: SubOrderProductRow[]
    try {
      rows = await subOrderProductService.getProductsBySubOrderId(subOrder.id)
    } catch {
      setProductsLoading(false)
      showError('Products could not be loaded')
      setProducts([])
      await loadFilesForProducts([])
      return []
    }
    setProductsLoading(false)
    const mapped: ProductRow[] = rows.map(row => ({
      id: row.id,
      sub_order_id: row.sub_order_id,
      department: row.department,
      detail: (row.detail ?? {}) as LaserDetailJson,
      sort_order: row.sort_order,
      created_at: row.created_at,
    }))
    setProducts(mapped)
    await loadFilesForProducts(mapped)
    return mapped
  }, [subOrder.id, showError, loadFilesForProducts])

  useEffect(() => {
    void reloadProducts()
  }, [reloadProducts])

  const assignFileToProduct = useCallback(
    async (productId: string, fileId: string, productRowsForReload?: ProductRow[]) => {
      const reloadRows = productRowsForReload ?? products
      if (productFilesRef.current[productId]?.some(assignment => assignment.fileId === fileId)) return
      try {
        await subOrderProductService.assignFileToProduct(productId, fileId)
      } catch {
        showError('File could not be assigned')
        return
      }
      await loadFilesForProducts(reloadRows)
    },
    [showError, products, loadFilesForProducts],
  )

  const removeFileFromProduct = useCallback(
    async (assignmentId: string, productRowsForReload?: ProductRow[]) => {
      try {
        await subOrderProductService.removeFileFromProduct(assignmentId)
      } catch {
        showError('Assignment could not be removed')
        return
      }
      await loadFilesForProducts(productRowsForReload ?? products)
    },
    [showError, products, loadFilesForProducts],
  )

  const resetForm = useCallback(() => {
    setEditingId(null)
    setFormFileRecordIds([])
    setSelectedType(null)
    setDetail({})
    detailRef.current = {}
    typeRef.current = null
  }, [])

  const validationErrors = validateLaserDetail(selectedType, detail, subOrderStatus)
  const shouldValidate = subOrderStatus !== 'QUOTE'
  const fieldErrorClass = (fieldKey: string) => (shouldValidate && validationErrors[fieldKey] ? ' ber-inp--err' : '')

  const saveDetail = useCallback(
    (nextType: string | null, json: LaserDetailJson) => {
      let prepared: LaserDetailJson = json
      if (nextType === 'NAME_TAG' && json && typeof json === 'object') {
        prepared = { ...json }
        delete (prepared as Record<string, unknown>).selbstklebend
      }
      setDetail(prepared)
      detailRef.current = prepared
      setSelectedType(nextType)
    },
    []
  )

  const patchLocal = useCallback((patch: LaserDetailJson) => {
    setDetail(currentDetail => {
      const merged = { ...currentDetail, ...patch }
      detailRef.current = merged
      return merged
    })
  }, [])

  const commit = useCallback(() => {
    void saveDetail(typeRef.current, { ...detailRef.current })
  }, [saveDetail])

  const applyDetail = useCallback(
    (newDetail: LaserDetailJson) => {
      setDetail(newDetail)
      detailRef.current = newDetail
      void saveDetail(typeRef.current, newDetail)
    },
    [saveDetail]
  )

  const detailBlock: DetailBlockProps = { detail, fieldErrorClass, shouldValidate, validationErrors, patchLocal, commit, applyDetail }

  const formOk = useMemo(() => Object.keys(validationErrors).length === 0, [validationErrors])

  const requiresUnlock =
    (subOrderStatus === 'PREPRESS_READY' || subOrderStatus === 'PRODUCTION_READY') && !unlocked

  const handleAddOrSave = useCallback(async () => {
    const currentType = typeRef.current
    const currentDetail = { ...detailRef.current }
    if (!currentType) return
    const errors = validateLaserDetail(currentType, currentDetail, subOrderStatus)
    if (Object.keys(errors).length > 0) return

    let filteredDetail = currentDetail
    if (currentType === 'NAME_TAG' && filteredDetail && typeof filteredDetail === 'object') {
      filteredDetail = { ...currentDetail }
      delete (filteredDetail as Record<string, unknown>).selbstklebend
    }

    if (editingId) {
      const patch: Database['public']['Tables']['sub_order_products']['Update'] = {
        detail: { ...filteredDetail, typ: currentType } as Json,
      }
      try {
        await subOrderProductService.updateProduct(editingId, patch)
      } catch {
        showError('Product could not be saved')
        return
      }
      for (const assignment of [...(productFiles[editingId] ?? [])]) {
        await removeFileFromProduct(assignment.assignmentId)
      }
      for (const fid of formFileRecordIds) {
        await assignFileToProduct(editingId, fid)
      }
      await reloadProducts()
      resetForm()
      return
    }

    const productInsert: Database['public']['Tables']['sub_order_products']['Insert'] = {
      sub_order_id: subOrder.id,
      department: 'LASER_ENGRAVING',
      detail: { ...filteredDetail, typ: currentType } as Json,
      sort_order: products.length,
    }
    let insertedRow: SubOrderProductRow
    try {
      insertedRow = await subOrderProductService.createProduct(productInsert)
    } catch {
      showError('Product could not be added')
      return
    }
    const newId = insertedRow.id
    const list = await reloadProducts()
    for (const fid of formFileRecordIds) {
      await assignFileToProduct(newId, fid, list)
    }
    await reloadProducts()
    resetForm()
  }, [
    subOrder,
    subOrderStatus,
    editingId,
    products.length,
    productFiles,
    formFileRecordIds,
    showError,
    reloadProducts,
    resetForm,
    assignFileToProduct,
    removeFileFromProduct,
  ])

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await subOrderProductService.deleteProduct(id)
      } catch {
        showError('Product could not be deleted')
        return
      }
      await reloadProducts()
      if (editingId === id) resetForm()
    },
    [showError, reloadProducts, editingId, resetForm]
  )

  const handleEdit = useCallback((row: ProductRow) => {
    setEditingId(row.id)
    setFormFileRecordIds(productFiles[row.id]?.map(assignment => assignment.fileId) ?? [])
    const rowDetail = row.detail ?? {}
    const detailRecord = rowDetail as Record<string, unknown>
    const rowType = typeof detailRecord.typ === 'string' ? detailRecord.typ : null
    setSelectedType(rowType)
    const cleanDetail = { ...(rowDetail as LaserDetailJson) }
    setDetail(cleanDetail)
    detailRef.current = cleanDetail
    typeRef.current = rowType
  }, [productFiles])

  return (
    <div className="ber-lfp">
      <h3 className="ber-h3">Laser Engraving Details</h3>
      {selectedType === 'OTHER_LASER' && (
        <p className="ber-hinweis">For &apos;Other (Laser)&apos;, PREPRESS_READY is set manually only.</p>
      )}

      <FieldRow
        label="Type"
        error={shouldValidate && validationErrors.typ ? validationErrors.typ : undefined}
        content={
          <select
            className={'ber-inp' + fieldErrorClass('typ')}
            value={selectedType ?? ''}
            onChange={e => {
              const selected = e.target.value
              if (selected !== (selectedType ?? '')) {
                setSelectedType(selected || null)
                setDetail({})
                detailRef.current = {}
                typeRef.current = selected || null
                if (editingId === null) void saveDetail(selected || null, {})
              } else {
                setSelectedType(selected || null)
                typeRef.current = selected || null
              }
            }}
          >
            <option value="">—</option>
            {LASER_TYPES.map(laserType => (
              <option key={laserType} value={laserType}>
                {LASER_TYPE_LABELS[laserType]}
              </option>
            ))}
          </select>
        }
      />

      <QuantityInput {...detailBlock} />

      {selectedType && SIGN_TYPES.has(selectedType) && <SignGroup props={detailBlock} signType={selectedType} />}
      {selectedType === 'GIFT_ITEM' && <GiftGroup props={detailBlock} />}
      {selectedType === 'OTHER_LASER' && <OtherLaserGroup props={detailBlock} />}

      <TextField
        {...detailBlock}
        fieldKey="besonderheiten"
        label="Notes (optional)"
        rows={3}
        optional
      />

      {orderFiles.length > 0 && (
        <FieldRow label="Files">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {formFileRecordIds.map(fid => (
              <span
                key={fid}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: '#f3f4f6',
                  border: '1px solid #e5e7eb',
                  maxWidth: '100%',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {orderFiles.find(file => file.id === fid)?.display_name ?? fid}
                </span>
                <button
                  type="button"
                  className="cp-btn cp-btn-grau"
                  style={{ minWidth: 22, padding: '0 6px', fontSize: 14, lineHeight: 1 }}
                  title="Remove"
                  onClick={() => setFormFileRecordIds(prev => prev.filter(id => id !== fid))}
                >
                  ×
                </button>
              </span>
            ))}
            <select
              key={formFileRecordIds.join('|')}
              className="ber-inp"
              style={{ fontSize: 12, maxWidth: 260 }}
              defaultValue=""
              onChange={e => {
                const selected = e.target.value
                if (selected && !formFileRecordIds.includes(selected)) {
                  setFormFileRecordIds(prev => [...prev, selected])
                }
              }}
            >
              <option value="">Add file…</option>
              {orderFiles
                .filter(file => !formFileRecordIds.includes(file.id))
                .map(file => (
                  <option key={file.id} value={file.id}>
                    {file.display_name}
                  </option>
                ))}
            </select>
          </div>
        </FieldRow>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="cp-btn"
          disabled={requiresUnlock ? false : !selectedType || !formOk}
          onClick={() => {
            if (requiresUnlock) {
              if (
                window.confirm(
                  'Sub-order is already released.\nReally edit products?',
                )
              ) {
                setUnlocked(true)
              }
              return
            }
            void handleAddOrSave()
          }}
        >
          {requiresUnlock
            ? 'Unlock editing'
            : editingId
              ? 'Save'
              : 'Add product'}
        </button>
        {editingId && (
          <button type="button" className="cp-btn cp-btn-grau" onClick={() => resetForm()}>
            Cancel
          </button>
        )}
      </div>
      {unlocked && (
        <p className="ber-hinweis" style={{ fontSize: 12, margin: '6px 0 0' }}>
          Editing unlocked — changes will reset status
        </p>
      )}

      <div style={{ borderTop: '1px solid var(--color-border, #e5e7eb)', marginTop: 10, paddingTop: 10 }}>
        <h3 className="wa-dl-titel" style={{ margin: 0 }}>
          Products
        </h3>
        {productsLoading ? (
          <p className="ber-hinweis" style={{ fontSize: 12, margin: '6px 0 0' }}>
            Loading products…
          </p>
        ) : products.length === 0 ? (
          <p className="ber-hinweis" style={{ fontSize: 12, margin: '6px 0 0' }}>
            No products yet.
          </p>
        ) : (
          <div style={{ overflowX: 'auto', marginTop: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                    Type
                  </th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                    Quantity
                  </th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                    Material
                  </th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                    Description
                  </th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {products.map(product => {
                  const productDetail = (product.detail ?? {}) as Record<string, unknown>
                  const productType = typeof productDetail.typ === 'string' ? productDetail.typ : ''
                  const quantity = productDetail.stueckzahl ?? ''
                  const rawMaterial = productDetail.material_schild ?? productDetail.material
                  const material = rawMaterial != null ? String(rawMaterial) : '—'
                  const description = productDetail.beschreibung != null ? String(productDetail.beschreibung).slice(0, 48) : '—'
                  const typeLabel = (LASER_TYPE_LABELS as Record<string, string>)[productType] ?? productType
                  const fileAssignments = productFiles[product.id] ?? []
                  return (
                    <tr key={product.id}>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>
                        {typeLabel || '—'}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>
                        {String(quantity || '—')}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{material}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{description}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button type="button" className="cp-btn cp-btn-grau" onClick={() => handleEdit(product)}>
                            Edit
                          </button>
                          <button type="button" className="cp-btn cp-btn-rot" onClick={() => void handleDelete(product.id)}>
                            Delete
                          </button>
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            marginTop: 6,
                            color: 'var(--color-muted-fg, #6b7280)',
                          }}
                        >
                          {fileAssignments.length === 0
                            ? '—'
                            : fileAssignments
                                .map(
                                  assignment =>
                                    orderFiles.find(file => file.id === assignment.fileId)?.display_name ?? assignment.fileId,
                                )
                                .join(', ')}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function FieldRow({ label, content, error, children }: { label: string; content?: React.ReactNode; error?: string; children?: React.ReactNode }) {
  const body = content ?? children
  return (
    <div className="ber-zeile">
      <span className="ber-lbl">{label}</span>
      <div>
        {body}
        {error && <p className="ber-err">{error}</p>}
      </div>
    </div>
  )
}

function QuantityInput(props: DetailBlockProps) {
  const { detail, fieldErrorClass, validationErrors, shouldValidate, patchLocal, commit } = props
  const rawQuantity = detail.stueckzahl
  let numForInput: number | '' = ''
  if (typeof rawQuantity === 'number' && Number.isInteger(rawQuantity) && rawQuantity >= 1) numForInput = rawQuantity
  else if (typeof rawQuantity === 'string' && (rawQuantity as string).trim() !== '') {
    const parsed = parseInt(rawQuantity as string, 10)
    if (Number.isInteger(parsed) && parsed >= 1) numForInput = parsed
  }
  return (
    <FieldRow label="Quantity" error={shouldValidate && validationErrors.stueckzahl ? validationErrors.stueckzahl : undefined}>
      <input
        type="number"
        className={'ber-inp' + fieldErrorClass('stueckzahl')}
        value={numForInput}
        onChange={e => {
          const inputValue = e.target.value
          patchLocal({ stueckzahl: inputValue === '' ? null : parseInt(inputValue, 10) } as LaserDetailJson)
        }}
        onBlur={commit}
        min={1}
      />
    </FieldRow>
  )
}

function BooleanSelect(props: DetailBlockProps & { fieldKey: string; label: string }) {
  const { fieldKey, detail, fieldErrorClass, validationErrors, shouldValidate, applyDetail, label } = props
  const rawValue = (detail as Record<string, unknown>)[fieldKey]
  const selectValue = rawValue === true ? 'true' : rawValue === false ? 'false' : ''
  return (
    <FieldRow label={label} error={shouldValidate ? validationErrors[fieldKey] : undefined}>
      <select
        className={'ber-inp' + fieldErrorClass(fieldKey)}
        value={selectValue}
        onChange={e => {
          const selected = e.target.value
          const boolValue: true | false | undefined = selected === 'true' ? true : selected === 'false' ? false : undefined
          applyDetail({ ...detail, [fieldKey]: boolValue } as LaserDetailJson)
        }}
      >
        <option value="">—</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    </FieldRow>
  )
}

function TextField(
  props: DetailBlockProps & { fieldKey: string; label: string; rows?: number; optional?: boolean },
) {
  const { fieldKey, label, detail, fieldErrorClass, validationErrors, shouldValidate, patchLocal, commit, rows = 1, optional } = props
  const fieldValue = String((detail as Record<string, string>)[fieldKey] ?? '')
  const errorMessage = shouldValidate && validationErrors[fieldKey] && !optional ? validationErrors[fieldKey] : undefined
  return (
    <FieldRow label={label} error={errorMessage}>
      {rows > 1 ? (
        <textarea
          className={'ber-inp' + (shouldValidate && validationErrors[fieldKey] && !optional ? fieldErrorClass(fieldKey) : '')}
          rows={rows}
          value={fieldValue}
          onChange={e => patchLocal({ [fieldKey]: e.target.value } as LaserDetailJson)}
          onBlur={commit}
        />
      ) : (
        <input
          type="text"
          className={'ber-inp' + (shouldValidate && validationErrors[fieldKey] && !optional ? fieldErrorClass(fieldKey) : '')}
          value={fieldValue}
          onChange={e => patchLocal({ [fieldKey]: e.target.value } as LaserDetailJson)}
          onBlur={commit}
        />
      )}
    </FieldRow>
  )
}

function DimensionInputsMm(props: DetailBlockProps) {
  const { detail, fieldErrorClass, validationErrors, shouldValidate, patchLocal, commit } = props
  const errorMessage = shouldValidate ? validationErrors.format_masse : undefined
  const detailRecord = detail as Record<string, number | null | undefined>
  const width = detailRecord.format_breite
  const height = detailRecord.format_hoehe
  const widthValue = width === null || width === undefined ? '' : String(width)
  const heightValue = height === null || height === undefined ? '' : String(height)
  return (
    <div>
      <div className="ber-zeile">
        <span className="ber-lbl">Width (mm)</span>
        <div>
          <input
            type="number"
            className={'ber-inp' + fieldErrorClass('format_masse')}
            min={1}
            step={1}
            value={widthValue}
            onChange={e => {
              const raw = e.target.value
              const parsed = raw === '' ? null : parseInt(raw, 10)
              patchLocal({
                format_breite: parsed === null || Number.isNaN(parsed) ? null : parsed,
              } as LaserDetailJson)
            }}
            onBlur={commit}
          />
        </div>
      </div>
      <div className="ber-zeile">
        <span className="ber-lbl">Height (mm)</span>
        <div>
          <input
            type="number"
            className={'ber-inp' + fieldErrorClass('format_masse')}
            min={1}
            step={1}
            value={heightValue}
            onChange={e => {
              const raw = e.target.value
              const parsed = raw === '' ? null : parseInt(raw, 10)
              patchLocal({
                format_hoehe: parsed === null || Number.isNaN(parsed) ? null : parsed,
              } as LaserDetailJson)
            }}
            onBlur={commit}
          />
        </div>
      </div>
      {errorMessage && <p className="ber-err">{errorMessage}</p>}
    </div>
  )
}

function SignGroup({ props, signType }: { props: DetailBlockProps; signType: string }) {
  const { detail, fieldErrorClass, validationErrors, shouldValidate, patchLocal, commit, applyDetail } = props
  const detailRecord = detail as Record<string, string | null | boolean | number | undefined>
  const material = String(detailRecord.material ?? '')
  return (
    <>
      <FieldRow
        label="Material"
        error={shouldValidate && (validationErrors.material || validationErrors.material_sonstige) ? validationErrors.material || validationErrors.material_sonstige : undefined}
        content={
          <div>
            <select
              className={'ber-inp' + fieldErrorClass('material')}
              value={material}
              onChange={e => {
                const selected = e.target.value
                applyDetail({
                  ...detail,
                  material: selected || null,
                  material_sonstige: selected === 'SONSTIGE' ? detailRecord.material_sonstige : null,
                } as LaserDetailJson)
              }}
            >
              <option value="">—</option>
              {LASER_SIGN_MATERIALS.map(signMaterial => (
                <option key={signMaterial} value={signMaterial}>
                  {LASER_SIGN_MATERIAL_LABELS[signMaterial]}
                </option>
              ))}
            </select>
            {material === 'SONSTIGE' && (
              <div style={{ marginTop: 8 }}>
                <input
                  type="text"
                  className={'ber-inp' + fieldErrorClass('material_sonstige')}
                  placeholder="Material (free text)"
                  value={String(detailRecord.material_sonstige ?? '')}
                  onChange={e => patchLocal({ material_sonstige: e.target.value || null } as LaserDetailJson)}
                  onBlur={commit}
                />
              </div>
            )}
          </div>
        }
      />
      <DimensionInputsMm {...props} />
      {BooleanSelect({ ...props, fieldKey: 'ecken_runden', label: 'Round corners' })}
      {signType !== 'NAME_TAG' && BooleanSelect({ ...props, fieldKey: 'selbstklebend', label: 'Self-adhesive' })}
      <TextField {...props} fieldKey="motiv" label="Motif / Content" rows={5} />
    </>
  )
}

function GiftGroup({ props }: { props: DetailBlockProps }) {
  const { detail, fieldErrorClass, validationErrors, shouldValidate, applyDetail } = props
  const detailRecord = detail as Record<string, string>
  return (
    <>
      <TextField {...props} fieldKey="material_freitext" label="Material" rows={2} />
      <FieldRow
        label="Origin"
        error={shouldValidate && validationErrors.herkunft ? validationErrors.herkunft : undefined}
        content={
          <select
            className={'ber-inp' + fieldErrorClass('herkunft')}
            value={detailRecord.herkunft ?? ''}
            onChange={e =>
              applyDetail({ ...detail, herkunft: e.target.value || null } as LaserDetailJson)
            }
          >
            <option value="">—</option>
            {LASER_ORIGINS.map(origin => (
              <option key={origin} value={origin}>
                {LASER_ORIGIN_LABELS[origin]}
              </option>
            ))}
          </select>
        }
      />
      <TextField {...props} fieldKey="motiv" label="Motif / Content" rows={5} />
    </>
  )
}

function OtherLaserGroup({ props }: { props: DetailBlockProps }) {
  const { detail, fieldErrorClass, validationErrors, shouldValidate, applyDetail } = props
  const detailRecord = detail as Record<string, string>
  return (
    <>
      <TextField {...props} fieldKey="material_freitext" label="Material (optional)" optional rows={2} />
      {BooleanSelect({ ...props, fieldKey: 'selbstklebend', label: 'Self-adhesive' })}
      <FieldRow
        label="Origin"
        error={shouldValidate && validationErrors.herkunft ? validationErrors.herkunft : undefined}
        content={
          <select
            className={'ber-inp' + fieldErrorClass('herkunft')}
            value={detailRecord.herkunft ?? ''}
            onChange={e =>
              applyDetail({ ...detail, herkunft: e.target.value || null } as LaserDetailJson)
            }
          >
            <option value="">—</option>
            {LASER_ORIGINS.map(origin => (
              <option key={origin} value={origin}>
                {LASER_ORIGIN_LABELS[origin]}
              </option>
            ))}
          </select>
        }
      />
      <TextField {...props} fieldKey="motiv" label="Motif / Content" rows={5} />
    </>
  )
}
