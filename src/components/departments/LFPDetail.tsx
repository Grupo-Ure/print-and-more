import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { LFP_TYPE_LABELS, LFP_TYPES } from '../../types/lfp'
import { validateLfpDetail } from '../../lib/lfp/validateLfpDetail'
import type { OrderStatus, SubOrderRow } from '../../types/database'
import { subOrderProductService } from '../../services/subOrderProductService'
import type { LoadedProduct, ProductChildInsert, ProductWriteInput } from '../../types/product'
import {
  LFP_3551_VARIANTEN,
  LFP_AUFKLEBER_MATERIALIEN,
  LFP_FOLIENPLOTT_MATERIALIEN,
} from '../../config/materialien'
import type { FileRow } from '../../services/fileService'
import { DateInput } from '../DateInput'
import { useToast } from '../Toast'
import '../WorkArea.css'

/**
 * Form state for the LFP product mask: the English child columns plus the
 * parent `quantity` and `notes`. The stored enum VALUE strings stay German
 * (FREIFORM, NEIN, MATT, MIT, …); only the keys are English.
 */
type Fields = Record<string, unknown>

type ProductRow = {
  id: string
  sub_order_id: string
  department: string
  type: string
  quantity: number | null
  notes: string | null
  fields: Fields
  sort_order: number | null
  created_at: string | null
}

type Props = {
  subOrder: SubOrderRow
  subOrderStatus: OrderStatus
  orderFiles?: FileRow[]
  onProductsChanged?: (hasProducts: boolean) => void
}

type DetailBlockProps = {
  detail: Fields
  fieldErrorClass: (fieldKey: string) => string
  shouldValidate: boolean
  validationErrors: Record<string, string>
  patchLocal: (patch: Fields) => void
  commit: () => void
  applyDetail: (newDetail: Fields) => void
}

type ProductFileAssignment = { assignmentId: string; fileId: string }

/** Build the typed child insert (English columns) for a given type from form fields. */
function buildChild(type: string, fields: Fields): ProductChildInsert {
  const pick = (keys: string[]): Record<string, unknown> => {
    const out: Record<string, unknown> = {}
    for (const key of keys) out[key] = fields[key] ?? null
    return out
  }
  let child: Record<string, unknown>
  switch (type) {
    case 'STICKER':
      child = pick(['material', 'material_variant', 'contour_cut', 'laminate', 'output', 'width', 'height'])
      break
    case 'SIGN_UV':
      child = pick([
        'material', 'print_side', 'acrylic_print_direction', 'width', 'height',
        'round_corners', 'drill_holes', 'drill_hole_diameter', 'drill_hole_position',
      ])
      break
    case 'SIGN_FOIL':
      child = pick([
        'material', 'laminate', 'print_side', 'width', 'height',
        'round_corners', 'drill_holes', 'drill_hole_diameter', 'drill_hole_position',
      ])
      break
    case 'FOIL_PLOTTER':
      child = pick(['material', 'output', 'width', 'height'])
      break
    case 'BANNER':
      child = pick(['material', 'width', 'height', 'hem', 'hem_sides', 'eyelets', 'eyelet_detail'])
      break
    case 'ROLLUP':
      child = pick(['material', 'rollup_system', 'rollup_width'])
      break
    case 'VEHICLE_LETTERING':
      child = pick([
        'vehicle_make', 'vehicle_model', 'area_sides', 'area_front', 'area_rear',
        'installation', 'existing_wrap', 'installation_date',
      ])
      break
    case 'OTHER_LFP':
      child = pick(['description'])
      break
    default:
      child = {}
  }
  return child as ProductChildInsert
}

