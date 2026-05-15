import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { subOrderProductService, type SubOrderProductRow } from '../../services/subOrderProductService'
import { COPY_SHOP_TYPES, COPY_SHOP_TYPE_LABELS, type CopyShopDetailJson } from '../../types/copyshop'
import { BROCHURE_DIN, FOLD_DIN, CARD_DIN, CARD_FORMAT_ORDER, FOLD_FORMAT_ORDER, BROCHURE_FORMAT_ORDER } from '../../lib/copyshop/dinCfbFormats'
import { validateCopyShopDetail } from '../../lib/copyshop/validateCopyShopDetail'
import type { OrderStatus, SubOrderRow } from '../../types/database'
import type { Database, Json } from '../../types/supabase'
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
  onDetailPatch: (patch: { typ?: string | null; detail: CopyShopDetailJson | null }) => Promise<void>
  orderFiles?: FileRow[]
}

type ProductRow = {
  id: string
  sub_order_id: string
  department: string
  detail: CopyShopDetailJson
  sort_order: number | null
  created_at: string | null
}

function stripFileRecordId(json: CopyShopDetailJson): CopyShopDetailJson {
  const copy = { ...json } as Record<string, unknown>
  delete copy.datei_id
  return copy as CopyShopDetailJson
}

function extractCopyShopRaw(subOrder: SubOrderRow): CopyShopDetailJson {
  const rawDetail = subOrder.detail
  const base = rawDetail && typeof rawDetail === 'object' && !Array.isArray(rawDetail) ? { ...rawDetail } : {}
  return stripFileRecordId(base)
}

const POSTER_DIN: Record<'A0' | 'A1' | 'A2' | 'A3' | 'A4', { b: number; h: number }> = {
  A4: { b: 210, h: 297 },
  A3: { b: 297, h: 420 },
  A2: { b: 420, h: 594 },
  A1: { b: 594, h: 841 },
  A0: { b: 841, h: 1189 },
}

const POSTER_DEFAULT: CopyShopDetailJson = {
  format: 'A1',
  format_breite: 594,
  format_hoehe: 841,
}

const CARD_FOLD_MATERIAL_RESET: CopyShopDetailJson = {
  material_cc: null,
  material_cc_sonstige: null,
  offset_art: null,
  offset_grammatur: null,
  offset_oberflaeche: null,
  spezial_papier: null,
  spezial_sonstige: null,
  kaschierung: null,
  kaschierung_seiten: null,
  recycling_grammatur: null,
}

const BROCHURE_MATERIAL_RESET: CopyShopDetailJson = {
  ...CARD_FOLD_MATERIAL_RESET,
  cc_umschlag: null,
  cc_umschlag_sonstige: null,
  cc_inhalt: null,
  cc_inhalt_sonstige: null,
  brosch_bindung: null,
  brosch_u_gramm: null,
  brosch_u_ober: null,
  brosch_i_gramm: null,
  brosch_i_ober: null,
}

type DetailBlockProps = {
  detail: CopyShopDetailJson
  fieldErrorClass: (fieldKey: string) => string
  shouldValidate: boolean
  validationErrors: Record<string, string>
  patchLocal: (patch: CopyShopDetailJson) => void
  commit: () => void
  applyDetail: (newDetail: CopyShopDetailJson) => void
}

type ProductFileAssignment = { assignmentId: string; fileId: string } // assignmentId = produkt_dateien.id

