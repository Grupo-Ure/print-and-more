import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { subOrderProductService } from '../../services/subOrderProductService'
import type { LoadedProduct, ProductWriteInput } from '../../types/product'
import {
  LASER_ORIGINS,
  LASER_ORIGIN_LABELS,
  LASER_SIGN_MATERIALS,
  LASER_SIGN_MATERIAL_LABELS,
  LASER_TYPES,
  LASER_TYPE_LABELS,
} from '../../types/laser'
import { validateProduct } from '../../lib/products/registry'
import type { OrderStatus, SubOrderRow } from '../../types/database'
import type { FileRow } from '../../services/fileService'
import { useToast } from '../Toast'
import '../WorkArea.css'

type Props = {
  subOrder: SubOrderRow
  subOrderStatus: OrderStatus
  orderFiles?: FileRow[]
  onProductsChanged?: (hasProducts: boolean) => void
}

/**
 * Flat form state: the English child columns plus the parent `quantity`.
 * (`notes`/`type` live in dedicated state, not in this record.)
 */
type LaserFields = Record<string, unknown>

type ProductRow = {
  id: string
  type: string
  quantity: number | null
  notes: string | null
  child: Record<string, unknown>
  sort_order: number | null
  created_at: string | null
}

type DetailBlockProps = {
  fields: LaserFields
  fieldErrorClass: (fieldKey: string) => string
  shouldValidate: boolean
  validationErrors: Record<string, string>
  patchLocal: (patch: LaserFields) => void
  commit: () => void
  applyFields: (newFields: LaserFields) => void
}

const SIGN_TYPES = new Set(['SIGN', 'TROPHY_PLATE', 'NAME_TAG'])

type ProductFileAssignment = { assignmentId: string; fileId: string }

