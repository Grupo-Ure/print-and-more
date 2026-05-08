import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { authService } from '../services/authService'
import { Login } from '../components/Login'
import { useToast } from '../components/Toast'
import type { Database } from '../types/supabase'

type BrandRow = Database['public']['Tables']['textil_marken']['Row']
type ProductRow = Database['public']['Tables']['textil_produkte']['Row'] & {
  textil_marken?: { name: string } | { name: string }[] | null
}
type VariantRow = Database['public']['Tables']['textil_varianten']['Row'] & {
  textil_produkte?: unknown
}
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
      return customSizes.length ? customSizes.join(' · ') : 'Eigene'
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
  artikelnummer: string | null
  textil_marken?: unknown
}

function productNested(variant: VariantRow): ProductNested | null {
  const nested = oneNested(variant.textil_produkte as ProductNested | ProductNested[] | null)
  return nested
}

function brandFromVariant(variant: VariantRow): string {
  const product = productNested(variant)
  if (!product) return ''
  return joinName(product.textil_marken)
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
    return 'Unbekannter Fehler'
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
  if (typeof value === 'boolean') return value ? 'ja' : 'nein'
  if (typeof value === 'object') return fallback
  return String(value)
}

/** Status für Bestand-Tab (ohne Muster: Farblogik; Muster: immer grau). */
function variantStatus(
  variant: VariantRow
): { cls: string; label: string; rank: number } {
  if (variant.ist_muster) return { cls: 'badge-grau', label: 'Muster', rank: -1 }
  const stock = variant.bestand ?? 0
  const minimum = variant.mindestbestand ?? 0
  if (stock <= 0) return { cls: 'badge-rot', label: 'Leer', rank: 0 }
  if (stock < minimum) return { cls: 'badge-rot', label: 'Nachbestellen', rank: 1 }
  if (stock === minimum) return { cls: 'badge-orange', label: 'Minimum', rank: 2 }
  return { cls: 'badge-gruen', label: 'OK', rank: 3 }
}

type ReorderRow = VariantRow & { offene_menge: number; bestellmenge: number }

