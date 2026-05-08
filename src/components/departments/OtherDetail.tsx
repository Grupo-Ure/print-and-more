import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../supabase'
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
  onDetailPatch: (patch: { typ?: string | null; detail: OtherDetailJson | null }) => Promise<void>
  orderFiles?: FileRow[]
}

type ProductRow = {
  id: string
  teilauftrag_id: string
  bereich: string
  detail: OtherDetailJson
  sort_order: number | null
  erstellt_am: string | null
}

const SONSTIGE_TYPE = 'SONSTIGE' as const

function extractOtherRaw(subOrder: SubOrderRow): OtherDetailJson {
  const rawDetail = subOrder.detail
  return rawDetail && typeof rawDetail === 'object' && !Array.isArray(rawDetail) ? { ...rawDetail } : {}
}

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

  const [detail, setDetail] = useState<OtherDetailJson>(extractOtherRaw(subOrder))
  const detailRef = useRef(detail)
  useEffect(() => {
    detailRef.current = detail
  }, [detail])

  useEffect(() => {
    setEditingId(null)
    setFormFileRecordIds([])
  }, [subOrder.id])

  useEffect(() => {
    setUnlocked(false)
  }, [subOrder.id])

  useEffect(() => {
    if (editingId !== null) return
    const extracted = extractOtherRaw(subOrder)
    setDetail(extracted)
    detailRef.current = extracted
  }, [subOrder, editingId])

  const loadFilesForProducts = useCallback(
    async (productRows: ProductRow[]) => {
      const ids = productRows.map(productRow => productRow.id)
      if (ids.length === 0) {
        setProductFiles({})
        return
      }
      const { data, error } = await supabase
        .from('produkt_dateien')
        .select('id, produkt_id, datei_id')
        .in('produkt_id', ids)
      if (error) {
        toastError('FileRecord-Zuordnungen konnten nicht geladen werden')
        setProductFiles({})
        return
      }
      const rows = (data ?? []) as Pick<
        Database['public']['Tables']['produkt_dateien']['Row'],
        'id' | 'produkt_id' | 'datei_id'
      >[]
      const next: Record<string, ProductFileAssignment[]> = {}
      for (const row of rows) {
        const list = next[row.produkt_id] ?? (next[row.produkt_id] = [])
        list.push({ assignmentId: row.id, fileId: row.datei_id })
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
    const { data, error } = await supabase
      .from('teilauftrag_produkte')
      .select('*')
      .eq('teilauftrag_id', subOrder.id)
      .eq('bereich', 'SONSTIGE')
      .order('sort_order')
    setProductsLoading(false)
    if (error) {
      toastError('Produkte konnten nicht geladen werden')
      setProducts([])
      await loadFilesForProducts([])
      return []
    }
    const rows = (data ?? []) as Database['public']['Tables']['teilauftrag_produkte']['Row'][]
    const mapped: ProductRow[] = rows.map(row => ({
      id: row.id,
      teilauftrag_id: row.teilauftrag_id,
      bereich: row.bereich,
      detail: (row.detail ?? {}) as OtherDetailJson,
      sort_order: row.sort_order,
      erstellt_am: row.erstellt_am,
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
      const fileAssignmentInsert: Database['public']['Tables']['produkt_dateien']['Insert'] = {
        produkt_id: productId,
        datei_id: fileId,
      }
      const { error } = await supabase.from('produkt_dateien').insert(fileAssignmentInsert)
      if (error) {
        toastError('FileRecord konnte nicht zugeordnet werden')
        return
      }
      await loadFilesForProducts(reloadRows)
    },
    [toastError, products, loadFilesForProducts],
  )

  const removeFileFromProduct = useCallback(
    async (assignmentId: string, productRowsForReload?: ProductRow[]) => {
      const { error } = await supabase.from('produkt_dateien').delete().eq('id', assignmentId)
      if (error) {
        toastError('Zuordnung konnte nicht entfernt werden')
        return
      }
      await loadFilesForProducts(productRowsForReload ?? products)
    },
    [toastError, products, loadFilesForProducts],
  )

  const resetForm = useCallback(() => {
    setEditingId(null)
    setFormFileRecordIds([])
    const extracted = extractOtherRaw(subOrder)
    setDetail(extracted)
    detailRef.current = extracted
  }, [subOrder])

  const validationErrors = validateOtherDetail(detail, subOrderStatus)
  const shouldValidate = subOrderStatus !== 'ANGEBOT'
  const fieldErrorClass = (fieldKey: string) => (shouldValidate && validationErrors[fieldKey] ? ' ber-inp--err' : '')

  const saveDetail = useCallback(
    async (json: OtherDetailJson) => {
      setDetail(json)
      detailRef.current = json
      if (editingId !== null) return
      await onDetailPatch({ typ: subOrder.typ?.trim() ? subOrder.typ : SONSTIGE_TYPE, detail: json })
    },
    [onDetailPatch, subOrder.typ, editingId]
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
    (subOrderStatus === 'PREPRESS_BEREIT' || subOrderStatus === 'PRODUKTION_BEREIT') && !unlocked

  const patchType = subOrder.typ?.trim() ? subOrder.typ : SONSTIGE_TYPE

  const handleAddOrSave = useCallback(async () => {
    const currentDetail = { ...detailRef.current }
    const errors = validateOtherDetail(currentDetail, subOrderStatus)
    if (Object.keys(errors).length > 0) return

    const detailWithType = { ...currentDetail, typ: SONSTIGE_TYPE }

    if (editingId) {
      const patch: Database['public']['Tables']['teilauftrag_produkte']['Update'] = {
        detail: detailWithType as Json,
      }
      const { error } = await supabase.from('teilauftrag_produkte').update(patch).eq('id', editingId)
      if (error) {
        toastError('Produkt konnte nicht gespeichert werden')
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
        typ: patchType,
        detail: {
          ...extractOtherRaw(subOrder),
          hat_products: list.length > 0,
        },
      })
      resetForm()
      return
    }

    const productInsert: Database['public']['Tables']['teilauftrag_produkte']['Insert'] = {
      teilauftrag_id: subOrder.id,
      bereich: 'SONSTIGE',
      detail: detailWithType as Json,
      sort_order: products.length,
    }
    const { data: insertedRow, error } = await supabase.from('teilauftrag_produkte').insert(productInsert).select('id').single()
    if (error) {
      toastError('Produkt konnte nicht hinzugefügt werden')
      return
    }
    const newId = insertedRow?.id != null ? String(insertedRow.id) : ''
    if (!newId) {
      toastError('Produkt konnte nicht hinzugefügt werden')
      return
    }
    let list = await reloadProducts()
    for (const fid of formFileRecordIds) {
      await assignFileToProduct(newId, fid, list)
    }
    list = await reloadProducts()
    await onDetailPatch({
      typ: patchType,
      detail: {
        ...extractOtherRaw(subOrder),
        hat_products: list.length > 0,
      },
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
    patchType,
    assignFileToProduct,
    removeFileFromProduct,
  ])

  const handleDelete = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('teilauftrag_produkte').delete().eq('id', id)
      if (error) {
        toastError('Produkt konnte nicht gelöscht werden')
        return
      }
      const list = await reloadProducts()
      await onDetailPatch({
        typ: patchType,
        detail: {
          ...extractOtherRaw(subOrder),
          hat_products: list.length > 0,
        },
      })
      if (editingId === id) resetForm()
    },
    [toastError, reloadProducts, editingId, resetForm, onDetailPatch, subOrder, patchType]
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
      <h3 className="ber-h3">Sonstige — Details</h3>
      <p className="ber-hinweis">Bei &apos;Sonstige&apos; wird PREPRESS_BEREIT nur manuell gesetzt.</p>

      <div className="ber-zeile" style={{ marginBottom: 8 }}>
        <span className="ber-lbl">Typ</span>
        <p className="td-wert td-mono" style={{ margin: 0 }}>
          {SONSTIGE_TYPE}
        </p>
      </div>

      <FieldRow
        label="Beschreibung / Inhalt"
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
              Änderungen nach Produktionsfreigabe setzen den Status zurück
            </p>
          </div>
        }
      />

      <OptionalQuantityInput {...detailBlock} />

      {orderFiles.length > 0 && (
        <FieldRow label="Dateien">
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
                  {orderFiles.find(file => file.id === fid)?.anzeigename ?? fid}
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
              <option value="">FileRecord hinzufügen…</option>
              {orderFiles
                .filter(file => !formFileRecordIds.includes(file.id))
                .map(file => (
                  <option key={file.id} value={file.id}>
                    {file.anzeigename}
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
                  'Teilauftrag ist bereits freigegeben.\nWirklich Produkte bearbeiten?',
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
            ? 'Bearbeitung entsperren'
            : editingId
              ? 'Speichern'
              : 'Produkt hinzufügen'}
        </button>
        {editingId && (
          <button type="button" className="cp-btn cp-btn-grau" onClick={() => resetForm()}>
            Abbrechen
          </button>
        )}
      </div>
      {unlocked && (
        <p className="ber-hinweis" style={{ fontSize: 12, margin: '6px 0 0' }}>
          Bearbeitung entsperrt — Änderungen setzen Status zurück
        </p>
      )}

      <div style={{ borderTop: '1px solid var(--color-border, #e5e7eb)', marginTop: 10, paddingTop: 10 }}>
        <h3 className="wa-dl-titel" style={{ margin: 0 }}>
          Produkte
        </h3>
        {productsLoading ? (
          <p className="ber-hinweis" style={{ fontSize: 12, margin: '6px 0 0' }}>
            Lädt Produkte …
          </p>
        ) : products.length === 0 ? (
          <p className="ber-hinweis" style={{ fontSize: 12, margin: '6px 0 0' }}>
            Noch keine Produkte.
          </p>
        ) : (
          <div style={{ overflowX: 'auto', marginTop: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                    Typ
                  </th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                    Stückzahl
                  </th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                    Beschreibung
                  </th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                    Aktionen
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
                            Bearbeiten
                          </button>
                          <button type="button" className="cp-btn cp-btn-rot" onClick={() => void handleDelete(product.id)}>
                            Löschen
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
                                    orderFiles.find(file => file.id === assignment.fileId)?.anzeigename ?? assignment.fileId,
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
      label="Stückzahl (optional)"
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
            Falls relevant, Stückzahl hier oder in der Beschreibung angeben
          </p>
        </div>
      }
    />
  )
}
