import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { subOrderProductService, type SubOrderProductRow } from '../../services/subOrderProductService'
import { validateOtherDetail } from '../../lib/other/validateOtherDetail'
import type { OrderStatus, SubOrderRow } from '../../types/database'
import type { Database, Json } from '../../types/supabase'
import type { FileRow } from '../../services/fileService'
import { useToast } from '../Toast'
import '../WorkArea.css'

export type OtherDetailJson = Record<string, unknown>

type Props = {
  subOrder: SubOrderRow
  subOrderStatus: OrderStatus
  orderFiles?: FileRow[]
  onProductsChanged?: (hasProducts: boolean) => void
}

type ProductRow = {
  id: string
  sub_order_id: string
  department: string
  detail: OtherDetailJson
  sort_order: number | null
  created_at: string | null
}

const SONSTIGE_TYPE = 'OTHER' as const

type DetailBlockProps = {
  detail: OtherDetailJson
  fieldErrorClass: (fieldKey: string) => string
  shouldValidate: boolean
  validationErrors: Record<string, string>
  patchLocal: (patch: OtherDetailJson) => void
  commit: () => void
  applyDetail: (newDetail: OtherDetailJson) => void
}

type ProductFileAssignment = { assignmentId: string; fileId: string }

export function OtherDetail({
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

  const [detail, setDetail] = useState<OtherDetailJson>({})
  const detailRef = useRef(detail)
  useEffect(() => {
    detailRef.current = detail
  }, [detail])

  useEffect(() => {
    setEditingId(null)
    setFormFileRecordIds([])
    setUnlocked(false)
    setDetail({})
    detailRef.current = {}
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
      detail: (row.detail ?? {}) as OtherDetailJson,
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
    setDetail({})
    detailRef.current = {}
  }, [])

  const validationErrors = validateOtherDetail(detail, subOrderStatus)
  const shouldValidate = subOrderStatus !== 'QUOTE'
  const fieldErrorClass = (fieldKey: string) => (shouldValidate && validationErrors[fieldKey] ? ' ber-inp--err' : '')

  const saveDetail = useCallback(
    (json: OtherDetailJson) => {
      setDetail(json)
      detailRef.current = json
    },
    []
  )

  const patchLocal = useCallback((patch: OtherDetailJson) => {
    setDetail(currentDetail => {
      const merged = { ...currentDetail, ...patch }
      detailRef.current = merged
      return merged
    })
  }, [])

  const commit = useCallback(() => {
    void saveDetail({ ...detailRef.current })
  }, [saveDetail])

  const applyDetail = useCallback(
    (newDetail: OtherDetailJson) => {
      setDetail(newDetail)
      detailRef.current = newDetail
      void saveDetail(newDetail)
    },
    [saveDetail]
  )

  const detailBlock: DetailBlockProps = { detail, fieldErrorClass, shouldValidate, validationErrors, patchLocal, commit, applyDetail }

  const formOk = useMemo(() => Object.keys(validationErrors).length === 0, [validationErrors])

  const requiresUnlock =
    (subOrderStatus === 'PREPRESS_READY' || subOrderStatus === 'PRODUCTION_READY') && !unlocked

  const handleAddOrSave = useCallback(async () => {
    const currentDetail = { ...detailRef.current }
    const errors = validateOtherDetail(currentDetail, subOrderStatus)
    if (Object.keys(errors).length > 0) return

    const detailWithType = { ...currentDetail, typ: SONSTIGE_TYPE }

    if (editingId) {
      const patch: Database['public']['Tables']['sub_order_products']['Update'] = {
        detail: detailWithType as Json,
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
      const list = await reloadProducts()
      onProductsChanged?.(list.length > 0)
      resetForm()
      return
    }

    const productInsert: Database['public']['Tables']['sub_order_products']['Insert'] = {
      sub_order_id: subOrder.id,
      department: 'OTHER',
      detail: detailWithType as Json,
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
    const finalList = await reloadProducts()
    onProductsChanged?.(finalList.length > 0)
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
    const cleanDetail = { ...(row.detail ?? {}) as OtherDetailJson }
    setDetail(cleanDetail)
    detailRef.current = cleanDetail
  }, [productFiles])

  return (
    <div className="ber-lfp">
      <h3 className="ber-h3">Other — Details</h3>
      <p className="ber-hinweis">For &apos;Other&apos;, PREPRESS_READY is set manually only.</p>

      <div className="ber-zeile" style={{ marginBottom: 8 }}>
        <span className="ber-lbl">Type</span>
        <p className="td-wert td-mono" style={{ margin: 0 }}>
          {SONSTIGE_TYPE}
        </p>
      </div>

      <FieldRow
        label="Description / Content"
        error={shouldValidate && validationErrors.beschreibung ? validationErrors.beschreibung : undefined}
        content={
          <div>
            <textarea
              className={'ber-inp' + fieldErrorClass('beschreibung')}
              rows={8}
              value={String(detail['beschreibung'] ?? '')}
              onChange={e => patchLocal({ beschreibung: e.target.value || null } as OtherDetailJson)}
              onBlur={commit}
            />
            <p className="ber-hinweis" style={{ marginTop: 6, marginBottom: 0 }}>
              Changes after production release will reset the status
            </p>
          </div>
        }
      />

      <OptionalQuantityInput {...detailBlock} />

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
          disabled={requiresUnlock ? false : !formOk}
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
                  const quantity = productDetail.stueckzahl ?? ''
                  const description =
                    String(productDetail.beschreibung ?? '')
                      .trim()
                      .slice(0, 72) || '—'
                  const fileAssignments = productFiles[product.id] ?? []
                  return (
                    <tr key={product.id}>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{SONSTIGE_TYPE}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>
                        {String(quantity || '—')}
                      </td>
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

function OptionalQuantityInput({ detail, fieldErrorClass, validationErrors, shouldValidate, patchLocal, commit }: DetailBlockProps) {
  const rawValue = detail.stueckzahl
  let numForInput: number | '' = ''
  if (typeof rawValue === 'number' && Number.isInteger(rawValue) && rawValue >= 1) numForInput = rawValue
  else if (typeof rawValue === 'string' && rawValue.trim() !== '') {
    const parsed = parseInt(rawValue, 10)
    if (Number.isInteger(parsed) && parsed >= 1) numForInput = parsed
  }
  return (
    <FieldRow
      label="Quantity (optional)"
      error={shouldValidate && validationErrors.stueckzahl ? validationErrors.stueckzahl : undefined}
      content={
        <div>
          <input
            type="number"
            className={'ber-inp' + fieldErrorClass('stueckzahl')}
            value={numForInput}
            onChange={e => {
              const inputValue = e.target.value
              patchLocal({ stueckzahl: inputValue === '' ? null : parseInt(inputValue, 10) } as OtherDetailJson)
            }}
            onBlur={commit}
            min={1}
            placeholder="—"
          />
          <p className="ber-hinweis" style={{ marginTop: 6, marginBottom: 0 }}>
            If relevant, enter quantity here or in the description
          </p>
        </div>
      }
    />
  )
}