export function CopyShopDetail({
  subOrder,
  subOrderStatus,
  onDetailPatch,
  orderFiles = [],
}: Props) {
  const { fehler: toastError } = useToast()

  const [products, setProducts] = useState<ProductRow[]>([])
  const [productFiles, setProductFiles] = useState<Record<string, ProductFileAssignment[]>>({})
  const productFilesRef = useRef(productFiles)
  productFilesRef.current = productFiles
  const [productsLoading, setProductsLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [unlocked, setUnlocked] = useState(false)
  const [formFileRecordIds, setFormFileRecordIds] = useState<string[]>([])

  const [selectedType, setSelectedType] = useState<string | null>(subOrder.type)
  const [detail, setDetail] = useState<CopyShopDetailJson>(extractCopyShopRaw(subOrder))
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
  }, [subOrder.id])

  useEffect(() => {
    if (editingId !== null) return
    setSelectedType(subOrder.type)
    const extracted = extractCopyShopRaw(subOrder)
    setDetail(extracted)
    detailRef.current = extracted
    typeRef.current = subOrder.type
  }, [subOrder, editingId])

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
        toastError('File assignments could not be loaded')
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
    [toastError],
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
      toastError('Products could not be loaded')
      setProducts([])
      await loadFilesForProducts([])
      return []
    }
    setProductsLoading(false)
    const mapped: ProductRow[] = rows.map(row => ({
      id: row.id,
      sub_order_id: row.sub_order_id,
      department: row.department,
      detail: stripFileRecordId((row.detail ?? {}) as CopyShopDetailJson),
      sort_order: row.sort_order,
      created_at: row.created_at,
    }))
    setProducts(mapped)
    await loadFilesForProducts(mapped)
    return mapped
  }, [subOrder.id, toastError, loadFilesForProducts])

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
        toastError('File could not be assigned')
        return
      }
      await loadFilesForProducts(reloadRows)
    },
    [toastError, products, loadFilesForProducts],
  )

  const removeFileFromProduct = useCallback(
    async (assignmentId: string, productRowsForReload?: ProductRow[]) => {
      try {
        await subOrderProductService.removeFileFromProduct(assignmentId)
      } catch {
        toastError('Assignment could not be removed')
        return
      }
      await loadFilesForProducts(productRowsForReload ?? products)
    },
    [toastError, products, loadFilesForProducts],
  )

  const resetForm = useCallback(() => {
    setEditingId(null)
    setFormFileRecordIds([])
    setSelectedType(subOrder.type)
    const extracted = extractCopyShopRaw(subOrder)
    setDetail(extracted)
    detailRef.current = extracted
    typeRef.current = subOrder.type
  }, [subOrder])

  const validationErrors = validateCopyShopDetail(selectedType, detail, subOrderStatus)
  const shouldValidate = subOrderStatus !== 'QUOTE'
  const fieldErrorClass = (fieldKey: string) => (shouldValidate && validationErrors[fieldKey] ? ' ber-inp--err' : '')

  const saveDetail = useCallback(
    async (nextType: string | null, json: CopyShopDetailJson) => {
      const clean = stripFileRecordId(json)
      setDetail(clean)
      detailRef.current = clean
      setSelectedType(nextType)
      if (editingId !== null) return
      await onDetailPatch({ typ: nextType, detail: clean })
    },
    [onDetailPatch, editingId]
  )

  const patchLocal = useCallback((patch: CopyShopDetailJson) => {
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
    (newDetail: CopyShopDetailJson) => {
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
    const currentDetail = stripFileRecordId({ ...detailRef.current })
    if (!currentType) return
    const errors = validateCopyShopDetail(currentType, currentDetail, subOrderStatus)
    if (Object.keys(errors).length > 0) return

    if (editingId) {
      const patch: Database['public']['Tables']['sub_order_products']['Update'] = {
        detail: { ...currentDetail, typ: currentType } as Json,
      }
      try {
        await subOrderProductService.updateProduct(editingId, patch)
      } catch {
        toastError('Product could not be saved')
        return
      }
      for (const assignment of [...(productFiles[editingId] ?? [])]) {
        await removeFileFromProduct(assignment.assignmentId)
      }
      for (const fid of formFileRecordIds) {
        await assignFileToProduct(editingId, fid)
      }
      const list = await reloadProducts()
      await onDetailPatch({
        typ: subOrder.type,
        detail: {
          ...extractCopyShopRaw(subOrder),
          hat_produkte: list.length > 0,
        } as CopyShopDetailJson,
      })
      resetForm()
      return
    }

    const productInsert: Database['public']['Tables']['sub_order_products']['Insert'] = {
      sub_order_id: subOrder.id,
      department: 'COPYSHOP',
      detail: { ...currentDetail, typ: currentType } as Json,
      sort_order: products.length,
    }
    let insertedRow: SubOrderProductRow
    try {
      insertedRow = await subOrderProductService.createProduct(productInsert)
    } catch {
      toastError('Product could not be added')
      return
    }
    const newId = insertedRow.id
    let list = await reloadProducts()
    for (const fid of formFileRecordIds) {
      await assignFileToProduct(newId, fid, list)
    }
    list = await reloadProducts()
    await onDetailPatch({
      typ: subOrder.type,
      detail: {
        ...extractCopyShopRaw(subOrder),
        hat_produkte: list.length > 0,
      } as CopyShopDetailJson,
    })
    resetForm()
  }, [
    subOrder,
    subOrderStatus,
    editingId,
    products.length,
    productFiles,
    formFileRecordIds,
    toastError,
    reloadProducts,
    resetForm,
    onDetailPatch,
    assignFileToProduct,
    removeFileFromProduct,
  ])

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await subOrderProductService.deleteProduct(id)
      } catch {
        toastError('Product could not be deleted')
        return
      }
      const list = await reloadProducts()
      await onDetailPatch({
        typ: subOrder.type,
        detail: {
          ...extractCopyShopRaw(subOrder),
          hat_produkte: list.length > 0,
        } as CopyShopDetailJson,
      })
      if (editingId === id) resetForm()
    },
    [toastError, reloadProducts, editingId, resetForm, onDetailPatch, subOrder]
  )

  const handleEdit = useCallback((row: ProductRow) => {
    setEditingId(row.id)
    setFormFileRecordIds(productFiles[row.id]?.map(assignment => assignment.fileId) ?? [])
    const rowDetail = row.detail ?? {}
    const detailRecord = rowDetail as Record<string, unknown>
    const rowType = typeof detailRecord.typ === 'string' ? detailRecord.typ : null
    setSelectedType(rowType)
    const cleanDetail = stripFileRecordId({ ...(rowDetail as CopyShopDetailJson) })
    setDetail(cleanDetail)
    detailRef.current = cleanDetail
    typeRef.current = rowType
  }, [productFiles])

  useEffect(() => {
    if (selectedType !== 'BINDUNG') return
    const currentDetail = detailRef.current
    const detailRecord = currentDetail as Record<string, string | number | null | boolean | undefined>
    const bindingType = String(detailRecord.bindungsart ?? '')
    if (bindingType === 'SOFTCOVER' || bindingType === 'HARDCOVER') {
      if (detailRecord.format === 'A4_HOCH') {
        applyDetail({
          ...currentDetail,
          format: 'A4',
          orientierung: 'HOCHFORMAT',
          format_breite: 210,
          format_hoehe: 297,
        } as CopyShopDetailJson)
        return
      }
      if (
        detailRecord.format !== 'A4' ||
        detailRecord.orientierung !== 'HOCHFORMAT' ||
        detailRecord.format_breite !== 210 ||
        detailRecord.format_hoehe !== 297
      ) {
        applyDetail({
          ...currentDetail,
          format: 'A4',
          orientierung: 'HOCHFORMAT',
          format_breite: 210,
          format_hoehe: 297,
        } as CopyShopDetailJson)
      }
    } else if (bindingType === 'WIRE_O' || bindingType === 'KUNSTSTOFFSPIRALE') {
      const formatStr = String(detailRecord.format ?? '')
      const legacyFormatMap: Record<string, { format: string; orientierung: string }> = {
        A5_HOCH: { format: 'A5', orientierung: 'HOCHFORMAT' },
        A4_HOCH: { format: 'A4', orientierung: 'HOCHFORMAT' },
        A3_QUER: { format: 'A3', orientierung: 'QUERFORMAT' },
      }
      if (formatStr in legacyFormatMap) {
        const mappedFormat = legacyFormatMap[formatStr]!
        applyDetail({ ...currentDetail, format: mappedFormat.format, orientierung: mappedFormat.orientierung } as CopyShopDetailJson)
        return
      }
      if (formatStr === 'A3' && detailRecord.orientierung !== 'QUERFORMAT') {
        applyDetail({ ...currentDetail, orientierung: 'QUERFORMAT' } as CopyShopDetailJson)
      }
    }
  }, [selectedType, subOrder.id, subOrder.detail, applyDetail])

  useEffect(() => {
    if (selectedType !== 'PLAKAT_POSTER') return
    const currentDetail = detailRef.current
    const formatStr = String((currentDetail as Record<string, string>).format ?? '').trim()
    if (!formatStr) {
      applyDetail({ ...currentDetail, ...POSTER_DEFAULT } as CopyShopDetailJson)
      return
    }
    if (formatStr !== 'FREI' && formatStr in POSTER_DIN) {
      const dinDimensions = POSTER_DIN[formatStr as keyof typeof POSTER_DIN]
      const currentWidth = currentDetail.format_breite
      const currentHeight = currentDetail.format_hoehe
      if (currentWidth !== dinDimensions.b || currentHeight !== dinDimensions.h) {
        applyDetail({ ...currentDetail, format: formatStr, format_breite: dinDimensions.b, format_hoehe: dinDimensions.h } as CopyShopDetailJson)
      }
    }
  }, [selectedType, subOrder.id, subOrder.detail, applyDetail])

  useEffect(() => {
    if (selectedType === 'KARTE_FLYER') {
      const currentDetail = detailRef.current
      const formatStr = String((currentDetail as Record<string, string>).format ?? '').trim()
      if (formatStr && formatStr !== 'FREI' && formatStr in CARD_DIN) {
        const dinDimensions = CARD_DIN[formatStr as keyof typeof CARD_DIN]
        if (currentDetail.format_breite !== dinDimensions.b || currentDetail.format_hoehe !== dinDimensions.h) {
          applyDetail({ ...currentDetail, format: formatStr, format_breite: dinDimensions.b, format_hoehe: dinDimensions.h } as CopyShopDetailJson)
        }
      }
    } else if (selectedType === 'FALZFLYER') {
      const currentDetail = detailRef.current
      const formatStr = String((currentDetail as Record<string, string>).format ?? '').trim()
      if (formatStr && formatStr !== 'FREI' && formatStr in FOLD_DIN) {
        const dinDimensions = FOLD_DIN[formatStr as keyof typeof FOLD_DIN]
        if (currentDetail.format_breite !== dinDimensions.b || currentDetail.format_hoehe !== dinDimensions.h) {
          applyDetail({ ...currentDetail, format: formatStr, format_breite: dinDimensions.b, format_hoehe: dinDimensions.h } as CopyShopDetailJson)
        }
      }
    } else if (selectedType === 'BROSCHUERE') {
      const currentDetail = detailRef.current
      const formatStr = String((currentDetail as Record<string, string>).format ?? '').trim()
      if (formatStr && formatStr !== 'FREI' && formatStr in BROCHURE_DIN) {
        const dinDimensions = BROCHURE_DIN[formatStr as keyof typeof BROCHURE_DIN]
        if (currentDetail.format_breite !== dinDimensions.b || currentDetail.format_hoehe !== dinDimensions.h) {
          applyDetail({ ...currentDetail, format: formatStr, format_breite: dinDimensions.b, format_hoehe: dinDimensions.h } as CopyShopDetailJson)
        }
      }
      if (String(currentDetail.produktionsweg) === 'CC' && currentDetail.brosch_bindung !== 'DRAHTHEFTUNG') {
        applyDetail({ ...currentDetail, brosch_bindung: 'DRAHTHEFTUNG' } as CopyShopDetailJson)
      }
    }
  }, [selectedType, subOrder.id, subOrder.detail, applyDetail])

  return (
    <div className="ber-lfp">
      <h3 className="ber-h3">Copy Shop Details</h3>

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
                if (selected === 'PLAKAT_POSTER') {
                  setSelectedType('PLAKAT_POSTER')
                  setDetail(POSTER_DEFAULT)
                  detailRef.current = POSTER_DEFAULT
                  typeRef.current = 'PLAKAT_POSTER'
                  if (editingId === null) void saveDetail('PLAKAT_POSTER', { ...POSTER_DEFAULT } as CopyShopDetailJson)
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
        selectedType !== 'PLAKAT_POSTER' &&
        selectedType !== 'AUSDRUCK' &&
        selectedType !== 'KARTE_FLYER' &&
        selectedType !== 'FALZFLYER' &&
        selectedType !== 'BROSCHUERE' &&
        selectedType !== 'VISITENKARTE' &&
        selectedType !== 'BINDUNG' && <ProductionPathSelect {...detailBlock} />}

      {selectedType === 'PLAKAT_POSTER' && <PlakatPoster {...detailBlock} />}
      {selectedType === 'KARTE_FLYER' && <CardFlyerSection {...detailBlock} />}
      {selectedType === 'FALZFLYER' && <FoldFlyerSection {...detailBlock} />}
      {selectedType === 'BROSCHUERE' && <BrochureSection {...detailBlock} />}
      {selectedType === 'VISITENKARTE' && <BusinessCardSection {...detailBlock} />}
      {selectedType === 'BINDUNG' && <BindingSection {...detailBlock} />}
      {selectedType === 'AUSDRUCK' && <PrintSection {...detailBlock} />}

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
                  const productDetail = (product.detail ?? {}) as Record<string, unknown>
                  const productType = typeof productDetail.typ === 'string' ? productDetail.typ : ''
                  const quantity = productDetail.stueckzahl ?? ''
                  const productionPath = productDetail.produktionsweg != null ? String(productDetail.produktionsweg) : ''
                  const material = productDetail.material != null ? String(productDetail.material) : ''
                  const shortPath = productionPath || material || '—'
                  const formatWidth = productDetail.format_breite
                  const formatHeight = productDetail.format_hoehe
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
  const quantity = detail.stueckzahl
  const inputValue = quantity === null || quantity === undefined ? '' : String(quantity)
  return (
    <FieldRow label="Quantity" error={shouldValidate && validationErrors.stueckzahl ? validationErrors.stueckzahl : undefined}>
      <input
        type="number"
        className={'ber-inp' + fieldErrorClass('stueckzahl')}
        min={1}
        step={1}
        value={inputValue}
        onChange={e => {
          const raw = e.target.value
          patchLocal({
            stueckzahl: raw === '' ? null : parseInt(raw, 10),
          } as CopyShopDetailJson)
        }}
        onBlur={commit}
      />
    </FieldRow>
  )
}