export function TextileStockPage() {
  const { fehler: showError, erfolg: showSuccess } = useToast()
  const [session, setSession] = useState<Session | null>(null)
  const [loading,setLoading] = useState(true)
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
    const { data, error: loadError } = await supabase.from('textil_marken').select('*').order('name')
    setBrandsLoading(false)
    if (loadError) {
      showError('Marken konnten nicht geladen werden')
      return
    }
    setBrands((data ?? []) as BrandRow[])
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
      const { data, error: loadError } = await supabase
        .from('textil_produkte')
        .select('*, textil_marken(name)')
        .eq('marke_id', brandId)
        .order('name')
      setProductsLoading(false)
      if (loadError) {
        showError('Produkte konnten nicht geladen werden')
        return
      }
      setProducts((data ?? []) as ProductRow[])
    },
    [showError]
  )

  useEffect(() => {
    if (tab !== 'PRODUCTS') return
    void loadProductsForBrand(brandIdForProducts)
  }, [tab, brandIdForProducts, loadProductsForBrand])

  const [newProduct, setNewProduct] = useState({
    marke_id: '',
    name: '',
    artikelnummer: '',
    beschreibung: '',
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
      const { data, error: loadError } = await supabase
        .from('textil_varianten')
        .select(
          '*, textil_produkte(name, artikelnummer, textil_marken(name))'
        )
        .eq('produkt_id', productId)
        .order('sort_order')
      setVariantsLoading(false)
      if (loadError) {
        showError('Varianten konnten nicht geladen werden')
        return
      }
      setVarianten((data ?? []) as VariantRow[])
    },
    [showError]
  )

  useEffect(() => {
    if (tab !== 'PRODUCTS') return
    void loadVariantsForProduct(productIdForVariants)
  }, [tab, productIdForVariants, loadVariantsForProduct])

  const [newVariant, setNewVariant] = useState({
    farbe: '',
    farbe_hex: '' as string,
    groesse: '',
    ist_muster: false,
    mindestbestand: '0',
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
    movementType: 'ZUGANG' | 'ABGANG',
    onSuccess?: (nextStock: number) => void
  ) => {
    if (!session?.user) return
    if (bookingBusyId) return
    const rawQuantity = (bookingQuantity[variant.id] ?? '').trim()
    setBookingErrors(m => ({ ...m, [variant.id]: null }))
    const quantity = parseInt(rawQuantity, 10)
    if (!Number.isInteger(quantity) || quantity < 1) {
      setBookingErrors(m => ({ ...m, [variant.id]: 'Menge: ganze Zahl ≥ 1' }))
      return
    }
    const stockDelta = movementType === 'ZUGANG' ? quantity : -quantity
    const nextStock = (variant.bestand ?? 0) + stockDelta
    if (nextStock < 0) {
      setBookingErrors(m => ({ ...m, [variant.id]: 'Menge überschreitet aktuellen Bestand' }))
      return
    }
    setBookingBusyId(variant.id)
    try {
      const { error: stockUpdateError } = await supabase
        .from('textil_varianten')
        .update({ bestand: nextStock })
        .eq('id', variant.id)
      if (stockUpdateError) throw stockUpdateError

      const { error: movementInsertError } = await supabase.from('textil_lager_bewegungen').insert({
        variante_id: variant.id,
        menge: quantity,
        typ: movementType,
        person_id: session.user.id,
      })
      if (movementInsertError) throw movementInsertError

      if (onSuccess) {
        onSuccess(nextStock)
      } else {
        setVarianten(list => list.map(x => (x.id === variant.id ? { ...x, bestand: nextStock } : x)))
      }
      setBookingQuantity(m => ({ ...m, [variant.id]: '' }))
    } catch (e) {
      showError('Buchung fehlgeschlagen')
      setBookingErrors(m => ({ ...m, [variant.id]: errorToString(e) }))
    } finally {
      setBookingBusyId(null)
    }
  }

  const bookMovementStockTab = async (variant: VariantRow, movementType: 'ZUGANG' | 'ABGANG') => {
    await bookMovement(variant, movementType, nextStock => {
      setAllVariants(list => list.map(x => (x.id === variant.id ? { ...x, bestand: nextStock } : x)))
    })
  }

  const saveMinimumStock = async (variant: VariantRow) => {
    const rawValue = (minimumEdit[variant.id] ?? String(variant.mindestbestand ?? 0)).trim()
    const minimumValue = rawValue === '' ? 0 : parseInt(rawValue, 10)
    if (!Number.isInteger(minimumValue) || minimumValue < 0) return
    if (minimumValue === (variant.mindestbestand ?? 0)) return
    const { error: updateError } = await supabase
      .from('textil_varianten')
      .update({ mindestbestand: minimumValue })
      .eq('id', variant.id)
    if (updateError) {
      showError('Mindestbestand konnte nicht gespeichert werden')
      return
    }
    setVarianten(list => list.map(x => (x.id === variant.id ? { ...x, mindestbestand: minimumValue } : x)))
    setAllVariants(list => list.map(x => (x.id === variant.id ? { ...x, mindestbestand: minimumValue } : x)))
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
    | 'farbe'
    | 'groesse'
    | 'muster'
    | 'bestand'
    | 'mindestbestand'
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
    const { data, error: loadError } = await supabase
      .from('textil_varianten')
      .select('*, textil_produkte(name, artikelnummer, textil_marken(name))')
      .eq('aktiv', true)
      .order('sort_order')
    setAllVariantsLoading(false)
    if (loadError) {
      showError('Bestand konnte nicht geladen werden')
      return
    }
    setAllVariants((data ?? []) as VariantRow[])
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
    if (filterSamplesOnly) list = list.filter(v => v.ist_muster)
    if (filterReorderOnly) {
      list = list.filter(v => {
        if (v.ist_muster) return false
        const stock = v.bestand ?? 0
        const minimumStock = v.mindestbestand ?? 0
        return stock < minimumStock
      })
    }
    const q = stockSearch.trim().toLowerCase()
    if (q) {
      list = list.filter(v => {
        const brandName = brandFromVariant(v).toLowerCase()
        const productName = productNameFromVariant(v).toLowerCase()
        const colorStr = String(v.farbe ?? '').toLowerCase()
        const sizeStr = String(v.groesse ?? '').toLowerCase()
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
              : key === 'farbe'
                ? a.farbe
                : key === 'groesse'
                  ? a.groesse
                  : key === 'muster'
                    ? (a.ist_muster ? 1 : 0)
                    : key === 'bestand'
                      ? a.bestand ?? 0
                      : key === 'mindestbestand'
                        ? a.mindestbestand ?? 0
                        : variantStatus(a).rank
        const bValue =
          key === 'marke'
            ? brandFromVariant(b)
            : key === 'produkt'
              ? productNameFromVariant(b)
              : key === 'farbe'
                ? b.farbe
                : key === 'groesse'
                  ? b.groesse
                  : key === 'muster'
                    ? (b.ist_muster ? 1 : 0)
                    : key === 'bestand'
                      ? b.bestand ?? 0
                      : key === 'mindestbestand'
                        ? b.mindestbestand ?? 0
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
      const { data: variantData, error: variantLoadError } = await supabase
        .from('textil_varianten')
        .select('*, textil_produkte(name, artikelnummer, textil_marken(name))')
        .eq('aktiv', true)
        .order('sort_order')
      if (variantLoadError) throw variantLoadError
      const activeVariants = (variantData ?? []) as VariantRow[]
      const variantIdSet = new Set(activeVariants.map(v => v.id))

      const { data: subOrderData, error: subOrderLoadError } = await supabase
        .from('teilauftraege')
        .select('id')
        .eq('bereich', 'TEXTIL')
        .eq('storniert', false)
        .neq('status', 'FERTIG')
      if (subOrderLoadError) throw subOrderLoadError
      const subOrderIds = (subOrderData ?? []).map((row: { id: string }) => row.id)
      const demandByVariantId = new Map<string, number>()

      const chunk = 200
      for (let i = 0; i < subOrderIds.length; i += chunk) {
        const subOrderSlice = subOrderIds.slice(i, i + chunk)
        if (subOrderSlice.length === 0) continue
        const { data: positionData, error: positionLoadError } = await supabase
          .from('textil_positionen')
          .select('variante_id, stueckzahl')
          .eq('herkunft', 'EIGENWARE')
          .not('variante_id', 'is', null)
          .in('teilauftrag_id', subOrderSlice)
        if (positionLoadError) throw positionLoadError
        for (const row of (positionData ?? []) as { variante_id: string | null; stueckzahl: number }[]) {
          const variantId = row.variante_id
          if (!variantId || !variantIdSet.has(variantId)) continue
          const demandQuantity = toInteger(row.stueckzahl)
          demandByVariantId.set(variantId, (demandByVariantId.get(variantId) ?? 0) + demandQuantity)
        }
      }

      const reorderRows: ReorderRow[] = []
      for (const v of activeVariants) {
        const openDemand = toInteger(demandByVariantId.get(v.id))
        const currentStock = toInteger(v.bestand)
        const minimumStock = toInteger(v.mindestbestand)
        const bestellmenge = Math.max(0, minimumStock + openDemand - currentStock)
        if (bestellmenge <= 0) continue
        reorderRows.push({ ...v, offene_menge: openDemand, bestellmenge: toInteger(bestellmenge) })
      }
      reorderRows.sort((a, b) => b.bestellmenge - a.bestellmenge)
      setOrderRows(reorderRows)
    } catch (e) {
      showError('Bestellliste konnte nicht geladen werden')
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
    const header = 'Marke | Produkt | Farbe | Größe | Bestand | Offen | Mindestbestand | Bestellen'
    const body = orderRows
      .map(orderRow => {
        return [
          orderListCell(brandFromVariant(orderRow), ''),
          orderListCell(productNameFromVariant(orderRow), ''),
          orderListCell(orderRow.farbe, ''),
          orderListCell(orderRow.groesse, ''),
          orderListNumber(orderRow.bestand),
          orderListNumber(orderRow.offene_menge),
          orderListNumber(orderRow.mindestbestand),
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
      showError('Kopieren fehlgeschlagen')
    }
  }

  const logout = async () => {
    await authService.signOut()
  }

  const saveBrand = async () => {
    const trimmedName = newBrandName.trim()
    if (!trimmedName) return
    const { error: insertError } = await supabase.from('textil_marken').insert({ name: trimmedName, aktiv: true })
    if (insertError) {
      showError('Marke konnte nicht angelegt werden')
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
    const { error: updateError } = await supabase
      .from('textil_marken')
      .update({ name: trimmedName, aktiv: editBrandActive })
      .eq('id', editingBrandId)
    if (updateError) {
      showError('Marke konnte nicht gespeichert werden')
      return
    }
    setEditingBrandId(null)
    void loadBrands()
    if (brandIdForProducts === previousBrandId) void loadProductsForBrand(brandIdForProducts)
  }

  const saveProduct = async () => {
    const brandId = newProduct.marke_id || brandIdForProducts
    const trimmedName = newProduct.name.trim()
    if (!brandId || !trimmedName) {
      showError('Marke und Name sind Pflicht')
      return
    }
    const { error: insertError } = await supabase.from('textil_produkte').insert({
      marke_id: brandId,
      name: trimmedName,
      artikelnummer: newProduct.artikelnummer.trim() || null,
      beschreibung: newProduct.beschreibung.trim() || null,
      aktiv: true,
    })
    if (insertError) {
      showError('Produkt konnte nicht angelegt werden')
      return
    }
    setNewProduct({ marke_id: '', name: '', artikelnummer: '', beschreibung: '' })
    setProductFormOpen(false)
    if (brandId === brandIdForProducts) void loadProductsForBrand(brandIdForProducts)
  }

  const updateProduct = async () => {
    if (!editProduct) return
    const trimmedName = editProductName.trim()
    if (!trimmedName) return
    const { error: updateError } = await supabase
      .from('textil_produkte')
      .update({
        name: trimmedName,
        artikelnummer: editProductArticleNumber.trim() || null,
        beschreibung: editProductDescription.trim() || null,
        aktiv: editProductActive,
      })
      .eq('id', editProduct.id)
    if (updateError) {
      showError('Produkt konnte nicht gespeichert werden')
      return
    }
    setEditProduct(null)
    void loadProductsForBrand(brandIdForProducts)
    if (productIdForVariants) void loadVariantsForProduct(productIdForVariants)
  }

  const saveVariant = async () => {
    if (!productIdForVariants) {
      showError('Produkt wählen')
      return
    }
    const colorValue = newVariant.farbe.trim()
    const sizeValue = newVariant.groesse.trim()
    if (!colorValue || !sizeValue) {
      showError('Farbe und Größe sind Pflicht')
      return
    }
    const minimumRaw = newVariant.mindestbestand.trim()
    const minimumValue = minimumRaw === '' ? 0 : parseInt(minimumRaw, 10)
    if (!Number.isInteger(minimumValue) || minimumValue < 0) {
      showError('Mindestbestand ungültig')
      return
    }
    const { data: maxRow } = await supabase
      .from('textil_varianten')
      .select('sort_order')
      .eq('produkt_id', productIdForVariants)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    const nextSortOrder = toInteger((maxRow as { sort_order: number } | null)?.sort_order) + 1
    const { error: insertError } = await supabase.from('textil_varianten').insert({
      produkt_id: productIdForVariants,
      farbe: colorValue,
      farbe_hex: newVariant.farbe_hex.trim() || null,
      groesse: sizeValue,
      ist_muster: newVariant.ist_muster,
      mindestbestand: minimumValue,
      bestand: 0,
      sort_order: nextSortOrder,
      aktiv: true,
    })
    if (insertError) {
      showError('Variante konnte nicht angelegt werden')
      return
    }
    setNewVariant({
      farbe: '',
      farbe_hex: '',
      groesse: '',
      ist_muster: false,
      mindestbestand: '0',
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
      parts.push(`${colorEntry.name} (${sizeCount} Größen)`)
    }
    const summaryText = `${parts.join(' + ')} = ${total} Varianten gesamt`
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
      showError('Bei „Eigene…” mindestens eine Größe als Tag hinzufügen')
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
      showError('Mindestens 1 Farbe hinzufügen')
      return
    }
    for (const colorEntry of colors) {
      const sizeList = sizesForPreset(colorEntry.sizeRun, colorEntry.customSizes)
      if (sizeList.length === 0) {
        showError(`Keine Größen für Farbe „${colorEntry.name}”`)
        return
      }
    }
    const minRaw = matrixMin.trim()
    const min = minRaw === '' ? 0 : parseInt(minRaw, 10)
    if (!Number.isInteger(min) || min < 0) {
      showError('Mindestbestand ungültig')
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
      const { data: existingVariants, error: existingError } = await supabase
        .from('textil_varianten')
        .select('farbe, groesse')
        .eq('produkt_id', productIdForVariants)
        .in('farbe', allColorNames)
        .in('groesse', allSizesList)
      if (existingError) throw existingError

      const existingCombinationSet = new Set<string>()
      for (const existingRow of (existingVariants ?? []) as { farbe: string; groesse: string }[]) {
        existingCombinationSet.add(`${existingRow.farbe}|||${existingRow.groesse}`)
      }

      const variantInserts: Database['public']['Tables']['textil_varianten']['Insert'][] = []
      let sortCounter = 0
      for (const colorEntry of colors) {
        const sizeList = sizesForPreset(colorEntry.sizeRun, colorEntry.customSizes)
        sizeList.forEach(sizeValue => {
          const combinationKey = `${colorEntry.name}|||${sizeValue}`
          if (existingCombinationSet.has(combinationKey)) return
          variantInserts.push({
            produkt_id: productIdForVariants,
            farbe: colorEntry.name,
            farbe_hex: colorEntry.hex,
            groesse: sizeValue,
            ist_muster: matrixAllSamples,
            mindestbestand: min,
            bestand: 0,
            sort_order: sortCounter++,
            aktiv: true,
          })
        })
      }

      if (variantInserts.length === 0) {
        showSuccess('Keine neuen Varianten — alles vorhanden')
        return
      }

      const { error: insertError } = await supabase.from('textil_varianten').insert(variantInserts)
      if (insertError) throw insertError

      showSuccess(`${variantInserts.length} Varianten angelegt`)
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
      showError('Farbe und Größe sind Pflicht')
      return
    }
    const minimumRaw = editVariantMinimum.trim()
    const minimumValue = minimumRaw === '' ? 0 : parseInt(minimumRaw, 10)
    if (!Number.isInteger(minimumValue) || minimumValue < 0) return
    const { error: updateError } = await supabase
      .from('textil_varianten')
      .update({
        farbe: colorValue,
        farbe_hex: editVariantColorHex.trim() || null,
        groesse: sizeValue,
        ist_muster: editVariantIsSample,
        mindestbestand: minimumValue,
        aktiv: editVariantActive,
      })
      .eq('id', editVariant.id)
    if (updateError) {
      showError('Variante konnte nicht gespeichert werden')
      return
    }
    setEditVariant(null)
    void loadVariantsForProduct(productIdForVariants)
    void loadAllVariants()
  }

  if (loading) return null
  if (!session) return <Login />

  const inVariantView = Boolean(productIdForVariants)
  const inProductView = Boolean(brandIdForProducts) && !inVariantView
  const currentBrandName = brands.find(m => m.id === brandIdForProducts)?.name ?? '—'
  const productBreadcrumbName = products.find(p => p.id === productIdForVariants)?.name ?? '—'

  const bookingField = (variant: VariantRow, onBook: (x: VariantRow, t: 'ZUGANG' | 'ABGANG') => void) => {
    const quantityStr = (bookingQuantity[variant.id] ?? '').slice(0, 3)
    const quantity = quantityStr.trim() === '' ? null : parseInt(quantityStr, 10)
    const quantityValid = quantity != null && Number.isInteger(quantity) && quantity >= 1
    const outboundDisabled = !quantityValid || bookingBusyId != null || (quantityValid && (quantity as number) > (variant.bestand ?? 0))
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
          onClick={() => void onBook(variant, 'ZUGANG')}
          title="Zugang"
        >
          +
        </button>
        <button
          type="button"
          className="cp-btn cp-btn-grau"
          style={{ width: 34, padding: '6px 0' }}
          disabled={outboundDisabled}
          onClick={() => void onBook(variant, 'ABGANG')}
          title="Abgang"
        >
          −
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 18 }}>Textilien — Bestandspflege</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, opacity: 0.85 }}>{userEmail}</span>
          <button type="button" className="cp-btn cp-btn-grau" onClick={() => void logout()}>
            Logout
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14, marginBottom: 14, flexWrap: 'wrap' }}>
        <button
          type="button"
          className={tab === 'PRODUCTS' ? 'cp-btn' : 'cp-btn cp-btn-grau'}
          onClick={() => setTab('PRODUCTS')}
        >
          Produkte
        </button>
        <button
          type="button"
          className={tab === 'STOCK' ? 'cp-btn' : 'cp-btn cp-btn-grau'}
          onClick={() => setTab('STOCK')}
        >
          Bestand
        </button>
        <button
          type="button"
          className={tab === 'ORDER_LIST' ? 'cp-btn' : 'cp-btn cp-btn-grau'}
          onClick={() => setTab('ORDER_LIST')}
        >
          Bestellliste
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
            {brandsLoading && <span style={{ fontSize: 13, opacity: 0.75 }}>Lädt…</span>}
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
                      aktiv
                    </label>
                    <button type="button" className="cp-btn" style={{ padding: '4px 10px' }} onClick={() => void updateBrand()}>
                      Speichern
                    </button>
                    <button
                      type="button"
                      className="cp-btn cp-btn-grau"
                      style={{ padding: '4px 10px' }}
                      onClick={() => setEditingBrandId(null)}
                    >
                      Abbrechen
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
                    title={m.aktiv ? m.name : `${m.name} (inaktiv)`}
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
                      setEditBrandActive(m.aktiv)
                    }}
                    title="Marke bearbeiten"
                    aria-label={`Marke ${m.name} bearbeiten`}
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
                title="Neue Marke"
              >
                + Neu
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
                  Speichern
                </button>
                <button
                  type="button"
                  className="cp-btn cp-btn-grau"
                  style={{ padding: '4px 10px' }}
                  onClick={() => setNewBrandFormOpen(false)}
                >
                  Abbrechen
                </button>
              </div>
            )}
            <button
              type="button"
              className="cp-btn cp-btn-grau"
              style={{ marginLeft: 4, padding: '4px 10px' }}
              onClick={() => void loadBrands()}
              disabled={brandsLoading}
              title="Marken neu laden"
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
                      if (isOpen) setNewProduct(s => ({ ...s, marke_id: brandIdForProducts }))
                      return isOpen
                    })
                  }}
                >
                  + Produkt hinzufügen
                </button>
                <button
                  type="button"
                  className="cp-btn cp-btn-grau"
                  onClick={() => void loadProductsForBrand(brandIdForProducts)}
                  disabled={productsLoading}
                >
                  Neu laden
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
                    placeholder="Name (Pflicht)"
                    value={newProduct.name}
                    onChange={e => setNewProduct(s => ({ ...s, name: e.target.value }))}
                  />
                  <input
                    className="cp-select"
                    placeholder="Artikelnummer"
                    value={newProduct.artikelnummer}
                    onChange={e => setNewProduct(s => ({ ...s, artikelnummer: e.target.value }))}
                  />
                  <input
                    className="cp-select"
                    placeholder="Beschreibung"
                    value={newProduct.beschreibung}
                    onChange={e => setNewProduct(s => ({ ...s, beschreibung: e.target.value }))}
                    style={{ gridColumn: '1 / -1' }}
                  />
                  <button type="button" className="cp-btn" onClick={() => void saveProduct()}>
                    Speichern
                  </button>
                </div>
              )}
              {productsLoading && <p style={{ opacity: 0.8, margin: '0 0 8px' }}>Lädt…</p>}
              {!productsLoading && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                        <th style={{ padding: '8px 6px' }}>Name</th>
                        <th style={{ padding: '8px 6px' }}>Artikelnummer</th>
                        <th style={{ padding: '8px 6px' }}>Aktionen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map(p => (
                        <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 6px', fontWeight: 600 }}>{p.name}</td>
                          <td style={{ padding: '8px 6px' }}>{p.artikelnummer ?? '—'}</td>
                          <td style={{ padding: '8px 6px' }}>
                            <button
                              type="button"
                              className="cp-btn cp-btn-grau"
                              onClick={() => {
                                setEditProduct(p)
                                setEditProductName(p.name)
                                setEditProductArticleNumber(p.artikelnummer ?? '')
                                setEditProductDescription(p.beschreibung ?? '')
                                setEditProductActive(p.aktiv)
                              }}
                            >
                              Bearbeiten
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
                              Varianten
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
                  <h3 style={{ fontSize: 14, marginTop: 0 }}>Produkt bearbeiten</h3>
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
                      placeholder="Artikelnummer"
                    />
                    <input
                      className="cp-select"
                      value={editProductDescription}
                      onChange={e => setEditProductDescription(e.target.value)}
                      placeholder="Beschreibung"
                      style={{ gridColumn: '1 / -1' }}
                    />
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={editProductActive}
                        onChange={e => setEditProductActive(e.target.checked)}
                      />
                      Aktiv
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="cp-btn" onClick={() => void updateProduct()}>
                        Speichern
                      </button>
                      <button type="button" className="cp-btn cp-btn-grau" onClick={() => setEditProduct(null)}>
                        Abbrechen
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
                  ← Produkte
                </button>
                <span style={{ fontSize: 13, color: '#64748b' }}>
                  {currentBrandName} <span aria-hidden>›</span> {productBreadcrumbName} <span aria-hidden>›</span> Varianten
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="cp-btn cp-btn-grau"
                  onClick={() => void loadVariantsForProduct(productIdForVariants)}
                  disabled={variantsLoading || matrixBusy}
                >
                  Neu laden
                </button>
              </div>

              {/* Matrix: Farben × Größen */}
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
                  {/* Schritt 1: Farben mit je eigenem Größenlauf */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                      Schritt 1: Farben mit je eigenem Größenlauf
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      <input
                        className="cp-select"
                        placeholder="Farbname"
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
                        aria-label="Farbwähler"
                      />
                      <select
                        className="cp-select"
                        value={matrixColorSizeRun}
                        onChange={e => setMatrixColorSizeRun(e.target.value as SizeMatrixPreset)}
                        disabled={matrixBusy}
                        style={{ minWidth: 220 }}
                        aria-label="Größenlauf wählen"
                      >
                        <option value="STANDARD">Standard (XS–5XL)</option>
                        <option value="REDUZIERT">Reduziert (XS–3XL)</option>
                        <option value="KIDS">Kids</option>
                        <option value="UNISEX">Unisex (XS–5XL)</option>
                        <option value="EIGENE">Eigene…</option>
                      </select>
                      <button
                        type="button"
                        className="cp-btn cp-btn-grau"
                        onClick={() => addMatrixColor()}
                        disabled={matrixBusy}
                      >
                        + Hinzufügen
                      </button>
                    </div>
                    {matrixColorSizeRun === 'EIGENE' && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                          <input
                            className="cp-select"
                            placeholder="Größe tippen + Enter"
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
                            + Hinzufügen
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
                                  aria-label={`${tag} entfernen`}
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
                              aria-label={`${f.name} entfernen`}
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
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Schritt 2: Vorschau</div>
                    <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
                      {matrixColors.length === 0
                        ? 'Noch keine Farben — Vorschau erscheint nach dem Hinzufügen.'
                        : matrixPreview.summaryText}
                    </p>
                  </div>

                  {/* Schritt 3: Optionen + Anlegen */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Schritt 3: Optionen</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                      <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                        Mindestbestand für alle
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
                        Alle als Muster markieren
                      </label>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                      <button
                        type="button"
                        className="cp-btn"
                        onClick={() => void createVariantMatrix()}
                        disabled={matrixBusy || matrixColors.length === 0 || matrixPreview.total === 0}
                      >
                        Varianten anlegen
                      </button>
                      <button
                        type="button"
                        className="cp-btn cp-btn-grau"
                        onClick={() => resetMatrix()}
                        disabled={matrixBusy}
                      >
                        Zurücksetzen
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
                    {showSingleVariantForm ? 'Einzel-Variante schließen' : 'Einzelne Variante hinzufügen'}
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
                    placeholder="Farbe (Pflicht)"
                    value={newVariant.farbe}
                    onChange={e => setNewVariant(s => ({ ...s, farbe: e.target.value }))}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12 }}>Farbcode</span>
                    <input
                      type="color"
                      value={newVariant.farbe_hex || '#000000'}
                      onChange={e => setNewVariant(s => ({ ...s, farbe_hex: e.target.value }))}
                      style={{ width: 44, height: 32, padding: 0, border: 'none' }}
                    />
                  </div>
                  <input
                    className="cp-select"
                    placeholder="Größe (Pflicht)"
                    value={newVariant.groesse}
                    onChange={e => setNewVariant(s => ({ ...s, groesse: e.target.value }))}
                  />
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={newVariant.ist_muster}
                      onChange={e => setNewVariant(s => ({ ...s, ist_muster: e.target.checked }))}
                    />
                    Ist Muster
                  </label>
                  <input
                    type="number"
                    className="cp-select"
                    min={0}
                    value={newVariant.mindestbestand}
                    onChange={e => setNewVariant(s => ({ ...s, mindestbestand: e.target.value }))}
                    placeholder="Mindestbestand"
                  />
                  <button type="button" className="cp-btn" onClick={() => void saveVariant()} disabled={matrixBusy}>
                    Speichern
                  </button>
                </div>
              )}
              {variantsLoading && <p style={{ opacity: 0.8 }}>Lädt…</p>}
              {!variantsLoading && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                        <th style={{ padding: '8px 6px' }}>Farbe</th>
                        <th style={{ padding: '8px 6px' }}>Farbcode</th>
                        <th style={{ padding: '8px 6px' }}>Größe</th>
                        <th style={{ padding: '8px 6px' }}>Muster</th>
                        <th style={{ padding: '8px 6px' }}>Bestand</th>
                        <th style={{ padding: '8px 6px' }}>Mindestbestand</th>
                        <th style={{ padding: '8px 6px' }}>Bearb.</th>
                        <th style={{ padding: '8px 6px' }}>Buchung</th>
                      </tr>
                    </thead>
                    <tbody>
                      {varianten.map(variant => {
                        const minEditValue = minimumEdit[variant.id]
                        const minimumDisplay = minEditValue != null ? minEditValue : String(variant.mindestbestand ?? 0)
                        return (
                          <tr key={variant.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 6px' }}>{variant.farbe}</td>
                            <td style={{ padding: '8px 6px' }}>{variant.farbe_hex || '—'}</td>
                            <td style={{ padding: '8px 6px' }}>{variant.groesse}</td>
                            <td style={{ padding: '8px 6px' }}>
                              {variant.ist_muster ? <span className="badge badge-grau">Muster</span> : '—'}
                            </td>
                            <td style={{ padding: '8px 6px' }}>{variant.bestand ?? 0}</td>
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
                                  setEditVariantColor(variant.farbe)
                                  setEditVariantColorHex(variant.farbe_hex ?? '')
                                  setEditVariantSize(variant.groesse)
                                  setEditVariantIsSample(variant.ist_muster)
                                  setEditVariantMinimum(String(variant.mindestbestand ?? 0))
                                  setEditVariantActive(variant.aktiv)
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
                  <h3 style={{ fontSize: 14, marginTop: 0 }}>Variante bearbeiten</h3>
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
                      placeholder="Farbe"
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
                      placeholder="Größe"
                    />
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={editVariantIsSample}
                        onChange={e => setEditVariantIsSample(e.target.checked)}
                      />
                      Muster
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
                      Aktiv
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="cp-btn" onClick={() => void updateVariant()}>
                        Speichern
                      </button>
                      <button type="button" className="cp-btn cp-btn-grau" onClick={() => setEditVariant(null)}>
                        Abbrechen
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {!brandIdForProducts && (
            <p style={{ fontSize: 13, color: '#64748b', margin: '8px 0 0' }}>Zuerst eine Marke wählen.</p>
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
              placeholder="Marke, Produkt, Farbe, Größe…"
              value={stockSearch}
              onChange={e => setStockSearch(e.target.value)}
              style={{ minWidth: 220, maxWidth: 320 }}
            />
            <select
              className="cp-select"
              value={stockBrandFilter}
              onChange={e => setStockBrandFilter(e.target.value)}
            >
              <option value="ALL">Alle Marken</option>
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
              Nur Nachbestellen
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={filterSamplesOnly}
                onChange={e => setFilterSamplesOnly(e.target.checked)}
              />
              Nur Muster
            </label>
            <button
              type="button"
              className="cp-btn cp-btn-grau"
              onClick={() => void loadAllVariants()}
              disabled={allVariantsLoading}
            >
              Neu laden
            </button>
          </div>
          {allVariantsLoading && <p style={{ opacity: 0.8 }}>Lädt…</p>}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                  <th
                    style={{ padding: '8px 6px', cursor: 'pointer' }}
                    onClick={() => toggleStockSort('marke')}
                  >
                    Marke
                    {stockSorting?.key === 'marke' ? (stockSorting.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                  <th
                    style={{ padding: '8px 6px', cursor: 'pointer' }}
                    onClick={() => toggleStockSort('produkt')}
                  >
                    Produkt
                    {stockSorting?.key === 'produkt' ? (stockSorting.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                  <th
                    style={{ padding: '8px 6px', cursor: 'pointer' }}
                    onClick={() => toggleStockSort('farbe')}
                  >
                    Farbe
                    {stockSorting?.key === 'farbe' ? (stockSorting.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                  <th
                    style={{ padding: '8px 6px', cursor: 'pointer' }}
                    onClick={() => toggleStockSort('groesse')}
                  >
                    Größe
                    {stockSorting?.key === 'groesse' ? (stockSorting.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                  <th
                    style={{ padding: '8px 6px', cursor: 'pointer' }}
                    onClick={() => toggleStockSort('muster')}
                  >
                    Muster
                    {stockSorting?.key === 'muster' ? (stockSorting.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                  <th
                    style={{ padding: '8px 6px', cursor: 'pointer' }}
                    onClick={() => toggleStockSort('bestand')}
                  >
                    Bestand
                    {stockSorting?.key === 'bestand' ? (stockSorting.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                  <th
                    style={{ padding: '8px 6px', cursor: 'pointer' }}
                    onClick={() => toggleStockSort('mindestbestand')}
                  >
                    Mindestbestand
                    {stockSorting?.key === 'mindestbestand' ? (stockSorting.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                  <th
                    style={{ padding: '8px 6px', cursor: 'pointer' }}
                    onClick={() => toggleStockSort('status')}
                  >
                    Status
                    {stockSorting?.key === 'status' ? (stockSorting.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                  <th style={{ padding: '8px 6px' }}>Buchung</th>
                </tr>
              </thead>
              <tbody>
                {filteredVariants.map(variant => {
                  const status = variantStatus(variant)
                  const minEditValue = minimumEdit[variant.id]
                  const minimumDisplay = minEditValue != null ? minEditValue : String(variant.mindestbestand ?? 0)
                  return (
                    <tr key={variant.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 6px' }}>{brandFromVariant(variant)}</td>
                      <td style={{ padding: '8px 6px', fontWeight: 600 }}>{productNameFromVariant(variant)}</td>
                      <td style={{ padding: '8px 6px' }}>{variant.farbe}</td>
                      <td style={{ padding: '8px 6px' }}>{variant.groesse}</td>
                      <td style={{ padding: '8px 6px' }}>
                        {variant.ist_muster ? <span className="badge badge-grau">Muster</span> : '—'}
                      </td>
                      <td style={{ padding: '8px 6px' }}>{variant.bestand ?? 0}</td>
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
        <div className='b-dev'>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
            <button
              type="button"
              className="cp-btn cp-btn-grau"
              onClick={() => void loadOrderList()}
              disabled={orderLoading}
            >
              Aktualisieren
            </button>
            <button
              type="button"
              className="cp-btn"
              onClick={() => void copyOrderList()}
              disabled={orderLoading || orderRows.length === 0}
            >
              In Zwischenablage kopieren
            </button>
            {orderCopied && <span style={{ fontSize: 13, color: '#15803d' }}>Kopiert</span>}
          </div>
          {orderError && <p style={{ color: '#b91c1c' }}>{orderError}</p>}
          {orderLoading && <p style={{ opacity: 0.8 }}>Lädt…</p>}
          {!orderLoading && !orderError && orderRows.length === 0 && (
            <p style={{ margin: '12px 0', color: '#15803d', fontWeight: 600 }}>
              Alles auf Lager — keine Bestellung nötig
            </p>
          )}
          {orderRows.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '8px 6px' }}>Marke</th>
                    <th style={{ padding: '8px 6px' }}>Produkt</th>
                    <th style={{ padding: '8px 6px' }}>Farbe</th>
                    <th style={{ padding: '8px 6px' }}>Größe</th>
                    <th style={{ padding: '8px 6px' }}>Bestand</th>
                    <th style={{ padding: '8px 6px' }}>Offen</th>
                    <th style={{ padding: '8px 6px' }}>Mindestbestand</th>
                    <th style={{ padding: '8px 6px' }}>Bestellen</th>
                  </tr>
                </thead>
                <tbody>
                  {orderRows.map(orderRow => (
                    <tr key={orderRow.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 6px' }}>{orderListCell(brandFromVariant(orderRow), '—')}</td>
                      <td style={{ padding: '8px 6px', fontWeight: 600 }}>
                        {orderListCell(productNameFromVariant(orderRow), '—')}
                      </td>
                      <td style={{ padding: '8px 6px' }}>{orderListCell(orderRow.farbe, '—')}</td>
                      <td style={{ padding: '8px 6px' }}>{orderListCell(orderRow.groesse, '—')}</td>
                      <td style={{ padding: '8px 6px' }}>{orderListNumber(orderRow.bestand)}</td>
                      <td style={{ padding: '8px 6px' }}>{orderListNumber(orderRow.offene_menge)}</td>
                      <td style={{ padding: '8px 6px' }}>{orderListNumber(orderRow.mindestbestand)}</td>
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