export function LFPDetail({
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
  const [detail, setDetail] = useState<Fields>({})
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
    const mapped: ProductRow[] = rows.map(row => {
      const child = { ...(row.child as Record<string, unknown>) }
      delete child.department_product_id
      return {
        id: row.id,
        sub_order_id: row.department_order_id,
        department: row.department,
        type: row.type,
        quantity: row.quantity,
        notes: row.notes,
        fields: child,
        sort_order: row.sort_order,
        created_at: row.created_at,
      }
    })
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

  const validationErrors = validateLfpDetail(selectedType, detail, subOrderStatus)
  const shouldValidate = subOrderStatus !== 'QUOTE'
  const fieldErrorClass = (fieldKey: string) => (shouldValidate && validationErrors[fieldKey] ? ' ber-inp--err' : '')

  const saveDetail = useCallback(
    (nextType: string | null, json: Fields) => {
      setDetail(json)
      detailRef.current = json
      setSelectedType(nextType)
    },
    []
  )

  const patchLocal = useCallback((patch: Fields) => {
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
    (newDetail: Fields) => {
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
    const currentFields = { ...detailRef.current }
    if (!currentType) return
    const errors = validateLfpDetail(currentType, currentFields, subOrderStatus)
    if (Object.keys(errors).length > 0) return

    const quantity =
      currentFields.quantity == null || currentFields.quantity === ''
        ? null
        : Number(currentFields.quantity)
    const notesRaw = currentFields.notes
    const notes = typeof notesRaw === 'string' && notesRaw.trim() !== '' ? notesRaw : null

    if (editingId) {
      const input: ProductWriteInput = {
        id: editingId,
        department_order_id: subOrder.id,
        department: 'LFP',
        type: currentType,
        quantity,
        notes,
        sort_order: products.find(p => p.id === editingId)?.sort_order ?? products.length,
        child: buildChild(currentType, currentFields),
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
      department: 'LFP',
      type: currentType,
      quantity,
      notes,
      sort_order: products.length,
      child: buildChild(currentType, currentFields),
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
    const cleanFields: Fields = { ...row.fields, quantity: row.quantity, notes: row.notes ?? '' }
    setDetail(cleanFields)
    detailRef.current = cleanFields
    typeRef.current = rowType
  }, [productFiles])

  return (
    <div className="ber-lfp td-bereich-sect">
      <div className="td-bereich-hd" aria-hidden>
        LFP
      </div>
      {selectedType === 'OTHER_LFP' && (
        <p className="ber-hinweis">For "Other (LFP)" sub-orders, PREPRESS_READY is set manually only, not automatically.</p>
      )}
      {selectedType === 'SIGN_FOIL' && detail.material === 'ACRYLGLAS' && (
        <p className="ber-hinweis">For acrylic glass: rear lamination included, no extra field needed.</p>
      )}

      <div className="ber-grid-2" style={{ marginTop: 4 }}>
        <FieldRow
          stack
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
              {LFP_TYPES.map(lfpType => (
                <option key={lfpType} value={lfpType}>
                  {LFP_TYPE_LABELS[lfpType]}
                </option>
              ))}
            </select>
          }
        />
        <QuantityInput {...detailBlock} stack />
      </div>

      {selectedType === 'STICKER' && <StickerSection {...detailBlock} />}
      {selectedType === 'SIGN_UV' && <UvSignSection {...detailBlock} />}
      {selectedType === 'SIGN_FOIL' && <FoilSignSection {...detailBlock} />}
      {selectedType === 'FOIL_PLOTTER' && <FoilPlottSection {...detailBlock} />}
      {selectedType === 'BANNER' && <BannerSection {...detailBlock} />}
      {selectedType === 'ROLLUP' && <RollupSection {...detailBlock} />}
      {selectedType === 'VEHICLE_LETTERING' && <VehicleWrapSection {...detailBlock} />}
      {selectedType === 'OTHER_LFP' && <OtherSection {...detailBlock} />}

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
                    Format
                  </th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {products.map(product => {
                  const productFields = product.fields
                  const productType = product.type
                  const quantity = product.quantity ?? ''
                  const material = productFields.material ?? '—'
                  const formatWidth = productFields.width
                  const formatHeight = productFields.height
                  const formatDisplay = formatWidth && formatHeight ? `${formatWidth}×${formatHeight} mm` : '—'
                  const typeLabel = (LFP_TYPE_LABELS as Record<string, string>)[productType] ?? productType
                  const fileAssignments = productFiles[product.id] ?? []
                  return (
                    <tr key={product.id}>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>
                        {typeLabel || '—'}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>
                        {String(quantity || '—')}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{String(material)}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{formatDisplay}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="cp-btn cp-btn-grau"
                            onClick={() => handleEdit(product)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="cp-btn cp-btn-rot"
                            onClick={() => void handleDelete(product.id)}
                          >
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

function FieldRow({
  label,
  content,
  error,
  children,
  stack,
}: {
  label: string
  content?: ReactNode
  error?: string
  children?: ReactNode
  stack?: boolean
}) {
  const body = content ?? children
  return (
    <div className={stack ? 'ber-zeile-stack' : 'ber-zeile'}>
      <span className="ber-lbl">{label}</span>
      <div>
        {body}
        {error && <p className="ber-err">{error}</p>}
      </div>
    </div>
  )
}

function QuantityInput(props: DetailBlockProps & { stack?: boolean }) {
  const { detail, fieldErrorClass, validationErrors, shouldValidate, patchLocal, commit, stack } = props
  const rawQuantity = detail.quantity
  const displayValue = rawQuantity === null || rawQuantity === undefined ? '' : String(rawQuantity)
  return (
    <FieldRow stack={stack} label="Quantity" error={shouldValidate && validationErrors.quantity ? validationErrors.quantity : undefined}>
      <input
        type="number"
        className={'ber-inp' + fieldErrorClass('quantity')}
        min={1}
        step={1}
        value={displayValue}
        onChange={e => {
          const rawInput = e.target.value
          patchLocal({
            quantity: rawInput === '' ? null : parseInt(rawInput, 10),
          })
        }}
        onBlur={commit}
      />
    </FieldRow>
  )
}

function SelectField(
  props: DetailBlockProps & { fieldKey: string; label?: string; options: { value: string; text: string }[]; stack?: boolean },
) {
  const { fieldKey, options, detail, fieldErrorClass, validationErrors, shouldValidate, applyDetail, label: labelText, stack } = props
  return (
    <FieldRow stack={stack} label={labelText ?? fieldKey} error={shouldValidate ? validationErrors[fieldKey] : undefined}>
      <select
        className={'ber-inp' + fieldErrorClass(fieldKey)}
        value={String((detail as Record<string, string>)[fieldKey] ?? '')}
        onChange={e => {
          const selected = e.target.value
          applyDetail({ ...detail, [fieldKey]: selected })
        }}
      >
        <option value="">—</option>
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.text}
          </option>
        ))}
      </select>
    </FieldRow>
  )
}

function BooleanSelect(props: DetailBlockProps & { fieldKey: string; label?: string }) {
  const { fieldKey, detail, fieldErrorClass, validationErrors, shouldValidate, applyDetail, label: labelText } = props
  const rawValue = (detail as Record<string, unknown>)[fieldKey]
  const selectValue = rawValue === true ? 'true' : rawValue === false ? 'false' : ''
  return (
    <FieldRow label={labelText ?? fieldKey} error={shouldValidate ? validationErrors[fieldKey] : undefined}>
      <select
        className={'ber-inp' + fieldErrorClass(fieldKey)}
        value={selectValue}
        onChange={e => {
          const selected = e.target.value
          const boolValue: true | false | undefined = selected === 'true' ? true : selected === 'false' ? false : undefined
          applyDetail({ ...detail, [fieldKey]: boolValue })
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
  props: DetailBlockProps & { fieldKey: string; label: string; rows?: number },
) {
  const { fieldKey, label, detail, fieldErrorClass, validationErrors, shouldValidate, patchLocal, commit, rows = 1 } = props
  const fieldValue = String((detail as Record<string, string>)[fieldKey] ?? '')
  return (
    <FieldRow label={label} error={shouldValidate ? validationErrors[fieldKey] : undefined}>
      {rows > 1 ? (
        <textarea
          className={'ber-inp ber-ta' + fieldErrorClass(fieldKey)}
          rows={rows}
          value={fieldValue}
          onChange={e => patchLocal({ [fieldKey]: e.target.value })}
          onBlur={commit}
        />
      ) : (
        <input
          type="text"
          className={'ber-inp' + fieldErrorClass(fieldKey)}
          value={fieldValue}
          onChange={e => patchLocal({ [fieldKey]: e.target.value })}
          onBlur={commit}
        />
      )}
    </FieldRow>
  )
}

function IntegerInput(
  props: DetailBlockProps & { fieldKey: string; label: string; suffix?: string; errorKey?: string; min?: number },
) {
  const { fieldKey, label, detail, fieldErrorClass, validationErrors, shouldValidate, patchLocal, commit, suffix, errorKey, min = 1 } = props
  const errorFieldKey = errorKey ?? fieldKey
  const rawValue = (detail as Record<string, number | null | string>)[fieldKey]
  const displayValue = rawValue === null || rawValue === undefined ? '' : String(rawValue)
  return (
    <FieldRow label={label} error={shouldValidate ? validationErrors[errorFieldKey] : undefined}>
      <div className="ber-nmb">
        <input
          type="number"
          className={'ber-inp' + fieldErrorClass(errorFieldKey)}
          min={min}
          step={1}
          value={displayValue}
          onChange={e => {
            const rawInput = e.target.value
            const parsedValue = rawInput === '' ? null : parseInt(rawInput, 10)
            patchLocal({ [fieldKey]: Number.isNaN(parsedValue as number) ? null : parsedValue })
          }}
          onBlur={commit}
        />
        {suffix && <span className="ber-suf">{suffix}</span>}
      </div>
    </FieldRow>
  )
}

/** Width/Height: at least one > 0 — shared error `format` */
function DimensionInputs(props: DetailBlockProps) {
  const { detail, fieldErrorClass, validationErrors, shouldValidate, patchLocal, commit } = props
  const errorMsg = shouldValidate ? validationErrors.format : undefined
  const widthValue = detail.width
  const heightValue = detail.height
  const widthDisplay = widthValue === null || widthValue === undefined ? '' : String(widthValue)
  const heightDisplay = heightValue === null || heightValue === undefined ? '' : String(heightValue)
  return (
    <div>
      <div className="ber-grid-2">
        <div className="ber-zeile-stack">
          <span className="ber-lbl">Width (mm)</span>
          <div>
            <input
              type="number"
              className={'ber-inp' + fieldErrorClass('format')}
              min={0.01}
              step={0.01}
              value={widthDisplay}
              onChange={e => {
                const rawInput = e.target.value
                patchLocal({
                  width: rawInput === '' ? null : parseFloat(rawInput),
                })
              }}
              onBlur={commit}
            />
          </div>
        </div>
        <div className="ber-zeile-stack">
          <span className="ber-lbl">Height (mm)</span>
          <div>
            <input
              type="number"
              className={'ber-inp' + fieldErrorClass('format')}
              min={0.01}
              step={0.01}
              value={heightDisplay}
              onChange={e => {
                const rawInput = e.target.value
                patchLocal({
                  height: rawInput === '' ? null : parseFloat(rawInput),
                })
              }}
              onBlur={commit}
            />
          </div>
        </div>
      </div>
      {errorMsg && <p className="ber-err ber-err--mass">{errorMsg}</p>}
    </div>
  )
}

function DateField(props: DetailBlockProps & { fieldKey: string; label: string }) {
  const { fieldKey, label, detail, fieldErrorClass, validationErrors, shouldValidate, patchLocal, commit } = props
  const dateValue = (detail as Record<string, string>)[fieldKey] ?? ''
  const isoValue = dateValue ? (dateValue.length > 10 ? dateValue.slice(0, 10) : dateValue) : ''
  return (
    <FieldRow label={label} error={shouldValidate ? validationErrors[fieldKey] : undefined}>
      <DateInput
        className={'ber-inp' + fieldErrorClass(fieldKey)}
        value={isoValue}
        onChange={e => patchLocal({ [fieldKey]: e.target.value })}
        onBlur={commit}
      />
    </FieldRow>
  )
}

function NotesField(props: DetailBlockProps) {
  return <TextField {...props} fieldKey="notes" label="Notes" rows={3} />
}

function StickerSection(props: DetailBlockProps) {
  const { detail, fieldErrorClass, validationErrors, shouldValidate, applyDetail } = props
  return (
    <>
      <div className="ber-grid-2">
        <FieldRow stack label="Material" error={shouldValidate ? validationErrors.material : undefined}>
          <select
            className={'ber-inp' + fieldErrorClass('material')}
            value={String((detail as Record<string, string>).material ?? '')}
            onChange={e => {
              const selected = e.target.value
              const updatedDetail: Fields = { ...detail, material: selected }
              if (selected !== '3551') updatedDetail.material_variant = null
              applyDetail(updatedDetail)
            }}
          >
            <option value="">—</option>
            {LFP_AUFKLEBER_MATERIALIEN.map(stickerMaterial => (
              <option key={stickerMaterial.wert} value={stickerMaterial.wert}>
                {stickerMaterial.anzeige}
              </option>
            ))}
          </select>
        </FieldRow>
        <SelectField
          {...props}
          stack
          fieldKey="contour_cut"
          label="Contour cut"
          options={[
            { value: 'FREIFORM', text: 'Freeform' },
            { value: 'RECHTECK', text: 'Rectangle' },
          ]}
        />
      </div>
      {props.detail.material === '3551' && (
        <div className="ber-col-voll" style={{ marginBottom: 6 }}>
          <FieldRow stack label="3551 Variant">
            <select
              className="ber-inp"
              value={String((detail as Record<string, string | null>).material_variant ?? '')}
              onChange={e =>
                applyDetail({
                  ...detail,
                  material_variant: e.target.value || null,
                })
              }
            >
              {LFP_3551_VARIANTEN.map(variant => (
                <option key={String(variant.wert)} value={String(variant.wert ?? '')}>
                  {variant.anzeige}
                </option>
              ))}
            </select>
          </FieldRow>
        </div>
      )}
      <div className="ber-grid-2">
        <SelectField
          {...props}
          stack
          fieldKey="laminate"
          label="Laminate"
          options={[
            { value: 'NEIN', text: 'No' },
            { value: 'MATT', text: 'Matte' },
            { value: 'GLAENZEND', text: 'Glossy' },
          ]}
        />
        <SelectField
          {...props}
          stack
          fieldKey="output"
          label="Output"
          options={[
            { value: 'EINZEL', text: 'Single' },
            { value: 'BOGEN', text: 'Sheet' },
          ]}
        />
      </div>
      <DimensionInputs {...props} />
      <NotesField {...props} />
    </>
  )
}

function UvSignSection(props: DetailBlockProps) {
  return (
    <>
      <div className="ber-grid-2">
        <SelectField
          {...props}
          stack
          fieldKey="material"
          label="Material"
          options={[
            { value: 'ALUVERBUND', text: 'Alu-Composite' },
            { value: 'PVC', text: 'PVC' },
            { value: 'ACRYLGLAS', text: 'Acrylic glass' },
          ]}
        />
        <SelectField
          {...props}
          stack
          fieldKey="print_side"
          label="Print side"
          options={[
            { value: 'EINSEITIG', text: 'Single-sided' },
            { value: 'BEIDSEITIG', text: 'Double-sided' },
          ]}
        />
      </div>
      {props.detail.material === 'ACRYLGLAS' && (
        <SelectField
          {...props}
          fieldKey="acrylic_print_direction"
          label="Acrylic print direction"
          options={[
            { value: 'VORDERSEITE', text: 'Front' },
            { value: 'RUECKSEITE', text: 'Back' },
          ]}
        />
      )}
      <DimensionInputs {...props} />
      {BooleanSelect({ ...props, fieldKey: 'round_corners', label: 'Round corners' })}
      {BooleanSelect({ ...props, fieldKey: 'drill_holes', label: 'Drill holes' })}
      {props.detail.drill_holes === true && (
        <>
          <IntegerInput {...props} fieldKey="drill_hole_diameter" label="Drill diameter Ø (mm)" errorKey="drill_hole_diameter" min={1} />
          <TextField {...props} fieldKey="drill_hole_position" label="Drill hole position" />
        </>
      )}
      <NotesField {...props} />
    </>
  )
}

function FoilSignSection(props: DetailBlockProps) {
  return (
    <>
      <div className="ber-grid-2">
        <SelectField
          {...props}
          stack
          fieldKey="material"
          label="Material"
          options={[
            { value: 'ALUVERBUND', text: 'Alu-Composite' },
            { value: 'PVC', text: 'PVC' },
            { value: 'ACRYLGLAS', text: 'Acrylic glass' },
          ]}
        />
        <SelectField
          {...props}
          stack
          fieldKey="print_side"
          label="Print side"
          options={[
            { value: 'EINSEITIG', text: 'Single-sided' },
            { value: 'BEIDSEITIG', text: 'Double-sided' },
          ]}
        />
      </div>
      <div style={{ maxWidth: '20rem' }}>
        <SelectField
          {...props}
          stack
          fieldKey="laminate"
          label="Laminate"
          options={[
            { value: 'NEIN', text: 'No' },
            { value: 'MATT', text: 'Matte' },
            { value: 'GLAENZEND', text: 'Glossy' },
          ]}
        />
      </div>
      <DimensionInputs {...props} />
      {BooleanSelect({ ...props, fieldKey: 'round_corners', label: 'Round corners' })}
      {BooleanSelect({ ...props, fieldKey: 'drill_holes', label: 'Drill holes' })}
      {props.detail.drill_holes === true && (
        <>
          <IntegerInput {...props} fieldKey="drill_hole_diameter" label="Drill diameter Ø (mm)" errorKey="drill_hole_diameter" min={1} />
          <TextField {...props} fieldKey="drill_hole_position" label="Drill hole position" />
        </>
      )}
      <NotesField {...props} />
    </>
  )
}

function FoilPlottSection(props: DetailBlockProps) {
  return (
    <>
      <div className="ber-grid-2">
        <SelectField
          {...props}
          stack
          fieldKey="material"
          label="Material"
          options={LFP_FOLIENPLOTT_MATERIALIEN.map(foilMaterial => ({ value: foilMaterial.wert, text: foilMaterial.anzeige }))}
        />
        <SelectField
          {...props}
          stack
          fieldKey="output"
          label="Output"
          options={[
            { value: 'EINZEL', text: 'Single' },
            { value: 'BOGEN', text: 'Sheet' },
          ]}
        />
      </div>
      <NotesField {...props} />
    </>
  )
}

function BannerSection(props: DetailBlockProps) {
  const { detail, fieldErrorClass, validationErrors, shouldValidate, applyDetail } = props
  return (
    <>
      <FieldRow label="Material" error={shouldValidate ? validationErrors.material : undefined}>
        <select
          className={'ber-inp' + fieldErrorClass('material')}
          value={String(detail.material ?? '')}
          onChange={e => {
            const materialValue = e.target.value
            if (materialValue === 'BAUZAUNBANNER') {
              applyDetail({
                ...detail,
                material: 'BAUZAUNBANNER',
                height: 1730,
                width: 3400,
                hem: true,
                eyelets: true,
              })
            } else {
              applyDetail({ ...detail, material: materialValue })
            }
          }}
        >
          <option value="">—</option>
          {(['PVC_FRONTLIT', 'MESH', 'BAUZAUNBANNER'] as const).map(bannerMaterial => {
            const materialLabel =
              bannerMaterial === 'PVC_FRONTLIT' ? 'PVC Frontlit' : bannerMaterial === 'MESH' ? 'Mesh' : 'Construction fence banner'
            return (
              <option key={bannerMaterial} value={bannerMaterial}>
                {materialLabel}
              </option>
            )
          })}
        </select>
      </FieldRow>
      <DimensionInputs {...props} />
      {BooleanSelect({ ...props, fieldKey: 'hem', label: 'Hem' })}
      {props.detail.hem === true && <TextField {...props} fieldKey="hem_sides" label="Hem (sides)" />}
      {BooleanSelect({ ...props, fieldKey: 'eyelets', label: 'Eyelets' })}
      {props.detail.eyelets === true && <TextField {...props} fieldKey="eyelet_detail" label="Eyelet detail" />}
      <NotesField {...props} />
    </>
  )
}

function RollupSection(props: DetailBlockProps) {
  const rollupWidth = (props.detail as Record<string, number>).rollup_width
  return (
    <>
      <SelectField
        {...props}
        fieldKey="material"
        label="Material"
        options={[
          { value: 'PVC_FRONTLIT', text: 'PVC Frontlit' },
          { value: 'ROLLUP_FILM', text: 'Roll-up Film' },
        ]}
      />
      <SelectField
        {...props}
        fieldKey="rollup_system"
        label="System"
        options={[
          { value: 'NEUE_KASSETTE', text: 'New cassette' },
          { value: 'MOTIVTAUSCH', text: 'Motif swap' },
        ]}
      />
      <FieldRow label="Width" error={props.shouldValidate ? props.validationErrors.rollup_width : undefined}>
        <select
          className={'ber-inp' + props.fieldErrorClass('rollup_width')}
          value={rollupWidth === 85 || rollupWidth === 100 ? String(rollupWidth) : ''}
          onChange={e => {
            const widthValue = e.target.value === '' ? null : parseInt(e.target.value, 10)
            props.applyDetail({ ...props.detail, rollup_width: widthValue })
          }}
        >
          <option value="">—</option>
          <option value="85">85 cm</option>
          <option value="100">100 cm</option>
        </select>
      </FieldRow>
      <NotesField {...props} />
    </>
  )
}

function VehicleWrapSection(props: DetailBlockProps) {
  const { detail, fieldErrorClass, validationErrors, shouldValidate, applyDetail } = props
  return (
    <>
      <TextField {...props} fieldKey="vehicle_make" label="Make" />
      <TextField {...props} fieldKey="vehicle_model" label="Model" />
      {BooleanSelect({ ...props, fieldKey: 'area_sides', label: 'Side panels' })}
      {BooleanSelect({ ...props, fieldKey: 'area_front', label: 'Front area' })}
      {BooleanSelect({ ...props, fieldKey: 'area_rear', label: 'Rear area' })}
      <FieldRow label="Installation" error={shouldValidate ? validationErrors.installation : undefined}>
        <select
          className={'ber-inp' + fieldErrorClass('installation')}
          value={String((detail as Record<string, string>).installation ?? '')}
          onChange={e => {
            const installationValue = e.target.value
            if (installationValue === 'OHNE') {
              applyDetail({
                ...detail,
                installation: 'OHNE',
                installation_date: null,
                existing_wrap: null,
              })
            } else {
              applyDetail({ ...detail, installation: installationValue })
            }
          }}
        >
          <option value="">—</option>
          <option value="MIT">With</option>
          <option value="OHNE">Without</option>
        </select>
      </FieldRow>
      {detail.installation === 'MIT' && BooleanSelect({ ...props, fieldKey: 'existing_wrap', label: 'Existing wrap' })}
      {detail.installation === 'MIT' && <DateField {...props} fieldKey="installation_date" label="Installation date" />}
      <NotesField {...props} />
    </>
  )
}

function OtherSection(props: DetailBlockProps) {
  return <TextField {...props} fieldKey="description" label="Description" rows={6} />
}