function ProductionPathSelect(props: DetailBlockProps) {
  const { detail, fieldErrorClass, validationErrors, shouldValidate, applyDetail } = props
  const productionPath = (detail.produktionsweg as string | null | undefined) ?? ''
  return (
    <FieldRow label="Process" error={shouldValidate && validationErrors.produktionsweg ? validationErrors.produktionsweg : undefined}>
      <select
        className={'ber-inp' + fieldErrorClass('produktionsweg')}
        value={productionPath}
        onChange={e => {
          const selected = e.target.value
          applyDetail({ ...detail, produktionsweg: selected === '' ? null : selected } as CopyShopDetailJson)
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
          applyDetail({ ...detail, [fieldKey]: e.target.value } as CopyShopDetailJson)
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
          applyDetail({ ...detail, [fieldKey]: boolValue } as CopyShopDetailJson)
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
          onChange={e => patchLocal({ [fieldKey]: e.target.value } as CopyShopDetailJson)}
          onBlur={commit}
        />
      ) : (
        <input
          type="text"
          className={'ber-inp' + fieldErrorClass(fieldKey)}
          value={fieldValue}
          onChange={e => patchLocal({ [fieldKey]: e.target.value } as CopyShopDetailJson)}
          onBlur={commit}
        />
      )}
    </FieldRow>
  )
}

