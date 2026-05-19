import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { subOrderService } from '../../services/subOrderService'
import { textileService } from '../../services/textileService'
import { textileMasterDataService } from '../../services/textileMasterDataService'
import { customerMeetsPrepressContact } from '../../lib/customer'
import { isSubOrderComplete, nextSubOrderStatus } from '../../lib/subOrderShared'
import {
  buildFreeSizeString,
  isUniqueViolation,
  textileRecordsAllowPrepress,
} from '../../lib/textile/validateTextileDetail'
import type { OrderStatus, Customer, SubOrderRow } from '../../types/database'
import type { FileRow } from '../../services/fileService'
import type {
  TextileSize,
  TextileOrigin,
  TextileCustomerGarmentType,
  TextileMotifRow,
  TextileMotifType,
  TextilePlacement,
  TextilePositionRow,
  TextileFontClass,
  TextileAssignmentRow,
} from '../../types/textile'
import type { Database, Json } from '../../types/supabase'
import '../WorkArea.css'

type Props = {
  subOrder: SubOrderRow
  subOrderStatus: OrderStatus
  orderStatus?: OrderStatus
  orderFiles: FileRow[]
  orderCustomer: Customer | null
  onUpdated: (t: SubOrderRow) => void
}

const FONT_CLASS_OPTIONS: { value: TextileFontClass; label: string }[] = [
  { value: 'SANS_SERIF', label: 'Sans-serif' },
  { value: 'SERIF', label: 'Serif' },
  { value: 'ELEGANT', label: 'Elegant' },
  { value: 'PLAYFUL', label: 'Playful' },
]

const ORIGIN_LABELS: Record<TextileOrigin, string> = {
  CUSTOMER_STOCK: 'Customer goods',
  OWN_STOCK: 'Own stock',
}

const GARMENT_TYPE_OPTIONS: { value: TextileCustomerGarmentType; label: string }[] = [
  { value: 'T_SHIRT', label: 'T-Shirt' },
  { value: 'POLO', label: 'Polo' },
  { value: 'SWEATSHIRT', label: 'Sweatshirt' },
  { value: 'HOODIE', label: 'Hoodie' },
  { value: 'ZIP_HOODIE', label: 'Zip Hoodie' },
  { value: 'JACKE', label: 'Jacket' },
  { value: 'SONSTIGES', label: 'Other' },
]

const PLACEMENT_OPTIONS: { value: TextilePlacement; label: string }[] = [
  { value: 'BRUST_LINKS', label: 'Chest left' },
  { value: 'BRUST_MITTE', label: 'Chest centre' },
  { value: 'BRUST_RECHTS', label: 'Chest right' },
  { value: 'RUECKEN', label: 'Back' },
  { value: 'ARM_LINKS', label: 'Arm left' },
  { value: 'ARM_RECHTS', label: 'Arm right' },
  { value: 'SONSTIGE', label: 'Other' },
]

const SIZE_LABELS: Record<Exclude<TextileSize, 'FREI'>, string> = {
  KLEIN: 'Small',
  MITTEL: 'Medium',
  GROSS: 'Large',
}

const SIZE_OPTIONS: TextileSize[] = ['KLEIN', 'MITTEL', 'GROSS', 'FREI']

type OwnGoodsMode = 'STAMMDATEN' | 'FREITEXT'

function one<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function garmentTypeLabel(garmentTypeValue: string | null | undefined): string {
  if (!garmentTypeValue) return '—'
  const option = GARMENT_TYPE_OPTIONS.find(o => o.value === garmentTypeValue)
  return option?.label ?? garmentTypeValue
}

function placementLabel(placementValue: string): string {
  const option = PLACEMENT_OPTIONS.find(o => o.value === placementValue)
  return option?.label ?? placementValue
}

function sizeShortLabel(groesse: string): string {
  if (SIZE_OPTIONS.slice(0, 3).includes(groesse as 'KLEIN' | 'MITTEL' | 'GROSS')) {
    return SIZE_LABELS[groesse as 'KLEIN' | 'MITTEL' | 'GROSS']
  }
  if (groesse === 'FREI' || (typeof groesse === 'string' && groesse.startsWith('FREI:'))) {
    if (groesse === 'FREI') return 'Free (mm)'
    if (groesse.startsWith('FREI:')) return `Free: ${groesse.slice(5)}`
  }
  return groesse
}

/** DB value `groesse` on the motif → form size selection + free text */
function parseSizeFromDb(groesse: string | null | undefined): { sizeType: TextileSize; freeText: string } {
  if (!groesse || groesse === 'KLEIN' || groesse === 'MITTEL' || groesse === 'GROSS') {
    return { sizeType: (groesse as TextileSize) || 'MITTEL', freeText: '' }
  }
  if (groesse === 'FREI') return { sizeType: 'FREI', freeText: '' }
  if (groesse.startsWith('FREI:')) return { sizeType: 'FREI', freeText: groesse.slice(5) }
  return { sizeType: 'MITTEL', freeText: '' }
}

/** INSERT `textil_zuordnungen`: Trigger `PLATZ_KONFLIKT` vs. Unique-Constraint */
function assignmentInsertErrorMessage(err: { message?: string; code?: string }): string {
  if ((err.message ?? '').includes('PLATZ_KONFLIKT')) {
    return 'This placement is already used by another motif for this textile position.'
  }
  if (isUniqueViolation(err)) {
    return 'This motif-position assignment already exists.'
  }
  return err.message ?? ''
}

const NEW_POSITION_SLOT = 'neu'

