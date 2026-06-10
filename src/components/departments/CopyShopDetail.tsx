import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { subOrderProductService } from '../../services/subOrderProductService'
import type { LoadedProduct, ProductChildInsert, ProductWriteInput } from '../../types/product'
import { COPY_SHOP_TYPES, COPY_SHOP_TYPE_LABELS, type CopyShopDetailJson } from '../../types/copyshop'
import { BROCHURE_DIN, FOLD_DIN, CARD_DIN, CARD_FORMAT_ORDER, FOLD_FORMAT_ORDER, BROCHURE_FORMAT_ORDER } from '../../lib/copyshop/dinCfbFormats'
import { validateProduct } from '../../lib/products/registry'
import type { OrderStatus, SubOrderRow } from '../../types/database'
import type { FileRow } from '../../services/fileService'
import { useToast } from '../Toast'
import { MaterialCC } from './copyshop/MaterialCC'
import { MaterialOffset } from './copyshop/MaterialOffset'
import {
  AUSDRUCK_MATERIALIEN,
  BINDUNG_MATERIALIEN,
  MULTILOFT_FARBKERNE,
  POSTER_MATERIALIEN,
  VISITENKARTE_MATERIALIEN,
} from '../../config/materialien'
import '../WorkArea.css'

type Props = {
  subOrder: SubOrderRow
  subOrderStatus: OrderStatus
  orderFiles?: FileRow[]
  onProductsChanged?: (hasProducts: boolean) => void
}

/**
 * Local form state: a flat record of the English child columns for the active
 * type, plus the parent `quantity`. Notes are kept in the same record under
 * `notes` for editing convenience; the SAVE split routes `quantity` → parent
 * `quantity` and `notes` → parent `notes`, everything else → the typed child.
 */
type FormState = CopyShopDetailJson

type ProductRow = {
  id: string
  department: string
  type: string
  quantity: number | null
  notes: string | null
  /** English child columns (the typed per-type row, minus the PK). */
  child: Record<string, unknown>
  sort_order: number | null
}

/** Child columns per CopyShop type (English) — drives the SAVE whitelist. */
const CHILD_COLUMNS_BY_TYPE: Record<string, readonly string[]> = {
  POSTER: ['format', 'width', 'height', 'material', 'laminate'],
  CARD_FLYER: [
    'format', 'width', 'height', 'color_mode', 'full_bleed', 'production_path',
    'cc_material', 'cc_material_other', 'offset_type', 'offset_weight', 'offset_finish',
    'special_paper', 'special_paper_other', 'lamination_finish', 'lamination_sides', 'recycling_weight',
  ],
  FOLDED_FLYER: [
    'format', 'width', 'height', 'color_mode', 'full_bleed', 'production_path',
    'cc_material', 'cc_material_other', 'offset_type', 'offset_weight', 'offset_finish',
    'special_paper', 'special_paper_other', 'lamination_finish', 'lamination_sides', 'recycling_weight',
    'fold_type', 'page_count',
  ],
  BROCHURE: [
    'format', 'width', 'height', 'orientation', 'page_count', 'full_bleed', 'production_path',
    'cover_material', 'cover_material_other', 'inner_material', 'inner_material_other',
    'binding', 'cover_weight', 'cover_finish', 'inner_weight', 'inner_finish',
  ],
  BUSINESS_CARD: [
    'format', 'width', 'height', 'orientation', 'color_mode', 'material',
    'film_laminated', 'multiloft_color', 'full_bleed',
  ],
  BINDING: [
    'format', 'width', 'height', 'orientation', 'material', 'material_other', 'color_mode',
    'binding_type', 'binding_color', 'full_bleed', 'hardcover_print', 'hardcover_cover',
  ],
  PRINTOUT: ['format', 'material', 'material_other', 'color_mode', 'punching', 'staple', 'laminate'],
}

/** Build the typed child insert payload for a type from the flat form state. */
function buildChild(type: string, form: FormState): ProductChildInsert {
  const allowed = CHILD_COLUMNS_BY_TYPE[type] ?? []
  const record = form as Record<string, unknown>
  const child: Record<string, unknown> = {}
  for (const key of allowed) {
    const value = record[key]
    child[key] = value === undefined ? null : value
  }
  return child as ProductChildInsert
}

const POSTER_DIN: Record<'A0' | 'A1' | 'A2' | 'A3' | 'A4', { b: number; h: number }> = {
  A4: { b: 210, h: 297 },
  A3: { b: 297, h: 420 },
  A2: { b: 420, h: 594 },
  A1: { b: 594, h: 841 },
  A0: { b: 841, h: 1189 },
}

const POSTER_DEFAULT: FormState = {
  format: 'A1',
  width: 594,
  height: 841,
}

const CARD_FOLD_MATERIAL_RESET: FormState = {
  cc_material: null,
  cc_material_other: null,
  offset_type: null,
  offset_weight: null,
  offset_finish: null,
  special_paper: null,
  special_paper_other: null,
  lamination_finish: null,
  lamination_sides: null,
  recycling_weight: null,
}

const BROCHURE_MATERIAL_RESET: FormState = {
  ...CARD_FOLD_MATERIAL_RESET,
  cover_material: null,
  cover_material_other: null,
  inner_material: null,
  inner_material_other: null,
  binding: null,
  cover_weight: null,
  cover_finish: null,
  inner_weight: null,
  inner_finish: null,
}

type DetailBlockProps = {
  detail: FormState
  fieldErrorClass: (fieldKey: string) => string
  shouldValidate: boolean
  validationErrors: Record<string, string>
  patchLocal: (patch: FormState) => void
  commit: () => void
  applyDetail: (newDetail: FormState) => void
}

type ProductFileAssignment = { assignmentId: string; fileId: string } // assignmentId = product_files.id

