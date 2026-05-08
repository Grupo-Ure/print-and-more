import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../../supabase'
import { subOrderService } from '../../services/subOrderService'
import { customerMeetsPrepressContact } from '../../lib/customer'
import { isSubOrderComplete, nextSubOrderStatus } from '../../lib/subOrderShared'
import {
  buildFreeSizeString,
  isUniqueViolation,
  textileRecordsAllowPrepress,
} from '../../lib/textile/validateTextileDetail'
import type { OrderStatus, CustomerContactJoin, SubOrderRow } from '../../types/database'
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

type TextileProductWithBrandEmbed = {
  name: string | null
  textil_marken?: { name: string | null } | { name: string | null }[] | null
}

type TextileVariantQueryRow = Pick<
  Database['public']['Tables']['textil_varianten']['Row'],
  'id' | 'bestand' | 'farbe' | 'groesse' | 'ist_muster'
> & {
  textil_produkte?: TextileProductWithBrandEmbed | TextileProductWithBrandEmbed[] | null
}

type Props = {
  subOrder: SubOrderRow
  subOrderStatus: OrderStatus
  orderStatus?: OrderStatus
  orderFiles: FileRow[]
  orderCustomer: CustomerContactJoin
  onUpdated: (t: SubOrderRow) => void
}

const FONT_CLASS_OPTIONS: { v: TextileFontClass; l: string }[] = [
  { v: 'SERIFENLOS', l: 'Serifenlos' },
  { v: 'SERIFEN', l: 'Serifen' },
  { v: 'ELEGANT', l: 'Elegant' },
  { v: 'VERSPIELT', l: 'Verspielt' },
]

const ORIGIN_LABELS: Record<TextileOrigin, string> = {
  KUNDENWARE: 'Kundenware',
  EIGENWARE: 'Eigenware',
}

const GARMENT_TYPE_OPTIONS: { v: TextileCustomerGarmentType; l: string }[] = [
  { v: 'T_SHIRT', l: 'T-Shirt' },
  { v: 'POLO', l: 'Polo' },
  { v: 'SWEATSHIRT', l: 'Sweatshirt' },
  { v: 'HOODIE', l: 'Hoodie' },
  { v: 'ZIP_HOODIE', l: 'Zip-Hoodie' },
  { v: 'JACKE', l: 'Jacke' },
  { v: 'SONSTIGES', l: 'Sonstiges' },
]

const PLACEMENT_OPTIONS: { v: TextilePlacement; l: string }[] = [
  { v: 'BRUST_LINKS', l: 'Brust links' },
  { v: 'BRUST_MITTE', l: 'Brust mitte' },
  { v: 'BRUST_RECHTS', l: 'Brust rechts' },
  { v: 'RUECKEN', l: 'Rücken' },
  { v: 'ARM_LINKS', l: 'Arm links' },
  { v: 'ARM_RECHTS', l: 'Arm rechts' },
  { v: 'SONSTIGE', l: 'Sonstige' },
]

const SIZE_LABELS: Record<Exclude<TextileSize, 'FREI'>, string> = {
  KLEIN: 'Klein',
  MITTEL: 'Mittel',
  GROSS: 'Groß',
}

const SIZE_OPTIONS: TextileSize[] = ['KLEIN', 'MITTEL', 'GROSS', 'FREI']

type OwnGoodsMode = 'STAMMDATEN' | 'FREITEXT'

function one<T>(x: T | T[] | null | undefined): T | null {
  if (x == null) return null
  return Array.isArray(x) ? (x[0] ?? null) : x
}

function garmentTypeLabel(v: string | null | undefined): string {
  if (!v) return '—'
  const s = GARMENT_TYPE_OPTIONS.find(x => x.v === v)
  return s?.l ?? v
}

function placementLabel(p: string): string {
  const s = PLACEMENT_OPTIONS.find(x => x.v === p)
  return s?.l ?? p
}

function sizeShortLabel(g: string): string {
  if (SIZE_OPTIONS.slice(0, 3).includes(g as 'KLEIN' | 'MITTEL' | 'GROSS')) {
    return SIZE_LABELS[g as 'KLEIN' | 'MITTEL' | 'GROSS']
  }
  if (g === 'FREI' || (typeof g === 'string' && g.startsWith('FREI:'))) {
    if (g === 'FREI') return 'Frei (mm)'
    if (g.startsWith('FREI:')) return `Frei: ${g.slice(5)}`
  }
  return g
}

/** DB-Wert `groesse` am Motiv → Formular Größenwahl + Freitext */
function parseSizeFromDb(g: string | null | undefined): { sizeType: TextileSize; freeText: string } {
  if (!g || g === 'KLEIN' || g === 'MITTEL' || g === 'GROSS') {
    return { sizeType: (g as TextileSize) || 'MITTEL', freeText: '' }
  }
  if (g === 'FREI') return { sizeType: 'FREI', freeText: '' }
  if (g.startsWith('FREI:')) return { sizeType: 'FREI', freeText: g.slice(5) }
  return { sizeType: 'MITTEL', freeText: '' }
}

/** INSERT `textil_zuordnungen`: Trigger `PLATZ_KONFLIKT` vs. Unique-Constraint */
function assignmentInsertErrorMessage(err: { message?: string; code?: string }): string {
  if ((err.message ?? '').includes('PLATZ_KONFLIKT')) {
    return 'Dieser Platz ist für diese Textilposition bereits durch ein anderes Motiv belegt.'
  }
  if (isUniqueViolation(err)) {
    return 'Diese Motiv-Position-Zuordnung existiert bereits.'
  }
  return err.message ?? ''
}