export function LaserDetail({
  subOrder,
  subOrderStatus,
  orderFiles = [],
  onProductsChanged,
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
  const [fields, setFields] = useState<LaserFields>({})
  const fieldsRef = useRef(fields)
  const typeRef = useRef(selectedType)
  useEffect(() => {
    fieldsRef.current = fields
  }, [fields])
  useEffect(() => {
    typeRef.current = selectedType
  }, [selectedType])

  useEffect(() => {
    setEditingId(null)
    setFormFileRecordIds([])
    setUnlocked(false)
    setSelectedType(null)
    setFields({})
    fieldsRef.current = {}
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
        const list = next[row.department_product_id] ?? (next[row.department_product_id] = [])
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
    let rows: LoadedProduct[]
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
      type: row.type,
      quantity: row.quantity,
      notes: row.notes,
      child: (row.child ?? {}) as Record<string, unknown>,
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
    setFields({})
    fieldsRef.current = {}
    typeRef.current = null
  }, [])

  const validationErrors = validateProduct(selectedType, { ...fields, quantity: fields.quantity }, subOrderStatus)
  const shouldValidate = subOrderStatus !== 'QUOTE'
  const fieldErrorClass = (fieldKey: string) => (shouldValidate && validationErrors[fieldKey] ? ' ber-inp--err' : '')

  const saveFields = useCallback(
    (nextType: string | null, next: LaserFields) => {
      let prepared: LaserFields = next
      if (nextType === 'NAME_TAG' && next && typeof next === 'object') {
        prepared = { ...next }
        delete (prepared as Record<string, unknown>).self_adhesive
      }
      setFields(prepared)
      fieldsRef.current = prepared
      setSelectedType(nextType)
    },
    []
  )

  const patchLocal = useCallback((patch: LaserFields) => {
    setFields(currentFields => {
      const merged = { ...currentFields, ...patch }
      fieldsRef.current = merged
      return merged
    })
  }, [])

  const commit = useCallback(() => {
    void saveFields(typeRef.current, { ...fieldsRef.current })
  }, [saveFields])

  const applyFields = useCallback(
    (newFields: LaserFields) => {
      setFields(newFields)
      fieldsRef.current = newFields
      void saveFields(typeRef.current, newFields)
    },
    [saveFields]
  )

  const detailBlock: DetailBlockProps = { fields, fieldErrorClass, shouldValidate, validationErrors, patchLocal, commit, applyFields }

  const formOk = useMemo(() => Object.keys(validationErrors).length === 0, [validationErrors])

  const requiresUnlock =
    (subOrderStatus === 'PREPRESS_READY' || subOrderStatus === 'PRODUCTION_READY') && !unlocked

  /**
   * Build the typed child column object for the given type from the flat
   * form state. `quantity` is a parent column and is not part of the child.
   */
  const buildChild = useCallback((type: string, src: LaserFields): Record<string, unknown> => {
    const f = src as Record<string, unknown>
    if (type === 'SIGN' || type === 'TROPHY_PLATE') {
      return {
        motif: f.motif ?? null,
        material: f.material ?? null,
        material_other: f.material === 'SONSTIGE' ? (f.material_other ?? null) : null,
        width: f.width ?? null,
        height: f.height ?? null,
        round_corners: f.round_corners ?? null,
        self_adhesive: f.self_adhesive ?? null,
      }
    }
    if (type === 'NAME_TAG') {
      return {
        motif: f.motif ?? null,
        material: f.material ?? null,
        material_other: f.material === 'SONSTIGE' ? (f.material_other ?? null) : null,
        width: f.width ?? null,
        height: f.height ?? null,
        round_corners: f.round_corners ?? null,
      }
    }
    if (type === 'GIFT_ITEM') {
      return {
        motif: f.motif ?? null,
        material_free_text: f.material_free_text ?? null,
        origin: f.origin ?? null,
      }
    }
    // OTHER_LASER
    return {
      motif: f.motif ?? null,
      material_free_text: f.material_free_text ?? null,
      origin: f.origin ?? null,
      self_adhesive: f.self_adhesive ?? null,
    }
  }, [])

  const handleAddOrSave = useCallback(async () => {
    const currentType = typeRef.current
    const currentFields = { ...fieldsRef.current }
    if (!currentType) return
    const errors = validateProduct(currentType, { ...currentFields, quantity: currentFields.quantity }, subOrderStatus)
    if (Object.keys(errors).length > 0) return

    const rawQuantity = currentFields.quantity
    const quantity =
      typeof rawQuantity === 'number'
        ? rawQuantity
        : rawQuantity == null || rawQuantity === ''
          ? null
          : parseInt(String(rawQuantity), 10)

    if (editingId) {
      const input: ProductWriteInput = {
        id: editingId,
        department_order_id: subOrder.id,
        department: 'LASER_ENGRAVING',
        type: currentType,
        quantity: Number.isNaN(quantity as number) ? null : quantity,
        notes: null,
        sort_order: products.find(p => p.id === editingId)?.sort_order ?? products.length,
        child: buildChild(currentType, currentFields) as ProductWriteInput['child'],
      }
      try {
        await subOrderProductService.updateProduct(editingId, input)
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
      const list = await reloadProducts()
      onProductsChanged?.(list.length > 0)
      resetForm()
      return
    }

    const input: ProductWriteInput = {
      department_order_id: subOrder.id,
      department: 'LASER_ENGRAVING',
      type: currentType,
      quantity: Number.isNaN(quantity as number) ? null : quantity,
      notes: null,
      sort_order: products.length,
      child: buildChild(currentType, currentFields) as ProductWriteInput['child'],
    }
    let newId: string
    try {
      newId = await subOrderProductService.createProduct(input)
    } catch {
      showError('Product could not be added')
      return
    }
    const list = await reloadProducts()
    for (const fid of formFileRecordIds) {
      await assignFileToProduct(newId, fid, list)
    }
    const finalList = await reloadProducts()
    onProductsChanged?.(finalList.length > 0)
    resetForm()
  }, [
    subOrder,
    subOrderStatus,
    editingId,
    products,
    productFiles,
    formFileRecordIds,
    showError,
    reloadProducts,
    resetForm,
    assignFileToProduct,
    removeFileFromProduct,
    onProductsChanged,
    buildChild,
  ])

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await subOrderProductService.deleteProduct(id)
      } catch {
        showError('Product could not be deleted')
        return
      }
      const list = await reloadProducts()
      onProductsChanged?.(list.length > 0)
      if (editingId === id) resetForm()
    },
    [showError, reloadProducts, editingId, resetForm, onProductsChanged]
  )

  const handleEdit = useCallback((row: ProductRow) => {
    setEditingId(row.id)
    setFormFileRecordIds(productFiles[row.id]?.map(assignment => assignment.fileId) ?? [])
    const rowType = row.type || null
    setSelectedType(rowType)
    const nextFields: LaserFields = { ...(row.child ?? {}), quantity: row.quantity }
    setFields(nextFields)
    fieldsRef.current = nextFields
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
        error={shouldValidate && validationErrors.type ? validationErrors.type : undefined}
        content={
          <select
            className={'ber-inp' + fieldErrorClass('type')}
            value={selectedType ?? ''}
            onChange={e => {
              const selected = e.target.value
              if (selected !== (selectedType ?? '')) {
                setSelectedType(selected || null)
                setFields({})
                fieldsRef.current = {}
                typeRef.current = selected || null
                if (editingId === null) void saveFields(selected || null, {})
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
                    Motif
                  </th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {products.map(product => {
                  const child = product.child ?? {}
                  const productType = product.type ?? ''
                  const quantity = product.quantity ?? ''
                  const rawMaterial = child.material ?? child.material_free_text
                  const material = rawMaterial != null ? String(rawMaterial) : '—'
                  const motif = child.motif != null ? String(child.motif).slice(0, 48) : '—'
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
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{motif}</td>
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
  const { fields, fieldErrorClass, validationErrors, shouldValidate, patchLocal, commit } = props
  const rawQuantity = fields.quantity
  let numForInput: number | '' = ''
  if (typeof rawQuantity === 'number' && Number.isInteger(rawQuantity) && rawQuantity >= 1) numForInput = rawQuantity
  else if (typeof rawQuantity === 'string' && (rawQuantity as string).trim() !== '') {
    const parsed = parseInt(rawQuantity as string, 10)
    if (Number.isInteger(parsed) && parsed >= 1) numForInput = parsed
  }
  return (
    <FieldRow label="Quantity" error={shouldValidate && validationErrors.quantity ? validationErrors.quantity : undefined}>
      <input
        type="number"
        className={'ber-inp' + fieldErrorClass('quantity')}
        value={numForInput}
        onChange={e => {
          const inputValue = e.target.value
          patchLocal({ quantity: inputValue === '' ? null : parseInt(inputValue, 10) })
        }}
        onBlur={commit}
        min={1}
      />
    </FieldRow>
  )
}

function BooleanSelect(props: DetailBlockProps & { fieldKey: string; label: string }) {
  const { fieldKey, fields, fieldErrorClass, validationErrors, shouldValidate, applyFields, label } = props
  const rawValue = (fields as Record<string, unknown>)[fieldKey]
  const selectValue = rawValue === true ? 'true' : rawValue === false ? 'false' : ''
  return (
    <FieldRow label={label} error={shouldValidate ? validationErrors[fieldKey] : undefined}>
      <select
        className={'ber-inp' + fieldErrorClass(fieldKey)}
        value={selectValue}
        onChange={e => {
          const selected = e.target.value
          const boolValue: true | false | undefined = selected === 'true' ? true : selected === 'false' ? false : undefined
          applyFields({ ...fields, [fieldKey]: boolValue })
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
  const { fieldKey, label, fields, fieldErrorClass, validationErrors, shouldValidate, patchLocal, commit, rows = 1, optional } = props
  const fieldValue = String((fields as Record<string, unknown>)[fieldKey] ?? '')
  const errorMessage = shouldValidate && validationErrors[fieldKey] && !optional ? validationErrors[fieldKey] : undefined
  return (
    <FieldRow label={label} error={errorMessage}>
      {rows > 1 ? (
        <textarea
          className={'ber-inp' + (shouldValidate && validationErrors[fieldKey] && !optional ? fieldErrorClass(fieldKey) : '')}
          rows={rows}
          value={fieldValue}
          onChange={e => patchLocal({ [fieldKey]: e.target.value })}
          onBlur={commit}
        />
      ) : (
        <input
          type="text"
          className={'ber-inp' + (shouldValidate && validationErrors[fieldKey] && !optional ? fieldErrorClass(fieldKey) : '')}
          value={fieldValue}
          onChange={e => patchLocal({ [fieldKey]: e.target.value })}
          onBlur={commit}
        />
      )}
    </FieldRow>
  )
}

function DimensionInputsMm(props: DetailBlockProps) {
  const { fields, fieldErrorClass, validationErrors, shouldValidate, patchLocal, commit } = props
  const errorMessage = shouldValidate ? validationErrors.format : undefined
  const fieldsRecord = fields as Record<string, number | null | undefined>
  const width = fieldsRecord.width
  const height = fieldsRecord.height
  const widthValue = width === null || width === undefined ? '' : String(width)
  const heightValue = height === null || height === undefined ? '' : String(height)
  return (
    <div>
      <div className="ber-zeile">
        <span className="ber-lbl">Width (mm)</span>
        <div>
          <input
            type="number"
            className={'ber-inp' + fieldErrorClass('format')}
            min={1}
            step={1}
            value={widthValue}
            onChange={e => {
              const raw = e.target.value
              const parsed = raw === '' ? null : parseInt(raw, 10)
              patchLocal({
                width: parsed === null || Number.isNaN(parsed) ? null : parsed,
              })
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
            className={'ber-inp' + fieldErrorClass('format')}
            min={1}
            step={1}
            value={heightValue}
            onChange={e => {
              const raw = e.target.value
              const parsed = raw === '' ? null : parseInt(raw, 10)
              patchLocal({
                height: parsed === null || Number.isNaN(parsed) ? null : parsed,
              })
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
  const { fields, fieldErrorClass, validationErrors, shouldValidate, patchLocal, commit, applyFields } = props
  const fieldsRecord = fields as Record<string, string | null | boolean | number | undefined>
  const material = String(fieldsRecord.material ?? '')
  return (
    <>
      <FieldRow
        label="Material"
        error={shouldValidate && (validationErrors.material || validationErrors.material_other) ? validationErrors.material || validationErrors.material_other : undefined}
        content={
          <div>
            <select
              className={'ber-inp' + fieldErrorClass('material')}
              value={material}
              onChange={e => {
                const selected = e.target.value
                applyFields({
                  ...fields,
                  material: selected || null,
                  material_other: selected === 'SONSTIGE' ? fieldsRecord.material_other : null,
                })
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
                  className={'ber-inp' + fieldErrorClass('material_other')}
                  placeholder="Material (free text)"
                  value={String(fieldsRecord.material_other ?? '')}
                  onChange={e => patchLocal({ material_other: e.target.value || null })}
                  onBlur={commit}
                />
              </div>
            )}
          </div>
        }
      />
      <DimensionInputsMm {...props} />
      {BooleanSelect({ ...props, fieldKey: 'round_corners', label: 'Round corners' })}
      {signType !== 'NAME_TAG' && BooleanSelect({ ...props, fieldKey: 'self_adhesive', label: 'Self-adhesive' })}
      <TextField {...props} fieldKey="motif" label="Motif / Content" rows={5} />
    </>
  )
}

function GiftGroup({ props }: { props: DetailBlockProps }) {
  const { fields, fieldErrorClass, validationErrors, shouldValidate, applyFields } = props
  const fieldsRecord = fields as Record<string, string>
  return (
    <>
      <TextField {...props} fieldKey="material_free_text" label="Material" rows={2} />
      <FieldRow
        label="Origin"
        error={shouldValidate && validationErrors.origin ? validationErrors.origin : undefined}
        content={
          <select
            className={'ber-inp' + fieldErrorClass('origin')}
            value={fieldsRecord.origin ?? ''}
            onChange={e =>
              applyFields({ ...fields, origin: e.target.value || null })
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
      <TextField {...props} fieldKey="motif" label="Motif / Content" rows={5} />
    </>
  )
}

function OtherLaserGroup({ props }: { props: DetailBlockProps }) {
  const { fields, fieldErrorClass, validationErrors, shouldValidate, applyFields } = props
  const fieldsRecord = fields as Record<string, string>
  return (
    <>
      <TextField {...props} fieldKey="material_free_text" label="Material (optional)" optional rows={2} />
      {BooleanSelect({ ...props, fieldKey: 'self_adhesive', label: 'Self-adhesive' })}
      <FieldRow
        label="Origin"
        error={shouldValidate && validationErrors.origin ? validationErrors.origin : undefined}
        content={
          <select
            className={'ber-inp' + fieldErrorClass('origin')}
            value={fieldsRecord.origin ?? ''}
            onChange={e =>
              applyFields({ ...fields, origin: e.target.value || null })
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
      <TextField {...props} fieldKey="motif" label="Motif / Content" rows={5} />
    </>
  )
}
