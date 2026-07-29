import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { authService } from '../services/authService'
import { jobService } from '../services/jobService'
import { textileMasterDataService, type BrandRow, type VariantWithDetails } from '../services/textileMasterDataService'
import { Login } from '../components/Login'
import { AccessDenied } from '../components/AccessDenied'
import { useIsAdmin } from '../queries/userQueries'
import { useToast } from '../components/Toast'
import type { Database } from '../types/supabase'

type ProductRow = Database['public']['Tables']['textile_products']['Row'] & {
  textile_brands?: { name: string } | { name: string }[] | null
}
type VariantRow = VariantWithDetails
type Tab = 'PRODUCTS' | 'STOCK' | 'ORDER_LIST'

const SIZE_RUNS = {
  STANDARD: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'],
  REDUZIERT: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'],
  KIDS: ['98/104', '110/116', '122/128', '134/146', '152/161'],
  UNISEX: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'],
} as const

type SizeMatrixPreset = keyof typeof SIZE_RUNS | 'EIGENE'

function sizesForPreset(preset: SizeMatrixPreset, customSizes: readonly string[]): string[] {
  if (preset === 'EIGENE') return [...customSizes]
  return [...SIZE_RUNS[preset]]
}

function sizeRunLabel(preset: SizeMatrixPreset, customSizes: readonly string[]): string {
  switch (preset) {
    case 'STANDARD':
      return 'XS–5XL'
    case 'REDUZIERT':
      return 'XS–3XL'
    case 'KIDS':
      return 'Kids'
    case 'UNISEX':
      return 'Unisex (XS–5XL)'
    case 'EIGENE':
      return customSizes.length ? customSizes.join(' · ') : 'Custom'
  }
}

function joinName(rawValue: unknown): string {
  if (!rawValue) return ''
  if (Array.isArray(rawValue)) return String((rawValue[0] as { name?: string })?.name ?? '')
  return String((rawValue as { name?: string }).name ?? '')
}

function oneNested<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

type ProductNested = {
  name: string
  article_number: string | null
  textile_brands?: unknown
}

function productNested(variant: VariantRow): ProductNested | null {
  const nested = oneNested(variant.textile_products as ProductNested | ProductNested[] | null)
  return nested
}

function brandFromVariant(variant: VariantRow): string {
  const product = productNested(variant)
  if (!product) return ''
  return joinName(product.textile_brands)
}

function productNameFromVariant(variant: VariantRow): string {
  const product = productNested(variant)
  return product?.name ?? '—'
}

function toInteger(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v)
  if (typeof v === 'string' && v.trim() !== '') {
    const parsed = parseInt(v, 10)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

function errorToString(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) {
    const message = (e as { message: unknown }).message
    if (typeof message === 'string') return message
  }
  try {
    return JSON.stringify(e)
  } catch {
    return 'Unknown error'
  }
}

function orderListNumber(v: unknown): number {
  const value = toInteger(v)
  return value < 0 ? 0 : value
}

function orderListCell(value: unknown, fallback: string = '—'): string {
  if (value == null) return fallback
  if (typeof value === 'string') return value.trim() === '' ? fallback : value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  if (typeof value === 'object') return fallback
  return String(value)
}

/** Status for the Stock tab (excluding samples: colour logic; samples: always grey). */
function variantStatus(
  variant: VariantRow
): { cls: string; label: string; rank: number } {
  if (variant.is_sample) return { cls: 'badge-grau', label: 'Sample', rank: -1 }
  const stock = variant.stock ?? 0
  const minimum = variant.min_stock ?? 0
  if (stock <= 0) return { cls: 'badge-rot', label: 'Out of stock', rank: 0 }
  if (stock < minimum) return { cls: 'badge-rot', label: 'Reorder', rank: 1 }
  if (stock === minimum) return { cls: 'badge-orange', label: 'At minimum', rank: 2 }
  return { cls: 'badge-gruen', label: 'OK', rank: 3 }
}

type ReorderRow = VariantRow & { offene_menge: number; bestellmenge: number }