export function TextileDetail({
  subOrder,
  subOrderStatus,
  orderStatus,
  orderFiles,
  orderCustomer,
  onUpdated,
}: Props) {
  const subOrderRef = useRef(subOrder)
  useEffect(() => {
    subOrderRef.current = subOrder
  }, [subOrder])

  const [motifs, setMotifs] = useState<TextileMotifRow[]>([])
  const [positions, setPositions] = useState<TextilePositionRow[]>([])
  const [assignments, setAssignments] = useState<TextileAssignmentRow[]>([])
  const [variantInfoById, setVariantInfoById] = useState<
    Map<string, { stock: number; color: string; size: string; is_sample: boolean; produkt: string; marke: string }>
  >(new Map())

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const [motifType, setMotifType] = useState<TextileMotifType>('TEXT')
  const [motifContent, setMotifContent] = useState('')
  const [motifColor, setMotifColor] = useState('')
  const [motifFontClass, setMotifFontClass] = useState<TextileFontClass>('SANS_SERIF')
  const [motifFontStyle, setMotifFontStyle] = useState('')
  const [motifFileId, setMotifFileId] = useState('')
  const [motifPlacement, setMotifPlacement] = useState<TextilePlacement>('BRUST_LINKS')
  const [motifSizeType, setMotifSizeType] = useState<TextileSize>('MITTEL')
  const [motifSizeFree, setMotifSizeFree] = useState('')
  const [motifPrintMethod, setMotifPrintMethod] = useState('')

  const [positionOrigin, setPositionOrigin] = useState<TextileOrigin>('CUSTOMER_STOCK')
  const [positionGarmentType, setPositionGarmentType] = useState<TextileCustomerGarmentType>('T_SHIRT')
  const [positionColor, setPositionColor] = useState('')
  const [positionQuantity, setPositionQuantity] = useState(1)
  const [positionBrand, setPositionBrand] = useState('')
  const [positionModel, setPositionModel] = useState('')
  const [positionSize, setPositionSize] = useState('')

  // Eigenware-Modus (in Teilauftrag-Detail gespeichert)
  const [ownGoodsMode, setOwnGoodsMode] = useState<OwnGoodsMode>('STAMMDATEN')

  const [motifEditId, setMotifEditId] = useState<string | null>(null)
  const [positionEditId, setPositionEditId] = useState<string | null>(null)

  const [positionMotifIds, setPositionMotifIds] = useState<Record<string, string[]>>({})

  const currentPositionSlotKey = positionEditId ?? NEW_POSITION_SLOT

  const syncSubOrder = useCallback(
    async (updatedMotifs: TextileMotifRow[], updatedPositions: TextilePositionRow[], updatedAssignments: TextileAssignmentRow[], afterProdMutation: boolean) => {
      const currentSubOrder = subOrderRef.current
      const allowsPrepress = textileRecordsAllowPrepress(updatedMotifs, updatedPositions, updatedAssignments)
      const existingDetail =
        currentSubOrder.detail && typeof currentSubOrder.detail === 'object' && !Array.isArray(currentSubOrder.detail) ? { ...(currentSubOrder.detail as object) } : {}
      const newDetail = { ...existingDetail, textil: { voll: allowsPrepress } }
      const merged: SubOrderRow = { ...currentSubOrder, detail: newDetail } as SubOrderRow
      const customerContactOk = customerMeetsPrepressContact(orderCustomer)
      const isComplete = isSubOrderComplete(merged, currentSubOrder.status)
      let nextStatus: OrderStatus
      if (afterProdMutation && (currentSubOrder.status === 'PRODUCTION_READY' || currentSubOrder.status === 'DONE')) {
        nextStatus = 'INCOMPLETE'
      } else {
        nextStatus = nextSubOrderStatus(currentSubOrder.status, currentSubOrder, merged, isComplete, customerContactOk, orderStatus)
      }
      setIsSaving(true)
      const subOrderSyncPatch: Database['public']['Tables']['sub_orders']['Update'] = {
        status: nextStatus,
        detail: newDetail as Json,
      }
      let updatedSubOrder: SubOrderRow
      try {
        updatedSubOrder = await subOrderService.updateSubOrder(currentSubOrder.id, subOrderSyncPatch)
      } catch (err) {
        setIsSaving(false)
        setError(err instanceof Error ? err.message : 'Save failed')
        return
      }
      setIsSaving(false)
      subOrderRef.current = updatedSubOrder
      onUpdated(updatedSubOrder)
    },
    [orderCustomer, orderStatus, onUpdated]
  )

  const syncSubOrderRef = useRef(syncSubOrder)
  useEffect(() => {
    syncSubOrderRef.current = syncSubOrder
  }, [syncSubOrder])

  const lastLoadedSubOrderId = useRef<string | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    const subOrderId = subOrderRef.current.id
    let loadedMotifs: TextileMotifRow[] = []
    let loadedPositions: TextilePositionRow[] = []
    let loadedAssignments: TextileAssignmentRow[] = []
    try {
      const textile = await textileService.getTextileDataForSubOrder(subOrderId)
      loadedMotifs = textile.motifs
      loadedPositions = textile.positions
      loadedAssignments = textile.assignments
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Loading failed')
      setLoading(false)
      return
    }
    setMotifs(loadedMotifs)
    setPositions(loadedPositions)
    setAssignments(loadedAssignments)

    // Variante-Infos für Positionsliste (Bestand/Labels) loading
    try {
      const ids = Array.from(
        new Set(
          loadedPositions.map(r => r.variant_id).filter((x): x is string => typeof x === 'string' && x.trim() !== '')
        )
      )
      if (ids.length === 0) {
        setVariantInfoById(new Map())
      } else {
        const variantRows = await textileService.getVariantsByIds(ids)
        const variantMap = new Map<
          string,
          { stock: number; color: string; size: string; is_sample: boolean; produkt: string; marke: string }
        >()
        for (const variantRow of variantRows) {
          const product = one(variantRow.textile_products)
          const brand = product ? one(product.textile_brands) : null
          variantMap.set(String(variantRow.id), {
            stock: Number(variantRow.stock) || 0,
            color: String(variantRow.color ?? ''),
            size: String(variantRow.size ?? ''),
            is_sample: Boolean(variantRow.is_sample),
            produkt: String(product?.name ?? ''),
            marke: String(brand?.name ?? ''),
          })
        }
        setVariantInfoById(variantMap)
      }
    } catch {
      // optional: Bestand-Infos sind nice-to-have; Fehler nicht blockierend
      setVariantInfoById(new Map())
    }

    setLoading(false)
    // Guard: Beim reinen Laden nur dann DB-Sync auslösen, wenn sich der "voll"-Wert tatsächlich ändert.
    // Sonst kann das (je nach Parent-Update-Strategie) unnötige Updates/Reloads auslösen.
    const allowsPrepress = textileRecordsAllowPrepress(loadedMotifs, loadedPositions, loadedAssignments)
    const detail = subOrderRef.current.detail
    const detailObject = detail && typeof detail === 'object' && !Array.isArray(detail) ? (detail as Record<string, unknown>) : null
    const textilDetail =
      detailObject && detailObject.textil && typeof detailObject.textil === 'object' && !Array.isArray(detailObject.textil)
        ? (detailObject.textil as Record<string, unknown>)
        : null
    const previousAllowsPrepress = textilDetail && typeof textilDetail.voll === 'boolean' ? (textilDetail.voll as boolean) : null
    if (previousAllowsPrepress !== allowsPrepress) {
      await syncSubOrderRef.current(loadedMotifs, loadedPositions, loadedAssignments, false)
    }
  }, [])

  useEffect(() => {
    // Guard gegen Endlosschleifen: nur 1× pro Teilauftrag-ID loading.
    if (lastLoadedSubOrderId.current === subOrder.id) return
    lastLoadedSubOrderId.current = subOrder.id
    void loadAll()
  }, [loadAll, subOrder.id])

  useEffect(() => {
    setMotifEditId(null)
    setPositionEditId(null)
    setPositionMotifIds({})
  }, [subOrder.id])

  useEffect(() => {
    const detail = subOrder.detail
    const obj = detail && typeof detail === 'object' && !Array.isArray(detail) ? (detail as Record<string, unknown>) : {}
    const rawMode = obj.eigenware_modus
    if (rawMode === 'FREITEXT' || rawMode === 'STAMMDATEN') {
      setOwnGoodsMode(rawMode)
    } else {
      setOwnGoodsMode('STAMMDATEN')
    }
  }, [subOrder.id, subOrder.detail])

  const saveOwnGoodsMode = useCallback(
    async (mode: OwnGoodsMode) => {
      const currentSubOrder = subOrderRef.current
      const currentDetail = currentSubOrder.detail
      const existingDetail = currentDetail && typeof currentDetail === 'object' && !Array.isArray(currentDetail) ? { ...(currentDetail as Record<string, unknown>) } : {}
      const newDetail = { ...existingDetail, eigenware_modus: mode }
      setIsSaving(true)
      const detailPatch: Database['public']['Tables']['sub_orders']['Update'] = {
        detail: newDetail as Json,
      }
      let updatedSubOrder: SubOrderRow
      try {
        updatedSubOrder = await subOrderService.updateSubOrder(currentSubOrder.id, detailPatch)
      } catch (err) {
        setIsSaving(false)
        setError(err instanceof Error ? err.message : 'Save failed')
        return
      }
      setIsSaving(false)
      subOrderRef.current = updatedSubOrder
      onUpdated(updatedSubOrder)
    },
    [onUpdated]
  )

  // Stammdaten-Auswahl (nur Eigenware + STAMMDATEN)
  const [masterBrands, setMasterBrands] = useState<{ id: string; name: string }[]>([])
  const [masterProducts, setMasterProducts] = useState<{ id: string; name: string; article_number: string | null }[]>([])
  const [masterColors, setMasterColors] = useState<{ farbe: string; farbe_hex: string | null }[]>([])
  const [masterSizes, setMasterSizes] = useState<{ id: string; size: string; stock: number; is_sample: boolean }[]>([])
  const [selectedBrandId, setSelectedBrandId] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedColor, setSelectedColor] = useState('')
  const [selectedVariantId, setSelectedVariantId] = useState('') // wird bei Größenwahl gesetzt
  const [masterDataLoading, setMasterDataLoading] = useState(false)

  useEffect(() => {
    if (positionOrigin !== 'OWN_STOCK') return
    if (ownGoodsMode !== 'STAMMDATEN') return
    setMasterDataLoading(true)
    textileMasterDataService.getBrandNames()
      .then(data => setMasterBrands(data))
      .catch(() => {})
      .finally(() => setMasterDataLoading(false))
  }, [ownGoodsMode, positionOrigin])

  useEffect(() => {
    if (positionOrigin !== 'OWN_STOCK') return
    if (ownGoodsMode !== 'STAMMDATEN') return
    if (!selectedBrandId) {
      setMasterProducts([])
      setSelectedProductId('')
      setMasterColors([])
      setMasterSizes([])
      setSelectedColor('')
      setSelectedVariantId('')
      return
    }
    setMasterDataLoading(true)
    textileService.getProductsByBrandId(selectedBrandId)
      .then(data => setMasterProducts(data))
      .catch(() => {})
      .finally(() => setMasterDataLoading(false))
  }, [ownGoodsMode, positionOrigin, selectedBrandId])

  useEffect(() => {
    if (positionOrigin !== 'OWN_STOCK') return
    if (ownGoodsMode !== 'STAMMDATEN') return
    if (!selectedProductId) {
      setMasterColors([])
      setMasterSizes([])
      setSelectedColor('')
      setSelectedVariantId('')
      return
    }
    setMasterDataLoading(true)
    textileService.getVariantColorsByProduct(selectedProductId)
      .then(rows => {
        const seen = new Set<string>()
        const uniqueColors: { farbe: string; farbe_hex: string | null }[] = []
        for (const colorRow of rows) {
          const colorValue = String(colorRow.color ?? '').trim()
          if (!colorValue) continue
          const colorKey = colorValue.toLowerCase()
          if (seen.has(colorKey)) continue
          seen.add(colorKey)
          uniqueColors.push({ farbe: colorValue, farbe_hex: colorRow.color_hex ?? null })
        }
        setMasterColors(uniqueColors)
      })
      .catch(() => {})
      .finally(() => setMasterDataLoading(false))
  }, [ownGoodsMode, positionOrigin, selectedProductId])

  useEffect(() => {
    if (positionOrigin !== 'OWN_STOCK') return
    if (ownGoodsMode !== 'STAMMDATEN') return
    if (!selectedProductId || !selectedColor) {
      setMasterSizes([])
      setSelectedVariantId('')
      return
    }
    setMasterDataLoading(true)
    textileService.getVariantSizesByProductAndColor(selectedProductId, selectedColor)
      .then(rows =>
        setMasterSizes(
          rows.map(r => ({
            id: String(r.id),
            size: String(r.size ?? ''),
            stock: Number(r.stock) || 0,
            is_sample: Boolean(r.is_sample),
          }))
        )
      )
      .catch(() => {})
      .finally(() => setMasterDataLoading(false))
  }, [ownGoodsMode, positionOrigin, selectedColor, selectedProductId])

  const fileNameById = new Map<string, string>()
  for (const file of orderFiles) {
    fileNameById.set(file.id, file.display_name)
  }

  const resetMotifForm = () => {
    setMotifContent('')
    setMotifColor('')
    setMotifFontClass('SANS_SERIF')
    setMotifFontStyle('')
    setMotifFileId('')
    setMotifType('TEXT')
    setMotifPlacement('BRUST_LINKS')
    setMotifSizeType('MITTEL')
    setMotifSizeFree('')
    setMotifPrintMethod('')
  }
  const resetPositionForm = () => {
    setPositionOrigin('CUSTOMER_STOCK')
    setPositionGarmentType('T_SHIRT')
    setPositionColor('')
    setPositionQuantity(1)
    setPositionBrand('')
    setPositionModel('')
    setPositionSize('')
    setSelectedBrandId('')
    setSelectedProductId('')
    setSelectedColor('')
    setSelectedVariantId('')
  }
  const cancelMotifForm = () => {
    setMotifEditId(null)
    resetMotifForm()
  }
  const cancelPositionForm = () => {
    const positionIdBeingCancelled = positionEditId
    setPositionEditId(null)
    if (positionIdBeingCancelled) {
      setPositionMotifIds(prev => {
        const updated = { ...prev }
        delete updated[positionIdBeingCancelled]
        return updated
      })
    }
    resetPositionForm()
  }

  const editMotif = (motif: TextileMotifRow) => {
    setError(null)
    setMotifEditId(motif.id)
    setMotifType(motif.type)
    setMotifContent(motif.content ?? '')
    setMotifColor(motif.color ?? '')
    setMotifFontClass((motif.font_class as TextileFontClass) || 'SANS_SERIF')
    setMotifFontStyle(motif.font_name ?? '')
    setMotifFileId(motif.file_id ?? '')
    const placement = String(motif.placement ?? 'BRUST_LINKS')
    setMotifPlacement((PLACEMENT_OPTIONS.some(o => o.value === placement) ? placement : 'BRUST_LINKS') as TextilePlacement)
    const { sizeType, freeText } = parseSizeFromDb(motif.size)
    setMotifSizeType(sizeType)
    setMotifSizeFree(freeText)
    setMotifPrintMethod(motif.print_method ?? '')
  }

  const editPosition = async (position: TextilePositionRow) => {
    setError(null)
    setPositionEditId(position.id)
    setPositionOrigin(position.origin)
    setPositionQuantity(position.quantity)
    setPositionBrand(position.brand ?? '')
    setPositionModel(position.model ?? '')
    setPositionColor(position.color ?? '')
    setPositionSize(position.size ?? '')
    if (position.origin === 'CUSTOMER_STOCK') {
      setPositionGarmentType((position.type as TextileCustomerGarmentType) || 'T_SHIRT')
    } else {
      if (position.variant_id) {
        setOwnGoodsMode('STAMMDATEN')
        const variant = await textileService.getVariantById(position.variant_id).catch(() => null)
        if (!variant) {
          setOwnGoodsMode('FREITEXT')
          setSelectedBrandId('')
          setSelectedProductId('')
          setSelectedColor('')
          setSelectedVariantId('')
        } else {
          const product = await textileService.getProductById(variant.product_id).catch(() => null)
          if (product?.brand_id) {
            setSelectedBrandId(String(product.brand_id))
            setSelectedProductId(String(product.id))
            setSelectedColor(String(variant.color ?? ''))
            setSelectedVariantId(String(variant.id))
          } else {
            setOwnGoodsMode('FREITEXT')
            setSelectedBrandId('')
            setSelectedProductId('')
            setSelectedColor('')
            setSelectedVariantId('')
          }
        }
      } else {
        setOwnGoodsMode('FREITEXT')
        setSelectedBrandId('')
        setSelectedProductId('')
        setSelectedColor('')
        setSelectedVariantId('')
      }
    }
    const currentMotifIds = assignments.filter(a => a.position_id === position.id).map(a => a.motif_id)
    setPositionMotifIds(prev => ({ ...prev, [position.id]: currentMotifIds.length > 0 ? currentMotifIds : [''] }))
  }

  async function syncAssignmentsForPosition(
    positionId: string,
    desiredMotifIds: string[],
    startAssignments: TextileAssignmentRow[]
  ): Promise<{ ok: true; updatedAssignments: TextileAssignmentRow[] } | { ok: false; message: string }> {
    const wantedMotifIdSet = new Set(desiredMotifIds.map(id => String(id).trim()).filter(Boolean))
    const wantedMotifIds = [...wantedMotifIdSet]
    let currentAssignments = startAssignments
    const existingAssignments = currentAssignments.filter(a => a.position_id === positionId)
    for (const assignment of existingAssignments) {
      if (!wantedMotifIdSet.has(assignment.motif_id)) {
        try {
          await textileService.deleteAssignment(assignment.id)
        } catch (err) {
          return { ok: false, message: err instanceof Error ? err.message : String(err) }
        }
        currentAssignments = currentAssignments.filter(a => a.id !== assignment.id)
      }
    }
    const existingMotifIds = new Set(currentAssignments.filter(a => a.position_id === positionId).map(a => a.motif_id))
    for (const motifId of wantedMotifIds) {
      if (existingMotifIds.has(motifId)) continue
      try {
        const newAssignment = await textileService.createAssignment({
          sub_order_id: subOrder.id,
          motif_id: motifId,
          position_id: positionId,
        })
        currentAssignments = [...currentAssignments, newAssignment]
      } catch (err) {
        return { ok: false, message: assignmentInsertErrorMessage(err as { message?: string; code?: string }) }
      }
    }
    return { ok: true, updatedAssignments: currentAssignments }
  }
  const submitMotif = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const subOrderId = subOrder.id
    const editId = motifEditId
    let sizeValue: string
    if (motifSizeType === 'FREI') {
      if (!motifSizeFree.trim()) {
        setError('For "Free (mm)" size, please enter dimension.')
        return
      }
      sizeValue = buildFreeSizeString(motifSizeFree)
    } else {
      sizeValue = motifSizeType
    }
    if (motifType === 'TEXT') {
      if (!motifContent.trim() || !motifColor.trim()) {
        setError('Content and colour are required (text).')
        return
      }
      setIsSaving(true)
      let motifRow: TextileMotifRow
      try {
        const textPatch = {
          type: 'TEXT' as const,
          placement: motifPlacement,
          size: sizeValue,
          print_method: motifPrintMethod.trim() || null,
          content: motifContent.trim(),
          color: motifColor.trim(),
          font_class: motifFontClass,
          font_name: motifFontStyle.trim() || null,
          file_id: null,
        }
        motifRow = editId
          ? await textileService.updateMotif(editId, textPatch)
          : await textileService.createMotif({ sub_order_id: subOrderId, ...textPatch })
      } catch (err) {
        setIsSaving(false)
        setError(err instanceof Error ? err.message : 'Save failed')
        return
      }
      setIsSaving(false)
      {
        const nextMotifs = editId ? motifs.map(x => (x.id === editId ? motifRow : x)) : [...motifs, motifRow]
        setMotifs(nextMotifs)
        setMotifEditId(null)
        resetMotifForm()
        const isProductionStatus = subOrderRef.current.status === 'PRODUCTION_READY' || subOrderRef.current.status === 'DONE'
        void syncSubOrder(nextMotifs, positions, assignments, isProductionStatus)
      }
    } else {
      if (!motifFileId) {
        setError('Please select a file.')
        return
      }
      setIsSaving(true)
      let motifRow: TextileMotifRow
      try {
        const filePatch = {
          type: 'FILE' as const,
          placement: motifPlacement,
          size: sizeValue,
          print_method: motifPrintMethod.trim() || null,
          content: null,
          color: null,
          font_class: null,
          font_name: null,
          file_id: motifFileId,
        }
        motifRow = editId
          ? await textileService.updateMotif(editId, filePatch)
          : await textileService.createMotif({ sub_order_id: subOrderId, ...filePatch })
      } catch (err) {
        setIsSaving(false)
        setError(err instanceof Error ? err.message : 'Save failed')
        return
      }
      setIsSaving(false)
      {
        const nextMotifs = editId ? motifs.map(x => (x.id === editId ? motifRow : x)) : [...motifs, motifRow]
        setMotifs(nextMotifs)
        setMotifEditId(null)
        resetMotifForm()
        const isProductionStatus = subOrderRef.current.status === 'PRODUCTION_READY' || subOrderRef.current.status === 'DONE'
        void syncSubOrder(nextMotifs, positions, assignments, isProductionStatus)
      }
    }
  }

  const submitPosition = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (positionQuantity < 1 || !Number.isInteger(positionQuantity)) {
      setError('Quantity: integer ≥ 1.')
      return
    }
    const subOrderId = subOrder.id
    const editId = positionEditId
    const currentSlotKey = editId ?? NEW_POSITION_SLOT
    const motifSlots = positionMotifIds[currentSlotKey] ?? ['']
    const desiredMotifIds = motifSlots.map(id => String(id).trim()).filter(Boolean)

    const afterPositionSaved = (nextPositions: TextilePositionRow[], updatedAssignments: TextileAssignmentRow[]) => {
      resetPositionForm()
      setPositionEditId(null)
      setPositionMotifIds(prev => {
        const updated = { ...prev }
        delete updated[currentSlotKey]
        return updated
      })
      const isProductionStatus = subOrderRef.current.status === 'PRODUCTION_READY' || subOrderRef.current.status === 'DONE'
      void syncSubOrder(motifs, nextPositions, updatedAssignments, isProductionStatus)
    }

    if (editId) {
      if (positionOrigin === 'CUSTOMER_STOCK') {
        if (!positionColor.trim() || !positionGarmentType) {
          setError('Type and colour are required.')
          return
        }
        setIsSaving(true)
        try {
          await textileService.updatePosition(editId, {
            origin: 'CUSTOMER_STOCK',
            type: positionGarmentType,
            color: positionColor.trim(),
            quantity: positionQuantity,
            brand: null,
            model: null,
            size: null,
            variant_id: null,
          })
        } catch (err) {
          setIsSaving(false)
          setError(err instanceof Error ? err.message : 'Save failed')
          return
        }
        const assignmentSyncResult = await syncAssignmentsForPosition(editId, desiredMotifIds, assignments)
        if (!assignmentSyncResult.ok) {
          setIsSaving(false)
          setError(assignmentSyncResult.message)
          void loadAll()
          return
        }
        const previousPosition = positions.find(x => x.id === editId)
        if (!previousPosition) {
          setIsSaving(false)
          setError('Position not found.')
          return
        }
        const updatedPosition: TextilePositionRow = {
          ...previousPosition,
          origin: 'CUSTOMER_STOCK',
          type: positionGarmentType,
          color: positionColor.trim(),
          quantity: positionQuantity,
          brand: null,
          model: null,
          size: null,
          variant_id: null,
        }
        const nextPositions = positions.map(p => (p.id === editId ? updatedPosition : p))
        setPositions(nextPositions)
        setAssignments(assignmentSyncResult.updatedAssignments)
        setIsSaving(false)
        afterPositionSaved(nextPositions, assignmentSyncResult.updatedAssignments)
        return
      }

      if (ownGoodsMode === 'STAMMDATEN') {
        if (!selectedBrandId || !selectedProductId || !selectedVariantId) {
          setError('Please select brand, product and variant from catalog.')
          return
        }
        const brandName = masterBrands.find(x => x.id === selectedBrandId)?.name ?? ''
        const productName = masterProducts.find(x => x.id === selectedProductId)?.name ?? ''
        const sizeValue = masterSizes.find(x => x.id === selectedVariantId)?.size ?? ''
        if (!brandName || !productName || !selectedColor || !sizeValue) {
          setError('Catalog selection incomplete.')
          return
        }
        setPositionBrand(brandName)
        setPositionModel(productName)
        setPositionColor(selectedColor)
        setPositionSize(sizeValue)
      } else {
        if (!positionBrand.trim() || !positionModel.trim() || !positionColor.trim() || !positionSize.trim()) {
          setError('Brand, model, colour and size are required.')
          return
        }
      }
      setIsSaving(true)
      try {
        await textileService.updatePosition(editId, {
          origin: 'OWN_STOCK',
          type: null,
          color: positionColor.trim(),
          quantity: positionQuantity,
          brand: positionBrand.trim(),
          model: positionModel.trim(),
          size: positionSize.trim(),
          variant_id: ownGoodsMode === 'STAMMDATEN' ? (selectedVariantId || null) : null,
        })
      } catch (err) {
        setIsSaving(false)
        setError(err instanceof Error ? err.message : 'Save failed')
        return
      }
      const ownGoodsSyncResult = await syncAssignmentsForPosition(editId, desiredMotifIds, assignments)
      if (!ownGoodsSyncResult.ok) {
        setIsSaving(false)
        setError(ownGoodsSyncResult.message)
        void loadAll()
        return
      }
      const previousPosition = positions.find(x => x.id === editId)
      if (!previousPosition) {
        setIsSaving(false)
        setError('Position nicht gefunden.')
        return
      }
      const updatedPosition: TextilePositionRow = {
        ...previousPosition,
        origin: 'OWN_STOCK',
        type: null,
        color: positionColor.trim(),
        quantity: positionQuantity,
        brand: positionBrand.trim(),
        model: positionModel.trim(),
        size: positionSize.trim(),
        variant_id: ownGoodsMode === 'STAMMDATEN' ? (selectedVariantId || null) : null,
      }
      const nextPositions = positions.map(p => (p.id === editId ? updatedPosition : p))
      setPositions(nextPositions)
      setAssignments(ownGoodsSyncResult.updatedAssignments)
      if (ownGoodsMode === 'STAMMDATEN' && selectedVariantId) {
        const brandName = masterBrands.find(x => x.id === selectedBrandId)?.name ?? ''
        const productName = masterProducts.find(x => x.id === selectedProductId)?.name ?? ''
        const sizeVariant = masterSizes.find(x => x.id === selectedVariantId) ?? null
        if (sizeVariant && brandName && productName) {
          setVariantInfoById(prev => {
            const updatedMap = new Map(prev)
            updatedMap.set(selectedVariantId, {
              stock: sizeVariant.stock,
              color: selectedColor,
              size: sizeVariant.size,
              is_sample: sizeVariant.is_sample,
              produkt: productName,
              marke: brandName,
            })
            return updatedMap
          })
        }
      }
      setIsSaving(false)
      afterPositionSaved(nextPositions, ownGoodsSyncResult.updatedAssignments)
      return
    }

    if (positionOrigin === 'CUSTOMER_STOCK') {
      if (!positionColor.trim() || !positionGarmentType) {
        setError('Type and colour are required.')
        return
      }
      setIsSaving(true)
      let positionRow: TextilePositionRow
      try {
        positionRow = await textileService.createPosition({
          sub_order_id: subOrderId,
          origin: 'CUSTOMER_STOCK',
          type: positionGarmentType,
          color: positionColor.trim(),
          quantity: positionQuantity,
          brand: null,
          model: null,
          size: null,
        })
      } catch (err) {
        setIsSaving(false)
        setError(err instanceof Error ? err.message : 'Save failed')
        return
      }
      setIsSaving(false)
      {
        const nextPositions = [...positions, positionRow]
        setPositions(nextPositions)

        let assignmentAccumulator = assignments
        const newMotifIds = desiredMotifIds
        if (newMotifIds.length > 0) {
          setIsSaving(true)
          try {
            for (const mid of newMotifIds) {
              try {
                const assignmentData = await textileService.createAssignment({
                  sub_order_id: subOrder.id,
                  motif_id: mid,
                  position_id: positionRow.id,
                })
                assignmentAccumulator = [...assignmentAccumulator, assignmentData]
              } catch (assignmentError) {
                await textileService.deleteAssignmentsByPosition(positionRow.id).catch(() => {})
                await textileService.deletePosition(positionRow.id).catch(() => {})
                setPositions(positions)
                setAssignments(assignments)
                setError(assignmentInsertErrorMessage(assignmentError as { message?: string; code?: string }))
                resetPositionForm()
                setPositionMotifIds(prev => ({ ...prev, [NEW_POSITION_SLOT]: [] }))
                const isProductionStatus = subOrderRef.current.status === 'PRODUCTION_READY' || subOrderRef.current.status === 'DONE'
                void syncSubOrder(motifs, positions, assignments, isProductionStatus)
                return
              }
            }
            setAssignments(assignmentAccumulator)
          } finally {
            setIsSaving(false)
          }
        }

        setPositionMotifIds(prev => ({ ...prev, [NEW_POSITION_SLOT]: [] }))
        resetPositionForm()
        const isProductionStatus = subOrderRef.current.status === 'PRODUCTION_READY' || subOrderRef.current.status === 'DONE'
        void syncSubOrder(motifs, nextPositions, assignmentAccumulator, isProductionStatus)
      }
    } else {
      if (ownGoodsMode === 'STAMMDATEN') {
        if (!selectedBrandId || !selectedProductId || !selectedVariantId) {
          setError('Please select brand, product and variant from catalog.')
          return
        }
        const brandName = masterBrands.find(x => x.id === selectedBrandId)?.name ?? ''
        const productName = masterProducts.find(x => x.id === selectedProductId)?.name ?? ''
        const sizeValue = masterSizes.find(x => x.id === selectedVariantId)?.size ?? ''
        if (!brandName || !productName || !selectedColor || !sizeValue) {
          setError('Catalog selection incomplete.')
          return
        }
        setPositionBrand(brandName)
        setPositionModel(productName)
        setPositionColor(selectedColor)
        setPositionSize(sizeValue)
      } else {
        if (!positionBrand.trim() || !positionModel.trim() || !positionColor.trim() || !positionSize.trim()) {
          setError('Brand, model, colour and size are required.')
          return
        }
      }
      setIsSaving(true)
      let positionRow: TextilePositionRow
      try {
        positionRow = await textileService.createPosition({
          sub_order_id: subOrderId,
          origin: 'OWN_STOCK',
          type: null,
          color: positionColor.trim(),
          quantity: positionQuantity,
          brand: positionBrand.trim(),
          model: positionModel.trim(),
          size: positionSize.trim(),
          variant_id: ownGoodsMode === 'STAMMDATEN' ? (selectedVariantId || null) : null,
        })
      } catch (err) {
        setIsSaving(false)
        setError(err instanceof Error ? err.message : 'Save failed')
        return
      }
      setIsSaving(false)
      {
        const nextPositions = [...positions, positionRow]
        setPositions(nextPositions)
        if (ownGoodsMode === 'STAMMDATEN' && selectedVariantId) {
          const brandName = masterBrands.find(x => x.id === selectedBrandId)?.name ?? ''
          const productName = masterProducts.find(x => x.id === selectedProductId)?.name ?? ''
          const sizeVariant = masterSizes.find(x => x.id === selectedVariantId) ?? null
          if (sizeVariant && brandName && productName) {
            setVariantInfoById(prev => {
              const updatedMap = new Map(prev)
              updatedMap.set(selectedVariantId, {
                stock: sizeVariant.stock,
                color: selectedColor,
                size: sizeVariant.size,
                is_sample: sizeVariant.is_sample,
                produkt: productName,
                marke: brandName,
              })
              return updatedMap
            })
          }
        }

        let assignmentAccumulator = assignments
        const ownGoodsMotifIds = desiredMotifIds
        if (ownGoodsMotifIds.length > 0) {
          setIsSaving(true)
          try {
            for (const mid of ownGoodsMotifIds) {
              try {
                const assignmentData = await textileService.createAssignment({
                  sub_order_id: subOrder.id,
                  motif_id: mid,
                  position_id: positionRow.id,
                })
                assignmentAccumulator = [...assignmentAccumulator, assignmentData]
              } catch (assignmentError) {
                await textileService.deleteAssignmentsByPosition(positionRow.id).catch(() => {})
                await textileService.deletePosition(positionRow.id).catch(() => {})
                setPositions(positions)
                setAssignments(assignments)
                setError(assignmentInsertErrorMessage(assignmentError as { message?: string; code?: string }))
                resetPositionForm()
                setPositionMotifIds(prev => ({ ...prev, [NEW_POSITION_SLOT]: [] }))
                const isProductionStatus = subOrderRef.current.status === 'PRODUCTION_READY' || subOrderRef.current.status === 'DONE'
                void syncSubOrder(motifs, positions, assignments, isProductionStatus)
                return
              }
            }
            setAssignments(assignmentAccumulator)
          } finally {
            setIsSaving(false)
          }
        }

        setPositionMotifIds(prev => ({ ...prev, [NEW_POSITION_SLOT]: [] }))
        resetPositionForm()
        const isProductionStatus = subOrderRef.current.status === 'PRODUCTION_READY' || subOrderRef.current.status === 'DONE'
        void syncSubOrder(motifs, nextPositions, assignmentAccumulator, isProductionStatus)
      }
    }
  }

  const deleteMotif = async (id: string) => {
    if (motifEditId === id) cancelMotifForm()
    setError(null)
    let inUse: boolean
    try {
      inUse = await textileService.getAssignmentIdsByMotif(id).then(ids => ids.length > 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error checking')
      return
    }
    if (inUse) {
      setError('Motif is still used in an assignment.')
      return
    }
    setIsSaving(true)
    try {
      await textileService.deleteMotif(id)
    } catch (err) {
      setIsSaving(false)
      setError(err instanceof Error ? err.message : 'Delete failed')
      return
    }
    setIsSaving(false)
    const remainingMotifs = motifs.filter(m => m.id !== id)
    setMotifs(remainingMotifs)
    const filteredAssignments = assignments.filter(z => z.motif_id !== id)
    setAssignments(filteredAssignments)
    const isProductionStatus = subOrderRef.current.status === 'PRODUCTION_READY' || subOrderRef.current.status === 'DONE'
    void syncSubOrder(remainingMotifs, positions, filteredAssignments, isProductionStatus)
  }

  const deletePosition = async (id: string) => {
    if (positionEditId === id) cancelPositionForm()
    setError(null)
    let inUse: boolean
    try {
      inUse = await textileService.getAssignmentIdsByPosition(id).then(ids => ids.length > 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error checking')
      return
    }
    if (inUse) {
      setError('Position is still used in an assignment.')
      return
    }
    setIsSaving(true)
    try {
      await textileService.deletePosition(id)
    } catch (err) {
      setIsSaving(false)
      setError(err instanceof Error ? err.message : 'Delete failed')
      return
    }
    setIsSaving(false)
    const remainingPositions = positions.filter(p => p.id !== id)
    setPositions(remainingPositions)
    const filteredAssignments = assignments.filter(z => z.position_id !== id)
    setAssignments(filteredAssignments)
    const isProductionStatus = subOrderRef.current.status === 'PRODUCTION_READY' || subOrderRef.current.status === 'DONE'
    void syncSubOrder(motifs, remainingPositions, filteredAssignments, isProductionStatus)
  }

  const deleteAssignment = async (id: string) => {
    setError(null)
    setIsSaving(true)
    try {
      await textileService.deleteAssignment(id)
    } catch (err) {
      setIsSaving(false)
      setError(err instanceof Error ? err.message : 'Delete failed')
      return
    }
    setIsSaving(false)
    const remainingAssignments = assignments.filter(z => z.id !== id)
    setAssignments(remainingAssignments)
    const isProductionStatus = subOrderRef.current.status === 'PRODUCTION_READY' || subOrderRef.current.status === 'DONE'
    void syncSubOrder(motifs, positions, remainingAssignments, isProductionStatus)
  }

  useEffect(() => {
    if (positionEditId !== null) return
    setPositionMotifIds(prev => {
      const cur = prev[NEW_POSITION_SLOT]
      if (cur && cur.length > 0) return prev
      return { ...prev, [NEW_POSITION_SLOT]: [''] }
    })
  }, [positionEditId])

  const shouldValidate = subOrderStatus !== 'QUOTE'

  return (
    <div className="ber-lfp" style={{ maxWidth: '100%' }}>
      <h3 className="ber-h3">Textile Details</h3>
      {shouldValidate && customerMeetsPrepressContact(orderCustomer) === false && (
        <p className="ber-hinweis">For auto-PREPRESS: Customer needs name and email or phone.</p>
      )}
      {error && <p className="ber-err">{error}</p>}

      {loading && <p className="ber-hinweis" style={{ fontStyle: 'normal' }}>Loading textile data…</p>}

      <div className="ber-lfp" style={{ borderTop: '1px solid var(--border)', marginTop: '0.5rem', paddingTop: '0.35rem' }}>
        <h3 className="ber-h3" style={{ marginTop: 0 }}>
          1. Motifs
        </h3>
        <p className="ber-hinweis" style={{ fontStyle: 'normal', fontSize: '0.8rem' }}>
          {motifEditId ? 'Edit entry and save.' : 'Create a new motif and save with + Add.'}
        </p>
        <form onSubmit={submitMotif}>
              <div className="ber-zeile">
                <span className="ber-lbl">Type</span>
                <div className="ber-nmb">
                  <label>
                    <input type="radio" name="mtyp" checked={motifType === 'TEXT'} onChange={() => setMotifType('TEXT')} /> Text
                  </label>
                  <label>
                    <input type="radio" name="mtyp" checked={motifType === 'FILE'} onChange={() => setMotifType('FILE')} /> File
                  </label>
                </div>
              </div>
              {motifType === 'TEXT' && (
                <>
                  <div className="ber-zeile">
                    <label className="ber-lbl" htmlFor="tx-inh">
                      Content
                    </label>
                    <input id="tx-inh" className="ber-inp" value={motifContent} onChange={e => setMotifContent(e.target.value)} />
                  </div>
                  <div className="ber-zeile">
                    <label className="ber-lbl" htmlFor="tx-fa">
                      Colour
                    </label>
                    <input id="tx-fa" className="ber-inp" value={motifColor} onChange={e => setMotifColor(e.target.value)} />
                  </div>
                  <div className="ber-zeile">
                    <span className="ber-lbl">Font class</span>
                    <select
                      className="ber-inp"
                      value={motifFontClass}
                      onChange={e => setMotifFontClass(e.target.value as TextileFontClass)}
                    >
                      {FONT_CLASS_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="ber-zeile">
                    <label className="ber-lbl" htmlFor="tx-sa">
                      Font
                    </label>
                    <input
                      id="tx-sa"
                      className="ber-inp"
                      placeholder="Specific font"
                      value={motifFontStyle}
                      onChange={e => setMotifFontStyle(e.target.value)}
                    />
                  </div>
                </>
              )}
              {motifType === 'FILE' && (
                <div className="ber-zeile">
                  <span className="ber-lbl">File</span>
                  <div>
                    {orderFiles.length === 0 ? (
                      <p className="ber-hinweis" style={{ fontStyle: 'normal' }}>
                        Add files to the order first (section &apos;Files for this order&apos;).
                      </p>
                    ) : (
                      <select className="ber-inp" value={motifFileId} onChange={e => setMotifFileId(e.target.value)} required>
                        <option value="">—</option>
                        {orderFiles.map(d => (
                          <option key={d.id} value={d.id}>
                            {d.display_name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              )}
              <div className="ber-zeile">
                <span className="ber-lbl">Placement</span>
                <select className="ber-inp" value={motifPlacement} onChange={e => setMotifPlacement(e.target.value as TextilePlacement)}>
                  {PLACEMENT_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ber-zeile">
                <span className="ber-lbl">Size</span>
                <div>
                  <select
                    className="ber-inp"
                    value={motifSizeType}
                    onChange={e => setMotifSizeType(e.target.value as TextileSize)}
                  >
                    {SIZE_OPTIONS.map(g => (
                      <option key={g} value={g}>
                        {g === 'FREI' ? 'Free (mm)' : SIZE_LABELS[g as 'KLEIN' | 'MITTEL' | 'GROSS']}
                      </option>
                    ))}
                  </select>
                  {motifSizeType === 'FREI' && (
                    <input
                      className="ber-inp"
                      style={{ marginTop: 6, maxWidth: '14rem' }}
                      placeholder="e.g. 150x200"
                      value={motifSizeFree}
                      onChange={e => setMotifSizeFree(e.target.value)}
                    />
                  )}
                </div>
              </div>
              <div className="ber-zeile">
                <label className="ber-lbl" htmlFor="m-druckart">
                  Print method
                </label>
                <input
                  id="m-druckart"
                  className="ber-inp"
                  placeholder="optional"
                  value={motifPrintMethod}
                  onChange={e => setMotifPrintMethod(e.target.value)}
                />
              </div>
              <div className="ber-zeile">
                <span className="ber-lbl" />
                <div className="ber-nmb" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                  <button type="submit" className="wa-bereich-btn" disabled={isSaving || loading}>
                    {motifEditId ? 'Save' : '+ Add'}
                  </button>
                  {motifEditId && (
                    <button type="button" className="wa-ghost-btn" onClick={cancelMotifForm} disabled={isSaving || loading}>
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </form>
        <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.65rem', paddingTop: '0.5rem' }}>
          <p style={{ margin: '0 0 0.35rem', fontSize: '0.82rem', fontWeight: 600 }}>Existing motifs</p>
          {motifs.length === 0 && (
            <div
              style={{
                border: '1px dashed var(--border)',
                borderRadius: 6,
                padding: '0.75rem',
                marginBottom: '0.5rem',
                fontSize: '0.85rem',
                color: 'var(--text)',
                opacity: 0.9,
              }}
            >
              No motifs yet.
            </div>
          )}
          {motifs.map((motif, index) => (
            <div
              key={motif.id}
              style={{
                marginBottom: '0.5rem',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '0.5rem 0.65rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: '0.88rem',
                }}
              >
                <strong>Motif {index + 1}</strong>
                <span style={{ opacity: 0.75 }}>|</span>
                <span>{motif.type}</span>
                <span style={{ opacity: 0.75 }}>|</span>
                <span>{placementLabel(String(motif.placement ?? '')) || '—'}</span>
                <span style={{ opacity: 0.75 }}>|</span>
                <span>{sizeShortLabel(motif.size ?? '—')}</span>
                <span style={{ opacity: 0.75 }}>|</span>
                <span>{motif.print_method?.trim() ? motif.print_method : '—'}</span>
                <button type="button" className="wa-ghost-btn" onClick={() => editMotif(motif)} disabled={isSaving}>
                  Edit
                </button>
                <button type="button" className="wa-ghost-btn" onClick={() => void deleteMotif(motif.id)} disabled={isSaving}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="ber-lfp" style={{ borderTop: '1px solid var(--border)' }}>
        <h3 className="ber-h3" style={{ marginTop: '0.35rem' }}>
          2. Textiles
        </h3>
        <p className="ber-hinweis" style={{ fontSize: '0.8rem' }}>
          {positionEditId ? 'Edit position and save.' : 'Create a new position.'} Own stock: each size as a separate position.
        </p>
        <form onSubmit={submitPosition}>
              <div className="ber-zeile">
                <span className="ber-lbl">Origin</span>
                <div className="ber-nmb">
                  <label>
                    <input
                      type="radio"
                      name="pH"
                      checked={positionOrigin === 'CUSTOMER_STOCK'}
                      onChange={() => setPositionOrigin('CUSTOMER_STOCK')}
                      disabled={positionEditId !== null}
                    />
                    {ORIGIN_LABELS.CUSTOMER_STOCK}
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="pH"
                      checked={positionOrigin === 'OWN_STOCK'}
                      onChange={() => setPositionOrigin('OWN_STOCK')}
                      disabled={positionEditId !== null}
                    />
                    {ORIGIN_LABELS.OWN_STOCK}
                  </label>
                </div>
              </div>
              {positionOrigin === 'CUSTOMER_STOCK' && (
                <>
                  <div className="ber-zeile">
                    <span className="ber-lbl">Type</span>
                    <select className="ber-inp" value={positionGarmentType} onChange={e => setPositionGarmentType(e.target.value as TextileCustomerGarmentType)}>
                      {GARMENT_TYPE_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="ber-zeile">
                    <label className="ber-lbl" htmlFor="px-fa">
                      Colour
                    </label>
                    <input id="px-fa" className="ber-inp" value={positionColor} onChange={e => setPositionColor(e.target.value)} />
                  </div>
                </>
              )}
              {positionOrigin === 'OWN_STOCK' && (
                <>
                  <div className="ber-zeile">
                    <span className="ber-lbl">Own stock mode</span>
                    <div className="ber-nmb" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                      <label>
                        <input
                          type="radio"
                          name="ewm"
                          checked={ownGoodsMode === 'STAMMDATEN'}
                          onChange={() => {
                            setOwnGoodsMode('STAMMDATEN')
                            void saveOwnGoodsMode('STAMMDATEN')
                            setSelectedBrandId('')
                            setSelectedProductId('')
                            setSelectedVariantId('')
                          }}
                        />{' '}
                        From catalog
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="ewm"
                          checked={ownGoodsMode === 'FREITEXT'}
                          onChange={() => {
                            setOwnGoodsMode('FREITEXT')
                            void saveOwnGoodsMode('FREITEXT')
                            setSelectedBrandId('')
                            setSelectedProductId('')
                            setSelectedVariantId('')
                          }}
                        />{' '}
                        Free text (item not in catalog)
                      </label>
                    </div>
                  </div>

                  {ownGoodsMode === 'STAMMDATEN' && (
                    <>
                      <div className="ber-zeile">
                        <span className="ber-lbl">Brand</span>
                        <div>
                          <select
                            className="ber-inp"
                            value={selectedBrandId}
                            onChange={e => {
                              setSelectedBrandId(e.target.value)
                              setSelectedProductId('')
                              setSelectedColor('')
                              setSelectedVariantId('')
                            }}
                            required
                          >
                            <option value="">—</option>
                            {masterBrands.map(m => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                          {masterDataLoading && <p className="ber-hinweis">Loading catalog…</p>}
                        </div>
                      </div>

                      {selectedBrandId && (
                        <div className="ber-zeile">
                          <span className="ber-lbl">Product</span>
                          <select
                            className="ber-inp"
                            value={selectedProductId}
                            onChange={e => {
                              setSelectedProductId(e.target.value)
                              setSelectedColor('')
                              setSelectedVariantId('')
                            }}
                            required
                          >
                            <option value="">—</option>
                            {masterProducts.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                                {p.article_number ? ` (${p.article_number})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {selectedProductId && (
                        <div className="ber-zeile">
                          <span className="ber-lbl">Colour</span>
                          <div>
                            <select
                              className="ber-inp"
                              value={selectedColor}
                              onChange={e => {
                                const colorValue = e.target.value
                                setSelectedColor(colorValue)
                                setSelectedVariantId('')
                                if (colorValue) {
                                  const brandName = masterBrands.find(x => x.id === selectedBrandId)?.name ?? ''
                                  const productName = masterProducts.find(x => x.id === selectedProductId)?.name ?? ''
                                  setPositionBrand(brandName)
                                  setPositionModel(productName)
                                  setPositionColor(colorValue)
                                  setPositionSize('')
                                } else {
                                  setPositionColor('')
                                  setPositionSize('')
                                }
                              }}
                              required
                            >
                              <option value="">—</option>
                              {masterColors.map(v => (
                                <option key={v.farbe} value={v.farbe}>
                                  {v.farbe_hex ? '● ' : ''}
                                  {v.farbe}
                                </option>
                              ))}
                            </select>
                            {selectedColor && (
                              <p
                                className="ber-hinweis"
                                style={{
                                  fontStyle: 'normal',
                                }}
                              >
                                Selection: {positionBrand} · {positionModel} · {selectedColor}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {selectedProductId && selectedColor && (
                        <div className="ber-zeile">
                          <span className="ber-lbl">Size</span>
                          <div>
                            <select
                              className="ber-inp"
                              value={selectedVariantId}
                              onChange={e => {
                                const variantId = e.target.value
                                setSelectedVariantId(variantId)
                                const selectedSize = masterSizes.find(x => x.id === variantId) ?? null
                                if (selectedSize) {
                                  setPositionSize(selectedSize.size)
                                } else {
                                  setPositionSize('')
                                }
                              }}
                              required
                            >
                              <option value="">—</option>
                              {masterSizes.map(v => (
                                <option key={v.id} value={v.id}>
                                  {(v.stock ?? 0) <= 0 ? '⚠ ' : ''}
                                  {v.size} (Stock: {v.stock ?? 0}){v.is_sample ? ' · Sample' : ''}
                                </option>
                              ))}
                            </select>
                            {selectedVariantId && (
                              <p
                                className="ber-hinweis"
                                style={{
                                  fontStyle: 'normal',
                                  color: (masterSizes.find(x => x.id === selectedVariantId)?.stock ?? 0) <= 0 ? '#f59e0b' : undefined,
                                }}
                              >
                                Selection: {positionBrand} · {positionModel} · {selectedColor} · {positionSize}
                              </p>
                            )}
                            {!selectedVariantId && masterSizes.length > 0 && (
                              <p className="ber-hinweis" style={{ fontStyle: 'normal' }}>
                                Select size (required)
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {ownGoodsMode === 'FREITEXT' && (
                    <>
                      <div className="ber-zeile">
                        <label className="ber-lbl" htmlFor="px-mk">
                          Brand
                        </label>
                        <input
                          id="px-mk"
                          className="ber-inp"
                          value={positionBrand}
                          onChange={e => setPositionBrand(e.target.value)}
                        />
                      </div>
                      <div className="ber-zeile">
                        <label className="ber-lbl" htmlFor="px-mo">
                          Model
                        </label>
                        <input
                          id="px-mo"
                          className="ber-inp"
                          value={positionModel}
                          onChange={e => setPositionModel(e.target.value)}
                        />
                      </div>
                      <div className="ber-zeile">
                        <label className="ber-lbl" htmlFor="px-f2">
                          Colour
                        </label>
                        <input
                          id="px-f2"
                          className="ber-inp"
                          value={positionColor}
                          onChange={e => setPositionColor(e.target.value)}
                        />
                      </div>
                      <div className="ber-zeile">
                        <label className="ber-lbl" htmlFor="px-gr">
                          Size
                        </label>
                        <div>
                          <input
                            id="px-gr"
                            className="ber-inp"
                            value={positionSize}
                            onChange={e => setPositionSize(e.target.value)}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
              {(positionOrigin !== 'OWN_STOCK' || ownGoodsMode !== 'STAMMDATEN' || selectedVariantId) && (
                <div className="ber-zeile">
                  <label className="ber-lbl" htmlFor="px-st">
                    Quantity
                  </label>
                  <input
                    id="px-st"
                    type="number"
                    className="ber-inp"
                    min={1}
                    step={1}
                    value={positionQuantity}
                    onChange={e => setPositionQuantity(parseInt(e.target.value, 10) || 0)}
                  />
                </div>
              )}
              {(positionMotifIds[currentPositionSlotKey] ?? ['']).map((slotVal, slotIx) => (
                <div key={`mot-slot-${currentPositionSlotKey}-${slotIx}`} className="ber-zeile">
                  <span className="ber-lbl">{slotIx === 0 ? 'Assign motif' : ''}</span>
                  <div>
                    <select
                      className="ber-inp"
                      value={slotVal}
                      onChange={e => {
                        const selectedMotifId = e.target.value
                        setPositionMotifIds(prev => {
                          const slots = [...(prev[currentPositionSlotKey] ?? [''])]
                          slots[slotIx] = selectedMotifId
                          return { ...prev, [currentPositionSlotKey]: slots }
                        })
                      }}
                    >
                      <option value="">— Select motif —</option>
                      {motifs.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.type === 'TEXT'
                            ? (m.content ?? 'Text motif')
                            : `File motif ${motifs.indexOf(m) + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
              <div className="ber-zeile">
                <span className="ber-lbl" />
                <button
                  type="button"
                  className="wa-ghost-btn"
                  onClick={() =>
                    setPositionMotifIds(prev => ({
                      ...prev,
                      [currentPositionSlotKey]: [...(prev[currentPositionSlotKey] ?? ['']), ''],
                    }))
                  }
                  disabled={isSaving || loading}
                >
                  + another motif
                </button>
              </div>
              <div className="ber-zeile">
                <span className="ber-lbl" />
                <div className="ber-nmb" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                  <button
                    type="submit"
                    className="wa-bereich-btn"
                    disabled={isSaving || loading || (positionOrigin === 'OWN_STOCK' && ownGoodsMode === 'STAMMDATEN' && !selectedVariantId)}
                    title={positionOrigin === 'OWN_STOCK' && ownGoodsMode === 'STAMMDATEN' && !selectedVariantId ? 'Please select a size' : undefined}
                  >
                    {positionEditId ? 'Save' : '+ Add'}
                  </button>
                  {positionEditId && (
                    <button type="button" className="wa-ghost-btn" onClick={cancelPositionForm} disabled={isSaving || loading}>
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </form>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {positions.map(position => (
            <li
              key={position.id}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 8,
                padding: '0.45rem 0',
                borderBottom: '1px solid var(--border)',
                fontSize: '0.88rem',
              }}
            >
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  padding: '0.12rem 0.4rem',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                }}
              >
                {position.origin === 'CUSTOMER_STOCK' ? 'CUSTOMER' : 'OWN'}
              </span>
              {position.origin === 'OWN_STOCK' && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '0.12rem 0.4rem',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    background: position.variant_id ? '#dcfce7' : '#f1f5f9',
                    color: position.variant_id ? '#166534' : '#475569',
                  }}
                >
                  {position.variant_id ? 'Catalog' : 'Free text'}
                </span>
              )}
              <span>
                {position.origin === 'CUSTOMER_STOCK' ? (
                  `${garmentTypeLabel(position.type)} · ${position.color} · Qty: ${position.quantity}`
                ) : position.variant_id ? (
                  (() => {
                    const variantId = String(position.variant_id)
                    const variantInfo = variantInfoById.get(variantId)
                    const brand = variantInfo?.marke || (position.brand ?? '')
                    const productName = variantInfo?.produkt || (position.model ?? '')
                    const color = variantInfo?.color || (position.color ?? '')
                    const size = variantInfo?.size || (position.size ?? '')
                    const stock = variantInfo ? variantInfo.stock : null
                    return `${brand} ${productName} ${color} / ${size} · Stock: ${stock == null ? '—' : stock} · Qty: ${position.quantity}`
                  })()
                ) : (
                  `${position.brand} ${position.model} ${position.color} / ${position.size} · Qty: ${position.quantity}`
                )}
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                {assignments
                  .filter(assignment => assignment.position_id === position.id)
                  .map(assignment => {
                    const matchedMotif = motifs.find(motif => motif.id === assignment.motif_id)
                    const motifLabel =
                      matchedMotif?.type === 'TEXT'
                        ? (matchedMotif.content ?? 'Text motif')
                        : matchedMotif
                          ? `File motif ${motifs.indexOf(matchedMotif) + 1}`
                          : assignment.motif_id
                    return (
                      <span
                        key={assignment.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: '0.65rem',
                          fontWeight: 600,
                          padding: '0.1rem 0.35rem',
                          border: '1px solid var(--border)',
                          borderRadius: 4,
                          background: 'var(--accent-bg, rgba(170, 59, 255, 0.08))',
                        }}
                      >
                        <span>{motifLabel}</span>
                        <button
                          type="button"
                          title="Remove assignment"
                          onClick={() => void deleteAssignment(assignment.id)}
                          disabled={isSaving}
                          style={{
                            font: 'inherit',
                            fontSize: '0.75rem',
                            lineHeight: 1,
                            padding: '0 0.15rem',
                            border: 'none',
                            background: 'transparent',
                            cursor: isSaving ? 'not-allowed' : 'pointer',
                            color: 'var(--text)',
                          }}
                        >
                          ×
                        </button>
                      </span>
                    )
                  })}
              </div>
              <button type="button" className="wa-ghost-btn" onClick={() => void editPosition(position)} disabled={isSaving}>
                Edit
              </button>
              <button type="button" className="wa-ghost-btn" onClick={() => void deletePosition(position.id)} disabled={isSaving}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