function DimensionInputs(props: DetailBlockProps) {
  const { detail, fieldErrorClass, validationErrors, shouldValidate, patchLocal, commit } = props
  const errorMessage = shouldValidate ? validationErrors.format_masse : undefined
  const width = detail.format_breite
  const height = detail.format_hoehe
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
                format_breite: raw === '' ? null : parseFloat(raw),
              } as CopyShopDetailJson)
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
                format_hoehe: raw === '' ? null : parseFloat(raw),
              } as CopyShopDetailJson)
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
  return <TextField {...props} fieldKey="besonderheiten" label="Notes" rows={3} />
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
              applyDetail({ ...detail, format: 'FREI' } as CopyShopDetailJson)
            } else if (selected in POSTER_DIN) {
              const dinDimensions = POSTER_DIN[selected as keyof typeof POSTER_DIN]
              applyDetail({
                ...detail,
                format: selected,
                format_breite: dinDimensions.b,
                format_hoehe: dinDimensions.h,
              } as CopyShopDetailJson)
            } else {
              applyDetail({ ...detail, format: selected || null } as CopyShopDetailJson)
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
        fieldKey="laminat"
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
          if (selected === 'FREI') applyDetail({ ...detail, format: 'FREI' } as CopyShopDetailJson)
          else if (selected in din) {
            const dinDimensions = din[selected]!
            applyDetail({
              ...detail,
              format: selected,
              format_breite: dinDimensions.b,
              format_hoehe: dinDimensions.h,
            } as CopyShopDetailJson)
          } else {
            applyDetail({ ...detail, format: selected || null } as CopyShopDetailJson)
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
  const productionPath = String((detail as Record<string, string>).produktionsweg ?? '')
  return (
    <FieldRow label="Process" error={shouldValidate && validationErrors.produktionsweg ? validationErrors.produktionsweg : undefined}>
      <select
        className={'ber-inp' + fieldErrorClass('produktionsweg')}
        value={productionPath}
        onChange={e => {
          const selected = e.target.value
          applyDetail({
            ...detail,
            produktionsweg: selected || null,
            ...CARD_FOLD_MATERIAL_RESET,
          } as CopyShopDetailJson)
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
  const productionPath = String((detail as Record<string, string>).produktionsweg ?? '')
  return (
    <FieldRow label="Process" error={shouldValidate && validationErrors.produktionsweg ? validationErrors.produktionsweg : undefined}>
      <select
        className={'ber-inp' + fieldErrorClass('produktionsweg')}
        value={productionPath}
        onChange={e => {
          const selected = e.target.value
          if (selected === 'CC') {
            applyDetail({
              ...detail,
              produktionsweg: 'CC',
              ...BROCHURE_MATERIAL_RESET,
              brosch_bindung: 'DRAHTHEFTUNG',
            } as CopyShopDetailJson)
          } else {
            applyDetail({
              ...detail,
              produktionsweg: selected || null,
              ...BROCHURE_MATERIAL_RESET,
            } as CopyShopDetailJson)
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
        fieldKey="brosch_bindung"
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
        fieldKey="brosch_u_gramm"
        label="Cover weight"
        options={['135G', '170G', '250G', '300G'].map(weight => ({ value: weight, text: weight }))}
      />
      <SelectField
        {...props}
        fieldKey="brosch_u_ober"
        label="Cover finish"
        options={[
          { value: 'MATT', text: 'Matte' },
          { value: 'GLAENZEND', text: 'Glossy' },
        ]}
      />
      <SelectField
        {...props}
        fieldKey="brosch_i_gramm"
        label="Content weight"
        options={['90G', '135G', '170G'].map(weight => ({ value: weight, text: weight }))}
      />
      <SelectField
        {...props}
        fieldKey="brosch_i_ober"
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
  const pageCount = detail.seitenzahl
  const inputValue = pageCount == null ? '' : String(pageCount)
  return (
    <FieldRow label="Page count" error={shouldValidate && validationErrors.seitenzahl ? validationErrors.seitenzahl : undefined}>
      <input
        type="number"
        className={'ber-inp' + fieldErrorClass('seitenzahl')}
        min={2}
        max={100}
        step={2}
        value={inputValue}
        onChange={e => {
          const raw = e.target.value
          if (raw === '') {
            patchLocal({ seitenzahl: null } as CopyShopDetailJson)
            return
          }
          let parsed = parseInt(raw, 10)
          if (Number.isNaN(parsed)) return
          parsed = Math.max(2, Math.min(100, parsed))
          if (parsed % 2 !== 0) parsed = parsed - 1
          if (parsed < 2) parsed = 2
          patchLocal({ seitenzahl: parsed } as CopyShopDetailJson)
        }}
        onBlur={commit}
      />
    </FieldRow>
  )
}

function BrochurePageCountInput(props: DetailBlockProps) {
  const { detail, fieldErrorClass, validationErrors, shouldValidate, patchLocal, commit } = props
  const pageCount = detail.seitenzahl
  const inputValue = pageCount == null ? '' : String(pageCount)
  return (
    <FieldRow label="Page count" error={shouldValidate && validationErrors.seitenzahl ? validationErrors.seitenzahl : undefined}>
      <input
        type="number"
        className={'ber-inp' + fieldErrorClass('seitenzahl')}
        min={4}
        max={152}
        step={4}
        value={inputValue}
        onChange={e => {
          const raw = e.target.value
          if (raw === '') {
            patchLocal({ seitenzahl: null } as CopyShopDetailJson)
            return
          }
          let parsed = parseInt(raw, 10)
          if (Number.isNaN(parsed)) return
          parsed = Math.max(4, Math.min(152, parsed))
          parsed = parsed - (parsed % 4)
          if (parsed < 4) parsed = 4
          patchLocal({ seitenzahl: parsed } as CopyShopDetailJson)
        }}
        onBlur={commit}
      />
    </FieldRow>
  )
}

function CardFlyerSection(props: DetailBlockProps) {
  const { detail } = props
  const detailRecord = detail as Record<string, string>
  const productionPath = String(detailRecord.produktionsweg ?? '')
  return (
    <>
      <SelectField
        {...props}
        fieldKey="farbigkeit"
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
      {BooleanSelect({ ...props, fieldKey: 'randabfallend', label: 'Bleed' })}
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
          materialKey="material_cc"
          customKey="material_cc_sonstige"
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
  const productionPath = String(detailRecord.produktionsweg ?? '')
  return (
    <>
      <SelectField
        {...props}
        fieldKey="farbigkeit"
        label="Colour mode"
        options={[
          { value: '1_1', text: '1/1' },
          { value: '4_4', text: '4/4' },
        ]}
      />
      <SelectField
        {...props}
        fieldKey="falzart"
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
      {BooleanSelect({ ...props, fieldKey: 'randabfallend', label: 'Bleed' })}
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
          materialKey="material_cc"
          customKey="material_cc_sonstige"
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
  const productionPath = String(detailRecord.produktionsweg ?? '')
  const orientation = detailRecord.orientierung ?? ''
  return (
    <>
      <FormatDinSelect din={BROCHURE_DIN} order={BROCHURE_FORMAT_ORDER} block={props} />
      <FieldRow
        label="Orientation"
        error={shouldValidate && (validationErrors.orientierung || validationErrors.brosch_quer_cc) ? validationErrors.orientierung || validationErrors.brosch_quer_cc : undefined}
      >
        <select
          className={'ber-inp' + (shouldValidate && validationErrors.brosch_quer_cc ? fieldErrorClass('brosch_quer_cc') : fieldErrorClass('orientierung'))}
          value={orientation}
          onChange={e =>
            props.applyDetail({ ...detail, orientierung: e.target.value } as CopyShopDetailJson)
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
            materialKey="cc_umschlag"
            customKey="cc_umschlag_sonstige"
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
            materialKey="cc_inhalt"
            customKey="cc_inhalt_sonstige"
            label="Content"
          />
        </>
      )}
      {(productionPath === 'OFFSET' || productionPath === 'OFFEN') && <BrochureOffsetFields {...props} />}
      {BooleanSelect({ ...props, fieldKey: 'randabfallend', label: 'Bleed' })}
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
        fieldKey="orientierung"
        label="Orientation"
        options={[
          { value: 'HOCHFORMAT', text: 'Portrait' },
          { value: 'QUERFORMAT', text: 'Landscape' },
        ]}
      />
      <SelectField
        {...props}
        fieldKey="farbigkeit"
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
            const patch: CopyShopDetailJson = { material: selected }
            if (selected !== '350G_OFFSET') (patch as Record<string, unknown>).folienkaschiert = null
            if (selected !== 'MULTILOFT') (patch as Record<string, unknown>).multiloft_farbkern = null
            applyDetail({ ...detail, ...patch } as CopyShopDetailJson)
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
      {material === '350G_OFFSET' && BooleanSelect({ ...props, fieldKey: 'folienkaschiert', label: 'Double-sided matte laminate' })}
      {material === 'MULTILOFT' && (
        <SelectField
          {...props}
          fieldKey="multiloft_farbkern"
          label="Colour core"
          options={MULTILOFT_FARBKERNE.map(colorCore => ({ value: colorCore.wert, text: colorCore.anzeige }))}
        />
      )}
      {format === 'FREI' && <DimensionInputs {...props} />}
      {BooleanSelect({ ...props, fieldKey: 'randabfallend', label: 'Bleed' })}
      <NotesField {...props} />
    </>
  )
}

function BindingFreeDimensions(props: DetailBlockProps) {
  const { detail, fieldErrorClass, validationErrors, shouldValidate, patchLocal, commit } = props
  const width = detail.format_breite
  const height = detail.format_hoehe
  const widthValue = width === null || width === undefined ? '' : String(width)
  const heightValue = height === null || height === undefined ? '' : String(height)
  return (
    <div>
      <div className="ber-zeile">
        <span className="ber-lbl">Width (mm)</span>
        <div>
          <input
            type="number"
            className={'ber-inp' + fieldErrorClass('format_breite')}
            min={0.01}
            step={0.01}
            value={widthValue}
            onChange={e => {
              const raw = e.target.value
              patchLocal({
                format_breite: raw === '' ? null : parseFloat(raw),
              } as CopyShopDetailJson)
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
            className={'ber-inp' + fieldErrorClass('format_hoehe')}
            min={0.01}
            max={300}
            step={0.01}
            value={heightValue}
            onChange={e => {
              const raw = e.target.value
              patchLocal({
                format_hoehe: raw === '' ? null : parseFloat(raw),
              } as CopyShopDetailJson)
            }}
            onBlur={commit}
          />
          {shouldValidate && validationErrors.format_hoehe && <p className="ber-err ber-err--mass">{validationErrors.format_hoehe}</p>}
        </div>
      </div>
    </div>
  )
}

function BindingColorSelect(
  props: DetailBlockProps & {
    bindungsart: 'WIRE_O' | 'KUNSTSTOFFSPIRALE' | 'SOFTCOVER' | 'HARDCOVER' | ''
  },
) {
  const { bindungsart, detail, fieldErrorClass, validationErrors, shouldValidate, applyDetail } = props
  let colorOptions: { value: string; text: string }[] = []
  if (bindungsart === 'WIRE_O') {
    colorOptions = [
      { value: 'SCHWARZ', text: 'Black' },
      { value: 'SILBER', text: 'Silver' },
    ]
  } else if (bindungsart === 'KUNSTSTOFFSPIRALE') {
    colorOptions = [
      { value: 'SCHWARZ', text: 'Black' },
      { value: 'WEISS', text: 'White' },
    ]
  } else if (bindungsart === 'SOFTCOVER' || bindungsart === 'HARDCOVER') {
    colorOptions = [
      { value: 'SCHWARZ', text: 'Black' },
      { value: 'DUNKELBLAU', text: 'Dark blue' },
      { value: 'DUNKELROT', text: 'Dark red' },
    ]
  }
  return (
    <FieldRow label="Binding colour" error={shouldValidate && validationErrors.bindungsart_farbe ? validationErrors.bindungsart_farbe : undefined}>
      <select
        className={'ber-inp' + fieldErrorClass('bindungsart_farbe')}
        value={String((detail as Record<string, string>).bindungsart_farbe ?? '')}
        onChange={e =>
          applyDetail({ ...detail, bindungsart_farbe: e.target.value } as CopyShopDetailJson)
        }
        disabled={!bindungsart}
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
  const bindingType = String(detailRecord.bindungsart ?? '') as
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
              applyDetail({ ...detail, material: selected } as CopyShopDetailJson)
            } else {
              applyDetail({ ...detail, material: selected, material_sonstige: null } as CopyShopDetailJson)
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
      {detailRecord.material === 'SONSTIGE' && <TextField {...props} fieldKey="material_sonstige" label="Material (other)" rows={2} />}
      <SelectField
        {...props}
        fieldKey="farbigkeit"
        label="Colour mode"
        options={[
          { value: '1_0', text: '1/0' },
          { value: '1_1', text: '1/1' },
          { value: '4_0', text: '4/0' },
          { value: '4_1', text: '4/1' },
        ]}
      />
      <FieldRow label="Binding type" error={shouldValidate && validationErrors.bindungsart ? validationErrors.bindungsart : undefined}>
        <select
          className={'ber-inp' + fieldErrorClass('bindungsart')}
          value={bindingType}
          onChange={e => {
            const selected = e.target.value
            if (selected === 'SOFTCOVER' || selected === 'HARDCOVER') {
              applyDetail({
                ...detail,
                bindungsart: selected,
                format: 'A4',
                orientierung: 'HOCHFORMAT',
                format_breite: 210,
                format_hoehe: 297,
                hardcover_druck: selected === 'HARDCOVER' ? detail.hardcover_druck : null,
                hardcover_einband: selected === 'HARDCOVER' ? detail.hardcover_einband : null,
              } as CopyShopDetailJson)
            } else if (selected === 'WIRE_O' || selected === 'KUNSTSTOFFSPIRALE') {
              applyDetail({
                ...detail,
                bindungsart: selected,
                format: 'A5',
                orientierung: 'HOCHFORMAT',
                hardcover_druck: null,
                hardcover_einband: null,
                format_breite: null,
                format_hoehe: null,
              } as CopyShopDetailJson)
            } else {
              applyDetail({ ...detail, bindungsart: selected || null } as CopyShopDetailJson)
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

      <BindingColorSelect {...props} bindungsart={bindingType} />

      {bindingType === 'WIRE_O' || bindingType === 'KUNSTSTOFFSPIRALE' ? (
        <FieldRow label="Format" error={shouldValidate && validationErrors.format ? validationErrors.format : undefined}>
          <select
            className={'ber-inp' + fieldErrorClass('format')}
            value={wireFormat}
            onChange={e => {
              const selected = e.target.value
              if (selected === 'A3') {
                applyDetail({ ...detail, format: selected, orientierung: 'QUERFORMAT' } as CopyShopDetailJson)
              } else if (selected === 'FREI') {
                applyDetail({
                  ...detail,
                  format: 'FREI',
                  orientierung: null,
                  format_breite: null,
                  format_hoehe: null,
                } as CopyShopDetailJson)
              } else if (selected === 'A5' || selected === 'A4') {
                const currentOrientation = (detailRecord.orientierung as string) || 'HOCHFORMAT'
                const validOrientation = currentOrientation === 'QUERFORMAT' || currentOrientation === 'HOCHFORMAT' ? currentOrientation : 'HOCHFORMAT'
                applyDetail({ ...detail, format: selected, orientierung: validOrientation } as CopyShopDetailJson)
              } else {
                applyDetail({ ...detail, format: selected } as CopyShopDetailJson)
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
          fieldKey="orientierung"
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

      {BooleanSelect({ ...props, fieldKey: 'randabfallend', label: 'Bleed' })}

      {bindingType === 'HARDCOVER' && (
        <>
          {BooleanSelect({ ...props, fieldKey: 'hardcover_druck', label: 'Print on hardcover' })}
          {detail.hardcover_druck === true && <TextField {...props} fieldKey="hardcover_einband" label="Hardcover cover" rows={2} />}
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
              applyDetail({ ...detail, material: selected } as CopyShopDetailJson)
            } else {
              applyDetail({ ...detail, material: selected, material_sonstige: null } as CopyShopDetailJson)
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
      {material === 'SONSTIGE' && <TextField {...props} fieldKey="material_sonstige" label="Material (sonstige)" rows={2} />}
      <SelectField
        {...props}
        fieldKey="farbigkeit"
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
        fieldKey="lochen"
        label="Punching"
        options={[
          { value: 'NEIN', text: 'No' },
          { value: '2_LOCH', text: '2 holes' },
          { value: '4_LOCH', text: '4 holes' },
        ]}
      />
      {BooleanSelect({ ...props, fieldKey: 'heften', label: 'Staple' })}
      <SelectField
        {...props}
        fieldKey="laminieren"
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