export function TextileStockPage() {
  const { showError, showSuccess } = useToast()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const { isAdmin, isLoading: roleLoading } = useIsAdmin()
  const [tab, setTab] = useState<Tab>('PRODUCTS')

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const session = await authService.getSession()
        if (!alive) return
        setSession(session)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    const { subscription } = authService.onAuthStateChange((_event, newSession) => {
      if (!alive) return
      setSession(newSession)
      // getSession() can stall on supabase's auth lock; the listener always
      // fires INITIAL_SESSION on subscribe, so it also resolves loading.
      setLoading(false)
    })
    return () => {
      alive = false
      subscription.unsubscribe()
    }
  }, [])

  const userEmail = session?.user?.email ?? session?.user?.id ?? ''

  // ——— Marken / Produkte (Tab Produkte) ———
  const [brands, setBrands] = useState<BrandRow[]>([])
  const [brandsLoading, setBrandsLoading] = useState(false)
  const [newBrandName, setNewBrandName] = useState('')
  const [newBrandFormOpen, setNewBrandFormOpen] = useState(false)
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null)
  const [editBrandName, setEditBrandName] = useState('')
  const [editBrandActive, setEditBrandActive] = useState(true)

  const loadBrands = useCallback(async () => {
    setBrandsLoading(true)
    let brands: BrandRow[]
    try {
      brands = await textileMasterDataService.getBrands()
    } catch {
      setBrandsLoading(false)
      showError('Brands could not be loaded')
      return
    }
    setBrandsLoading(false)
    setBrands(brands)
  }, [showError])

  useEffect(() => {
    if (!session) return
    if (tab !== 'PRODUCTS') return
    void loadBrands()
  }, [session, tab, loadBrands])

  const [brandIdForProducts, setBrandIdForProducts] = useState<string>('')
  const [products, setProducts] = useState<ProductRow[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [productIdForVariants, setProductIdForVariants] = useState<string>('')

  const loadProductsForBrand = useCallback(
    async (brandId: string) => {
      if (!brandId) {
        setProducts([])
        return
      }
      setProductsLoading(true)
      let products: ProductRow[]
      try {
        products = (await textileMasterDataService.getProductsByBrand(brandId)) as unknown as ProductRow[]
      } catch {
        setProductsLoading(false)
        showError('Products could not be loaded')
        return
      }
      setProductsLoading(false)
      setProducts(products)
    },
    [showError]
  )

  useEffect(() => {
    if (tab !== 'PRODUCTS') return
    void loadProductsForBrand(brandIdForProducts)
  }, [tab, brandIdForProducts, loadProductsForBrand])

  const [newProduct, setNewProduct] = useState({
    brand_id: '',
    name: '',
    article_number: '',
    description: '',
  })
  const [productFormOpen, setProductFormOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<ProductRow | null>(null)
  const [editProductName, setEditProductName] = useState('')
  const [editProductArticleNumber, setEditProductArticleNumber] = useState('')
  const [editProductDescription, setEditProductDescription] = useState('')
  const [editProductActive, setEditProductActive] = useState(true)

  const [varianten, setVarianten] = useState<VariantRow[]>([])
  const [variantsLoading, setVariantsLoading] = useState(false)

  const loadVariantsForProduct = useCallback(
    async (productId: string) => {
      if (!productId) {
        setVarianten([])
        return
      }
      setVariantsLoading(true)
      let variants: VariantRow[]
      try {
        variants = await textileMasterDataService.getVariantsByProduct(productId)
      } catch {
        setVariantsLoading(false)
        showError('Variants could not be loaded')
        return
      }
      setVariantsLoading(false)
      setVarianten(variants)
    },
    [showError]
  )

  useEffect(() => {
    if (tab !== 'PRODUCTS') return
    void loadVariantsForProduct(productIdForVariants)
  }, [tab, productIdForVariants, loadVariantsForProduct])

  const [newVariant, setNewVariant] = useState({
    color: '',
    color_hex: '' as string,
    size: '',
    is_sample: false,
    min_stock: '0',
  })
  const [variantFormOpen, setVariantFormOpen] = useState(false)
  const [editVariant, setEditVariant] = useState<VariantRow | null>(null)
  const [editVariantColor, setEditVariantColor] = useState('')
  const [editVariantColorHex, setEditVariantColorHex] = useState('')
  const [editVariantSize, setEditVariantSize] = useState('')
  const [editVariantIsSample, setEditVariantIsSample] = useState(false)
  const [editVariantMinimum, setEditVariantMinimum] = useState('0')
  const [editVariantActive, setEditVariantActive] = useState(true)

  // Matrix-Anlegen: je Farbe eigener Größenlauf
  type MatrixColor = {
    id: string
    name: string
    hex: string
    sizeRun: SizeMatrixPreset
    customSizes: string[]
  }
  const [matrixColors, setMatrixColors] = useState<MatrixColor[]>([])
  const [matrixColorName, setMatrixColorName] = useState('')
  const [matrixColorHex, setMatrixColorHex] = useState('#000000')
  const [matrixColorSizeRun, setMatrixColorSizeRun] = useState<SizeMatrixPreset>('STANDARD')
  const [matrixCustomInput, setMatrixCustomInput] = useState('')
  const [matrixCustomTags, setMatrixCustomTags] = useState<string[]>([])
  const [matrixMin, setMatrixMin] = useState('0')
  const [matrixAllSamples, setMatrixAllSamples] = useState(false)
  const [matrixBusy, setMatrixBusy] = useState(false)
  const [showSingleVariantForm, setShowSingleVariantForm] = useState(false)

  const [bookingQuantity, setBookingQuantity] = useState<Record<string, string>>({})
  const [bookingBusyId, setBookingBusyId] = useState<string | null>(null)
  const [bookingErrors, setBookingErrors] = useState<Record<string, string | null>>({})
  const [minimumEdit, setMinimumEdit] = useState<Record<string, string>>({})

  const bookMovement = async (
    variant: VariantRow,
    movementType: 'INBOUND' | 'OUTBOUND',
    onSuccess?: (nextStock: number) => void
  ) => {
    if (!session?.user) return
    if (bookingBusyId) return
    const rawQuantity = (bookingQuantity[variant.id] ?? '').trim()
    setBookingErrors(m => ({ ...m, [variant.id]: null }))
    const quantity = parseInt(rawQuantity, 10)
    if (!Number.isInteger(quantity) || quantity < 1) {
      setBookingErrors(m => ({ ...m, [variant.id]: 'Quantity: integer ≥ 1' }))
      return
    }
    const stockDelta = movementType === 'INBOUND' ? quantity : -quantity
    const nextStock = (variant.stock ?? 0) + stockDelta
    if (nextStock < 0) {
      setBookingErrors(m => ({ ...m, [variant.id]: 'Quantity exceeds current stock' }))
      return
    }
    setBookingBusyId(variant.id)
    try {
      await textileMasterDataService.updateVariantStock(variant.id, nextStock)
      await textileMasterDataService.createTextileStockMovement({
        variant_id: variant.id,
        quantity,
        type: movementType,
        user_id: session.user.id,
      })

      if (onSuccess) {
        onSuccess(nextStock)
      } else {
        setVarianten(list => list.map(x => (x.id === variant.id ? { ...x, stock: nextStock } : x)))
      }
      setBookingQuantity(m => ({ ...m, [variant.id]: '' }))
    } catch (e) {
      showError('Booking failed')
      setBookingErrors(m => ({ ...m, [variant.id]: errorToString(e) }))
    } finally {
      setBookingBusyId(null)
    }
  }

  const bookMovementStockTab = async (variant: VariantRow, movementType: 'INBOUND' | 'OUTBOUND') => {
    await bookMovement(variant, movementType, nextStock => {
      setAllVariants(list => list.map(x => (x.id === variant.id ? { ...x, stock: nextStock } : x)))
    })
  }

  const saveMinimumStock = async (variant: VariantRow) => {
    const rawValue = (minimumEdit[variant.id] ?? String(variant.min_stock ?? 0)).trim()
    const minimumValue = rawValue === '' ? 0 : parseInt(rawValue, 10)
    if (!Number.isInteger(minimumValue) || minimumValue < 0) return
    if (minimumValue === (variant.min_stock ?? 0)) return
    try {
      await textileMasterDataService.updateVariantMinimumStock(variant.id, minimumValue)
    } catch {
      showError('Min. stock could not be saved')
      return
    }
    setVarianten(list => list.map(x => (x.id === variant.id ? { ...x, min_stock: minimumValue } : x)))
    setAllVariants(list => list.map(x => (x.id === variant.id ? { ...x, min_stock: minimumValue } : x)))
  }

  // ——— Bestand-Tab: alle Varianten ———
  const [allVariants, setAllVariants] = useState<VariantRow[]>([])
  const [allVariantsLoading, setAllVariantsLoading] = useState(false)
  const [stockSearch, setStockSearch] = useState('')
  const [stockBrandFilter, setStockBrandFilter] = useState<string>('ALL')
  const [filterReorderOnly, setFilterReorderOnly] = useState(false)
  const [filterSamplesOnly, setFilterSamplesOnly] = useState(false)
  type StockSortKey =
    | 'marke'
    | 'produkt'
    | 'color'
    | 'size'
    | 'muster'
    | 'stock'
    | 'min_stock'
    | 'status'
  const [stockSorting, setStockSorting] = useState<{ key: StockSortKey; dir: 'asc' | 'desc' } | null>(null)

  const toggleStockSort = (key: StockSortKey) => {
    setStockSorting(currentSorting => {
      if (!currentSorting || currentSorting.key !== key) return { key, dir: 'asc' }
      if (currentSorting.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

  const loadAllVariants = useCallback(async () => {
    setAllVariantsLoading(true)
    let variants: VariantRow[]
    try {
      variants = await textileMasterDataService.getVariantsWithDetails()
    } catch {
      setAllVariantsLoading(false)
      showError('Stock could not be loaded')
      return
    }
    setAllVariantsLoading(false)
    setAllVariants(variants)
  }, [showError])

  useEffect(() => {
    if (!session) return
    if (tab !== 'STOCK' && tab !== 'ORDER_LIST') return
    void loadAllVariants()
  }, [session, tab, loadAllVariants])

  const brandOptionsForStock = useMemo(() => {
    const set = new Set<string>()
    for (const v of allVariants) {
      const brand = brandFromVariant(v)
      if (brand) set.add(brand)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'de'))
  }, [allVariants])

  const filteredVariants = useMemo(() => {
    let list = allVariants.slice()
    if (stockBrandFilter !== 'ALL') {
      list = list.filter(v => brandFromVariant(v) === stockBrandFilter)
    }
    if (filterSamplesOnly) list = list.filter(v => v.is_sample)
    if (filterReorderOnly) {
      list = list.filter(v => {
        if (v.is_sample) return false
        const stock = v.stock ?? 0
        const minimumStock = v.min_stock ?? 0
        return stock < minimumStock
      })
    }
    const q = stockSearch.trim().toLowerCase()
    if (q) {
      list = list.filter(v => {
        const brandName = brandFromVariant(v).toLowerCase()
        const productName = productNameFromVariant(v).toLowerCase()
        const colorStr = String(v.color ?? '').toLowerCase()
        const sizeStr = String(v.size ?? '').toLowerCase()
        return brandName.includes(q) || productName.includes(q) || colorStr.includes(q) || sizeStr.includes(q)
      })
    }
    if (stockSorting) {
      const dir = stockSorting.dir === 'asc' ? 1 : -1
      const key = stockSorting.key
      list = list.slice().sort((a, b) => {
        const aValue =
          key === 'marke'
            ? brandFromVariant(a)
            : key === 'produkt'
              ? productNameFromVariant(a)
              : key === 'color'
                ? a.color
                : key === 'size'
                  ? a.size
                  : key === 'muster'
                    ? (a.is_sample ? 1 : 0)
                    : key === 'stock'
                      ? a.stock ?? 0
                      : key === 'min_stock'
                        ? a.min_stock ?? 0
                        : variantStatus(a).rank
        const bValue =
          key === 'marke'
            ? brandFromVariant(b)
            : key === 'produkt'
              ? productNameFromVariant(b)
              : key === 'color'
                ? b.color
                : key === 'size'
                  ? b.size
                  : key === 'muster'
                    ? (b.is_sample ? 1 : 0)
                    : key === 'stock'
                      ? b.stock ?? 0
                      : key === 'min_stock'
                        ? b.min_stock ?? 0
                        : variantStatus(b).rank
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          if (aValue !== bValue) return (aValue - bValue) * dir
        } else {
          const comparison = String(aValue).localeCompare(String(bValue), 'de')
          if (comparison !== 0) return comparison * dir
        }
        return a.id.localeCompare(b.id)
      })
    }
    return list
  }, [
    allVariants,
    stockBrandFilter,
    stockSearch,
    filterReorderOnly,
    filterSamplesOnly,
    stockSorting,
  ])

  // ——— Bestellliste ———
  const [orderRows, setOrderRows] = useState<ReorderRow[]>([])
  const [orderLoading, setOrderLoading] = useState(false)
  const [orderError, setOrderError] = useState<string | null>(null)
  const [orderCopied, setOrderCopied] = useState(false)

  const loadOrderList = useCallback(async () => {
    setOrderLoading(true)
    setOrderError(null)
    try {
      const activeVariants = await textileMasterDataService.getVariantsWithDetails()
      const variantIdSet = new Set(activeVariants.map(v => v.id))

      const activeJobs = await jobService.getActiveJobsByBereich('TEXTILE')
      const jobIds = activeJobs.filter(s => !s.is_cancelled && s.status !== 'DONE').map(s => s.id)
      const demandByVariantId = new Map<string, number>()

      const chunk = 200
      for (let i = 0; i < jobIds.length; i += chunk) {
        const jobSlice = jobIds.slice(i, i + chunk)
        if (jobSlice.length === 0) continue
        const positionData = await textileMasterDataService.getEigenwarePositionsByJobs(jobSlice)
        for (const row of positionData) {
          const variantId = row.variant_id
          if (!variantId || !variantIdSet.has(variantId)) continue
          const demandQuantity = toInteger(row.quantity)
          demandByVariantId.set(variantId, (demandByVariantId.get(variantId) ?? 0) + demandQuantity)
        }
      }

      const reorderRows: ReorderRow[] = []
      for (const v of activeVariants) {
        const openDemand = toInteger(demandByVariantId.get(v.id))
        const currentStock = toInteger(v.stock)
        const minimumStock = toInteger(v.min_stock)
        const bestellmenge = Math.max(0, minimumStock + openDemand - currentStock)
        if (bestellmenge <= 0) continue
        reorderRows.push({ ...v, offene_menge: openDemand, bestellmenge: toInteger(bestellmenge) })
      }
      reorderRows.sort((a, b) => b.bestellmenge - a.bestellmenge)
      setOrderRows(reorderRows)
    } catch (e) {
      showError('Reorder list could not be loaded')
      setOrderRows([])
      setOrderError(errorToString(e))
    } finally {
      setOrderLoading(false)
    }
  }, [showError])

  useEffect(() => {
    if (!session) return
    if (tab !== 'ORDER_LIST') return
    void loadOrderList()
  }, [session, tab, loadOrderList])

  const orderClipboardText = useMemo(() => {
    const header = 'Brand | Product | Colour | Size | Stock | Open | Min. Stock | Order qty'
    const body = orderRows
      .map(orderRow => {
        return [
          orderListCell(brandFromVariant(orderRow), ''),
          orderListCell(productNameFromVariant(orderRow), ''),
          orderListCell(orderRow.color, ''),
          orderListCell(orderRow.size, ''),
          orderListNumber(orderRow.stock),
          orderListNumber(orderRow.offene_menge),
          orderListNumber(orderRow.min_stock),
          orderListNumber(orderRow.bestellmenge),
        ].join(' | ')
      })
      .join('\n')
    return body ? `${header}\n${body}` : header
  }, [orderRows])

  const copyOrderList = async () => {
    try {
      await navigator.clipboard.writeText(orderClipboardText)
      setOrderCopied(true)
      window.setTimeout(() => setOrderCopied(false), 2000)
    } catch {
      showError('Copy failed')
    }
  }

  const saveBrand = async () => {
    const trimmedName = newBrandName.trim()
    if (!trimmedName) return
    try {
      await textileMasterDataService.createBrand(trimmedName)
    } catch {
      showError('Brand could not be created')
      return
    }
    setNewBrandName('')
    setNewBrandFormOpen(false)
    void loadBrands()
  }

  const updateBrand = async () => {
    if (!editingBrandId) return
    const trimmedName = editBrandName.trim()
    if (!trimmedName) return
    const previousBrandId = editingBrandId
    try {
      await textileMasterDataService.updateBrand(editingBrandId, { name: trimmedName, is_active: editBrandActive })
    } catch {
      showError('Brand could not be saved')
      return
    }
    setEditingBrandId(null)
    void loadBrands()
    if (brandIdForProducts === previousBrandId) void loadProductsForBrand(brandIdForProducts)
  }

  const saveProduct = async () => {
    const brandId = newProduct.brand_id || brandIdForProducts
    const trimmedName = newProduct.name.trim()
    if (!brandId || !trimmedName) {
      showError('Brand and name are required')
      return
    }
    try {
      await textileMasterDataService.createProduct({
        brand_id: brandId,
        name: trimmedName,
        article_number: newProduct.article_number.trim() || null,
        description: newProduct.description.trim() || null,
        is_active: true,
      })
    } catch {
      showError('Product could not be created')
      return
    }
    setNewProduct({ brand_id: '', name: '', article_number: '', description: '' })
    setProductFormOpen(false)
    if (brandId === brandIdForProducts) void loadProductsForBrand(brandIdForProducts)
  }

  const updateProduct = async () => {
    if (!editProduct) return
    const trimmedName = editProductName.trim()
    if (!trimmedName) return
    try {
      await textileMasterDataService.updateProduct(editProduct.id, {
        name: trimmedName,
        article_number: editProductArticleNumber.trim() || null,
        description: editProductDescription.trim() || null,
        is_active: editProductActive,
      })
    } catch {
      showError('Product could not be saved')
      return
    }
    setEditProduct(null)
    void loadProductsForBrand(brandIdForProducts)
    if (productIdForVariants) void loadVariantsForProduct(productIdForVariants)
  }

  const saveVariant = async () => {
    if (!productIdForVariants) {
      showError('Select a product')
      return
    }
    const colorValue = newVariant.color.trim()
    const sizeValue = newVariant.size.trim()
    if (!colorValue || !sizeValue) {
      showError('Colour and size are required')
      return
    }
    const minimumRaw = newVariant.min_stock.trim()
    const minimumValue = minimumRaw === '' ? 0 : parseInt(minimumRaw, 10)
    if (!Number.isInteger(minimumValue) || minimumValue < 0) {
      showError('Invalid minimum stock')
      return
    }
    const maxSortOrder = await textileMasterDataService.getMaxSortOrderForProduct(productIdForVariants)
    const nextSortOrder = (maxSortOrder ?? 0) + 1
    try {
      await textileMasterDataService.createVariant({
        product_id: productIdForVariants,
        color: colorValue,
        color_hex: newVariant.color_hex.trim() || null,
        size: sizeValue,
        is_sample: newVariant.is_sample,
        min_stock: minimumValue,
        stock: 0,
        sort_order: nextSortOrder,
        is_active: true,
      })
    } catch {
      showError('Variant could not be created')
      return
    }
    setNewVariant({
      color: '',
      color_hex: '',
      size: '',
      is_sample: false,
      min_stock: '0',
    })
    setVariantFormOpen(false)
    void loadVariantsForProduct(productIdForVariants)
  }

  const resetMatrix = () => {
    setMatrixColors([])
    setMatrixColorName('')
    setMatrixColorHex('#000000')
    setMatrixColorSizeRun('STANDARD')
    setMatrixCustomInput('')
    setMatrixCustomTags([])
    setMatrixMin('0')
    setMatrixAllSamples(false)
  }

  const matrixPreview = useMemo(() => {
    if (matrixColors.length === 0) return { parts: [] as string[], total: 0, summaryText: '' }
    const parts: string[] = []
    let total = 0
    for (const colorEntry of matrixColors) {
      const sizeCount = sizesForPreset(colorEntry.sizeRun, colorEntry.customSizes).length
      total += sizeCount
      parts.push(`${colorEntry.name} (${sizeCount} sizes)`)
    }
    const summaryText = `${parts.join(' + ')} = ${total} variants total`
    return { parts, total, summaryText }
  }, [matrixColors])

  const addMatrixCustomTag = () => {
    const raw = matrixCustomInput.trim()
    if (!raw) return
    const clean = raw.replace(/\s+/g, ' ')
    setMatrixCustomTags(prev => (prev.includes(clean) ? prev : [...prev, clean]))
    setMatrixCustomInput('')
  }

  const removeMatrixCustomTag = (tag: string) => {
    setMatrixCustomTags(prev => prev.filter(x => x !== tag))
  }

  const addMatrixColor = () => {
    const name = matrixColorName.trim()
    if (!name) return
    if (matrixColorSizeRun === 'EIGENE' && matrixCustomTags.length === 0) {
      showError('For "Custom…" add at least one size as a tag')
      return
    }
    const hex = (matrixColorHex || '#000000').toUpperCase()
    const key = name.toLowerCase()
    const customSizes = matrixColorSizeRun === 'EIGENE' ? [...matrixCustomTags] : []
    setMatrixColors(prev => {
      if (prev.some(f => f.name.toLowerCase() === key)) return prev
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          name,
          hex,
          sizeRun: matrixColorSizeRun,
          customSizes,
        },
      ]
    })
    setMatrixColorName('')
    setMatrixCustomTags([])
    setMatrixCustomInput('')
  }

  const removeMatrixColor = (id: string) => {
    setMatrixColors(prev => prev.filter(f => f.id !== id))
  }

  const createVariantMatrix = async () => {
    if (!productIdForVariants) return
    if (matrixBusy) return

    const colors = matrixColors.slice()
    if (colors.length === 0) {
      showError('Add at least 1 colour')
      return
    }
    for (const colorEntry of colors) {
      const sizeList = sizesForPreset(colorEntry.sizeRun, colorEntry.customSizes)
      if (sizeList.length === 0) {
        showError(`No sizes for colour "${colorEntry.name}"`)
        return
      }
    }
    const minRaw = matrixMin.trim()
    const min = minRaw === '' ? 0 : parseInt(minRaw, 10)
    if (!Number.isInteger(min) || min < 0) {
      showError('Invalid minimum stock')
      return
    }

    const allColorNames = colors.map(colorEntry => colorEntry.name)
    const allSizes = new Set<string>()
    for (const colorEntry of colors) {
      for (const sizeValue of sizesForPreset(colorEntry.sizeRun, colorEntry.customSizes)) allSizes.add(sizeValue)
    }
    const allSizesList = [...allSizes]

    setMatrixBusy(true)
    try {
      const existingVariants = await textileMasterDataService.getExistingVariantCombinations(
        productIdForVariants,
        allColorNames,
        allSizesList,
      )

      const existingCombinationSet = new Set<string>()
      for (const existingRow of existingVariants) {
        existingCombinationSet.add(`${existingRow.color}|||${existingRow.size}`)
      }

      const variantInserts: Database['public']['Tables']['textile_variants']['Insert'][] = []
      let sortCounter = 0
      for (const colorEntry of colors) {
        const sizeList = sizesForPreset(colorEntry.sizeRun, colorEntry.customSizes)
        sizeList.forEach(sizeValue => {
          const combinationKey = `${colorEntry.name}|||${sizeValue}`
          if (existingCombinationSet.has(combinationKey)) return
          variantInserts.push({
            product_id: productIdForVariants,
            color: colorEntry.name,
            color_hex: colorEntry.hex,
            size: sizeValue,
            is_sample: matrixAllSamples,
            min_stock: min,
            stock: 0,
            sort_order: sortCounter++,
            is_active: true,
          })
        })
      }

      if (variantInserts.length === 0) {
        showSuccess('No new variants — all already exist')
        return
      }

      await textileMasterDataService.createVariantsBatch(variantInserts)

      showSuccess(`${variantInserts.length} variants created`)
      resetMatrix()
      setShowSingleVariantForm(false)
      void loadVariantsForProduct(productIdForVariants)
    } catch (e) {
      showError(errorToString(e))
    } finally {
      setMatrixBusy(false)
    }
  }

  const updateVariant = async () => {
    if (!editVariant) return
    const colorValue = editVariantColor.trim()
    const sizeValue = editVariantSize.trim()
    if (!colorValue || !sizeValue) {
      showError('Colour and size are required')
      return
    }
    const minimumRaw = editVariantMinimum.trim()
    const minimumValue = minimumRaw === '' ? 0 : parseInt(minimumRaw, 10)
    if (!Number.isInteger(minimumValue) || minimumValue < 0) return
    try {
      await textileMasterDataService.updateVariant(editVariant.id, {
        color: colorValue,
        color_hex: editVariantColorHex.trim() || null,
        size: sizeValue,
        is_sample: editVariantIsSample,
        min_stock: minimumValue,
        is_active: editVariantActive,
      })
    } catch {
      showError('Variant could not be saved')
      return
    }
    setEditVariant(null)
    void loadVariantsForProduct(productIdForVariants)
    void loadAllVariants()
  }

  if (loading) return null
  if (!session) return <Login />
  if (roleLoading) return null
  if (!isAdmin) return <AccessDenied description="Stock management requires an admin account." />

  const inVariantView = Boolean(productIdForVariants)
  const inProductView = Boolean(brandIdForProducts) && !inVariantView
  const currentBrandName = brands.find(m => m.id === brandIdForProducts)?.name ?? '—'
  const productBreadcrumbName = products.find(p => p.id === productIdForVariants)?.name ?? '—'

  const bookingField = (variant: VariantRow, onBook: (x: VariantRow, t: 'INBOUND' | 'OUTBOUND') => void) => {
    const quantityStr = (bookingQuantity[variant.id] ?? '').slice(0, 3)
    const quantity = quantityStr.trim() === '' ? null : parseInt(quantityStr, 10)
    const quantityValid = quantity != null && Number.isInteger(quantity) && quantity >= 1
    const outboundDisabled = !quantityValid || bookingBusyId != null || (quantityValid && (quantity as number) > (variant.stock ?? 0))
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={999}
          step={1}
          value={quantityStr}
          onChange={e => {
            const cleaned = e.target.value.replace(/[^\d]/g, '').slice(0, 3)
            setBookingQuantity(s => ({ ...s, [variant.id]: cleaned }))
          }}
          style={{
            width: 52,
            padding: '6px 8px',
            border: '1px solid #d4d4d4',
            borderRadius: 6,
            fontSize: 13,
            appearance: 'textfield',
          }}
        />
        <button
          type="button"
          className="cp-btn cp-btn-grau"
          style={{ width: 34, padding: '6px 0' }}
          disabled={!quantityValid || bookingBusyId != null}
          onClick={() => void onBook(variant, 'INBOUND')}
          title="Stock in"
        >
          +
        </button>
        <button
          type="button"
          className="cp-btn cp-btn-grau"
          style={{ width: 34, padding: '6px 0' }}
          disabled={outboundDisabled}
          onClick={() => void onBook(variant, 'OUTBOUND')}
          title="Stock out"
        >
          −
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 18 }}>Textiles — Stock Management</h1>
        <span style={{ fontSize: 13, opacity: 0.85 }}>{userEmail}</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14, marginBottom: 14, flexWrap: 'wrap' }}>
        <button
          type="button"
          className={tab === 'PRODUCTS' ? 'cp-btn' : 'cp-btn cp-btn-grau'}
          onClick={() => setTab('PRODUCTS')}
        >
          Products
        </button>
        <button
          type="button"
          className={tab === 'STOCK' ? 'cp-btn' : 'cp-btn cp-btn-grau'}
          onClick={() => setTab('STOCK')}
        >
          Stock
        </button>
        <button
          type="button"
          className={tab === 'ORDER_LIST' ? 'cp-btn' : 'cp-btn cp-btn-grau'}
          onClick={() => setTab('ORDER_LIST')}
        >
          Reorder list
        </button>
      </div>

      {tab === 'PRODUCTS' && (
        <div>
          {/* Stufe 1: Marken — immer sichtbar */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 6,
              marginBottom: 16,
            }}
          >
            {brandsLoading && <span style={{ fontSize: 13, opacity: 0.75 }}>Loading…</span>}
            {brands.map(m => {
              if (editingBrandId === m.id) {
                return (
                  <div
                    key={m.id}
                    style={{
                      display: 'inline-flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 8px',
                      border: '1px solid #1d4ed8',
                      borderRadius: 8,
                      background: '#eff6ff',
                    }}
                  >
                    <input
                      className="cp-select"
                      value={editBrandName}
                      onChange={e => setEditBrandName(e.target.value)}
                      style={{ minWidth: 120, maxWidth: 200 }}
                    />
                    <label style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 12 }}>
                      <input
                        type="checkbox"
                        checked={editBrandActive}
                        onChange={e => setEditBrandActive(e.target.checked)}
                      />
                      active
                    </label>
                    <button type="button" className="cp-btn" style={{ padding: '4px 10px' }} onClick={() => void updateBrand()}>
                      Save
                    </button>
                    <button
                      type="button"
                      className="cp-btn cp-btn-grau"
                      style={{ padding: '4px 10px' }}
                      onClick={() => setEditingBrandId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                )
              }
              return (
                <div key={m.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                  <button
                    type="button"
                    className={brandIdForProducts === m.id ? 'cp-btn' : 'cp-btn cp-btn-grau'}
                    style={{ fontWeight: brandIdForProducts === m.id ? 600 : 400 }}
                    onClick={() => {
                      setBrandIdForProducts(m.id)
                      setProductIdForVariants('')
                      setEditProduct(null)
                      setProductFormOpen(false)
                      setEditVariant(null)
                      setVariantFormOpen(false)
                    }}
                    title={m.is_active ? m.name : `${m.name} (inactive)`}
                  >
                    {m.name}
                  </button>
                  <button
                    type="button"
                    className="cp-btn cp-btn-grau"
                    style={{ padding: '2px 6px', minWidth: 0, fontSize: 12 }}
                    onClick={e => {
                      e.stopPropagation()
                      setEditingBrandId(m.id)
                      setEditBrandName(m.name)
                      setEditBrandActive(m.is_active)
                    }}
                    title="Edit brand"
                    aria-label={`Edit brand ${m.name}`}
                  >
                    ✎
                  </button>
                </div>
              )
            })}
            {!newBrandFormOpen ? (
              <button
                type="button"
                className="cp-btn cp-btn-grau"
                onClick={() => {
                  setNewBrandFormOpen(true)
                  setNewBrandName('')
                }}
                title="New brand"
              >
                + New
              </button>
            ) : (
              <div
                style={{
                  display: 'inline-flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 8px',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                }}
              >
                <input
                  className="cp-select"
                  placeholder="Name"
                  value={newBrandName}
                  onChange={e => setNewBrandName(e.target.value)}
                  style={{ minWidth: 120, maxWidth: 200 }}
                />
                <button type="button" className="cp-btn" style={{ padding: '4px 10px' }} onClick={() => void saveBrand()}>
                  Save
                </button>
                <button
                  type="button"
                  className="cp-btn cp-btn-grau"
                  style={{ padding: '4px 10px' }}
                  onClick={() => setNewBrandFormOpen(false)}
                >
                  Cancel
                </button>
              </div>
            )}
            <button
              type="button"
              className="cp-btn cp-btn-grau"
              style={{ marginLeft: 4, padding: '4px 10px' }}
              onClick={() => void loadBrands()}
              disabled={brandsLoading}
              title="Reload brands"
            >
              ↻
            </button>
          </div>

          {/* Stufe 2: Produkte — nur wenn Marke & nicht in Varianten-Ansicht */}
          {inProductView && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  className="cp-btn cp-btn-grau"
                  onClick={() => {
                    setProductFormOpen(o => {
                      const isOpen = !o
                      if (isOpen) setNewProduct(s => ({ ...s, brand_id: brandIdForProducts }))
                      return isOpen
                    })
                  }}
                >
                  + Add product
                </button>
                <button
                  type="button"
                  className="cp-btn cp-btn-grau"
                  onClick={() => void loadProductsForBrand(brandIdForProducts)}
                  disabled={productsLoading}
                >
                  Reload
                </button>
              </div>
              {productFormOpen && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: 8,
                    marginBottom: 12,
                    padding: 10,
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                  }}
                >
                  <input
                    className="cp-select"
                    placeholder="Name (required)"
                    value={newProduct.name}
                    onChange={e => setNewProduct(s => ({ ...s, name: e.target.value }))}
                  />
                  <input
                    className="cp-select"
                    placeholder="Article number"
                    value={newProduct.article_number}
                    onChange={e => setNewProduct(s => ({ ...s, article_number: e.target.value }))}
                  />
                  <input
                    className="cp-select"
                    placeholder="Description"
                    value={newProduct.description}
                    onChange={e => setNewProduct(s => ({ ...s, description: e.target.value }))}
                    style={{ gridColumn: '1 / -1' }}
                  />
                  <button type="button" className="cp-btn" onClick={() => void saveProduct()}>
                    Save
                  </button>
                </div>
              )}
              {productsLoading && <p style={{ opacity: 0.8, margin: '0 0 8px' }}>Loading…</p>}
              {!productsLoading && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                        <th style={{ padding: '8px 6px' }}>Name</th>
                        <th style={{ padding: '8px 6px' }}>Article number</th>
                        <th style={{ padding: '8px 6px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map(p => (
                        <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 6px', fontWeight: 600 }}>{p.name}</td>
                          <td style={{ padding: '8px 6px' }}>{p.article_number ?? '—'}</td>
                          <td style={{ padding: '8px 6px' }}>
                            <button
                              type="button"
                              className="cp-btn cp-btn-grau"
                              onClick={() => {
                                setEditProduct(p)
                                setEditProductName(p.name)
                                setEditProductArticleNumber(p.article_number ?? '')
                                setEditProductDescription(p.description ?? '')
                                setEditProductActive(p.is_active)
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="cp-btn"
                              style={{ marginLeft: 8 }}
                              onClick={() => {
                                setProductIdForVariants(p.id)
                                setEditProduct(null)
                                setProductFormOpen(false)
                                setEditVariant(null)
                                setVariantFormOpen(false)
                              }}
                            >
                              Variants
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {editProduct && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    maxWidth: 560,
                  }}
                >
                  <h3 style={{ fontSize: 14, marginTop: 0 }}>Edit product</h3>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                      gap: 8,
                    }}
                  >
                    <input
                      className="cp-select"
                      value={editProductName}
                      onChange={e => setEditProductName(e.target.value)}
                    />
                    <input
                      className="cp-select"
                      value={editProductArticleNumber}
                      onChange={e => setEditProductArticleNumber(e.target.value)}
                      placeholder="Article number"
                    />
                    <input
                      className="cp-select"
                      value={editProductDescription}
                      onChange={e => setEditProductDescription(e.target.value)}
                      placeholder="Description"
                      style={{ gridColumn: '1 / -1' }}
                    />
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={editProductActive}
                        onChange={e => setEditProductActive(e.target.checked)}
                      />
                      Active
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="cp-btn" onClick={() => void updateProduct()}>
                        Save
                      </button>
                      <button type="button" className="cp-btn cp-btn-grau" onClick={() => setEditProduct(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Stufe 3: Varianten — nur in Varianten-Ansicht (ersetzt Stufe 2) */}
          {inVariantView && brandIdForProducts && (
            <div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <button
                  type="button"
                  className="cp-btn cp-btn-grau"
                  onClick={() => {
                    setProductIdForVariants('')
                    setEditVariant(null)
                    setVariantFormOpen(false)
                    setShowSingleVariantForm(false)
                  }}
                >
                  ← Products
                </button>
                <span style={{ fontSize: 13, color: '#64748b' }}>
                  {currentBrandName} <span aria-hidden>›</span> {productBreadcrumbName} <span aria-hidden>›</span> Variants
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="cp-btn cp-btn-grau"
                  onClick={() => void loadVariantsForProduct(productIdForVariants)}
                  disabled={variantsLoading || matrixBusy}
                >
                  Reload
                </button>
              </div>

              {/* Matrix: colours × sizes */}
              <div
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 12,
                  background: '#fff',
                }}
              >
                <div style={{ display: 'grid', gap: 12 }}>
                  {/* Step 1: colours each with their own size run */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                      Step 1: Colours each with their own size run
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      <input
                        className="cp-select"
                        placeholder="Colour name"
                        value={matrixColorName}
                        onChange={e => setMatrixColorName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addMatrixColor()
                          }
                        }}
                        style={{ minWidth: 160 }}
                      />
                      <input
                        type="color"
                        value={matrixColorHex}
                        onChange={e => setMatrixColorHex(e.target.value)}
                        style={{ width: 44, height: 32, padding: 0, border: 'none' }}
                        aria-label="Colour picker"
                      />
                      <select
                        className="cp-select"
                        value={matrixColorSizeRun}
                        onChange={e => setMatrixColorSizeRun(e.target.value as SizeMatrixPreset)}
                        disabled={matrixBusy}
                        style={{ minWidth: 220 }}
                        aria-label="Select size run"
                      >
                        <option value="STANDARD">Standard (XS–5XL)</option>
                        <option value="REDUZIERT">Reduced (XS–3XL)</option>
                        <option value="KIDS">Kids</option>
                        <option value="UNISEX">Unisex (XS–5XL)</option>
                        <option value="EIGENE">Custom…</option>
                      </select>
                      <button
                        type="button"
                        className="cp-btn cp-btn-grau"
                        onClick={() => addMatrixColor()}
                        disabled={matrixBusy}
                      >
                        + Add
                      </button>
                    </div>
                    {matrixColorSizeRun === 'EIGENE' && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                          <input
                            className="cp-select"
                            placeholder="Type size + Enter"
                            value={matrixCustomInput}
                            onChange={e => setMatrixCustomInput(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                addMatrixCustomTag()
                              }
                            }}
                            style={{ minWidth: 200 }}
                          />
                          <button
                            type="button"
                            className="cp-btn cp-btn-grau"
                            onClick={() => addMatrixCustomTag()}
                            disabled={matrixBusy}
                          >
                            + Add
                          </button>
                        </div>
                        {matrixCustomTags.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                            {matrixCustomTags.map(tag => (
                              <span
                                key={tag}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  border: '1px solid #e5e7eb',
                                  borderRadius: 999,
                                  padding: '6px 10px',
                                  fontSize: 13,
                                  background: '#f8fafc',
                                }}
                              >
                                {tag}
                                <button
                                  type="button"
                                  onClick={() => removeMatrixCustomTag(tag)}
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    fontSize: 14,
                                    lineHeight: 1,
                                    padding: 0,
                                    opacity: 0.75,
                                  }}
                                  aria-label={`Remove ${tag}`}
                                  disabled={matrixBusy}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {matrixColors.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                        {matrixColors.map(f => (
                          <span
                            key={f.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 8,
                              border: '1px solid #e5e7eb',
                              borderRadius: 999,
                              padding: '6px 10px',
                              fontSize: 13,
                              background: '#f8fafc',
                            }}
                          >
                            <span
                              aria-hidden
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: 999,
                                background: f.hex,
                                border: '1px solid rgba(0,0,0,0.15)',
                              }}
                            />
                            <span style={{ fontWeight: 600 }}>{f.name}</span>
                            <span style={{ opacity: 0.75 }}>{f.hex.toUpperCase()}</span>
                            <span
                              style={{
                                fontSize: 12,
                                padding: '2px 8px',
                                borderRadius: 999,
                                background: '#e2e8f0',
                                color: '#334155',
                              }}
                            >
                              {sizeRunLabel(f.sizeRun, f.customSizes)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeMatrixColor(f.id)}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                fontSize: 14,
                                lineHeight: 1,
                                padding: 0,
                                opacity: 0.75,
                              }}
                              aria-label={`Remove ${f.name}`}
                              disabled={matrixBusy}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Schritt 2: Vorschau */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Step 2: Preview</div>
                    <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
                      {matrixColors.length === 0
                        ? 'No colours yet — preview appears after adding.'
                        : matrixPreview.summaryText}
                    </p>
                  </div>

                  {/* Schritt 3: Optionen + Anlegen */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Step 3: Options</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                      <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                        Min. stock for all
                        <input
                          type="number"
                          className="cp-select"
                          min={0}
                          value={matrixMin}
                          onChange={e => setMatrixMin(e.target.value)}
                          style={{ maxWidth: 100 }}
                          disabled={matrixBusy}
                        />
                      </label>
                      <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                        <input
                          type="checkbox"
                          checked={matrixAllSamples}
                          onChange={e => setMatrixAllSamples(e.target.checked)}
                          disabled={matrixBusy}
                        />
                        Mark all as samples
                      </label>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                      <button
                        type="button"
                        className="cp-btn"
                        onClick={() => void createVariantMatrix()}
                        disabled={matrixBusy || matrixColors.length === 0 || matrixPreview.total === 0}
                      >
                        Create variants
                      </button>
                      <button
                        type="button"
                        className="cp-btn cp-btn-grau"
                        onClick={() => resetMatrix()}
                        disabled={matrixBusy}
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowSingleVariantForm(o => !o)
                      setVariantFormOpen(o => !o)
                    }}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      cursor: 'pointer',
                      color: '#2563eb',
                      fontSize: 13,
                      textDecoration: 'underline',
                      alignSelf: 'flex-start',
                    }}
                    disabled={matrixBusy}
                  >
                    {showSingleVariantForm ? 'Close single variant' : 'Add single variant'}
                  </button>
                </div>
              </div>

              {/* Einzelvariante (Ausnahme) */}
              {showSingleVariantForm && variantFormOpen && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: 8,
                    marginBottom: 12,
                    padding: 10,
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    alignItems: 'end',
                  }}
                >
                  <input
                    className="cp-select"
                    placeholder="Colour (required)"
                    value={newVariant.color}
                    onChange={e => setNewVariant(s => ({ ...s, color: e.target.value }))}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12 }}>Colour code</span>
                    <input
                      type="color"
                      value={newVariant.color_hex || '#000000'}
                      onChange={e => setNewVariant(s => ({ ...s, color_hex: e.target.value }))}
                      style={{ width: 44, height: 32, padding: 0, border: 'none' }}
                    />
                  </div>
                  <input
                    className="cp-select"
                    placeholder="Size (required)"
                    value={newVariant.size}
                    onChange={e => setNewVariant(s => ({ ...s, size: e.target.value }))}
                  />
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={newVariant.is_sample}
                      onChange={e => setNewVariant(s => ({ ...s, ist_muster: e.target.checked }))}
                    />
                    Is sample
                  </label>
                  <input
                    type="number"
                    className="cp-select"
                    min={0}
                    value={newVariant.min_stock}
                    onChange={e => setNewVariant(s => ({ ...s, min_stock: e.target.value }))}
                    placeholder="Min. stock"
                  />
                  <button type="button" className="cp-btn" onClick={() => void saveVariant()} disabled={matrixBusy}>
                    Save
                  </button>
                </div>
              )}
              {variantsLoading && <p style={{ opacity: 0.8 }}>Loading…</p>}
              {!variantsLoading && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                        <th style={{ padding: '8px 6px' }}>Colour</th>
                        <th style={{ padding: '8px 6px' }}>Colour code</th>
                        <th style={{ padding: '8px 6px' }}>Size</th>
                        <th style={{ padding: '8px 6px' }}>Sample</th>
                        <th style={{ padding: '8px 6px' }}>Stock</th>
                        <th style={{ padding: '8px 6px' }}>Min. stock</th>
                        <th style={{ padding: '8px 6px' }}>Edit</th>
                        <th style={{ padding: '8px 6px' }}>Booking</th>
                      </tr>
                    </thead>
                    <tbody>
                      {varianten.map(variant => {
                        const minEditValue = minimumEdit[variant.id]
                        const minimumDisplay = minEditValue != null ? minEditValue : String(variant.min_stock ?? 0)
                        return (
                          <tr key={variant.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 6px' }}>{variant.color}</td>
                            <td style={{ padding: '8px 6px' }}>{variant.color_hex || '—'}</td>
                            <td style={{ padding: '8px 6px' }}>{variant.size}</td>
                            <td style={{ padding: '8px 6px' }}>
                              {variant.is_sample ? <span className="badge badge-grau">Sample</span> : '—'}
                            </td>
                            <td style={{ padding: '8px 6px' }}>{variant.stock ?? 0}</td>
                            <td style={{ padding: '8px 6px' }}>
                              <input
                                type="number"
                                className="cp-select"
                                value={minimumDisplay}
                                min={0}
                                onChange={e => setMinimumEdit(s => ({ ...s, [variant.id]: e.target.value }))}
                                onBlur={() => void saveMinimumStock(variant)}
                                style={{ maxWidth: 100 }}
                              />
                            </td>
                            <td style={{ padding: '8px 6px' }}>
                              <button
                                type="button"
                                className="cp-btn cp-btn-grau"
                                style={{ padding: '2px 8px', fontSize: 12 }}
                                onClick={() => {
                                  setEditVariant(variant)
                                  setEditVariantColor(variant.color)
                                  setEditVariantColorHex(variant.color_hex ?? '')
                                  setEditVariantSize(variant.size)
                                  setEditVariantIsSample(variant.is_sample)
                                  setEditVariantMinimum(String(variant.min_stock ?? 0))
                                  setEditVariantActive(variant.is_active)
                                }}
                              >
                                …
                              </button>
                            </td>
                            <td style={{ padding: '8px 6px' }}>
                              {bookingField(variant, (x, t) => void bookMovement(x, t))}
                              {bookingErrors[variant.id] && (
                                <div style={{ color: '#b91c1c', fontSize: 12, marginTop: 4 }}>{bookingErrors[variant.id]}</div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {editVariant && productIdForVariants && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    maxWidth: 560,
                  }}
                >
                  <h3 style={{ fontSize: 14, marginTop: 0 }}>Edit variant</h3>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                      gap: 8,
                      alignItems: 'end',
                    }}
                  >
                    <input
                      className="cp-select"
                      value={editVariantColor}
                      onChange={e => setEditVariantColor(e.target.value)}
                      placeholder="Colour"
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="color"
                        value={editVariantColorHex || '#000000'}
                        onChange={e => setEditVariantColorHex(e.target.value)}
                        style={{ width: 44, height: 32, padding: 0, border: 'none' }}
                      />
                    </div>
                    <input
                      className="cp-select"
                      value={editVariantSize}
                      onChange={e => setEditVariantSize(e.target.value)}
                      placeholder="Size"
                    />
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={editVariantIsSample}
                        onChange={e => setEditVariantIsSample(e.target.checked)}
                      />
                      Sample
                    </label>
                    <input
                      type="number"
                      className="cp-select"
                      min={0}
                      value={editVariantMinimum}
                      onChange={e => setEditVariantMinimum(e.target.value)}
                    />
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={editVariantActive}
                        onChange={e => setEditVariantActive(e.target.checked)}
                      />
                      Active
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="cp-btn" onClick={() => void updateVariant()}>
                        Save
                      </button>
                      <button type="button" className="cp-btn cp-btn-grau" onClick={() => setEditVariant(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {!brandIdForProducts && (
            <p style={{ fontSize: 13, color: '#64748b', margin: '8px 0 0' }}>Select a brand first.</p>
          )}
        </div>
      )}

      {tab === 'STOCK' && (
        <div>
          <div
            style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <input
              type="search"
              className="cp-select"
              placeholder="Brand, product, colour, size…"
              value={stockSearch}
              onChange={e => setStockSearch(e.target.value)}
              style={{ minWidth: 220, maxWidth: 320 }}
            />
            <select
              className="cp-select"
              value={stockBrandFilter}
              onChange={e => setStockBrandFilter(e.target.value)}
            >
              <option value="ALL">All brands</option>
              {brandOptionsForStock.map(m => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={filterReorderOnly}
                onChange={e => setFilterReorderOnly(e.target.checked)}
              />
              Only reorder
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={filterSamplesOnly}
                onChange={e => setFilterSamplesOnly(e.target.checked)}
              />
              Only samples
            </label>
            <button
              type="button"
              className="cp-btn cp-btn-grau"
              onClick={() => void loadAllVariants()}
              disabled={allVariantsLoading}
            >
              Reload
            </button>
          </div>
          {allVariantsLoading && <p style={{ opacity: 0.8 }}>Loading…</p>}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                  <th
                    style={{ padding: '8px 6px', cursor: 'pointer' }}
                    onClick={() => toggleStockSort('marke')}
                  >
                    Brand
                    {stockSorting?.key === 'marke' ? (stockSorting.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                  <th
                    style={{ padding: '8px 6px', cursor: 'pointer' }}
                    onClick={() => toggleStockSort('produkt')}
                  >
                    Product
                    {stockSorting?.key === 'produkt' ? (stockSorting.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                  <th
                    style={{ padding: '8px 6px', cursor: 'pointer' }}
                    onClick={() => toggleStockSort('color')}
                  >
                    Colour
                    {stockSorting?.key === 'color' ? (stockSorting.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                  <th
                    style={{ padding: '8px 6px', cursor: 'pointer' }}
                    onClick={() => toggleStockSort('size')}
                  >
                    Size
                    {stockSorting?.key === 'size' ? (stockSorting.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                  <th
                    style={{ padding: '8px 6px', cursor: 'pointer' }}
                    onClick={() => toggleStockSort('muster')}
                  >
                    Sample
                    {stockSorting?.key === 'muster' ? (stockSorting.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                  <th
                    style={{ padding: '8px 6px', cursor: 'pointer' }}
                    onClick={() => toggleStockSort('stock')}
                  >
                    Stock
                    {stockSorting?.key === 'stock' ? (stockSorting.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                  <th
                    style={{ padding: '8px 6px', cursor: 'pointer' }}
                    onClick={() => toggleStockSort('min_stock')}
                  >
                    Min. stock
                    {stockSorting?.key === 'min_stock' ? (stockSorting.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                  <th
                    style={{ padding: '8px 6px', cursor: 'pointer' }}
                    onClick={() => toggleStockSort('status')}
                  >
                    Status
                    {stockSorting?.key === 'status' ? (stockSorting.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                  <th style={{ padding: '8px 6px' }}>Booking</th>
                </tr>
              </thead>
              <tbody>
                {filteredVariants.map(variant => {
                  const status = variantStatus(variant)
                  const minEditValue = minimumEdit[variant.id]
                  const minimumDisplay = minEditValue != null ? minEditValue : String(variant.min_stock ?? 0)
                  return (
                    <tr key={variant.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 6px' }}>{brandFromVariant(variant)}</td>
                      <td style={{ padding: '8px 6px', fontWeight: 600 }}>{productNameFromVariant(variant)}</td>
                      <td style={{ padding: '8px 6px' }}>{variant.color}</td>
                      <td style={{ padding: '8px 6px' }}>{variant.size}</td>
                      <td style={{ padding: '8px 6px' }}>
                        {variant.is_sample ? <span className="badge badge-grau">Sample</span> : '—'}
                      </td>
                      <td style={{ padding: '8px 6px' }}>{variant.stock ?? 0}</td>
                      <td style={{ padding: '8px 6px' }}>
                        <input
                          type="number"
                          className="cp-select"
                          min={0}
                          value={minimumDisplay}
                          onChange={e => setMinimumEdit(s => ({ ...s, [variant.id]: e.target.value }))}
                          onBlur={() => void saveMinimumStock(variant)}
                          style={{ maxWidth: 100 }}
                        />
                      </td>
                      <td style={{ padding: '8px 6px' }}>
                        <span className={`badge ${status.cls}`}>{status.label}</span>
                      </td>
                      <td style={{ padding: '8px 6px' }}>
                        {bookingField(variant, (x, t) => void bookMovementStockTab(x, t))}
                        {bookingErrors[variant.id] && (
                          <div style={{ color: '#b91c1c', fontSize: 12, marginTop: 4 }}>{bookingErrors[variant.id]}</div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'ORDER_LIST' && (
        <div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
            <button
              type="button"
              className="cp-btn cp-btn-grau"
              onClick={() => void loadOrderList()}
              disabled={orderLoading}
            >
              Refresh
            </button>
            <button
              type="button"
              className="cp-btn"
              onClick={() => void copyOrderList()}
              disabled={orderLoading || orderRows.length === 0}
            >
              Copy to clipboard
            </button>
            {orderCopied && <span style={{ fontSize: 13, color: '#15803d' }}>Copied</span>}
          </div>
          {orderError && <p style={{ color: '#b91c1c' }}>{orderError}</p>}
          {orderLoading && <p style={{ opacity: 0.8 }}>Loading…</p>}
          {!orderLoading && !orderError && orderRows.length === 0 && (
            <p style={{ margin: '12px 0', color: '#15803d', fontWeight: 600 }}>
              All in stock — no reorder needed
            </p>
          )}
          {orderRows.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '8px 6px' }}>Brand</th>
                    <th style={{ padding: '8px 6px' }}>Product</th>
                    <th style={{ padding: '8px 6px' }}>Colour</th>
                    <th style={{ padding: '8px 6px' }}>Size</th>
                    <th style={{ padding: '8px 6px' }}>Stock</th>
                    <th style={{ padding: '8px 6px' }}>Open</th>
                    <th style={{ padding: '8px 6px' }}>Min. stock</th>
                    <th style={{ padding: '8px 6px' }}>Order qty</th>
                  </tr>
                </thead>
                <tbody>
                  {orderRows.map(orderRow => (
                    <tr key={orderRow.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 6px' }}>{orderListCell(brandFromVariant(orderRow), '—')}</td>
                      <td style={{ padding: '8px 6px', fontWeight: 600 }}>
                        {orderListCell(productNameFromVariant(orderRow), '—')}
                      </td>
                      <td style={{ padding: '8px 6px' }}>{orderListCell(orderRow.color, '—')}</td>
                      <td style={{ padding: '8px 6px' }}>{orderListCell(orderRow.size, '—')}</td>
                      <td style={{ padding: '8px 6px' }}>{orderListNumber(orderRow.stock)}</td>
                      <td style={{ padding: '8px 6px' }}>{orderListNumber(orderRow.offene_menge)}</td>
                      <td style={{ padding: '8px 6px' }}>{orderListNumber(orderRow.min_stock)}</td>
                      <td
                        style={{
                          padding: '8px 6px',
                          fontWeight: 700,
                          color: '#b91c1c',
                        }}
                      >
                        {orderListNumber(orderRow.bestellmenge)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