export function CopyShopDetail({
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
  const [detail, setDetail] = useState<FormState>({})
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
      const { department_product_id: _pk, ...child } = (row.child ?? {}) as Record<string, unknown>
      void _pk
      return {
        id: row.id,
        department: row.department,
        type: row.type,
        quantity: row.quantity,
        notes: row.notes,
        child,
        sort_order: row.sort_order,
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

  const validationErrors = validateProduct(selectedType, detail, subOrderStatus)
  const shouldValidate = subOrderStatus !== 'QUOTE'
  const fieldErrorClass = (fieldKey: string) => (shouldValidate && validationErrors[fieldKey] ? ' ber-inp--err' : '')

  const saveDetail = useCallback(
    (nextType: string | null, form: FormState) => {
      setDetail(form)
      detailRef.current = form
      setSelectedType(nextType)
    },
    []
  )

  const patchLocal = useCallback((patch: FormState) => {
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
    (newDetail: FormState) => {
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
    const currentDetail = { ...detailRef.current } as Record<string, unknown>
    if (!currentType) return
    const errors = validateProduct(currentType, currentDetail, subOrderStatus)
    if (Object.keys(errors).length > 0) return

    const quantityRaw = currentDetail.quantity
    const quantity =
      quantityRaw == null || quantityRaw === ''
        ? null
        : typeof quantityRaw === 'number'
          ? quantityRaw
          : parseInt(String(quantityRaw), 10)
    const notesRaw = currentDetail.notes
    const notes = notesRaw == null || String(notesRaw).trim() === '' ? null : String(notesRaw)

    if (editingId) {
      const input: ProductWriteInput = {
        id: editingId,
        department_order_id: subOrder.id,
        department: 'COPYSHOP',
        type: currentType,
        quantity,
        notes,
        sort_order: products.find(p => p.id === editingId)?.sort_order ?? products.length,
        child: buildChild(currentType, currentDetail),
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
      department: 'COPYSHOP',
      type: currentType,
      quantity,
      notes,
      sort_order: products.length,
      child: buildChild(currentType, currentDetail),
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
    // Flatten child columns + parent quantity/notes into the form state.
    const formState: FormState = { ...row.child, quantity: row.quantity, notes: row.notes }
    setDetail(formState)
    detailRef.current = formState
    typeRef.current = rowType
  }, [productFiles])

  useEffect(() => {
    if (selectedType !== 'BINDING') return
    const currentDetail = detailRef.current
    const detailRecord = currentDetail as Record<string, string | number | null | boolean | undefined>
    const bindingType = String(detailRecord.binding_type ?? '')
    if (bindingType === 'SOFTCOVER' || bindingType === 'HARDCOVER') {
      if (detailRecord.format === 'A4_HOCH') {
        applyDetail({
          ...currentDetail,
          format: 'A4',
          orientation: 'HOCHFORMAT',
          width: 210,
          height: 297,
        } as FormState)
        return
      }
      if (
        detailRecord.format !== 'A4' ||
        detailRecord.orientation !== 'HOCHFORMAT' ||
        detailRecord.width !== 210 ||
        detailRecord.height !== 297
      ) {
        applyDetail({
          ...currentDetail,
          format: 'A4',
          orientation: 'HOCHFORMAT',
          width: 210,
          height: 297,
        } as FormState)
      }
    } else if (bindingType === 'WIRE_O' || bindingType === 'KUNSTSTOFFSPIRALE') {
      const formatStr = String(detailRecord.format ?? '')
      const legacyFormatMap: Record<string, { format: string; orientation: string }> = {
        A5_HOCH: { format: 'A5', orientation: 'HOCHFORMAT' },
        A4_HOCH: { format: 'A4', orientation: 'HOCHFORMAT' },
        A3_QUER: { format: 'A3', orientation: 'QUERFORMAT' },
      }
      if (formatStr in legacyFormatMap) {
        const mappedFormat = legacyFormatMap[formatStr]!
        applyDetail({ ...currentDetail, format: mappedFormat.format, orientation: mappedFormat.orientation } as FormState)
        return
      }
      if (formatStr === 'A3' && detailRecord.orientation !== 'QUERFORMAT') {
        applyDetail({ ...currentDetail, orientation: 'QUERFORMAT' } as FormState)
      }
    }
  }, [selectedType, subOrder.id, detail, applyDetail])

  useEffect(() => {
    if (selectedType !== 'POSTER') return
    const currentDetail = detailRef.current
    const formatStr = String((currentDetail as Record<string, string>).format ?? '').trim()
    if (!formatStr) {
      applyDetail({ ...currentDetail, ...POSTER_DEFAULT } as FormState)
      return
    }
    if (formatStr !== 'FREI' && formatStr in POSTER_DIN) {
      const dinDimensions = POSTER_DIN[formatStr as keyof typeof POSTER_DIN]
      const currentWidth = currentDetail.width
      const currentHeight = currentDetail.height
      if (currentWidth !== dinDimensions.b || currentHeight !== dinDimensions.h) {
        applyDetail({ ...currentDetail, format: formatStr, width: dinDimensions.b, height: dinDimensions.h } as FormState)
      }
    }
  }, [selectedType, subOrder.id, detail, applyDetail])

  useEffect(() => {
    if (selectedType === 'CARD_FLYER') {
      const currentDetail = detailRef.current
      const formatStr = String((currentDetail as Record<string, string>).format ?? '').trim()
      if (formatStr && formatStr !== 'FREI' && formatStr in CARD_DIN) {
        const dinDimensions = CARD_DIN[formatStr as keyof typeof CARD_DIN]
        if (currentDetail.width !== dinDimensions.b || currentDetail.height !== dinDimensions.h) {
          applyDetail({ ...currentDetail, format: formatStr, width: dinDimensions.b, height: dinDimensions.h } as FormState)
        }
      }
    } else if (selectedType === 'FOLDED_FLYER') {
      const currentDetail = detailRef.current
      const formatStr = String((currentDetail as Record<string, string>).format ?? '').trim()
      if (formatStr && formatStr !== 'FREI' && formatStr in FOLD_DIN) {
        const dinDimensions = FOLD_DIN[formatStr as keyof typeof FOLD_DIN]
        if (currentDetail.width !== dinDimensions.b || currentDetail.height !== dinDimensions.h) {
          applyDetail({ ...currentDetail, format: formatStr, width: dinDimensions.b, height: dinDimensions.h } as FormState)
        }
      }
    } else if (selectedType === 'BROCHURE') {
      const currentDetail = detailRef.current
      const formatStr = String((currentDetail as Record<string, string>).format ?? '').trim()
      if (formatStr && formatStr !== 'FREI' && formatStr in BROCHURE_DIN) {
        const dinDimensions = BROCHURE_DIN[formatStr as keyof typeof BROCHURE_DIN]
        if (currentDetail.width !== dinDimensions.b || currentDetail.height !== dinDimensions.h) {
          applyDetail({ ...currentDetail, format: formatStr, width: dinDimensions.b, height: dinDimensions.h } as FormState)
        }
      }
      if (String(currentDetail.production_path) === 'CC' && currentDetail.binding !== 'DRAHTHEFTUNG') {
        applyDetail({ ...currentDetail, binding: 'DRAHTHEFTUNG' } as FormState)
      }
    }
  }, [selectedType, subOrder.id, detail, applyDetail])

  return (
    <div className="ber-lfp">
      <h3 className="ber-h3">Copy Shop Details</h3>

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
                if (selected === 'POSTER') {
                  setSelectedType('POSTER')
                  setDetail(POSTER_DEFAULT)
                  detailRef.current = POSTER_DEFAULT
                  typeRef.current = 'POSTER'
                  if (editingId === null) void saveDetail('POSTER', { ...POSTER_DEFAULT } as FormState)
                } else {
                  setSelectedType(selected || null)
                  setDetail({})
                  detailRef.current = {}
                  typeRef.current = selected || null
                  if (editingId === null) void saveDetail(selected || null, {})
                }
              } else {
                setSelectedType(selected || null)
                typeRef.current = selected || null
              }
            }}
          >
            <option value="">—</option>
            {COPY_SHOP_TYPES.map(copyShopType => (
              <option key={copyShopType} value={copyShopType}>
                {COPY_SHOP_TYPE_LABELS[copyShopType]}
              </option>
            ))}
          </select>
        }
      />

      <QuantityInput {...detailBlock} />
      {selectedType &&
        selectedType !== 'POSTER' &&
        selectedType !== 'PRINTOUT' &&
        selectedType !== 'CARD_FLYER' &&
        selectedType !== 'FOLDED_FLYER' &&
        selectedType !== 'BROCHURE' &&
        selectedType !== 'BUSINESS_CARD' &&
        selectedType !== 'BINDING' && <ProductionPathSelect {...detailBlock} />}

      {selectedType === 'POSTER' && <PlakatPoster {...detailBlock} />}
      {selectedType === 'CARD_FLYER' && <CardFlyerSection {...detailBlock} />}
      {selectedType === 'FOLDED_FLYER' && <FoldFlyerSection {...detailBlock} />}
      {selectedType === 'BROCHURE' && <BrochureSection {...detailBlock} />}
      {selectedType === 'BUSINESS_CARD' && <BusinessCardSection {...detailBlock} />}
      {selectedType === 'BINDING' && <BindingSection {...detailBlock} />}
      {selectedType === 'PRINTOUT' && <PrintSection {...detailBlock} />}

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
                  title="Entfernen"
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
                    Process / Material
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
                  const child = product.child
                  const productType = product.type
                  const quantity = product.quantity ?? ''
                  const productionPath = child.production_path != null ? String(child.production_path) : ''
                  const material = child.material != null ? String(child.material) : ''
                  const shortPath = productionPath || material || '—'
                  const formatWidth = child.width
                  const formatHeight = child.height
                  const formatDisplay = formatWidth && formatHeight ? `${formatWidth}×${formatHeight} mm` : '—'
                  const typeLabel =
                    (COPY_SHOP_TYPE_LABELS as Record<string, string>)[productType] ?? productType
                  const fileAssignments = productFiles[product.id] ?? []
                  return (
                    <tr key={product.id}>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>
                        {typeLabel || '—'}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>
                        {String(quantity || '—')}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{shortPath}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{formatDisplay}</td>
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
  const quantity = detail.quantity
  const inputValue = quantity === null || quantity === undefined ? '' : String(quantity)
  return (
    <FieldRow label="Quantity" error={shouldValidate && validationErrors.quantity ? validationErrors.quantity : undefined}>
      <input
        type="number"
        className={'ber-inp' + fieldErrorClass('quantity')}
        min={1}
        step={1}
        value={inputValue}
        onChange={e => {
          const raw = e.target.value
          patchLocal({
            quantity: raw === '' ? null : parseInt(raw, 10),
          } as FormState)
        }}
        onBlur={commit}
      />
    </FieldRow>
  )
}

function ProductionPathSelect(props: DetailBlockProps) {
  const { detail, fieldErrorClass, validationErrors, shouldValidate, applyDetail } = props
  const productionPath = (detail.production_path as string | null | undefined) ?? ''
  return (
    <FieldRow label="Process" error={shouldValidate && validationErrors.production_path ? validationErrors.production_path : undefined}>
      <select
        className={'ber-inp' + fieldErrorClass('production_path')}
        value={productionPath}
        onChange={e => {
          const selected = e.target.value
          applyDetail({ ...detail, production_path: selected === '' ? null : selected } as FormState)
        }}
      >
        <option value="">—</option>
        <option value="COPYSHOP">Copy Shop</option>
        <option value="OFFSET">Offset</option>
      </select>
    </FieldRow>
  )
}

function SelectField(
  props: DetailBlockProps & { fieldKey: string; label?: string; options: { value: string; text: string }[] },
) {
  const { fieldKey, options, detail, fieldErrorClass, validationErrors, shouldValidate, applyDetail, label } = props
  return (
    <FieldRow label={label ?? fieldKey} error={shouldValidate ? validationErrors[fieldKey] : undefined}>
      <select
        className={'ber-inp' + fieldErrorClass(fieldKey)}
        value={String((detail as Record<string, string>)[fieldKey] ?? '')}
        onChange={e =>
          applyDetail({ ...detail, [fieldKey]: e.target.value } as FormState)
        }
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
  const { fieldKey, detail, fieldErrorClass, validationErrors, shouldValidate, applyDetail, label } = props
  const rawValue = (detail as Record<string, unknown>)[fieldKey]
  const selectValue = rawValue === true ? 'true' : rawValue === false ? 'false' : ''
  return (
    <FieldRow label={label ?? fieldKey} error={shouldValidate ? validationErrors[fieldKey] : undefined}>
      <select
        className={'ber-inp' + fieldErrorClass(fieldKey)}
        value={selectValue}
        onChange={e => {
          const selected = e.target.value
          const boolValue: true | false | undefined = selected === 'true' ? true : selected === 'false' ? false : undefined
          applyDetail({ ...detail, [fieldKey]: boolValue } as FormState)
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
          onChange={e => patchLocal({ [fieldKey]: e.target.value } as FormState)}
          onBlur={commit}
        />
      ) : (
        <input
          type="text"
          className={'ber-inp' + fieldErrorClass(fieldKey)}
          value={fieldValue}
          onChange={e => patchLocal({ [fieldKey]: e.target.value } as FormState)}
          onBlur={commit}
        />
      )}
    </FieldRow>
  )
}

function DimensionInputs(props: DetailBlockProps) {
  const { detail, fieldErrorClass, validationErrors, shouldValidate, patchLocal, commit } = props
  const errorMessage = shouldValidate ? validationErrors.format_masse : undefined
  const width = detail.width
  const height = detail.height
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
            min={0.01}
            step={0.01}
            value={widthValue}
            onChange={e => {
              const raw = e.target.value
              patchLocal({
                width: raw === '' ? null : parseFloat(raw),
              } as FormState)
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
            min={0.01}
            step={0.01}
            value={heightValue}
            onChange={e => {
              const raw = e.target.value
              patchLocal({
                height: raw === '' ? null : parseFloat(raw),
              } as FormState)
            }}
            onBlur={commit}
          />
        </div>
      </div>
      {errorMessage && <p className="ber-err ber-err--mass">{errorMessage}</p>}
    </div>
  )
}

function NotesField(props: DetailBlockProps) {
  return <TextField {...props} fieldKey="notes" label="Notes" rows={3} />
}

function PlakatPoster(props: DetailBlockProps) {
  const { detail, fieldErrorClass, validationErrors, shouldValidate, applyDetail } = props
  const formatStr = String((detail as Record<string, string>).format ?? '')
  return (
    <>
      <FieldRow label="Format" error={shouldValidate && validationErrors.format ? validationErrors.format : undefined}>
        <select
          className={'ber-inp' + fieldErrorClass('format')}
          value={formatStr}
          onChange={e => {
            const selected = e.target.value
            if (selected === 'FREI') {
              applyDetail({ ...detail, format: 'FREI' } as FormState)
            } else if (selected in POSTER_DIN) {
              const dinDimensions = POSTER_DIN[selected as keyof typeof POSTER_DIN]
              applyDetail({
                ...detail,
                format: selected,
                width: dinDimensions.b,
                height: dinDimensions.h,
              } as FormState)
            } else {
              applyDetail({ ...detail, format: selected || null } as FormState)
            }
          }}
        >
          <option value="">—</option>
          {(['A4', 'A3', 'A2', 'A1', 'A0'] as const).map(size => {
            const dinDimensions = POSTER_DIN[size]
            return (
              <option key={size} value={size}>
                {size} ({dinDimensions.b}×{dinDimensions.h} mm)
              </option>
            )
          })}
          <option value="FREI">Free</option>
        </select>
      </FieldRow>
      <SelectField
        {...props}
        fieldKey="material"
        label="Material"
        options={POSTER_MATERIALIEN.map(posterMaterial => ({ value: posterMaterial.wert, text: posterMaterial.anzeige }))}
      />
      <SelectField
        {...props}
        fieldKey="laminate"
        label="Laminate"
        options={[
          { value: 'NEIN', text: 'No' },
          { value: 'MATT', text: 'Matte' },
          { value: 'GLAENZEND', text: 'Glossy' },
        ]}
      />
      {formatStr === 'FREI' && <DimensionInputs {...props} />}
      <NotesField {...props} />
    </>
  )
}

function FormatDinSelect(props: {
  block: DetailBlockProps
  din: Record<string, { b: number; h: number }>
  order: readonly string[]
}) {
  const { block, din, order } = props
  const { detail, fieldErrorClass, validationErrors, shouldValidate, applyDetail } = block
  const formatStr = String((detail as Record<string, string>).format ?? '')
  return (
    <FieldRow label="Format" error={shouldValidate && validationErrors.format ? validationErrors.format : undefined}>
      <select
        className={'ber-inp' + fieldErrorClass('format')}
        value={formatStr}
        onChange={e => {
          const selected = e.target.value
          if (selected === 'FREI') applyDetail({ ...detail, format: 'FREI' } as FormState)
          else if (selected in din) {
            const dinDimensions = din[selected]!
            applyDetail({
              ...detail,
              format: selected,
              width: dinDimensions.b,
              height: dinDimensions.h,
            } as FormState)
          } else {
            applyDetail({ ...detail, format: selected || null } as FormState)
          }
        }}
      >
        <option value="">—</option>
        {order.map(formatKey => {
          if (formatKey === 'FREI') {
            return (
              <option key="FREI" value="FREI">
                Free
              </option>
            )
          }
          const dinDimensions = din[formatKey]
          if (!dinDimensions) return null
          return (
            <option key={formatKey} value={formatKey}>
              {formatKey} ({dinDimensions.b}×{dinDimensions.h} mm)
            </option>
          )
        })}
      </select>
    </FieldRow>
  )
}

function CardFoldProductionPathSelect({ block }: { block: DetailBlockProps }) {
  const { detail, fieldErrorClass, validationErrors, shouldValidate, applyDetail } = block
  const productionPath = String((detail as Record<string, string>).production_path ?? '')
  return (
    <FieldRow label="Process" error={shouldValidate && validationErrors.production_path ? validationErrors.production_path : undefined}>
      <select
        className={'ber-inp' + fieldErrorClass('production_path')}
        value={productionPath}
        onChange={e => {
          const selected = e.target.value
          applyDetail({
            ...detail,
            production_path: selected || null,
            ...CARD_FOLD_MATERIAL_RESET,
          } as FormState)
        }}
      >
        <option value="">—</option>
        <option value="CC">CC</option>
        <option value="OFFSET">Offset</option>
        <option value="OFFEN">Open</option>
      </select>
    </FieldRow>
  )
}

function BrochureProductionPathSelect({ block }: { block: DetailBlockProps }) {
  const { detail, fieldErrorClass, validationErrors, shouldValidate, applyDetail } = block
  const productionPath = String((detail as Record<string, string>).production_path ?? '')
  return (
    <FieldRow label="Process" error={shouldValidate && validationErrors.production_path ? validationErrors.production_path : undefined}>
      <select
        className={'ber-inp' + fieldErrorClass('production_path')}
        value={productionPath}
        onChange={e => {
          const selected = e.target.value
          if (selected === 'CC') {
            applyDetail({
              ...detail,
              production_path: 'CC',
              ...BROCHURE_MATERIAL_RESET,
              binding: 'DRAHTHEFTUNG',
            } as FormState)
          } else {
            applyDetail({
              ...detail,
              production_path: selected || null,
              ...BROCHURE_MATERIAL_RESET,
            } as FormState)
          }
        }}
      >
        <option value="">—</option>
        <option value="CC">CC</option>
        <option value="OFFSET">Offset</option>
        <option value="OFFEN">Open</option>
      </select>
    </FieldRow>
  )
}

function BrochureOffsetFields(props: DetailBlockProps) {
  return (
    <>
      <SelectField
        {...props}
        fieldKey="binding"
        label="Binding"
        options={[
          { value: 'DRAHTHEFTUNG', text: 'Staple binding' },
          { value: 'RINGSÖSEN', text: 'Ring binder' },
          { value: 'KLEBEBINDUNG', text: 'Perfect binding' },
          { value: 'SPIRALBINDUNG', text: 'Spiral binding' },
        ]}
      />
      <SelectField
        {...props}
        fieldKey="cover_weight"
        label="Cover weight"
        options={['135G', '170G', '250G', '300G'].map(weight => ({ value: weight, text: weight }))}
      />
      <SelectField
        {...props}
        fieldKey="cover_finish"
        label="Cover finish"
        options={[
          { value: 'MATT', text: 'Matte' },
          { value: 'GLAENZEND', text: 'Glossy' },
        ]}
      />
      <SelectField
        {...props}
        fieldKey="inner_weight"
        label="Content weight"
        options={['90G', '135G', '170G'].map(weight => ({ value: weight, text: weight }))}
      />
      <SelectField
        {...props}
        fieldKey="inner_finish"
        label="Content finish"
        options={[
          { value: 'MATT', text: 'Matte' },
          { value: 'GLAENZEND', text: 'Glossy' },
        ]}
      />
    </>
  )
}

function FoldPageCountInput(props: DetailBlockProps) {
  const { detail, fieldErrorClass, validationErrors, shouldValidate, patchLocal, commit } = props
  const pageCount = detail.page_count
  const inputValue = pageCount == null ? '' : String(pageCount)
  return (
    <FieldRow label="Page count" error={shouldValidate && validationErrors.page_count ? validationErrors.page_count : undefined}>
      <input
        type="number"
        className={'ber-inp' + fieldErrorClass('page_count')}
        min={2}
        max={100}
        step={2}
        value={inputValue}
        onChange={e => {
          const raw = e.target.value
          if (raw === '') {
            patchLocal({ page_count: null } as FormState)
            return
          }
          let parsed = parseInt(raw, 10)
          if (Number.isNaN(parsed)) return
          parsed = Math.max(2, Math.min(100, parsed))
          if (parsed % 2 !== 0) parsed = parsed - 1
          if (parsed < 2) parsed = 2
          patchLocal({ page_count: parsed } as FormState)
        }}
        onBlur={commit}
      />
    </FieldRow>
  )
}

function BrochurePageCountInput(props: DetailBlockProps) {
  const { detail, fieldErrorClass, validationErrors, shouldValidate, patchLocal, commit } = props
  const pageCount = detail.page_count
  const inputValue = pageCount == null ? '' : String(pageCount)
  return (
    <FieldRow label="Page count" error={shouldValidate && validationErrors.page_count ? validationErrors.page_count : undefined}>
      <input
        type="number"
        className={'ber-inp' + fieldErrorClass('page_count')}
        min={4}
        max={152}
        step={4}
        value={inputValue}
        onChange={e => {
          const raw = e.target.value
          if (raw === '') {
            patchLocal({ page_count: null } as FormState)
            return
          }
          let parsed = parseInt(raw, 10)
          if (Number.isNaN(parsed)) return
          parsed = Math.max(4, Math.min(152, parsed))
          parsed = parsed - (parsed % 4)
          if (parsed < 4) parsed = 4
          patchLocal({ page_count: parsed } as FormState)
        }}
        onBlur={commit}
      />
    </FieldRow>
  )
}

function CardFlyerSection(props: DetailBlockProps) {
  const { detail } = props
  const detailRecord = detail as Record<string, string>
  const productionPath = String(detailRecord.production_path ?? '')
  return (
    <>
      <SelectField
        {...props}
        fieldKey="color_mode"
        label="Colour mode"
        options={[
          { value: '1_0', text: '1/0' },
          { value: '1_1', text: '1/1' },
          { value: '4_0', text: '4/0' },
          { value: '4_4', text: '4/4' },
        ]}
      />
      <FormatDinSelect din={CARD_DIN} order={CARD_FORMAT_ORDER} block={props} />
      {String(detailRecord.format) === 'FREI' && <DimensionInputs {...props} />}
      {BooleanSelect({ ...props, fieldKey: 'full_bleed', label: 'Bleed' })}
      <CardFoldProductionPathSelect block={props} />
      {productionPath === 'CC' && (
        <MaterialCC
          detail={detail}
          fieldErrorClass={props.fieldErrorClass}
          validationErrors={props.validationErrors}
          shouldValidate={props.shouldValidate}
          patchLocal={props.patchLocal}
          commit={props.commit}
          applyDetail={props.applyDetail}
          materialKey="cc_material"
          customKey="cc_material_other"
          label="Material"
        />
      )}
      {productionPath === 'OFFSET' && <MaterialOffset detail={detail} fieldErrorClass={props.fieldErrorClass} validationErrors={props.validationErrors} shouldValidate={props.shouldValidate} patchLocal={props.patchLocal} commit={props.commit} applyDetail={props.applyDetail} />}
      <NotesField {...props} />
    </>
  )
}

function FoldFlyerSection(props: DetailBlockProps) {
  const { detail } = props
  const detailRecord = detail as Record<string, string>
  const productionPath = String(detailRecord.production_path ?? '')
  return (
    <>
      <SelectField
        {...props}
        fieldKey="color_mode"
        label="Colour mode"
        options={[
          { value: '1_1', text: '1/1' },
          { value: '4_4', text: '4/4' },
        ]}
      />
      <SelectField
        {...props}
        fieldKey="fold_type"
        label="Fold type"
        options={[
          { value: 'MITTELFALZ', text: 'Centre fold' },
          { value: 'WICKELFALZ', text: 'Roll fold' },
          { value: 'ZICKZACK', text: 'Z-fold' },
        ]}
      />
      <FormatDinSelect din={FOLD_DIN as Record<string, { b: number; h: number }>} order={FOLD_FORMAT_ORDER} block={props} />
      {String(detailRecord.format) === 'FREI' && <DimensionInputs {...props} />}
      <FoldPageCountInput {...props} />
      {BooleanSelect({ ...props, fieldKey: 'full_bleed', label: 'Bleed' })}
      <CardFoldProductionPathSelect block={props} />
      {productionPath === 'CC' && (
        <MaterialCC
          detail={detail}
          fieldErrorClass={props.fieldErrorClass}
          validationErrors={props.validationErrors}
          shouldValidate={props.shouldValidate}
          patchLocal={props.patchLocal}
          commit={props.commit}
          applyDetail={props.applyDetail}
          materialKey="cc_material"
          customKey="cc_material_other"
          label="Material"
        />
      )}
      {productionPath === 'OFFSET' && <MaterialOffset detail={detail} fieldErrorClass={props.fieldErrorClass} validationErrors={props.validationErrors} shouldValidate={props.shouldValidate} patchLocal={props.patchLocal} commit={props.commit} applyDetail={props.applyDetail} />}
      <NotesField {...props} />
    </>
  )
}

function BrochureSection(props: DetailBlockProps) {
  const { detail, fieldErrorClass, validationErrors, shouldValidate } = props
  const detailRecord = detail as Record<string, string>
  const productionPath = String(detailRecord.production_path ?? '')
  const orientation = detailRecord.orientation ?? ''
  return (
    <>
      <FormatDinSelect din={BROCHURE_DIN} order={BROCHURE_FORMAT_ORDER} block={props} />
      <FieldRow
        label="Orientation"
        error={shouldValidate && (validationErrors.orientation || validationErrors.brochure_landscape_cc) ? validationErrors.orientation || validationErrors.brochure_landscape_cc : undefined}
      >
        <select
          className={'ber-inp' + (shouldValidate && validationErrors.brochure_landscape_cc ? fieldErrorClass('brochure_landscape_cc') : fieldErrorClass('orientation'))}
          value={orientation}
          onChange={e =>
            props.applyDetail({ ...detail, orientation: e.target.value } as FormState)
          }
        >
          <option value="">—</option>
          <option value="HOCHFORMAT">Portrait</option>
          <option value="QUERFORMAT">Landscape</option>
        </select>
      </FieldRow>
      <BrochurePageCountInput {...props} />
      <BrochureProductionPathSelect block={props} />
      {productionPath === 'CC' && (
        <>
          <p className="ber-hinweis">Binding: Staple binding (fixed)</p>
          <MaterialCC
            detail={detail}
            fieldErrorClass={props.fieldErrorClass}
            validationErrors={props.validationErrors}
            shouldValidate={props.shouldValidate}
            patchLocal={props.patchLocal}
            commit={props.commit}
            applyDetail={props.applyDetail}
            materialKey="cover_material"
            customKey="cover_material_other"
            label="Cover"
          />
          <MaterialCC
            detail={detail}
            fieldErrorClass={props.fieldErrorClass}
            validationErrors={props.validationErrors}
            shouldValidate={props.shouldValidate}
            patchLocal={props.patchLocal}
            commit={props.commit}
            applyDetail={props.applyDetail}
            materialKey="inner_material"
            customKey="inner_material_other"
            label="Content"
          />
        </>
      )}
      {(productionPath === 'OFFSET' || productionPath === 'OFFEN') && <BrochureOffsetFields {...props} />}
      {BooleanSelect({ ...props, fieldKey: 'full_bleed', label: 'Bleed' })}
      <NotesField {...props} />
    </>
  )
}

function BusinessCardSection(props: DetailBlockProps) {
  const { detail, fieldErrorClass, validationErrors, shouldValidate, applyDetail } = props
  const detailRecord = detail as Record<string, string>
  const format = String(detailRecord.format ?? '')
  const material = String(detailRecord.material ?? '')
  return (
    <>
      <SelectField
        {...props}
        fieldKey="format"
        label="Format"
        options={[
          { value: 'STANDARD_85_55', text: '85 × 55 mm (Standard)' },
          { value: 'STANDARD_90_50', text: '90 × 50 mm' },
          { value: 'FREI', text: 'Free' },
        ]}
      />
      <SelectField
        {...props}
        fieldKey="orientation"
        label="Orientation"
        options={[
          { value: 'HOCHFORMAT', text: 'Portrait' },
          { value: 'QUERFORMAT', text: 'Landscape' },
        ]}
      />
      <SelectField
        {...props}
        fieldKey="color_mode"
        label="Colour mode"
        options={[
          { value: '4_0', text: '4/0' },
          { value: '4_4', text: '4/4' },
        ]}
      />
      <FieldRow label="Material" error={shouldValidate && validationErrors.material ? validationErrors.material : undefined}>
        <select
          className={'ber-inp' + fieldErrorClass('material')}
          value={material}
          onChange={e => {
            const selected = e.target.value
            const patch: FormState = { material: selected }
            if (selected !== '350G_OFFSET') (patch as Record<string, unknown>).film_laminated = null
            if (selected !== 'MULTILOFT') (patch as Record<string, unknown>).multiloft_color = null
            applyDetail({ ...detail, ...patch } as FormState)
          }}
        >
          <option value="">—</option>
          {VISITENKARTE_MATERIALIEN.map(cardMaterial => (
            <option key={cardMaterial.wert} value={cardMaterial.wert}>
              {cardMaterial.anzeige}
            </option>
          ))}
        </select>
      </FieldRow>
      {material === '350G_OFFSET' && BooleanSelect({ ...props, fieldKey: 'film_laminated', label: 'Double-sided matte laminate' })}
      {material === 'MULTILOFT' && (
        <SelectField
          {...props}
          fieldKey="multiloft_color"
          label="Colour core"
          options={MULTILOFT_FARBKERNE.map(colorCore => ({ value: colorCore.wert, text: colorCore.anzeige }))}
        />
      )}
      {format === 'FREI' && <DimensionInputs {...props} />}
      {BooleanSelect({ ...props, fieldKey: 'full_bleed', label: 'Bleed' })}
      <NotesField {...props} />
    </>
  )
}

function BindingFreeDimensions(props: DetailBlockProps) {
  const { detail, fieldErrorClass, validationErrors, shouldValidate, patchLocal, commit } = props
  const width = detail.width
  const height = detail.height
  const widthValue = width === null || width === undefined ? '' : String(width)
  const heightValue = height === null || height === undefined ? '' : String(height)
  return (
    <div>
      <div className="ber-zeile">
        <span className="ber-lbl">Width (mm)</span>
        <div>
          <input
            type="number"
            className={'ber-inp' + fieldErrorClass('width')}
            min={0.01}
            step={0.01}
            value={widthValue}
            onChange={e => {
              const raw = e.target.value
              patchLocal({
                width: raw === '' ? null : parseFloat(raw),
              } as FormState)
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
            className={'ber-inp' + fieldErrorClass('height')}
            min={0.01}
            max={300}
            step={0.01}
            value={heightValue}
            onChange={e => {
              const raw = e.target.value
              patchLocal({
                height: raw === '' ? null : parseFloat(raw),
              } as FormState)
            }}
            onBlur={commit}
          />
          {shouldValidate && validationErrors.height && <p className="ber-err ber-err--mass">{validationErrors.height}</p>}
        </div>
      </div>
    </div>
  )
}

function BindingColorSelect(
  props: DetailBlockProps & {
    bindingType: 'WIRE_O' | 'KUNSTSTOFFSPIRALE' | 'SOFTCOVER' | 'HARDCOVER' | ''
  },
) {
  const { bindingType, detail, fieldErrorClass, validationErrors, shouldValidate, applyDetail } = props
  let colorOptions: { value: string; text: string }[] = []
  if (bindingType === 'WIRE_O') {
    colorOptions = [
      { value: 'SCHWARZ', text: 'Black' },
      { value: 'SILBER', text: 'Silver' },
    ]
  } else if (bindingType === 'KUNSTSTOFFSPIRALE') {
    colorOptions = [
      { value: 'SCHWARZ', text: 'Black' },
      { value: 'WEISS', text: 'White' },
    ]
  } else if (bindingType === 'SOFTCOVER' || bindingType === 'HARDCOVER') {
    colorOptions = [
      { value: 'SCHWARZ', text: 'Black' },
      { value: 'DUNKELBLAU', text: 'Dark blue' },
      { value: 'DUNKELROT', text: 'Dark red' },
    ]
  }
  return (
    <FieldRow label="Binding colour" error={shouldValidate && validationErrors.binding_color ? validationErrors.binding_color : undefined}>
      <select
        className={'ber-inp' + fieldErrorClass('binding_color')}
        value={String((detail as Record<string, string>).binding_color ?? '')}
        onChange={e =>
          applyDetail({ ...detail, binding_color: e.target.value } as FormState)
        }
        disabled={!bindingType}
      >
        <option value="">—</option>
        {colorOptions.map(colorOption => (
          <option key={colorOption.value} value={colorOption.value}>
            {colorOption.text}
          </option>
        ))}
      </select>
    </FieldRow>
  )
}

function BindingSection(props: DetailBlockProps) {
  const { detail, fieldErrorClass, validationErrors, shouldValidate, applyDetail } = props
  const detailRecord = detail as Record<string, string>
  const bindingType = String(detailRecord.binding_type ?? '') as
    | 'WIRE_O'
    | 'KUNSTSTOFFSPIRALE'
    | 'SOFTCOVER'
    | 'HARDCOVER'
    | ''
  const wireFormat = String(detailRecord.format ?? '')
  return (
    <>
      <FieldRow label="Material" error={shouldValidate && validationErrors.material ? validationErrors.material : undefined}>
        <select
          className={'ber-inp' + fieldErrorClass('material')}
          value={detailRecord.material ?? ''}
          onChange={e => {
            const selected = e.target.value
            if (selected === 'SONSTIGE') {
              applyDetail({ ...detail, material: selected } as FormState)
            } else {
              applyDetail({ ...detail, material: selected, material_other: null } as FormState)
            }
          }}
        >
          <option value="">—</option>
          {BINDUNG_MATERIALIEN.map(bindingMaterial => (
            <option key={String(bindingMaterial.wert)} value={String(bindingMaterial.wert)}>
              {bindingMaterial.anzeige}
            </option>
          ))}
        </select>
      </FieldRow>
      {detailRecord.material === 'SONSTIGE' && <TextField {...props} fieldKey="material_other" label="Material (other)" rows={2} />}
      <SelectField
        {...props}
        fieldKey="color_mode"
        label="Colour mode"
        options={[
          { value: '1_0', text: '1/0' },
          { value: '1_1', text: '1/1' },
          { value: '4_0', text: '4/0' },
          { value: '4_1', text: '4/1' },
        ]}
      />
      <FieldRow label="Binding type" error={shouldValidate && validationErrors.binding_type ? validationErrors.binding_type : undefined}>
        <select
          className={'ber-inp' + fieldErrorClass('binding_type')}
          value={bindingType}
          onChange={e => {
            const selected = e.target.value
            if (selected === 'SOFTCOVER' || selected === 'HARDCOVER') {
              applyDetail({
                ...detail,
                binding_type: selected,
                format: 'A4',
                orientation: 'HOCHFORMAT',
                width: 210,
                height: 297,
                hardcover_print: selected === 'HARDCOVER' ? detail.hardcover_print : null,
                hardcover_cover: selected === 'HARDCOVER' ? detail.hardcover_cover : null,
              } as FormState)
            } else if (selected === 'WIRE_O' || selected === 'KUNSTSTOFFSPIRALE') {
              applyDetail({
                ...detail,
                binding_type: selected,
                format: 'A5',
                orientation: 'HOCHFORMAT',
                hardcover_print: null,
                hardcover_cover: null,
                width: null,
                height: null,
              } as FormState)
            } else {
              applyDetail({ ...detail, binding_type: selected || null } as FormState)
            }
          }}
        >
          <option value="">—</option>
          <option value="WIRE_O">Wire-O</option>
          <option value="KUNSTSTOFFSPIRALE">Plastic coil</option>
          <option value="SOFTCOVER">Softcover</option>
          <option value="HARDCOVER">Hardcover</option>
        </select>
      </FieldRow>

      <BindingColorSelect {...props} bindingType={bindingType} />

      {bindingType === 'WIRE_O' || bindingType === 'KUNSTSTOFFSPIRALE' ? (
        <FieldRow label="Format" error={shouldValidate && validationErrors.format ? validationErrors.format : undefined}>
          <select
            className={'ber-inp' + fieldErrorClass('format')}
            value={wireFormat}
            onChange={e => {
              const selected = e.target.value
              if (selected === 'A3') {
                applyDetail({ ...detail, format: selected, orientation: 'QUERFORMAT' } as FormState)
              } else if (selected === 'FREI') {
                applyDetail({
                  ...detail,
                  format: 'FREI',
                  orientation: null,
                  width: null,
                  height: null,
                } as FormState)
              } else if (selected === 'A5' || selected === 'A4') {
                const currentOrientation = (detailRecord.orientation as string) || 'HOCHFORMAT'
                const validOrientation = currentOrientation === 'QUERFORMAT' || currentOrientation === 'HOCHFORMAT' ? currentOrientation : 'HOCHFORMAT'
                applyDetail({ ...detail, format: selected, orientation: validOrientation } as FormState)
              } else {
                applyDetail({ ...detail, format: selected } as FormState)
              }
            }}
          >
            <option value="">—</option>
            <option value="A5">A5</option>
            <option value="A4">A4</option>
            <option value="A3">A3</option>
            <option value="FREI">Free</option>
          </select>
        </FieldRow>
      ) : null}

      {bindingType === 'WIRE_O' || bindingType === 'KUNSTSTOFFSPIRALE' ? (wireFormat === 'A5' || wireFormat === 'A4' ? (
        <SelectField
          {...props}
          fieldKey="orientation"
          label="Orientation"
          options={[
            { value: 'HOCHFORMAT', text: 'Portrait' },
            { value: 'QUERFORMAT', text: 'Landscape' },
          ]}
        />
      ) : wireFormat === 'A3' ? (
        <FieldRow label="Orientation" content={<span className="td-wert">Landscape (fixed)</span>} />
      ) : null) : null}

      {bindingType === 'WIRE_O' || bindingType === 'KUNSTSTOFFSPIRALE' ? (wireFormat === 'FREI' ? <BindingFreeDimensions {...props} /> : null) : null}

      {bindingType === 'SOFTCOVER' || bindingType === 'HARDCOVER' ? (
        <FieldRow label="Format" content={<span className="td-wert">A4 Portrait (210 × 297 mm)</span>} />
      ) : null}

      {BooleanSelect({ ...props, fieldKey: 'full_bleed', label: 'Bleed' })}

      {bindingType === 'HARDCOVER' && (
        <>
          {BooleanSelect({ ...props, fieldKey: 'hardcover_print', label: 'Print on hardcover' })}
          {detail.hardcover_print === true && <TextField {...props} fieldKey="hardcover_cover" label="Hardcover cover" rows={2} />}
        </>
      )}

      <NotesField {...props} />
    </>
  )
}

function PrintSection(props: DetailBlockProps) {
  const { detail, fieldErrorClass, validationErrors, shouldValidate, applyDetail } = props
  const material = String((detail as Record<string, string>).material ?? '')
  return (
    <>
      <SelectField
        {...props}
        fieldKey="format"
        label="Format"
        options={[
          { value: 'A5', text: 'A5' },
          { value: 'A4', text: 'A4' },
          { value: 'A3', text: 'A3' },
        ]}
      />
      <FieldRow label="Material" error={shouldValidate && validationErrors.material ? validationErrors.material : undefined}>
        <select
          className={'ber-inp' + fieldErrorClass('material')}
          value={material}
          onChange={e => {
            const selected = e.target.value
            if (selected === 'SONSTIGE') {
              applyDetail({ ...detail, material: selected } as FormState)
            } else {
              applyDetail({ ...detail, material: selected, material_other: null } as FormState)
            }
          }}
        >
          <option value="">—</option>
          {AUSDRUCK_MATERIALIEN.map(printMaterial => (
            <option key={String(printMaterial.wert)} value={String(printMaterial.wert)}>
              {printMaterial.anzeige}
            </option>
          ))}
        </select>
      </FieldRow>
      {material === 'SONSTIGE' && <TextField {...props} fieldKey="material_other" label="Material (other)" rows={2} />}
      <SelectField
        {...props}
        fieldKey="color_mode"
        label="Colour mode"
        options={[
          { value: '1_0', text: '1/0' },
          { value: '1_1', text: '1/1' },
          { value: '4_0', text: '4/0' },
          { value: '4_1', text: '4/1' },
        ]}
      />
      <SelectField
        {...props}
        fieldKey="punching"
        label="Punching"
        options={[
          { value: 'NEIN', text: 'No' },
          { value: '2_LOCH', text: '2 holes' },
          { value: '4_LOCH', text: '4 holes' },
        ]}
      />
      {BooleanSelect({ ...props, fieldKey: 'staple', label: 'Staple' })}
      <SelectField
        {...props}
        fieldKey="laminate"
        label="Laminate"
        options={[
          { value: 'NEIN', text: 'No' },
          { value: 'MATT', text: 'Matte' },
          { value: 'GLAENZEND', text: 'Glossy' },
        ]}
      />
      <NotesField {...props} />
    </>
  )
}