const ASSIGNMENT_EMBED_SELECT =
  'id, teilauftrag_id, motiv_id, position_id, textil_motive(typ, inhalt, datei_id, platz, groesse, druckart), textil_positionen(herkunft, typ, farbe, marke, modell, groesse)'

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
    Map<string, { bestand: number; farbe: string; groesse: string; ist_muster: boolean; produkt: string; marke: string }>
  >(new Map())

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const [motifType, setMotifType] = useState<TextileMotifType>('TEXT')
  const [motifContent, setMotifContent] = useState('')
  const [motifColor, setMotifColor] = useState('')
  const [motifFontClass, setMotifFontClass] = useState<TextileFontClass>('SERIFENLOS')
  const [motifFontStyle, setMotifFontStyle] = useState('')
  const [motifFileId, setMotifFileId] = useState('')
  const [motifPlacement, setMotifPlacement] = useState<TextilePlacement>('BRUST_LINKS')
  const [motifSizeType, setMotifSizeType] = useState<TextileSize>('MITTEL')
  const [motifSizeFree, setMotifSizeFree] = useState('')
  const [motifPrintMethod, setMotifPrintMethod] = useState('')

  const [positionOrigin, setPositionOrigin] = useState<TextileOrigin>('KUNDENWARE')
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
      if (afterProdMutation && (currentSubOrder.status === 'PRODUKTION_BEREIT' || currentSubOrder.status === 'FERTIG')) {
        nextStatus = 'UNVOLLSTAENDIG'
      } else {
        nextStatus = nextSubOrderStatus(currentSubOrder.status, currentSubOrder, merged, isComplete, customerContactOk, orderStatus)
      }
      setIsSaving(true)
      const subOrderSyncPatch: Database['public']['Tables']['teilauftraege']['Update'] = {
        status: nextStatus,
        detail: newDetail as Json,
      }
      let row: SubOrderRow
      try {
        row = await subOrderService.updateSubOrder(currentSubOrder.id, subOrderSyncPatch)
      } catch (err) {
        setIsSaving(false)
        setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen')
        return
      }
      setIsSaving(false)
      subOrderRef.current = row
      onUpdated(row)
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
    const [motifResult, positionResult, assignmentResult] = await Promise.all([
      supabase.from('textil_motive').select('*').eq('teilauftrag_id', subOrderId),
      supabase.from('textil_positionen').select('*').eq('teilauftrag_id', subOrderId),
      supabase.from('textil_zuordnungen').select(ASSIGNMENT_EMBED_SELECT).eq('teilauftrag_id', subOrderId),
    ])
    if (motifResult.error) setError(motifResult.error.message)
    if (positionResult.error) setError(positionResult.error.message)
    if (assignmentResult.error) setError(assignmentResult.error.message)
    const loadedMotifs = (motifResult.data ?? []) as TextileMotifRow[]
    const loadedPositions = (positionResult.data ?? []) as TextilePositionRow[]
    const loadedAssignments = (assignmentResult.data ?? []) as unknown as TextileAssignmentRow[]
    setMotifs(loadedMotifs)
    setPositions(loadedPositions)
    setAssignments(loadedAssignments)

    // Variante-Infos für Positionsliste (Bestand/Labels) loading
    try {
      const ids = Array.from(
        new Set(
          loadedPositions.map(r => r.variante_id).filter((x): x is string => typeof x === 'string' && x.trim() !== '')
        )
      )
      if (ids.length === 0) {
        setVariantInfoById(new Map())
      } else {
        const { data: vData, error: vErr } = await supabase
          .from('textil_varianten')
          .select('id, bestand, farbe, groesse, ist_muster, textil_produkte(name, textil_marken(name))')
          .in('id', ids)
        if (vErr) throw vErr
        const variantMap = new Map<
          string,
          { bestand: number; farbe: string; groesse: string; ist_muster: boolean; produkt: string; marke: string }
        >()
        for (const variantRow of (vData ?? []) as unknown as TextileVariantQueryRow[]) {
          const product = one(variantRow.textil_produkte)
          const brand = product ? one(product.textil_marken) : null
          variantMap.set(String(variantRow.id), {
            bestand: Number(variantRow.bestand) || 0,
            farbe: String(variantRow.farbe ?? ''),
            groesse: String(variantRow.groesse ?? ''),
            ist_muster: Boolean(variantRow.ist_muster),
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
    const det = subOrderRef.current.detail
    const detObj = det && typeof det === 'object' && !Array.isArray(det) ? (det as Record<string, unknown>) : null
    const textilObj =
      detObj && detObj.textil && typeof detObj.textil === 'object' && !Array.isArray(detObj.textil)
        ? (detObj.textil as Record<string, unknown>)
        : null
    const previousAllowsPrepress = textilObj && typeof textilObj.voll === 'boolean' ? (textilObj.voll as boolean) : null
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
      const detailPatch: Database['public']['Tables']['teilauftraege']['Update'] = {
        detail: newDetail as Json,
      }
      let row: SubOrderRow
      try {
        row = await subOrderService.updateSubOrder(currentSubOrder.id, detailPatch)
      } catch (err) {
        setIsSaving(false)
        setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen')
        return
      }
      setIsSaving(false)
      subOrderRef.current = row
      onUpdated(row)
    },
    [onUpdated]
  )

  // Stammdaten-Auswahl (nur Eigenware + STAMMDATEN)
  const [masterBrands, setMasterBrands] = useState<{ id: string; name: string }[]>([])
  const [masterProducts, setMasterProducts] = useState<{ id: string; name: string; artikelnummer: string | null }[]>([])
  const [masterColors, setMasterColors] = useState<{ farbe: string; farbe_hex: string | null }[]>([])
  const [masterSizes, setMasterSizes] = useState<{ id: string; groesse: string; bestand: number; ist_muster: boolean }[]>([])
  const [selectedBrandId, setSelectedBrandId] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedColor, setSelectedColor] = useState('')
  const [selectedVariantId, setSelectedVariantId] = useState('') // wird bei Größenwahl gesetzt
  const [masterDataLoading, setMasterDataLoading] = useState(false)

  useEffect(() => {
    if (positionOrigin !== 'EIGENWARE') return
    if (ownGoodsMode !== 'STAMMDATEN') return
    setMasterDataLoading(true)
    void Promise.resolve(
      supabase.from('textil_marken').select('id, name').eq('aktiv', true).order('name'),
    )
      .then(({ data, error }) => {
        if (error) return
        setMasterBrands((data ?? []) as { id: string; name: string }[])
      })
      .finally(() => setMasterDataLoading(false))
  }, [ownGoodsMode, positionOrigin])

  useEffect(() => {
    if (positionOrigin !== 'EIGENWARE') return
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
    void Promise.resolve(
      supabase
        .from('textil_produkte')
        .select('id, name, artikelnummer')
        .eq('marke_id', selectedBrandId)
        .eq('aktiv', true)
        .order('name'),
    )
      .then(({ data, error }) => {
        if (error) return
        setMasterProducts((data ?? []) as { id: string; name: string; artikelnummer: string | null }[])
      })
      .finally(() => setMasterDataLoading(false))
  }, [ownGoodsMode, positionOrigin, selectedBrandId])

  useEffect(() => {
    if (positionOrigin !== 'EIGENWARE') return
    if (ownGoodsMode !== 'STAMMDATEN') return
    if (!selectedProductId) {
      setMasterColors([])
      setMasterSizes([])
      setSelectedColor('')
      setSelectedVariantId('')
      return
    }
    setMasterDataLoading(true)
    void Promise.resolve(
      supabase
        .from('textil_varianten')
        .select('farbe, farbe_hex')
        .eq('produkt_id', selectedProductId)
        .eq('aktiv', true)
        .order('farbe'),
    )
      .then(res => {
        const { data, error } = res
        if (error) return
        const rows = (data ?? []) as { farbe: string | null; farbe_hex: string | null }[]
        const seen = new Set<string>()
        const uniqueColors: { farbe: string; farbe_hex: string | null }[] = []
        for (const colorRow of rows) {
          const colorValue = String(colorRow.farbe ?? '').trim()
          if (!colorValue) continue
          const colorKey = colorValue.toLowerCase()
          if (seen.has(colorKey)) continue
          seen.add(colorKey)
          uniqueColors.push({ farbe: colorValue, farbe_hex: colorRow.farbe_hex ?? null })
        }
        setMasterColors(uniqueColors)
      })
      .finally(() => setMasterDataLoading(false))
  }, [ownGoodsMode, positionOrigin, selectedProductId])

  useEffect(() => {
    if (positionOrigin !== 'EIGENWARE') return
    if (ownGoodsMode !== 'STAMMDATEN') return
    if (!selectedProductId || !selectedColor) {
      setMasterSizes([])
      setSelectedVariantId('')
      return
    }
    setMasterDataLoading(true)
    void Promise.resolve(
      supabase
        .from('textil_varianten')
        .select('id, groesse, bestand, ist_muster')
        .eq('produkt_id', selectedProductId)
        .eq('farbe', selectedColor)
        .eq('aktiv', true)
        .order('sort_order'),
    )
      .then(({ data, error }) => {
        if (error) return
        const rows = (data ?? []) as { id: string; groesse: string | null; bestand: number | null; ist_muster: boolean | null }[]
        setMasterSizes(
          rows.map(r => ({
            id: String(r.id),
            groesse: String(r.groesse ?? ''),
            bestand: Number(r.bestand) || 0,
            ist_muster: Boolean(r.ist_muster),
          }))
        )
      })
      .finally(() => setMasterDataLoading(false))
  }, [ownGoodsMode, positionOrigin, selectedColor, selectedProductId])

  const fileNameById = new Map<string, string>()
  for (const file of orderFiles) {
    fileNameById.set(file.id, file.anzeigename)
  }

  const resetMotifForm = () => {
    setMotifContent('')
    setMotifColor('')
    setMotifFontClass('SERIFENLOS')
    setMotifFontStyle('')
    setMotifFileId('')
    setMotifType('TEXT')
    setMotifPlacement('BRUST_LINKS')
    setMotifSizeType('MITTEL')
    setMotifSizeFree('')
    setMotifPrintMethod('')
  }
  const resetPositionForm = () => {
    setPositionOrigin('KUNDENWARE')
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
    const pid = positionEditId
    setPositionEditId(null)
    if (pid) {
      setPositionMotifIds(prev => {
        const updated = { ...prev }
        delete updated[pid]
        return updated
      })
    }
    resetPositionForm()
  }

  const editMotif = (m: TextileMotifRow) => {
    setError(null)
    setMotifEditId(m.id)
    setMotifType(m.typ)
    setMotifContent(m.inhalt ?? '')
    setMotifColor(m.farbe ?? '')
    setMotifFontClass((m.schriftklasse as TextileFontClass) || 'SERIFENLOS')
    setMotifFontStyle(m.schriftart ?? '')
    setMotifFileId(m.datei_id ?? '')
    const pl = String(m.platz ?? 'BRUST_LINKS')
    setMotifPlacement((PLACEMENT_OPTIONS.some(o => o.v === pl) ? pl : 'BRUST_LINKS') as TextilePlacement)
    const { sizeType, freeText } = parseSizeFromDb(m.groesse)
    setMotifSizeType(sizeType)
    setMotifSizeFree(freeText)
    setMotifPrintMethod(m.druckart ?? '')
  }

  const editPosition = async (p: TextilePositionRow) => {
    setError(null)
    setPositionEditId(p.id)
    setPositionOrigin(p.herkunft)
    setPositionQuantity(p.stueckzahl)
    setPositionBrand(p.marke ?? '')
    setPositionModel(p.modell ?? '')
    setPositionColor(p.farbe ?? '')
    setPositionSize(p.groesse ?? '')
    if (p.herkunft === 'KUNDENWARE') {
      setPositionGarmentType((p.typ as TextileCustomerGarmentType) || 'T_SHIRT')
    } else {
      if (p.variante_id) {
        setOwnGoodsMode('STAMMDATEN')
        const { data: vr, error: ve } = await supabase
          .from('textil_varianten')
          .select('id, produkt_id, farbe, groesse')
          .eq('id', p.variante_id)
          .maybeSingle()
        if (ve || !vr) {
          setOwnGoodsMode('FREITEXT')
          setSelectedBrandId('')
          setSelectedProductId('')
          setSelectedColor('')
          setSelectedVariantId('')
        } else {
          const { data: pr } = await supabase
            .from('textil_produkte')
            .select('id, marke_id')
            .eq('id', vr.produkt_id)
            .maybeSingle()
          if (pr?.marke_id) {
            setSelectedBrandId(String(pr.marke_id))
            setSelectedProductId(String(pr.id))
            setSelectedColor(String(vr.farbe ?? ''))
            setSelectedVariantId(String(vr.id))
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
    const mids = assignments.filter(z => z.position_id === p.id).map(z => z.motiv_id)
    setPositionMotifIds(prev => ({ ...prev, [p.id]: mids.length > 0 ? mids : [''] }))
  }

  async function syncAssignmentsForPosition(
    posId: string,
    desiredMotifIds: string[],
    startAssignments: TextileAssignmentRow[]
  ): Promise<{ ok: true; updatedAssignments: TextileAssignmentRow[] } | { ok: false; message: string }> {
    const wantedSet = new Set(desiredMotifIds.map(id => String(id).trim()).filter(Boolean))
    const wantedList = [...wantedSet]
    let currentAssignments = startAssignments
    const existingAssignments = currentAssignments.filter(z => z.position_id === posId)
    for (const assignment of existingAssignments) {
      if (!wantedSet.has(assignment.motiv_id)) {
        const { error } = await supabase.from('textil_zuordnungen').delete().eq('id', assignment.id)
        if (error) return { ok: false, message: error.message }
        currentAssignments = currentAssignments.filter(x => x.id !== assignment.id)
      }
    }
    const existingMotifIds = new Set(currentAssignments.filter(x => x.position_id === posId).map(x => x.motiv_id))
    for (const mid of wantedList) {
      if (existingMotifIds.has(mid)) continue
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('textil_zuordnungen')
        .insert({
          teilauftrag_id: subOrder.id,
          motiv_id: mid,
          position_id: posId,
        })
        .select(ASSIGNMENT_EMBED_SELECT)
        .single()
      if (assignmentError) return { ok: false, message: assignmentInsertErrorMessage(assignmentError) }
      if (assignmentData) currentAssignments = [...currentAssignments, assignmentData as unknown as TextileAssignmentRow]
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
        setError('Bei Größe „Frei (mm)” bitte Abmessung eintragen.')
        return
      }
      sizeValue = buildFreeSizeString(motifSizeFree)
    } else {
      sizeValue = motifSizeType
    }
    if (motifType === 'TEXT') {
      if (!motifContent.trim() || !motifColor.trim()) {
        setError('Inhalt und Farbe sind erforderlich (Text).')
        return
      }
      setIsSaving(true)
      const motifQuery = editId
        ? supabase
            .from('textil_motive')
            .update({
              typ: 'TEXT',
              platz: motifPlacement,
              groesse: sizeValue,
              druckart: motifPrintMethod.trim() || null,
              inhalt: motifContent.trim(),
              farbe: motifColor.trim(),
              schriftklasse: motifFontClass,
              schriftart: motifFontStyle.trim() || null,
              datei_id: null,
            })
            .eq('id', editId)
            .select('*')
            .single()
        : supabase
            .from('textil_motive')
            .insert({
              teilauftrag_id: subOrderId,
              typ: 'TEXT',
              platz: motifPlacement,
              groesse: sizeValue,
              druckart: motifPrintMethod.trim() || null,
              inhalt: motifContent.trim(),
              farbe: motifColor.trim(),
              schriftklasse: motifFontClass,
              schriftart: motifFontStyle.trim() || null,
              datei_id: null,
            })
            .select('*')
            .single()
      const { data, error } = await motifQuery
      setIsSaving(false)
      if (error) {
        setError(error.message)
        return
      }
      if (data) {
        const motifRow = data as TextileMotifRow
        const nextMotifs = editId ? motifs.map(x => (x.id === editId ? motifRow : x)) : [...motifs, motifRow]
        setMotifs(nextMotifs)
        setMotifEditId(null)
        resetMotifForm()
        const isProductionStatus = subOrderRef.current.status === 'PRODUKTION_BEREIT' || subOrderRef.current.status === 'FERTIG'
        void syncSubOrder(nextMotifs, positions, assignments, isProductionStatus)
      }
    } else {
      if (!motifFileId) {
        setError('Bitte eine FileRecord wählen.')
        return
      }
      setIsSaving(true)
      const motifFileQuery = editId
        ? supabase
            .from('textil_motive')
            .update({
              typ: 'DATEI',
              platz: motifPlacement,
              groesse: sizeValue,
              druckart: motifPrintMethod.trim() || null,
              inhalt: null,
              farbe: null,
              schriftklasse: null,
              schriftart: null,
              datei_id: motifFileId,
            })
            .eq('id', editId)
            .select('*')
            .single()
        : supabase
            .from('textil_motive')
            .insert({
              teilauftrag_id: subOrderId,
              typ: 'DATEI',
              platz: motifPlacement,
              groesse: sizeValue,
              druckart: motifPrintMethod.trim() || null,
              inhalt: null,
              farbe: null,
              schriftklasse: null,
              schriftart: null,
              datei_id: motifFileId,
            })
            .select('*')
            .single()
      const { data, error } = await motifFileQuery
      setIsSaving(false)
      if (error) {
        setError(error.message)
        return
      }
      if (data) {
        const motifRow = data as TextileMotifRow
        const nextMotifs = editId ? motifs.map(x => (x.id === editId ? motifRow : x)) : [...motifs, motifRow]
        setMotifs(nextMotifs)
        setMotifEditId(null)
        resetMotifForm()
        const isProductionStatus = subOrderRef.current.status === 'PRODUKTION_BEREIT' || subOrderRef.current.status === 'FERTIG'
        void syncSubOrder(nextMotifs, positions, assignments, isProductionStatus)
      }
    }
  }

  const submitPosition = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (positionQuantity < 1 || !Number.isInteger(positionQuantity)) {
      setError('Stückzahl: ganze Zahl ≥ 1.')
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
      const isProductionStatus = subOrderRef.current.status === 'PRODUKTION_BEREIT' || subOrderRef.current.status === 'FERTIG'
      void syncSubOrder(motifs, nextPositions, updatedAssignments, isProductionStatus)
    }

    if (editId) {
      if (positionOrigin === 'KUNDENWARE') {
        if (!positionColor.trim() || !positionGarmentType) {
          setError('Typ und Farbe sind erforderlich.')
          return
        }
        setIsSaving(true)
        const { error: updateError } = await supabase
          .from('textil_positionen')
          .update({
            herkunft: 'KUNDENWARE',
            typ: positionGarmentType,
            farbe: positionColor.trim(),
            stueckzahl: positionQuantity,
            marke: null,
            modell: null,
            groesse: null,
            variante_id: null,
          })
          .eq('id', editId)
        if (updateError) {
          setIsSaving(false)
          setError(updateError.message)
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
          setError('Position nicht gefunden.')
          return
        }
        const updatedPosition: TextilePositionRow = {
          ...previousPosition,
          herkunft: 'KUNDENWARE',
          typ: positionGarmentType,
          farbe: positionColor.trim(),
          stueckzahl: positionQuantity,
          marke: null,
          modell: null,
          groesse: null,
          variante_id: null,
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
          setError('Bitte Marke, Produkt und Variante aus Stammdaten wählen.')
          return
        }
        const brandName = masterBrands.find(x => x.id === selectedBrandId)?.name ?? ''
        const productName = masterProducts.find(x => x.id === selectedProductId)?.name ?? ''
        const sizeValue = masterSizes.find(x => x.id === selectedVariantId)?.groesse ?? ''
        if (!brandName || !productName || !selectedColor || !sizeValue) {
          setError('Stammdaten-Auswahl unvollständig.')
          return
        }
        setPositionBrand(brandName)
        setPositionModel(productName)
        setPositionColor(selectedColor)
        setPositionSize(sizeValue)
      } else {
        if (!positionBrand.trim() || !positionModel.trim() || !positionColor.trim() || !positionSize.trim()) {
          setError('Marke, Modell, Farbe und Größe sind erforderlich.')
          return
        }
      }
      setIsSaving(true)
      const { error: ownGoodsUpdateError } = await supabase
        .from('textil_positionen')
        .update({
          herkunft: 'EIGENWARE',
          typ: null,
          farbe: positionColor.trim(),
          stueckzahl: positionQuantity,
          marke: positionBrand.trim(),
          modell: positionModel.trim(),
          groesse: positionSize.trim(),
          variante_id: ownGoodsMode === 'STAMMDATEN' ? (selectedVariantId || null) : null,
        })
        .eq('id', editId)
      if (ownGoodsUpdateError) {
        setIsSaving(false)
        setError(ownGoodsUpdateError.message)
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
        herkunft: 'EIGENWARE',
        typ: null,
        farbe: positionColor.trim(),
        stueckzahl: positionQuantity,
        marke: positionBrand.trim(),
        modell: positionModel.trim(),
        groesse: positionSize.trim(),
        variante_id: ownGoodsMode === 'STAMMDATEN' ? (selectedVariantId || null) : null,
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
              bestand: sizeVariant.bestand,
              farbe: selectedColor,
              groesse: sizeVariant.groesse,
              ist_muster: sizeVariant.ist_muster,
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

    if (positionOrigin === 'KUNDENWARE') {
      if (!positionColor.trim() || !positionGarmentType) {
        setError('Typ und Farbe sind erforderlich.')
        return
      }
      setIsSaving(true)
      const { data, error } = await supabase
        .from('textil_positionen')
        .insert({
          teilauftrag_id: subOrderId,
          herkunft: 'KUNDENWARE',
          typ: positionGarmentType,
          farbe: positionColor.trim(),
          stueckzahl: positionQuantity,
          marke: null,
          modell: null,
          groesse: null,
        })
        .select('*')
        .single()
      setIsSaving(false)
      if (error) {
        setError(error.message)
        return
      }
      if (data) {
        const positionRow = data as TextilePositionRow
        const nextPositions = [...positions, positionRow]
        setPositions(nextPositions)

        let assignmentAccumulator = assignments
        const newMotifIds = desiredMotifIds
        if (newMotifIds.length > 0) {
          setIsSaving(true)
          try {
            for (const mid of newMotifIds) {
              const { data: assignmentData, error: assignmentError } = await supabase
                .from('textil_zuordnungen')
                .insert({
                  teilauftrag_id: subOrder.id,
                  motiv_id: mid,
                  position_id: positionRow.id,
                })
                .select(ASSIGNMENT_EMBED_SELECT)
                .single()
              if (assignmentError) {
                await supabase.from('textil_zuordnungen').delete().eq('position_id', positionRow.id)
                await supabase.from('textil_positionen').delete().eq('id', positionRow.id)
                setPositions(positions)
                setAssignments(assignments)
                setError(assignmentInsertErrorMessage(assignmentError))
                resetPositionForm()
                setPositionMotifIds(prev => ({ ...prev, [NEW_POSITION_SLOT]: [] }))
                const isProductionStatus = subOrderRef.current.status === 'PRODUKTION_BEREIT' || subOrderRef.current.status === 'FERTIG'
                void syncSubOrder(motifs, positions, assignments, isProductionStatus)
                return
              }
              if (assignmentData) assignmentAccumulator = [...assignmentAccumulator, assignmentData as unknown as TextileAssignmentRow]
            }
            setAssignments(assignmentAccumulator)
          } finally {
            setIsSaving(false)
          }
        }

        setPositionMotifIds(prev => ({ ...prev, [NEW_POSITION_SLOT]: [] }))
        resetPositionForm()
        const isProductionStatus = subOrderRef.current.status === 'PRODUKTION_BEREIT' || subOrderRef.current.status === 'FERTIG'
        void syncSubOrder(motifs, nextPositions, assignmentAccumulator, isProductionStatus)
      }
    } else {
      if (ownGoodsMode === 'STAMMDATEN') {
        if (!selectedBrandId || !selectedProductId || !selectedVariantId) {
          setError('Bitte Marke, Produkt und Variante aus Stammdaten wählen.')
          return
        }
        const brandName = masterBrands.find(x => x.id === selectedBrandId)?.name ?? ''
        const productName = masterProducts.find(x => x.id === selectedProductId)?.name ?? ''
        const sizeValue = masterSizes.find(x => x.id === selectedVariantId)?.groesse ?? ''
        if (!brandName || !productName || !selectedColor || !sizeValue) {
          setError('Stammdaten-Auswahl unvollständig.')
          return
        }
        setPositionBrand(brandName)
        setPositionModel(productName)
        setPositionColor(selectedColor)
        setPositionSize(sizeValue)
      } else {
        if (!positionBrand.trim() || !positionModel.trim() || !positionColor.trim() || !positionSize.trim()) {
          setError('Marke, Modell, Farbe und Größe sind erforderlich.')
          return
        }
      }
      setIsSaving(true)
      const { data, error } = await supabase
        .from('textil_positionen')
        .insert({
          teilauftrag_id: subOrderId,
          herkunft: 'EIGENWARE',
          typ: null,
          farbe: positionColor.trim(),
          stueckzahl: positionQuantity,
          marke: positionBrand.trim(),
          modell: positionModel.trim(),
          groesse: positionSize.trim(),
          variante_id: ownGoodsMode === 'STAMMDATEN' ? (selectedVariantId || null) : null,
        })
        .select('*')
        .single()
      setIsSaving(false)
      if (error) {
        setError(error.message)
        return
      }
      if (data) {
        const positionRow = data as TextilePositionRow
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
                bestand: sizeVariant.bestand,
                farbe: selectedColor,
                groesse: sizeVariant.groesse,
                ist_muster: sizeVariant.ist_muster,
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
              const { data: assignmentData, error: assignmentError } = await supabase
                .from('textil_zuordnungen')
                .insert({
                  teilauftrag_id: subOrder.id,
                  motiv_id: mid,
                  position_id: positionRow.id,
                })
                .select(ASSIGNMENT_EMBED_SELECT)
                .single()
              if (assignmentError) {
                await supabase.from('textil_zuordnungen').delete().eq('position_id', positionRow.id)
                await supabase.from('textil_positionen').delete().eq('id', positionRow.id)
                setPositions(positions)
                setAssignments(assignments)
                setError(assignmentInsertErrorMessage(assignmentError))
                resetPositionForm()
                setPositionMotifIds(prev => ({ ...prev, [NEW_POSITION_SLOT]: [] }))
                const isProductionStatus = subOrderRef.current.status === 'PRODUKTION_BEREIT' || subOrderRef.current.status === 'FERTIG'
                void syncSubOrder(motifs, positions, assignments, isProductionStatus)
                return
              }
              if (assignmentData) assignmentAccumulator = [...assignmentAccumulator, assignmentData as unknown as TextileAssignmentRow]
            }
            setAssignments(assignmentAccumulator)
          } finally {
            setIsSaving(false)
          }
        }

        setPositionMotifIds(prev => ({ ...prev, [NEW_POSITION_SLOT]: [] }))
        resetPositionForm()
        const isProductionStatus = subOrderRef.current.status === 'PRODUKTION_BEREIT' || subOrderRef.current.status === 'FERTIG'
        void syncSubOrder(motifs, nextPositions, assignmentAccumulator, isProductionStatus)
      }
    }
  }

  const deleteMotif = async (id: string) => {
    if (motifEditId === id) cancelMotifForm()
    setError(null)
    const { data: inUse, error: cErr } = await supabase
      .from('textil_zuordnungen')
      .select('id')
      .eq('motiv_id', id)
      .limit(1)
    if (cErr) {
      setError(cErr.message)
      return
    }
    if (inUse && inUse.length > 0) {
      setError('Motiv wird noch in einer Zuordnung verwendet.')
      return
    }
    setIsSaving(true)
    const { error } = await supabase.from('textil_motive').delete().eq('id', id)
    setIsSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    const remainingMotifs = motifs.filter(m => m.id !== id)
    setMotifs(remainingMotifs)
    const filteredAssignments = assignments.filter(z => z.motiv_id !== id)
    setAssignments(filteredAssignments)
    const isProductionStatus = subOrderRef.current.status === 'PRODUKTION_BEREIT' || subOrderRef.current.status === 'FERTIG'
    void syncSubOrder(remainingMotifs, positions, filteredAssignments, isProductionStatus)
  }

  const deletePosition = async (id: string) => {
    if (positionEditId === id) cancelPositionForm()
    setError(null)
    const { data: inUse, error: cErr } = await supabase
      .from('textil_zuordnungen')
      .select('id')
      .eq('position_id', id)
      .limit(1)
    if (cErr) {
      setError(cErr.message)
      return
    }
    if (inUse && inUse.length > 0) {
      setError('Position wird noch in einer Zuordnung verwendet.')
      return
    }
    setIsSaving(true)
    const { error } = await supabase.from('textil_positionen').delete().eq('id', id)
    setIsSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    const remainingPositions = positions.filter(p => p.id !== id)
    setPositions(remainingPositions)
    const filteredAssignments = assignments.filter(z => z.position_id !== id)
    setAssignments(filteredAssignments)
    const isProductionStatus = subOrderRef.current.status === 'PRODUKTION_BEREIT' || subOrderRef.current.status === 'FERTIG'
    void syncSubOrder(motifs, remainingPositions, filteredAssignments, isProductionStatus)
  }

  const deleteAssignment = async (id: string) => {
    setError(null)
    setIsSaving(true)
    const { error } = await supabase.from('textil_zuordnungen').delete().eq('id', id)
    setIsSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    const remainingAssignments = assignments.filter(z => z.id !== id)
    setAssignments(remainingAssignments)
    const isProductionStatus = subOrderRef.current.status === 'PRODUKTION_BEREIT' || subOrderRef.current.status === 'FERTIG'
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

  const shouldValidate = subOrderStatus !== 'ANGEBOT'

  return (
    <div className="ber-lfp" style={{ maxWidth: '100%' }}>
      <h3 className="ber-h3">Textil-Details</h3>
      {shouldValidate && customerMeetsPrepressContact(orderCustomer) === false && (
        <p className="ber-hinweis">Für Auto-PREPRESS: Kunde braucht Name und E-Mail oder Telefon.</p>
      )}
      {error && <p className="ber-err">{error}</p>}

      {loading && <p className="ber-hinweis" style={{ fontStyle: 'normal' }}>Lädt Textildaten …</p>}

      <div className="ber-lfp" style={{ borderTop: '1px solid var(--border)', marginTop: '0.5rem', paddingTop: '0.35rem' }}>
        <h3 className="ber-h3" style={{ marginTop: 0 }}>
          1. Motive
        </h3>
        <p className="ber-hinweis" style={{ fontStyle: 'normal', fontSize: '0.8rem' }}>
          {motifEditId ? 'Eintrag bearbeiten und speichern.' : 'Neues Motiv anlegen und mit + Hinzufügen speichern.'}
        </p>
        <form onSubmit={submitMotif}>
              <div className="ber-zeile">
                <span className="ber-lbl">Typ</span>
                <div className="ber-nmb">
                  <label>
                    <input type="radio" name="mtyp" checked={motifType === 'TEXT'} onChange={() => setMotifType('TEXT')} /> Text
                  </label>
                  <label>
                    <input type="radio" name="mtyp" checked={motifType === 'DATEI'} onChange={() => setMotifType('DATEI')} /> FileRecord
                  </label>
                </div>
              </div>
              {motifType === 'TEXT' && (
                <>
                  <div className="ber-zeile">
                    <label className="ber-lbl" htmlFor="tx-inh">
                      Inhalt
                    </label>
                    <input id="tx-inh" className="ber-inp" value={motifContent} onChange={e => setMotifContent(e.target.value)} />
                  </div>
                  <div className="ber-zeile">
                    <label className="ber-lbl" htmlFor="tx-fa">
                      Farbe
                    </label>
                    <input id="tx-fa" className="ber-inp" value={motifColor} onChange={e => setMotifColor(e.target.value)} />
                  </div>
                  <div className="ber-zeile">
                    <span className="ber-lbl">Schriftklasse</span>
                    <select
                      className="ber-inp"
                      value={motifFontClass}
                      onChange={e => setMotifFontClass(e.target.value as TextileFontClass)}
                    >
                      {FONT_CLASS_OPTIONS.map(s => (
                        <option key={s.v} value={s.v}>
                          {s.l}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="ber-zeile">
                    <label className="ber-lbl" htmlFor="tx-sa">
                      Schriftart
                    </label>
                    <input
                      id="tx-sa"
                      className="ber-inp"
                      placeholder="Konkrete Schriftart"
                      value={motifFontStyle}
                      onChange={e => setMotifFontStyle(e.target.value)}
                    />
                  </div>
                </>
              )}
              {motifType === 'DATEI' && (
                <div className="ber-zeile">
                  <span className="ber-lbl">FileRecord</span>
                  <div>
                    {orderFiles.length === 0 ? (
                      <p className="ber-hinweis" style={{ fontStyle: 'normal' }}>
                        Zuerst Dateien am Auftrag hinterlegen (Abschnitt &apos;Dateien dieses Auftrags&apos;).
                      </p>
                    ) : (
                      <select className="ber-inp" value={motifFileId} onChange={e => setMotifFileId(e.target.value)} required>
                        <option value="">—</option>
                        {orderFiles.map(d => (
                          <option key={d.id} value={d.id}>
                            {d.anzeigename}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              )}
              <div className="ber-zeile">
                <span className="ber-lbl">Platz</span>
                <select className="ber-inp" value={motifPlacement} onChange={e => setMotifPlacement(e.target.value as TextilePlacement)}>
                  {PLACEMENT_OPTIONS.map(p => (
                    <option key={p.v} value={p.v}>
                      {p.l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ber-zeile">
                <span className="ber-lbl">Größe</span>
                <div>
                  <select
                    className="ber-inp"
                    value={motifSizeType}
                    onChange={e => setMotifSizeType(e.target.value as TextileSize)}
                  >
                    {SIZE_OPTIONS.map(g => (
                      <option key={g} value={g}>
                        {g === 'FREI' ? 'Frei (mm)' : SIZE_LABELS[g as 'KLEIN' | 'MITTEL' | 'GROSS']}
                      </option>
                    ))}
                  </select>
                  {motifSizeType === 'FREI' && (
                    <input
                      className="ber-inp"
                      style={{ marginTop: 6, maxWidth: '14rem' }}
                      placeholder="z. B. 150x200"
                      value={motifSizeFree}
                      onChange={e => setMotifSizeFree(e.target.value)}
                    />
                  )}
                </div>
              </div>
              <div className="ber-zeile">
                <label className="ber-lbl" htmlFor="m-druckart">
                  Druckart
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
                    {motifEditId ? 'Speichern' : '+ Hinzufügen'}
                  </button>
                  {motifEditId && (
                    <button type="button" className="wa-ghost-btn" onClick={cancelMotifForm} disabled={isSaving || loading}>
                      Abbrechen
                    </button>
                  )}
                </div>
              </div>
            </form>
        <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.65rem', paddingTop: '0.5rem' }}>
          <p style={{ margin: '0 0 0.35rem', fontSize: '0.82rem', fontWeight: 600 }}>Bestehende Motive</p>
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
              Noch kein Motiv angelegt.
            </div>
          )}
          {motifs.map((m, idx) => (
            <div
              key={m.id}
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
                <strong>Motiv {idx + 1}</strong>
                <span style={{ opacity: 0.75 }}>|</span>
                <span>{m.typ}</span>
                <span style={{ opacity: 0.75 }}>|</span>
                <span>{placementLabel(String(m.platz ?? '')) || '—'}</span>
                <span style={{ opacity: 0.75 }}>|</span>
                <span>{sizeShortLabel(m.groesse ?? '—')}</span>
                <span style={{ opacity: 0.75 }}>|</span>
                <span>{m.druckart?.trim() ? m.druckart : '—'}</span>
                <button type="button" className="wa-ghost-btn" onClick={() => editMotif(m)} disabled={isSaving}>
                  Bearbeiten
                </button>
                <button type="button" className="wa-ghost-btn" onClick={() => void deleteMotif(m.id)} disabled={isSaving}>
                  Entfernen
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="ber-lfp" style={{ borderTop: '1px solid var(--border)' }}>
        <h3 className="ber-h3" style={{ marginTop: '0.35rem' }}>
          2. Textilien
        </h3>
        <p className="ber-hinweis" style={{ fontSize: '0.8rem' }}>
          {positionEditId ? 'Position bearbeiten und speichern.' : 'Neue Position anlegen.'} Eigenware: Jede Größe als eigene Position.
        </p>
        <form onSubmit={submitPosition}>
              <div className="ber-zeile">
                <span className="ber-lbl">Herkunft</span>
                <div className="ber-nmb">
                  <label>
                    <input
                      type="radio"
                      name="pH"
                      checked={positionOrigin === 'KUNDENWARE'}
                      onChange={() => setPositionOrigin('KUNDENWARE')}
                      disabled={positionEditId !== null}
                    />
                    {ORIGIN_LABELS.KUNDENWARE}
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="pH"
                      checked={positionOrigin === 'EIGENWARE'}
                      onChange={() => setPositionOrigin('EIGENWARE')}
                      disabled={positionEditId !== null}
                    />
                    {ORIGIN_LABELS.EIGENWARE}
                  </label>
                </div>
              </div>
              {positionOrigin === 'KUNDENWARE' && (
                <>
                  <div className="ber-zeile">
                    <span className="ber-lbl">Typ</span>
                    <select className="ber-inp" value={positionGarmentType} onChange={e => setPositionGarmentType(e.target.value as TextileCustomerGarmentType)}>
                      {GARMENT_TYPE_OPTIONS.map(x => (
                        <option key={x.v} value={x.v}>
                          {x.l}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="ber-zeile">
                    <label className="ber-lbl" htmlFor="px-fa">
                      Farbe
                    </label>
                    <input id="px-fa" className="ber-inp" value={positionColor} onChange={e => setPositionColor(e.target.value)} />
                  </div>
                </>
              )}
              {positionOrigin === 'EIGENWARE' && (
                <>
                  <div className="ber-zeile">
                    <span className="ber-lbl">Eigenware-Modus</span>
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
                        Aus Stammdaten wählen
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
                        Freitext (Artikel nicht in Stammdaten)
                      </label>
                    </div>
                  </div>

                  {ownGoodsMode === 'STAMMDATEN' && (
                    <>
                      <div className="ber-zeile">
                        <span className="ber-lbl">Marke</span>
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
                          {masterDataLoading && <p className="ber-hinweis">Lädt Stammdaten …</p>}
                        </div>
                      </div>

                      {selectedBrandId && (
                        <div className="ber-zeile">
                          <span className="ber-lbl">Produkt</span>
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
                                {p.artikelnummer ? ` (${p.artikelnummer})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {selectedProductId && (
                        <div className="ber-zeile">
                          <span className="ber-lbl">Farbe</span>
                          <div>
                            <select
                              className="ber-inp"
                              value={selectedColor}
                              onChange={e => {
                                const f = e.target.value
                                setSelectedColor(f)
                                setSelectedVariantId('')
                                if (f) {
                                  const brandName = masterBrands.find(x => x.id === selectedBrandId)?.name ?? ''
                                  const productName = masterProducts.find(x => x.id === selectedProductId)?.name ?? ''
                                  setPositionBrand(brandName)
                                  setPositionModel(productName)
                                  setPositionColor(f)
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
                                Auswahl: {positionBrand} · {positionModel} · {selectedColor}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {selectedProductId && selectedColor && (
                        <div className="ber-zeile">
                          <span className="ber-lbl">Größe</span>
                          <div>
                            <select
                              className="ber-inp"
                              value={selectedVariantId}
                              onChange={e => {
                                const variantId = e.target.value
                                setSelectedVariantId(variantId)
                                const selectedSize = masterSizes.find(x => x.id === variantId) ?? null
                                if (selectedSize) {
                                  setPositionSize(selectedSize.groesse)
                                } else {
                                  setPositionSize('')
                                }
                              }}
                              required
                            >
                              <option value="">—</option>
                              {masterSizes.map(v => (
                                <option key={v.id} value={v.id}>
                                  {(v.bestand ?? 0) <= 0 ? '⚠ ' : ''}
                                  {v.groesse} (Bestand: {v.bestand ?? 0}){v.ist_muster ? ' · Muster' : ''}
                                </option>
                              ))}
                            </select>
                            {selectedVariantId && (
                              <p
                                className="ber-hinweis"
                                style={{
                                  fontStyle: 'normal',
                                  color: (masterSizes.find(x => x.id === selectedVariantId)?.bestand ?? 0) <= 0 ? '#f59e0b' : undefined,
                                }}
                              >
                                Auswahl: {positionBrand} · {positionModel} · {selectedColor} · {positionSize}
                              </p>
                            )}
                            {!selectedVariantId && masterSizes.length > 0 && (
                              <p className="ber-hinweis" style={{ fontStyle: 'normal' }}>
                                Größe wählen (Pflicht)
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
                          Marke
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
                          Modell
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
                          Farbe
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
                          Größe
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
              {(positionOrigin !== 'EIGENWARE' || ownGoodsMode !== 'STAMMDATEN' || selectedVariantId) && (
                <div className="ber-zeile">
                  <label className="ber-lbl" htmlFor="px-st">
                    Stückzahl
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
                  <span className="ber-lbl">{slotIx === 0 ? 'Motiv zuordnen' : ''}</span>
                  <div>
                    <select
                      className="ber-inp"
                      value={slotVal}
                      onChange={e => {
                        const v = e.target.value
                        setPositionMotifIds(prev => {
                          const row = [...(prev[currentPositionSlotKey] ?? [''])]
                          row[slotIx] = v
                          return { ...prev, [currentPositionSlotKey]: row }
                        })
                      }}
                    >
                      <option value="">— Motiv wählen —</option>
                      {motifs.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.typ === 'TEXT'
                            ? (m.inhalt ?? 'Text-Motiv')
                            : `FileRecord-Motiv ${motifs.indexOf(m) + 1}`}
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
                  + weiteres Motiv
                </button>
              </div>
              <div className="ber-zeile">
                <span className="ber-lbl" />
                <div className="ber-nmb" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                  <button
                    type="submit"
                    className="wa-bereich-btn"
                    disabled={isSaving || loading || (positionOrigin === 'EIGENWARE' && ownGoodsMode === 'STAMMDATEN' && !selectedVariantId)}
                    title={positionOrigin === 'EIGENWARE' && ownGoodsMode === 'STAMMDATEN' && !selectedVariantId ? 'Bitte Größe wählen' : undefined}
                  >
                    {positionEditId ? 'Speichern' : '+ Hinzufügen'}
                  </button>
                  {positionEditId && (
                    <button type="button" className="wa-ghost-btn" onClick={cancelPositionForm} disabled={isSaving || loading}>
                      Abbrechen
                    </button>
                  )}
                </div>
              </div>
            </form>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {positions.map(p => (
            <li
              key={p.id}
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
                {p.herkunft === 'KUNDENWARE' ? 'KUNDE' : 'EIGEN'}
              </span>
              {p.herkunft === 'EIGENWARE' && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '0.12rem 0.4rem',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    background: p.variante_id ? '#dcfce7' : '#f1f5f9',
                    color: p.variante_id ? '#166534' : '#475569',
                  }}
                >
                  {p.variante_id ? 'Stammdaten' : 'Freitext'}
                </span>
              )}
              <span>
                {p.herkunft === 'KUNDENWARE' ? (
                  `${garmentTypeLabel(p.typ)} · ${p.farbe} · Stückzahl: ${p.stueckzahl}`
                ) : p.variante_id ? (
                  (() => {
                    const variantId = String(p.variante_id)
                    const variantInfo = variantInfoById.get(variantId)
                    const brand = variantInfo?.marke || (p.marke ?? '')
                    const productName = variantInfo?.produkt || (p.modell ?? '')
                    const color = variantInfo?.farbe || (p.farbe ?? '')
                    const size = variantInfo?.groesse || (p.groesse ?? '')
                    const stock = variantInfo ? variantInfo.bestand : null
                    return `${brand} ${productName} ${color} / ${size} · Bestand: ${stock == null ? '—' : stock} · Stückzahl: ${p.stueckzahl}`
                  })()
                ) : (
                  `${p.marke} ${p.modell} ${p.farbe} / ${p.groesse} · Stückzahl: ${p.stueckzahl}`
                )}
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                {assignments
                  .filter(z => z.position_id === p.id)
                  .map(z => {
                    const mo = motifs.find(m => m.id === z.motiv_id)
                    const lab =
                      mo?.typ === 'TEXT'
                        ? (mo.inhalt ?? 'Text-Motiv')
                        : mo
                          ? `FileRecord-Motiv ${motifs.indexOf(mo) + 1}`
                          : z.motiv_id
                    return (
                      <span
                        key={z.id}
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
                        <span>{lab}</span>
                        <button
                          type="button"
                          title="Zuordnung entfernen"
                          onClick={() => void deleteAssignment(z.id)}
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
              <button type="button" className="wa-ghost-btn" onClick={() => void editPosition(p)} disabled={isSaving}>
                Bearbeiten
              </button>
              <button type="button" className="wa-ghost-btn" onClick={() => void deletePosition(p.id)} disabled={isSaving}>
                Entfernen
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
