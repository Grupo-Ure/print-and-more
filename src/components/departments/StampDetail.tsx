import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  STAMP_COLORS,
  STAMP_COLOR_LABELS,
  STAMP_TYPES,
  STAMP_TYPE_LABELS,
} from '../../types/stamp'
import { validateStampDetail } from '../../lib/stamp/validateStampDetail'
import { type OrderStatus, type SubOrderRow } from '../../types/database'
import type { LoadedProduct, ProductChildInsert, ProductWriteInput } from '../../types/product'
import { subOrderProductService } from '../../services/subOrderProductService'
import { stampService } from '../../services/stampService'
import type { FileRow } from '../../services/fileService'
import { useToast } from '../Toast'
import '../WorkArea.css'

type Props = {
  subOrder: SubOrderRow
  subOrderStatus: OrderStatus
  orderFiles?: FileRow[]
  onProductsChanged?: (hasProducts: boolean) => void
}

/** English child fields (per type) plus the parent `quantity`. */
type StampFields = Record<string, unknown>

type ProductRow = {
  id: string
  department: string
  type: string
  quantity: number | null
  notes: string | null
  child: Record<string, unknown>
  sort_order: number
  created_at: string
}

type StampFormContext = {
  fields: StampFields
  fieldErrorClass: (fieldKey: string) => string
  shouldValidate: boolean
  errors: Record<string, string>
  patchLocal: (patch: StampFields) => void
  commitChanges: () => void
  saveFields: (newFields: StampFields) => void
}

const EXTRA_TYPES = ['REFILL_INK', 'INK_PAD', 'STAMP_PLATE', 'TRODAT_PAD'] as const
const EXTRA_TYPE_LABELS: Record<(typeof EXTRA_TYPES)[number], string> = {
  REFILL_INK: 'Refill Ink',
  INK_PAD: 'Stamp Pad',
  STAMP_PLATE: 'Stamp Plate',
  TRODAT_PAD: 'Trodat Replacement Pad',
}

const REFILL_INK_COLORS = ['SCHWARZ', 'ROT', 'BLAU', 'GRUEN'] as const
const REFILL_INK_TYPES = ['NORMAL', 'HAUTVERTRAEGLICH', 'TEXTIL'] as const
const REFILL_INK_TYPE_LABELS: Record<(typeof REFILL_INK_TYPES)[number], string> = {
  NORMAL: 'Standard',
  HAUTVERTRAEGLICH: 'Skin-safe',
  TEXTIL: 'Textile',
}

const STAMP_PAD_SIZES = ['KLEIN', 'MITTEL', 'GROSS'] as const
const STAMP_PAD_SIZE_LABELS: Record<(typeof STAMP_PAD_SIZES)[number], string> = {
  KLEIN: 'Small',
  MITTEL: 'Medium',
  GROSS: 'Large',
}

type StampModel = {
  id: string
  name: string
  max_width_mm: number | null
  max_height_mm: number | null
  print_area: string | null
  stock: number | null
  replacement_pad_article_number: string | null
}

const REPLACEMENT_PAD_COLOR_SEQUENCE = ['SCHWARZ', 'ROT', 'BLAU', 'GRUEN'] as const

type ReplacementCushionRow = { farbe: string; label: string; bestand: number }

type CushionArticleRow = { article_number: string; name: string }
type CushionColorButton = { id: string; color: (typeof REPLACEMENT_PAD_COLOR_SEQUENCE)[number]; stock: number }


async function loadCushionColorRows(articleNumber: string): Promise<CushionColorButton[]> {
  let data: { id: string; name: string; color: string | null; stock: number | null }[]
  try {
    data = await stampService.getCushionsByArticleNumber(articleNumber)
  } catch (err) {
    console.error(err)
    return REPLACEMENT_PAD_COLOR_SEQUENCE.map(farbe => ({ id: '', color: farbe, stock: 0 }))
  }
  const colorRows = (data ?? []) as { id: string; color: string | null; stock: number | null }[]
  const byColor = new Map<string, (typeof colorRows)[0]>()
  for (const row of colorRows) {
    if (row.color) byColor.set(row.color, row)
  }
  return REPLACEMENT_PAD_COLOR_SEQUENCE.map(farbe => {
    const colorRow = byColor.get(farbe)
    return { id: colorRow?.id && String(colorRow.id) ? String(colorRow.id) : '', color: farbe, stock: colorRow ? Number(colorRow.stock) || 0 : 0 }
  })
}

function toPositiveIntOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const parsed = typeof v === 'number' ? v : parseInt(String(v), 10)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

function typeLabel(t: string): string {
  if ((EXTRA_TYPES as readonly string[]).includes(t)) return EXTRA_TYPE_LABELS[t as (typeof EXTRA_TYPES)[number]]
  if ((STAMP_TYPES as readonly string[]).includes(t)) return STAMP_TYPE_LABELS[t as (typeof STAMP_TYPES)[number]]
  return t
}

