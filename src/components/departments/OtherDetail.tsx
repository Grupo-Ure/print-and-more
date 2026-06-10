import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { subOrderProductService } from '../../services/subOrderProductService'
import { validateOtherDetail } from '../../lib/other/validateOtherDetail'
import type { OrderStatus, SubOrderRow } from '../../types/database'
import type { LoadedProduct, ProductWriteInput } from '../../types/product'
import type { FileRow } from '../../services/fileService'
import { useToast } from '../Toast'
import '../WorkArea.css'

type Props = {
  subOrder: SubOrderRow
  subOrderStatus: OrderStatus
  orderFiles?: FileRow[]
  onProductsChanged?: (hasProducts: boolean) => void
}

const OTHER_TYPE = 'OTHER' as const

/** English form fields for an Other product: child `description` + parent `quantity`. */
type OtherFields = {
  description: string | null
  quantity: number | null
}

type DetailBlockProps = {
  fields: OtherFields
  fieldErrorClass: (fieldKey: string) => string
  shouldValidate: boolean
  validationErrors: Record<string, string>
  patchLocal: (patch: Partial<OtherFields>) => void
  commit: () => void
}

type ProductFileAssignment = { assignmentId: string; fileId: string }

const emptyFields = (): OtherFields => ({ description: null, quantity: null })

export function OtherDetail({
  subOrder,
  subOrderStatus,
  orderFiles = [],
  onProductsChanged,
}: Props) {
  const { showError } = useToast()

  const [products, setProducts] = useState<LoadedProduct[]>([])
  const [productFiles, setProductFiles] = useState<Record<string, ProductFileAssignment[]>>({})
  const productFilesRef = useRef(productFiles)
  productFilesRef.current = productFiles
  const [productsLoading, setProductsLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [unlocked, setUnlocked] = useState(false)
  const [formFileRecordIds, setFormFileRecordIds] = useState<string[]>([])

  const [fields, setFields] = useState<OtherFields>(emptyFields())
  const fieldsRef = useRef(fields)
  useEffect(() => {
    fieldsRef.current = fields
  }, [fields])

  useEffect(() => {
    setEditingId(null)
    setFormFileRecordIds([])
    setUnlocked(false)
    setFields(emptyFields())
    fieldsRef.current = emptyFields()
  }, [subOrder.id])

  const loadFilesForProducts = useCallback(
    async (productRows: LoadedProduct[]) => {
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

  const reloadProducts = useCallback(async (): Promise<LoadedProduct[]> => {
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
    setProducts(rows)
    await loadFilesForProducts(rows)
    return rows
  }, [subOrder.id, showError, loadFilesForProducts])

  useEffect(() => {
    void reloadProducts()
  }, [reloadProducts])

  const assignFileToProduct = useCallback(
    async (productId: string, fileId: string, productRowsForReload?: LoadedProduct[]) => {
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
    async (assignmentId: string, productRowsForReload?: LoadedProduct[]) => {
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
    setFields(emptyFields())
    fieldsRef.current = emptyFields()
  }, [])

  const validationErrors = useMemo(
    () => validateOtherDetail(fields as unknown as Record<string, unknown>, subOrderStatus),
    [fields, subOrderStatus],
  )
  const shouldValidate = subOrderStatus !== 'QUOTE'
  const fieldErrorClass = (fieldKey: string) => (shouldValidate && validationErrors[fieldKey] ? ' ber-inp--err' : '')

  const patchLocal = useCallback((patch: Partial<OtherFields>) => {
    setFields(current => {
      const merged = { ...current, ...patch }
      fieldsRef.current = merged
      return merged
    })
  }, [])

  const commit = useCallback(() => {
    setFields({ ...fieldsRef.current })
  }, [])

  const detailBlock: DetailBlockProps = { fields, fieldErrorClass, shouldValidate, validationErrors, patchLocal, commit }

  const formOk = useMemo(() => Object.keys(validationErrors).length === 0, [validationErrors])

  const requiresUnlock =
    (subOrderStatus === 'PREPRESS_READY' || subOrderStatus === 'PRODUCTION_READY') && !unlocked

  const handleAddOrSave = useCallback(async () => {
    const currentFields = { ...fieldsRef.current }
    const errors = validateOtherDetail(currentFields as unknown as Record<string, unknown>, subOrderStatus)
    if (Object.keys(errors).length > 0) return

    const buildInput = (sortOrder: number, id?: string): ProductWriteInput => ({
      ...(id ? { id } : {}),
      department_order_id: subOrder.id,
      department: 'OTHER',
      type: OTHER_TYPE,
      quantity: currentFields.quantity,
      notes: null,
      sort_order: sortOrder,
      child: { description: currentFields.description },
    })

    if (editingId) {
      const existing = products.find(product => product.id === editingId)
      try {
        await subOrderProductService.updateProduct(editingId, buildInput(existing?.sort_order ?? 0, editingId))
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

    let newId: string
    try {
      newId = await subOrderProductService.createProduct(buildInput(products.length))
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

  const handleEdit = useCallback((row: LoadedProduct) => {
    setEditingId(row.id)
    setFormFileRecordIds(productFiles[row.id]?.map(assignment => assignment.fileId) ?? [])
    const child = (row.child ?? {}) as { description?: string | null }
    const loaded: OtherFields = {
      description: child.description ?? null,
      quantity: row.quantity,
    }
    setFields(loaded)
    fieldsRef.current = loaded
  }, [productFiles])

  return (
    <div className="ber-lfp">
      <h3 className="ber-h3">Other — Details</h3>
      <p className="ber-hinweis">For &apos;Other&apos;, PREPRESS_READY is set manually only.</p>

      <div className="ber-zeile" style={{ marginBottom: 8 }}>
        <span className="ber-lbl">Type</span>
        <p className="td-wert td-mono" style={{ margin: 0 }}>
          {OTHER_TYPE}
        </p>
      </div>

      <FieldRow
        label="Description / Content"
        error={shouldValidate && validationErrors.description ? validationErrors.description : undefined}
        content={
          <div>
            <textarea
              className={'ber-inp' + fieldErrorClass('description')}
              rows={8}
              value={String(fields.description ?? '')}
              onChange={e => patchLocal({ description: e.target.value || null })}
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
                  const child = (product.child ?? {}) as { description?: string | null }
                  const quantity = product.quantity ?? ''
                  const description =
                    String(child.description ?? '')
                      .trim()
                      .slice(0, 72) || '—'
                  const fileAssignments = productFiles[product.id] ?? []
                  return (
                    <tr key={product.id}>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{OTHER_TYPE}</td>
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

function OptionalQuantityInput({ fields, fieldErrorClass, validationErrors, shouldValidate, patchLocal, commit }: DetailBlockProps) {
  const rawValue = fields.quantity
  let numForInput: number | '' = ''
  if (typeof rawValue === 'number' && Number.isInteger(rawValue) && rawValue >= 1) numForInput = rawValue
  return (
    <FieldRow
      label="Quantity (optional)"
      error={shouldValidate && validationErrors.quantity ? validationErrors.quantity : undefined}
      content={
        <div>
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