/** Build the typed child insert for the given type from the English form fields. */
function buildChildForType(type: string, fields: StampFields): ProductChildInsert {
  const width = toPositiveIntOrNull(fields.width)
  const height = toPositiveIntOrNull(fields.height)
  const str = (v: unknown): string | null => {
    if (v == null) return null
    const s = String(v).trim()
    return s === '' ? null : s
  }
  switch (type) {
    case 'TRODAT_PRINTY':
    case 'WOODEN_STAMP':
      return { model_id: str(fields.model_id) }
    case 'STAND_STAMP':
    case 'DATE_STAMP':
    case 'OTHER_STAMP':
      return {
        width,
        height,
        color: str(fields.color),
        color_other: str(fields.color_other),
        description: str(fields.description),
      }
    case 'STAMP_PLATE':
      return { width, height }
    case 'REFILL_INK':
      return { color: str(fields.color), ink_type: str(fields.ink_type) }
    case 'INK_PAD':
      return { pad_size: str(fields.pad_size), color: str(fields.color) }
    case 'TRODAT_PAD':
      return {
        pad_article_number: str(fields.pad_article_number),
        pad_variant_id: str(fields.pad_variant_id),
        color: str(fields.color),
      }
    default:
      return {} as ProductChildInsert
  }
}

type ProductFileAssignment = { assignmentId: string; fileId: string }

export function StampDetail({
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

  const [stampType, setStampType] = useState<string | null>(null)
  const [fields, setFields] = useState<StampFields>({})
  const fieldsRef = useRef(fields)
  const stampTypeRef = useRef(stampType)
  useEffect(() => {
    fieldsRef.current = fields
  }, [fields])
  useEffect(() => {
    stampTypeRef.current = stampType
  }, [stampType])

  // Display-only caches (dropped from storage; re-derived from selections).
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [selectedModelName, setSelectedModelName] = useState<string | null>(null)
  const [padName, setPadName] = useState<string | null>(null)

  useEffect(() => {
    setEditingId(null)
    setFormFileRecordIds([])
    setUnlocked(false)
    setStampType(null)
    setFields({})
    fieldsRef.current = {}
    stampTypeRef.current = null
    setSelectedModelId(null)
    setSelectedModelName(null)
    setPadName(null)
  }, [subOrder.id])

  const loadFilesForProducts = useCallback(
    async (productRows: ProductRow[]) => {
      const ids = productRows.map(p => p.id)
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
      const fileMap: Record<string, ProductFileAssignment[]> = {}
      for (const row of rows) {
        const assignmentList = fileMap[row.department_product_id] ?? (fileMap[row.department_product_id] = [])
        assignmentList.push({ assignmentId: row.id, fileId: row.file_id })
      }
      setProductFiles(fileMap)
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
    const mapped: ProductRow[] = rows.map(r => ({
      id: r.id,
      department: r.department,
      type: r.type,
      quantity: r.quantity,
      notes: r.notes,
      child: (r.child ?? {}) as Record<string, unknown>,
      sort_order: r.sort_order,
      created_at: r.created_at,
    }))
    setProducts(mapped)
    await loadFilesForProducts(mapped)
    return mapped
  }, [subOrder.id, showError, loadFilesForProducts])

  useEffect(() => {
    void reloadProducts()
  }, [reloadProducts])

  const assignFileToProduct = useCallback(
    async (produktId: string, dateiId: string, produktRowsForReload?: ProductRow[]) => {
      const reloadRows = produktRowsForReload ?? products
      if (productFilesRef.current[produktId]?.some(z => z.fileId === dateiId)) return
      try {
        await subOrderProductService.assignFileToProduct(produktId, dateiId)
      } catch {
        showError('File could not be assigned')
        return
      }
      await loadFilesForProducts(reloadRows)
    },
    [showError, products, loadFilesForProducts],
  )

  const removeFileFromProduct = useCallback(
    async (zuordnungId: string, produktRowsForReload?: ProductRow[]) => {
      try {
        await subOrderProductService.removeFileFromProduct(zuordnungId)
      } catch {
        showError('Assignment could not be removed')
        return
      }
      await loadFilesForProducts(produktRowsForReload ?? products)
    },
    [showError, products, loadFilesForProducts],
  )

  const resetForm = useCallback(() => {
    setEditingId(null)
    setFormFileRecordIds([])
    setStampType(null)
    setFields({})
    fieldsRef.current = {}
    stampTypeRef.current = null
    setSelectedModelId(null)
    setSelectedModelName(null)
    setPadName(null)
  }, [])

  const stampErrors = validateStampDetail(stampType, fields, subOrderStatus)
  const shouldValidate = subOrderStatus !== 'QUOTE'
  const fieldErrorClass = (fieldKey: string) => (shouldValidate && stampErrors[fieldKey] ? ' ber-inp--err' : '')

  const widthValue = toPositiveIntOrNull(fields.width)
  const heightValue = toPositiveIntOrNull(fields.height)
  const hasDimensions = (widthValue ?? 0) > 0 || (heightValue ?? 0) > 0

  const showDimensions = stampType !== 'REFILL_INK' && stampType !== 'INK_PAD' && stampType !== 'TRODAT_PAD'
  const showDescription =
    stampType !== 'REFILL_INK' &&
    stampType !== 'INK_PAD' &&
    stampType !== 'TRODAT_PAD' &&
    stampType !== 'STAMP_PLATE' &&
    !!stampType
  const showColor = showDescription // alle "klassischen" Typen
  const showQuantity = !!stampType

  const [models, setModels] = useState<StampModel[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelError, setModelError] = useState<string | null>(null)

  const [replacementCushions, setReplacementCushions] = useState<ReplacementCushionRow[] | null>(null)

  const [cushionSearchInput, setCushionSearchInput] = useState('')
  const [cushionSearchDebounced, setCushionSearchDebounced] = useState('')
  const [cushionSearchResults, setCushionSearchResults] = useState<CushionArticleRow[]>([])
  const [cushionSearchLoading, setCushionSearchLoading] = useState(false)
  const [cushionSearchError, setCushionSearchError] = useState<string | null>(null)
  const [cushionColorOptions, setCushionColorOptions] = useState<CushionColorButton[]>([])

  useEffect(() => {
    const currentType = stampTypeRef.current
    const currentFields = fieldsRef.current
    const width = toPositiveIntOrNull(currentFields.width)
    const height = toPositiveIntOrNull(currentFields.height)
    const hasDimensions = (width ?? 0) > 0 || (height ?? 0) > 0
    const isModelSuggestionType = currentType === 'TRODAT_PRINTY' || currentType === 'WOODEN_STAMP'
    if (!isModelSuggestionType || !hasDimensions) {
      setModels([])
      setModelError(null)
      setModelsLoading(false)
      return
    }

    let alive = true
    setModelsLoading(true)
    setModelError(null)

    void (async () => {
      try {
        const data = await stampService.getStampModelsByType(currentType as string)
        if (!alive) return
        {
          const width = toPositiveIntOrNull(fieldsRef.current.width)
          const height = toPositiveIntOrNull(fieldsRef.current.height)
          const baseWidth = width ?? 0
          const baseHeight = height ?? 0

          const filteredModels = (data as unknown as StampModel[]).filter(m => {
            const modelWidth = m.max_width_mm ?? 0
            const modelHeight = m.max_height_mm ?? 0
            if (width != null && height != null) return modelWidth >= width && modelHeight >= height
            if (width != null) return modelWidth >= width
            if (height != null) return modelHeight >= height
            return true
          })

          const sorted = filteredModels
            .slice()
            .sort((a, b) => {
              const distA =
                Math.abs((a.max_width_mm ?? 0) - baseWidth) + Math.abs((a.max_height_mm ?? 0) - baseHeight)
              const distB =
                Math.abs((b.max_width_mm ?? 0) - baseWidth) + Math.abs((b.max_height_mm ?? 0) - baseHeight)
              return distA - distB
            })
            .slice(0, 8)

          setModels(sorted)
          setModelError(null)
        }
      } catch (e) {
        if (!alive) return
        setModels([])
        setModelError(e instanceof Error ? e.message : String(e))
      } finally {
        if (alive) setModelsLoading(false)
      }
    })()

    return () => {
      alive = false
    }
  }, [stampType, widthValue, heightValue])

  useEffect(() => {
    if (!selectedModelId) {
      setReplacementCushions(null)
      return
    }
    let alive = true
    void (async () => {
      const fromList = models.find(m => m.id === selectedModelId)
      let articleNumber: string | null = (fromList?.replacement_pad_article_number && String(fromList.replacement_pad_article_number).trim()) || null
      if (!articleNumber) {
        const stampModel = await stampService.getStampModelForOrder(selectedModelId).catch(() => null)
        if (!alive) return
        if (!stampModel) {
          setReplacementCushions(null)
          return
        }
        articleNumber = stampModel.replacement_pad_article_number?.trim() || null
      }
      if (!articleNumber) {
        if (alive) setReplacementCushions(null)
        return
      }
      const cushionRows = await stampService.getCushionsByArticleNumber(articleNumber).catch(() => null)
      if (!alive) return
      if (!cushionRows) {
        setReplacementCushions(null)
        return
      }
      const byColor = new Map<string, (typeof cushionRows)[0]>()
      for (const row of cushionRows) {
        if (row.color) byColor.set(row.color, row)
      }
      setReplacementCushions(
        REPLACEMENT_PAD_COLOR_SEQUENCE.map(farbe => {
          const colorRow = byColor.get(farbe)
          return {
            farbe,
            label: STAMP_COLOR_LABELS[farbe],
            bestand: colorRow ? Number(colorRow.stock) || 0 : 0,
          }
        })
      )
    })()
    return () => {
      alive = false
    }
  }, [selectedModelId, models])

  useEffect(() => {
    if (stampType !== 'TRODAT_PAD') return
    const timer = setTimeout(() => setCushionSearchDebounced(cushionSearchInput), 350)
    return () => clearTimeout(timer)
  }, [cushionSearchInput, stampType])

  useEffect(() => {
    if (stampType !== 'TRODAT_PAD') {
      setCushionSearchResults([])
      setCushionSearchError(null)
      setCushionSearchLoading(false)
      return
    }
    const searchQuery = cushionSearchDebounced.trim()
    if (searchQuery.length < 1) {
      setCushionSearchResults([])
      setCushionSearchError(null)
      setCushionSearchLoading(false)
      return
    }
    let alive = true
    setCushionSearchLoading(true)
    setCushionSearchError(null)
    void (async () => {
      let searchRows: Awaited<ReturnType<typeof stampService.searchCushions>>
      try {
        searchRows = await stampService.searchCushions(searchQuery)
      } catch (err) {
        if (!alive) return
        setCushionSearchResults([])
        setCushionSearchError(err instanceof Error ? err.message : 'Search failed')
        setCushionSearchLoading(false)
        return
      }
      if (!alive) return
      const articlesByKey = new Map<string, CushionArticleRow>()
      for (const row of searchRows) {
        const articleKey = (row.article_number && String(row.article_number).trim()) || row.id
        if (!articlesByKey.has(articleKey)) {
          articlesByKey.set(articleKey, { article_number: row.article_number ? String(row.article_number) : '', name: row.name })
        }
      }
      setCushionSearchResults(
        [...articlesByKey.values()].sort(
          (a, b) => a.article_number.localeCompare(b.article_number) || a.name.localeCompare(b.name)
        )
      )
      setCushionSearchError(null)
      setCushionSearchLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [cushionSearchDebounced, stampType])

  useEffect(() => {
    if (stampType !== 'TRODAT_PAD') {
      setCushionSearchInput('')
      setCushionSearchDebounced('')
      setCushionSearchResults([])
      setCushionSearchError(null)
      setCushionColorOptions([])
      return
    }
  }, [stampType])

  useEffect(() => {
    if (stampType !== 'TRODAT_PAD') {
      setCushionColorOptions([])
      return
    }
    const art = String(fields['pad_article_number'] ?? '').trim()
    if (!art) {
      setCushionColorOptions([])
      return
    }
    let alive = true
    void loadCushionColorRows(art).then(rows => {
      if (alive) setCushionColorOptions(rows)
    })
    return () => {
      alive = false
    }
  }, [stampType, fields, subOrder.id])

  const save = useCallback(
    (nextTyp: string | null, newFields: StampFields) => {
      setFields(newFields)
      fieldsRef.current = newFields
      setStampType(nextTyp)
    },
    []
  )

  const patchLocal = useCallback((patch: StampFields) => {
    setFields(current => {
      const patched = { ...current, ...patch }
      fieldsRef.current = patched
      return patched
    })
  }, [])

  const commitChanges = useCallback(() => {
    void save(stampTypeRef.current, { ...fieldsRef.current })
  }, [save])

  const saveFields = useCallback(
    (newFields: StampFields) => {
      setFields(newFields)
      fieldsRef.current = newFields
      void save(stampTypeRef.current, newFields)
    },
    [save]
  )

  const formContext: StampFormContext = { fields, fieldErrorClass, shouldValidate, errors: stampErrors, patchLocal, commitChanges, saveFields }

  const formValid = useMemo(() => Object.keys(stampErrors).length === 0, [stampErrors])

  const requiresUnlock =
    (subOrderStatus === 'PREPRESS_READY' || subOrderStatus === 'PRODUCTION_READY') && !unlocked

  const handleAddOrSave = useCallback(async () => {
    const currentType = stampTypeRef.current
    const currentFields = { ...fieldsRef.current }
    if (!currentType) return
    const errors = validateStampDetail(currentType, currentFields, subOrderStatus)
    if (Object.keys(errors).length > 0) return

    const quantity = toPositiveIntOrNull(currentFields.quantity)
    const child = buildChildForType(currentType, currentFields)

    if (editingId) {
      const input: ProductWriteInput = {
        department_order_id: subOrder.id,
        department: 'STAMP',
        type: currentType,
        quantity,
        notes: null,
        sort_order: products.find(p => p.id === editingId)?.sort_order ?? products.length,
        child,
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
      const updatedProducts = await reloadProducts()
      onProductsChanged?.(updatedProducts.length > 0)
      resetForm()
      return
    }

    const input: ProductWriteInput = {
      department_order_id: subOrder.id,
      department: 'STAMP',
      type: currentType,
      quantity,
      notes: null,
      sort_order: products.length,
      child,
    }
    let newId: string
    try {
      newId = await subOrderProductService.createProduct(input)
    } catch {
      showError('Product could not be added')
      return
    }
    const updatedProducts = await reloadProducts()
    for (const fid of formFileRecordIds) {
      await assignFileToProduct(newId, fid, updatedProducts)
    }
    const finalProducts = await reloadProducts()
    onProductsChanged?.(finalProducts.length > 0)
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
      const updatedProducts = await reloadProducts()
      onProductsChanged?.(updatedProducts.length > 0)
      if (editingId === id) resetForm()
    },
    [showError, reloadProducts, editingId, resetForm, onProductsChanged]
  )

  const handleEdit = useCallback((row: ProductRow) => {
    setEditingId(row.id)
    setFormFileRecordIds(productFiles[row.id]?.map(z => z.fileId) ?? [])
    const child = (row.child ?? {}) as Record<string, unknown>
    const editType = row.type || null
    setStampType(editType)
    const editFields: StampFields = { ...child, quantity: row.quantity }
    setFields(editFields)
    fieldsRef.current = editFields
    stampTypeRef.current = editType
    setSelectedModelId(String(child.model_id ?? '') || null)
    setSelectedModelName(null)
    setPadName(null)
  }, [productFiles])

  // Re-derive the selected model's display name from the stamp catalog when
  // editing an existing TRODAT_PRINTY / WOODEN_STAMP (the cache is not stored).
  useEffect(() => {
    if (!selectedModelId) {
      setSelectedModelName(null)
      return
    }
    const fromList = models.find(m => m.id === selectedModelId)
    if (fromList) {
      setSelectedModelName(fromList.name)
      return
    }
    let alive = true
    const type = stampTypeRef.current
    if (type !== 'TRODAT_PRINTY' && type !== 'WOODEN_STAMP') return
    void stampService
      .getStampModelsByType(type)
      .then(rows => {
        if (!alive) return
        const found = (rows as unknown as StampModel[]).find(m => m.id === selectedModelId)
        if (found) setSelectedModelName(found.name)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [selectedModelId, models])

  // Re-derive the selected pad colour-variant name for the TRODAT_PAD badge
  // from the cushion catalog (the display cache is no longer stored).
  useEffect(() => {
    const variantId = String(fields['pad_variant_id'] ?? '').trim()
    const articleNumber = String(fields['pad_article_number'] ?? '').trim()
    if (stampType !== 'TRODAT_PAD' || !variantId || !articleNumber || padName) {
      if (stampType !== 'TRODAT_PAD' || !variantId) setPadName(null)
      return
    }
    let alive = true
    void stampService
      .getCushionsByArticleNumber(articleNumber)
      .then(rows => {
        if (!alive) return
        const found = (rows ?? []).find(r => String(r.id) === variantId)
        if (found) setPadName(found.name ?? null)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [stampType, fields, padName])

  const typeOptions = [...STAMP_TYPES, ...EXTRA_TYPES] as readonly string[]

  const cushionArticleNumber = String(fields['pad_article_number'] ?? '').trim()
  const cushionModelId = String(fields['pad_variant_id'] ?? '').trim()
  const cushionBadgeStock =
    (cushionModelId && cushionColorOptions.find(f => f.id === cushionModelId)?.stock) ?? null
  const cushionColorLabel =
    fields['color'] && typeof fields['color'] === 'string' && fields['color'] in STAMP_COLOR_LABELS
      ? STAMP_COLOR_LABELS[fields['color'] as keyof typeof STAMP_COLOR_LABELS]
      : String(fields['color'] ?? '—')

  return (
    <div className="ber-lfp">
      <h3 className="ber-h3">Stamp Details</h3>
      {stampType === 'OTHER_STAMP' && (
        <p className="ber-hinweis">
          For &apos;Other Stamps&apos;, PREPRESS_READY is set manually only.
        </p>
      )}

      <FormRow
        label="Type"
        error={shouldValidate && stampErrors.type ? stampErrors.type : undefined}
        content={
          <select
            className={'ber-inp' + fieldErrorClass('type')}
            value={stampType ?? ''}
            onChange={e => {
              const v = e.target.value
              if (v !== (stampType ?? '')) {
                setStampType(v || null)
                setFields({})
                fieldsRef.current = {}
                stampTypeRef.current = v || null
                setSelectedModelId(null)
                setSelectedModelName(null)
                setPadName(null)
                if (editingId === null) void save(v || null, {})
              } else {
                setStampType(v || null)
                stampTypeRef.current = v || null
              }
            }}
          >
            <option value="">—</option>
            {typeOptions.map(x => (
              <option key={x} value={x}>
                {typeLabel(x)}
              </option>
            ))}
          </select>
        }
      />

      {stampType === 'TRODAT_PAD' && (
        <>
          <FormRow
            label="Search"
            error={
              shouldValidate && (stampErrors.pad_article_number || stampErrors.pad_variant_id)
                ? [stampErrors.pad_article_number, stampErrors.pad_variant_id].filter(Boolean).join(' — ')
                : undefined
            }
            content={
              <div>
                <input
                  type="search"
                  className={'ber-inp' + fieldErrorClass('pad_article_number')}
                  placeholder="Model or article number…"
                  value={cushionSearchInput}
                  onChange={e => setCushionSearchInput(e.target.value)}
                />
                {cushionSearchLoading && <p className="ber-hinweis" style={{ marginTop: 6 }}>Searching…</p>}
                {cushionSearchError && <p className="ber-err" style={{ marginTop: 6 }}>{cushionSearchError}</p>}
                {!cushionSearchLoading && !cushionSearchError && cushionSearchDebounced.trim() !== '' && cushionSearchResults.length === 0 && (
                  <p className="ber-hinweis" style={{ marginTop: 6 }}>
                    No results
                  </p>
                )}
                {!cushionSearchLoading && cushionSearchResults.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                    {cushionSearchResults.map(result => (
                      <button
                        key={result.article_number || result.name}
                        type="button"
                        className="wa-btn wa-btn--ghost"
                        onClick={() => {
                          setPadName(result.name)
                          void loadCushionColorRows(result.article_number).then(rows => {
                            setCushionColorOptions(rows)
                            saveFields({
                              ...fieldsRef.current,
                              pad_article_number: result.article_number,
                              color: null,
                              pad_variant_id: null,
                            })
                          })
                        }}
                        style={{ textAlign: 'left', padding: '6px 8px' }}
                      >
                        <span style={{ fontWeight: 600, marginRight: 8 }}>{result.article_number || '—'}</span>
                        {result.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            }
          />
          {!!cushionArticleNumber && cushionColorOptions.length > 0 && (
            <FormRow
              label="Colour"
              error={shouldValidate && (stampErrors.color || stampErrors.pad_variant_id) ? [stampErrors.color, stampErrors.pad_variant_id].filter(Boolean).join(' — ') : undefined}
              content={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexWrap: 'wrap' }}>
                  {cushionColorOptions.map(fv => {
                    const isSelected = cushionModelId && fv.id && cushionModelId === fv.id
                    const noStock = fv.stock <= 0
                    return (
                      <button
                        key={fv.color}
                        type="button"
                        className="wa-btn wa-btn--ghost"
                        disabled={!fv.id}
                        onClick={() => {
                          if (!fv.id) return
                          saveFields({
                            ...fieldsRef.current,
                            color: fv.color,
                            pad_variant_id: fv.id,
                          })
                        }}
                        style={{
                          textAlign: 'left',
                          border: isSelected ? '1px solid rgba(59, 130, 246, 0.45)' : undefined,
                          background: isSelected ? 'rgba(59, 130, 246, 0.12)' : undefined,
                          color: noStock ? '#f59e0b' : undefined,
                          fontWeight: noStock || isSelected ? 600 : undefined,
                        }}
                      >
                        {STAMP_COLOR_LABELS[fv.color as keyof typeof STAMP_COLOR_LABELS]} (Stock: {fv.stock})
                      </button>
                    )
                  })}
                </div>
              }
            />
          )}
          <QuantityInput {...formContext} label="Quantity" />
          {cushionModelId && (
            <FormRow label="Selected" error={undefined}>
              <div
                className="wa-badge"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 8px',
                  borderRadius: 999,
                  border: '1px solid rgba(255,255,255,0.18)',
                  background: 'rgba(255,255,255,0.06)',
                  fontSize: 12,
                }}
              >
                {cushionArticleNumber !== '' ? cushionArticleNumber : '—'} {padName ?? ''} · {cushionColorLabel} ·
                Stock: {cushionBadgeStock == null ? '—' : cushionBadgeStock}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setCushionColorOptions([])
                    setCushionSearchInput('')
                    setPadName(null)
                    saveFields({
                      ...fieldsRef.current,
                      pad_article_number: null,
                      pad_variant_id: null,
                      color: null,
                    })
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setCushionColorOptions([])
                      setCushionSearchInput('')
                      setPadName(null)
                      saveFields({
                        ...fieldsRef.current,
                        pad_article_number: null,
                        pad_variant_id: null,
                        color: null,
                      })
                    }
                  }}
                  style={{ cursor: 'pointer', padding: '0 6px', userSelect: 'none', fontWeight: 700 }}
                  title="Deselect"
                >
                  ×
                </span>
              </div>
            </FormRow>
          )}
        </>
      )}

      {showQuantity && stampType !== 'TRODAT_PAD' && (
        <QuantityInput {...formContext} label={stampType === 'REFILL_INK' || stampType === 'INK_PAD' ? 'Count' : 'Quantity'} />
      )}

      {stampType === 'INK_PAD' && (
        <FormRow label="Size" error={shouldValidate && stampErrors.pad_size ? stampErrors.pad_size : undefined}>
          <select
            className={'ber-inp' + fieldErrorClass('pad_size')}
            value={String(fields['pad_size'] ?? '')}
            onChange={e =>
              saveFields({ ...fields, pad_size: e.target.value || null })
            }
          >
            <option value="">—</option>
            {STAMP_PAD_SIZES.map(g => (
              <option key={g} value={g}>
                {STAMP_PAD_SIZE_LABELS[g]}
              </option>
            ))}
          </select>
        </FormRow>
      )}

      {(showColor || stampType === 'REFILL_INK' || stampType === 'INK_PAD') &&
        stampType !== 'STAMP_PLATE' &&
        stampType !== 'TRODAT_PAD' && (
        <FormRow
          label="Colour"
          error={
            (shouldValidate && stampErrors.color) || (shouldValidate && stampErrors.color_other)
              ? [stampErrors.color, stampErrors.color_other].filter(Boolean).join(' — ')
              : undefined
          }
          content={
            <div>
              <select
                className={'ber-inp' + fieldErrorClass('color')}
                value={String(fields['color'] ?? '')}
                onChange={e => {
                  const v = e.target.value
                  const next: StampFields = { ...fields, color: v || null }
                  if (v !== 'SONSTIGE') next.color_other = null
                  saveFields(next)
                }}
              >
                <option value="">—</option>
                {(stampType === 'REFILL_INK' || stampType === 'INK_PAD' ? REFILL_INK_COLORS : STAMP_COLORS).map(
                  fv => (
                    <option key={fv} value={fv}>
                      {STAMP_COLOR_LABELS[fv as (typeof STAMP_COLORS)[number]]}
                    </option>
                  )
                )}
              </select>
              {String(fields['color'] ?? '') === 'SONSTIGE' && stampType !== 'REFILL_INK' && (
                <div style={{ marginTop: 8 }}>
                  <input
                    type="text"
                    className={'ber-inp' + fieldErrorClass('color_other')}
                    placeholder="Colour (free text)"
                    value={String(fields['color_other'] ?? '')}
                    onChange={e => patchLocal({ color_other: e.target.value || null })}
                    onBlur={commitChanges}
                  />
                </div>
              )}
            </div>
          }
        />
      )}

      {stampType === 'REFILL_INK' && (
        <FormRow label="Type" error={shouldValidate && stampErrors.ink_type ? stampErrors.ink_type : undefined}>
          <select
            className={'ber-inp' + fieldErrorClass('ink_type')}
            value={String(fields['ink_type'] ?? '')}
            onChange={e =>
              saveFields({ ...fields, ink_type: e.target.value || null })
            }
          >
            <option value="">—</option>
            {REFILL_INK_TYPES.map(tt => (
              <option key={tt} value={tt}>
                {REFILL_INK_TYPE_LABELS[tt]}
              </option>
            ))}
          </select>
        </FormRow>
      )}

      {showDimensions && (
        <FormRow
          label="Format (mm)"
          error={
            shouldValidate && (stampErrors.format || stampErrors.width || stampErrors.height)
              ? [stampErrors.format, stampErrors.width, stampErrors.height].filter(Boolean).join(' — ')
              : undefined
          }
          content={
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 140px', minWidth: 140 }}>
                <input
                  type="number"
                  className={'ber-inp' + fieldErrorClass('width')}
                  placeholder="Width"
                  value={widthValue ?? ''}
                  onChange={e => {
                    const raw = e.target.value
                    patchLocal({ width: raw === '' ? null : parseInt(raw, 10) })
                  }}
                  onBlur={commitChanges}
                  min={1}
                />
              </div>
              <div style={{ flex: '1 1 140px', minWidth: 140 }}>
                <input
                  type="number"
                  className={'ber-inp' + fieldErrorClass('height')}
                  placeholder="Height"
                  value={heightValue ?? ''}
                  onChange={e => {
                    const raw = e.target.value
                    patchLocal({ height: raw === '' ? null : parseInt(raw, 10) })
                  }}
                  onBlur={commitChanges}
                  min={1}
                />
              </div>
            </div>
          }
        />
      )}

      {(stampType === 'TRODAT_PRINTY' || stampType === 'WOODEN_STAMP') && showDimensions && hasDimensions && (
        <FormRow label="Suggested model">
          <div>
            {selectedModelId && (
              <div style={{ marginBottom: 8 }}>
                <div
                  className="wa-badge"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 8px',
                    borderRadius: 999,
                    border: '1px solid rgba(255,255,255,0.18)',
                    background: 'rgba(255,255,255,0.06)',
                    fontSize: 12,
                  }}
                >
                  Selected: {selectedModelName || 'Model'}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedModelId(null)
                      setSelectedModelName(null)
                      saveFields({ ...fieldsRef.current, model_id: null })
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setSelectedModelId(null)
                        setSelectedModelName(null)
                        saveFields({ ...fieldsRef.current, model_id: null })
                      }
                    }}
                    style={{ cursor: 'pointer', padding: '0 6px', userSelect: 'none', fontWeight: 700 }}
                    title="Deselect model"
                  >
                    ×
                  </span>
                </div>
                {replacementCushions && replacementCushions.length > 0 && (
                  <div style={{ margin: '6px 0 0 0', fontSize: 12, opacity: 0.92 }}>
                    {replacementCushions.map(z => (
                      <div
                        key={z.farbe}
                        style={{
                          color: z.bestand <= 0 ? '#f59e0b' : undefined,
                          fontWeight: z.bestand <= 0 ? 600 : undefined,
                        }}
                      >
                        {z.label}: Stock {z.bestand}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {modelsLoading && <p className="ber-hinweis">Searching matching models…</p>}
            {!modelsLoading && modelError && <p className="ber-err">{modelError}</p>}

            {!modelsLoading && !modelError && models.length === 0 && (
              <p className="ber-hinweis">
                No matching model found — please check dimensions or enter manually
              </p>
            )}

            {!selectedModelId && !modelsLoading && !modelError && models.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {models.map(m => {
                  const noStock = (m.stock ?? 0) <= 0
                  const isSelected = m.id === selectedModelId
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className="wa-btn wa-btn--ghost"
                      onClick={() => {
                        if (isSelected) {
                          setSelectedModelId(null)
                          setSelectedModelName(null)
                          saveFields({ ...fieldsRef.current, model_id: null })
                          return
                        }
                        setSelectedModelId(m.id)
                        setSelectedModelName(m.name)
                        saveFields({ ...fieldsRef.current, model_id: m.id })
                      }}
                      style={{
                        textAlign: 'left',
                        display: 'flex',
                        gap: 10,
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(59, 130, 246, 0.18)' : undefined,
                        border: isSelected ? '1px solid rgba(59, 130, 246, 0.45)' : undefined,
                      }}
                    >
                      <span style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        {isSelected && <span title="Selected">✓</span>}
                        {m.name}
                      </span>
                      <span style={{ opacity: 0.8 }}>{m.print_area ?? ''}</span>
                      <span style={{ opacity: 0.9, whiteSpace: 'nowrap' }}>
                        Stock: {m.stock ?? 0}
                        {noStock && (
                          <span style={{ marginLeft: 8, color: '#f59e0b', fontWeight: 600 }}>Out of stock</span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </FormRow>
      )}

      {showDescription && (
        <FormRow
          label="Description / Content"
          error={shouldValidate && stampErrors.description ? stampErrors.description : undefined}
          content={
            <div>
              <textarea
                className={'ber-inp' + fieldErrorClass('description')}
                rows={6}
                value={String(fields['description'] ?? '')}
                onChange={e => patchLocal({ description: e.target.value || null })}
                onBlur={commitChanges}
              />
              <p className="ber-hinweis" style={{ marginTop: 6, marginBottom: 0 }}>
                Changes after production release reset the status (description, width/height)
              </p>
            </div>
          }
        />
      )}

      {orderFiles.length > 0 && (
        <FormRow label="Files">
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
                  {orderFiles.find(df => df.id === fid)?.display_name ?? fid}
                </span>
                <button
                  type="button"
                  className="cp-btn cp-btn-grau"
                  style={{ minWidth: 22, padding: '0 6px', fontSize: 14, lineHeight: 1 }}
                  title="Remove"
                  onClick={() => setFormFileRecordIds(prev => prev.filter(x => x !== fid))}
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
                const v = e.target.value
                if (v && !formFileRecordIds.includes(v)) {
                  setFormFileRecordIds(prev => [...prev, v])
                }
              }}
            >
              <option value="">Add file…</option>
              {orderFiles
                .filter(df => !formFileRecordIds.includes(df.id))
                .map(df => (
                  <option key={df.id} value={df.id}>
                    {df.display_name}
                  </option>
                ))}
            </select>
          </div>
        </FormRow>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="cp-btn"
          disabled={requiresUnlock ? false : !stampType || !formValid}
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
                    Summary
                  </th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {products.map(r => {
                  const child = (r.child ?? {}) as Record<string, unknown>
                  const productType = r.type || ''
                  const quantity = r.quantity ?? ''
                  const shortDescription =
                    String(child.description ?? '')
                      .trim()
                      .slice(0, 60) || '—'
                  const typeDisplay = typeLabel(productType)
                  const fileAssignments = productFiles[r.id] ?? []
                  return (
                    <tr key={r.id}>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>
                        {typeDisplay || '—'}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>
                        {String(quantity || '—')}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{shortDescription}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button type="button" className="cp-btn cp-btn-grau" onClick={() => handleEdit(r)}>
                            Edit
                          </button>
                          <button type="button" className="cp-btn cp-btn-rot" onClick={() => void handleDelete(r.id)}>
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
                                  z =>
                                    orderFiles.find(df => df.id === z.fileId)?.display_name ?? z.fileId,
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

function FormRow({ label, content, error, children }: { label: string; content?: React.ReactNode; error?: string; children?: React.ReactNode }) {
  const displayContent = content ?? children
  return (
    <div className="ber-zeile">
      <span className="ber-lbl">{label}</span>
      <div>
        {displayContent}
        {error && <p className="ber-err">{error}</p>}
      </div>
    </div>
  )
}

function QuantityInput(context: StampFormContext & { label: string }) {
  const { fields, fieldErrorClass, errors, shouldValidate, patchLocal, commitChanges, label } = context
  const rawQuantity = fields.quantity
  let numForInput: number | '' = ''
  if (typeof rawQuantity === 'number' && Number.isInteger(rawQuantity) && rawQuantity >= 1) numForInput = rawQuantity
  else if (typeof rawQuantity === 'string' && rawQuantity.trim() !== '') {
    const parsed = parseInt(rawQuantity, 10)
    if (Number.isInteger(parsed) && parsed >= 1) numForInput = parsed
  }
  return (
    <FormRow label={label} error={shouldValidate && errors.quantity ? errors.quantity : undefined}>
      <input
        type="number"
        className={'ber-inp' + fieldErrorClass('quantity')}
        value={numForInput}
        onChange={e => {
          const raw = e.target.value
          patchLocal({ quantity: raw === '' ? null : parseInt(raw, 10) })
        }}
        onBlur={commitChanges}
        min={1}
      />
    </FormRow>
  )
}
