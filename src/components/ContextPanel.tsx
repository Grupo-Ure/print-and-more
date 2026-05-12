import { useEffect, useState } from 'react'
import { authService } from '../services/authService'
import { historyService, type HistoryEvent } from '../services/historyService'
import { orderService } from '../services/orderService'
import { subOrderService } from '../services/subOrderService'
import { stampService } from '../services/stampService'
import { textileService } from '../services/textileService'
import { textileMasterDataService } from '../services/textileMasterDataService'
import { generateAndDownloadPdf } from '../lib/pdf/orderPdf'
import {
  subOrderDetailToFieldMap,
  type Auftrag,
  type OrderStatus,
  type CustomerContactJoin,
  type CustomerContactRow,
  type SubOrderRow,
} from '../types/database'
import { FileList } from './FileList'
import type { FileRow } from '../services/fileService'
import { HistoryPanel } from './HistoryPanel'
import { useToast } from './Toast'
import { isSubOrderComplete } from '../lib/subOrderShared'
import './ContextPanel.css'

type Props = {
  order: Auftrag | null
  activeSubOrder: SubOrderRow | null
  orderCustomer: CustomerContactJoin | null
  orderFiles: FileRow[]
  onOrderUpdated: (updatedOrder: Auftrag) => void
  onOrderDeleted: (auftragId: string) => void
  onSubOrderUpdated: (updatedSubOrder: SubOrderRow) => void
  onSubOrderRemoved: (id: string) => void
  onEditCustomer: () => void
  contextRefreshTick: number
  onFileChanged?: (newFileRow?: FileRow) => void | Promise<void>
}

function statusBadgeGlobal(status: OrderStatus): string {
  switch (status) {
    case 'QUOTE':
      return 'badge-grau'
    case 'INCOMPLETE':
      return 'badge-orange'
    case 'PREPRESS_READY':
      return 'badge-blau'
    case 'PRODUCTION_READY':
      return 'badge-lila'
    case 'DONE':
      return 'badge-gruen'
    case 'INVOICED':
      return 'badge-grau'
    default:
      return 'badge-grau'
  }
}

function nextEmergencyStatus(status: OrderStatus): OrderStatus {
  if (status === 'INVOICED') return status
  if (status === 'INCOMPLETE') return 'PREPRESS_READY'
  if (status === 'PREPRESS_READY') return 'PRODUCTION_READY'
  if (status === 'PRODUCTION_READY') return 'DONE'
  return status
}

function resolveCustomerContact(contact: CustomerContactJoin | null): CustomerContactRow | null {
  if (contact == null) return null
  return Array.isArray(contact) ? (contact[0] ?? null) : contact
}

function hasStampModelLinked(detail: Record<string, unknown>): boolean {
  const padModelId = detail.kissen_modell_id
  const stampModelId = detail.modell_id
  return !!(padModelId && String(padModelId).trim()) || !!(stampModelId && String(stampModelId).trim())
}

function isStampStockCritical(
  stampStock: number | null,
  padStock: number | null
): boolean {
  return (
    (stampStock !== null && stampStock === 0) ||
    (padStock !== null && padStock === 0)
  )
}

function completionBlockedHint(
  stampStock: number | null,
  padStock: number | null
): string {
  const stampIsZero = stampStock !== null && stampStock === 0
  const padIsZero = padStock !== null && padStock === 0
  if (stampIsZero && padIsZero) {
    return 'Fertigmeldung nicht möglich — Stempel- und Kissen-Bestand sind 0'
  }
  if (stampIsZero) return 'Fertigmeldung nicht möglich — Stempel-Bestand ist 0'
  if (padIsZero) return 'Fertigmeldung nicht möglich — Kissen-Bestand ist 0'
  return ''
}

function productionStockModalTitle(
  stampStock: number | null,
  padStock: number | null
): string {
  const stampIsZero = stampStock !== null && stampStock === 0
  const padIsZero = padStock !== null && padStock === 0
  if (stampIsZero && padIsZero) return 'Achtung: Stempel- und Kissen-Bestand sind 0'
  if (stampIsZero) return 'Achtung: Stempel-Bestand ist 0'
  if (padIsZero) return 'Achtung: Kissen-Bestand ist 0'
  return 'Achtung: Bestand ist 0'
}

type StampPadStock = { stampStock: number | null; padStock: number | null }

/** Anzeige im Status: Zahl oder „—“ bei unbekannt (z. B. Ladefehler). */
function stockDisplayValue(stock: number | null): string {
  return stock === null ? '—' : String(stock)
}

/**
 * Lädt Stempel- und/oder Kissen-`bestand` je nach verknüpftem Modell, Farbe und Auftragstyp.
 */
async function loadStampStock(detail: Record<string, unknown>): Promise<StampPadStock> {
  const hasStampModel = detail.modell_id && String(detail.modell_id).trim()
  const hasPadModel = detail.kissen_modell_id && String(detail.kissen_modell_id).trim()
  const colorValue = detail.farbe
  const colorSet = colorValue != null && String(colorValue).trim() !== ''

  async function fetchStockById(id: string): Promise<number | null> {
    const row = await stampService.getStampModelById(id).catch(() => null)
    if (!row) return null
    return row.bestand ?? 0
  }

  if (hasPadModel && !hasStampModel) {
    const padStockValue = await fetchStockById(String(detail.kissen_modell_id))
    return { stampStock: null, padStock: padStockValue }
  }

  let stampStockValue: number | null = null
  let padStockValue: number | null = null

  if (hasStampModel) {
    stampStockValue = await fetchStockById(String(detail.modell_id))
    if (colorSet) {
      const stampModelRow = await stampService.getStampModelForOrder(String(detail.modell_id)).catch(() => null)
      if (stampModelRow) {
        const articleNumber = stampModelRow.ersatzkissen_artikelnummer?.trim() || null
        if (articleNumber) {
          const padRow = await stampService.findReplacementPad(articleNumber, String(colorValue)).catch(() => null)
          padStockValue = padRow ? (padRow.bestand ?? 0) : 0
        }
      }
    }
  }

  return { stampStock: stampStockValue, padStock: padStockValue }
}

export function ContextPanel({
  order,
  activeSubOrder,
  orderCustomer,
  orderFiles,
  onOrderUpdated,
  onOrderDeleted,
  onSubOrderUpdated,
  onSubOrderRemoved,
  onEditCustomer,
  contextRefreshTick,
  onFileChanged = async () => {},
}: Props) {
  const [busy, setBusy] = useState(false)
  const [subOrderAreaList, setSubOrderAreaList] = useState<{ id: string; bereich: string }[]>([])
  const [cancelInProgress, setCancelInProgress] = useState(false)
  const [deleteInProgress, setDeleteInProgress] = useState(false)
  const [emergencyDialogOpen, setEmergencyDialogOpen] = useState(false)
  const [emergencyReason, setEmergencyReason] = useState('')
  const [dialogCustomerApprovalFile, setDialogCustomerApprovalFile] = useState(false)
  const [customerApprovalFileId, setCustomerApprovalFileId] = useState('')
  const [stampStock, setStampStock] = useState<number | null>(null)
  const [padStock, setPadStock] = useState<number | null>(null)
  const [productionStockZeroDialogOpen, setProductionStockZeroDialogOpen] = useState(false)
  const { fehler, erfolg } = useToast()

  useEffect(() => {
    if (!activeSubOrder || activeSubOrder.bereich !== 'STEMPEL') {
      setStampStock(null)
      setPadStock(null)
      return
    }
    const stampDetail = subOrderDetailToFieldMap(activeSubOrder.detail)
    let alive = true
    void loadStampStock(stampDetail)
      .then(stockResult => {
        if (alive) {
          setStampStock(stockResult.stampStock)
          setPadStock(stockResult.padStock)
        }
      })
      .catch((err: unknown) => console.error(err))
    return () => {
      alive = false
    }
  }, [activeSubOrder, contextRefreshTick])

  useEffect(() => {
    if (!order) {
      setSubOrderAreaList([])
      return
    }
    let alive = true
    void (async () => {
      try {
        const summaries = await subOrderService.getSubOrderSummariesForOrder(order.id).catch(() => null)
        if (!alive) return
        if (!summaries) {
          fehler('Daten konnten nicht geladen werden')
          setSubOrderAreaList([])
          return
        }
        setSubOrderAreaList(summaries)
      } catch (err: unknown) {
        if (alive) console.error(err)
      }
    })()
    return () => {
      alive = false
    }
  }, [order, contextRefreshTick, fehler])

  if (!order) {
    return (
      <div className="cp" style={{ padding: 0 }}>
        <p className="cp-hinweis">Wählen Sie links einen Auftrag.</p>
      </div>
    )
  }

  const subOrder = activeSubOrder
  const subOrderActive = subOrder && !subOrder.storniert
  const canDeleteOrder = order.status === 'QUOTE' || order.status === 'INCOMPLETE'
  const canCancelOrder = order.status !== 'QUOTE' && order.status !== 'INCOMPLETE'

  const handleInBearbeitung = async () => {
    if (busy || order.status !== 'QUOTE') return
    setBusy(true)
    try {
      await orderService.setOrderStatus(order.id, 'INCOMPLETE')
      await historyService.writeHistory({
        auftrag_id: order.id,
        ereignisart: 'IN_BEARBEITUNG_GENOMMEN',
      })
      const updated = await orderService.synchronizeOrderStatus(order.id)
      onOrderUpdated({ ...order, status: updated.status })
    } catch {
      fehler('Status konnte nicht geändert werden')
    } finally {
      setBusy(false)
    }
  }

  const handleArchiv = async () => {
    if (busy) return
    if (!window.confirm('Auftrag archivieren?\nEr wird aus der normalen Liste ausgeblendet.')) return
    setBusy(true)
    try {
      await orderService.archiveOrder(order.id)
      onOrderUpdated({ ...order, archiviert: true })
    } catch {
      fehler('Status konnte nicht geändert werden')
    } finally {
      setBusy(false)
    }
  }

  const handleAbrechnen = async () => {
    if (busy) return
    if (!window.confirm('Auftrag als abgerechnet markieren?\nEr wird aus der Liste ausgeblendet.')) return
    setBusy(true)
    try {
      await orderService.markOrderBilled(order.id)
      await historyService.writeHistory({
        auftrag_id: order.id,
        ereignisart: 'FERTIG_GEMELDET',
        meta: { abgerechnet_auftrag: true },
      })
      onOrderUpdated({ ...order, status: 'INVOICED', archiviert: true })
    } catch {
      fehler('Status konnte nicht geändert werden')
    } finally {
      setBusy(false)
    }
  }

  const handleAuftragStornieren = async () => {
    if (busy) return
    if (
      !window.confirm(
        'Auftrag stornieren? Alle Teilaufträge werden storniert und der Auftrag wird ausgeblendet.'
      )
    )
      return
    setBusy(true)
    try {
      await orderService.archiveOrderWithCancelledSubOrders(order.id)
      await historyService.writeHistory({ auftrag_id: order.id, ereignisart: 'STORNIERT' })
      onOrderUpdated({ ...order, archiviert: true })
    } catch {
      fehler('Status konnte nicht geändert werden')
    } finally {
      setBusy(false)
    }
  }

  const handleAuftragLoeschen = async () => {
    if (busy) return
    if (
      !window.confirm(
        'Auftrag endgültig löschen?\nAlle Teilaufträge und Dateien werden mitgelöscht.'
      )
    )
      return
    setBusy(true)
    try {
      await orderService.deleteOrder(order.id)
      onOrderDeleted(order.id)
    } catch {
      fehler('Status konnte nicht geändert werden')
    } finally {
      setBusy(false)
    }
  }

  const syncOrderStatusAfterSubOrderAction = async () => {
    const updated = await orderService.synchronizeOrderStatus(order.id)
    onOrderUpdated({ ...order, status: updated.status })
  }

  const handlePrepressFrei = async () => {
    if (busy || !subOrder || subOrder.status !== 'INCOMPLETE') return
    if (order.status === 'QUOTE') {
      fehler('Auftrag muss zuerst in Bearbeitung genommen werden')
      return
    }
    const isComplete = isSubOrderComplete(subOrder, subOrder.status)
    if (!isComplete) {
      fehler('Teilauftrag ist noch nicht vollständig ausgefüllt')
      return
    }
    setBusy(true)
    try {
      const data = await subOrderService.setSubOrderStatus(subOrder.id, 'PREPRESS_READY')
      await historyService.writeHistory({
        auftrag_id: order.id,
        teilauftrag_id: subOrder.id,
        ereignisart: 'PREPRESS_BEREIT_MANUELL',
      })
      onSubOrderUpdated(data as SubOrderRow)
      const pdfOk = await generateAndDownloadPdf(subOrder.id, order.id)
      if (!pdfOk) fehler('PDF konnte nicht erstellt werden')
      await syncOrderStatusAfterSubOrderAction()
    } catch {
      fehler('Status konnte nicht geändert werden')
    } finally {
      setBusy(false)
    }
  }

  const executeProductionRelease = async () => {
    if (busy || !subOrder || subOrder.status !== 'PREPRESS_READY') return
    if (subOrder.kundenfreigabe_erforderlich && !subOrder.kundenfreigabe_liegt_vor) return
    setBusy(true)
    try {
      // Stempel: Automatischer Lagerabgang (vor Status-Update).
      if (subOrder.bereich === 'STEMPEL') {
        const stampDetail = subOrderDetailToFieldMap(subOrder.detail)
        const rawQuantity = stampDetail.stueckzahl
        const parsedQuantity =
          typeof rawQuantity === 'number'
            ? rawQuantity
            : typeof rawQuantity === 'string' && rawQuantity.trim() !== ''
              ? parseInt(rawQuantity, 10)
              : 1
        const quantity = Number.isFinite(parsedQuantity) && parsedQuantity >= 1 ? Math.floor(parsedQuantity) : 1

        const stampNote = 'Automatisch bei Produktionsfreigabe ' + (order.auftragsnummer ?? '')

        const bookStampStockDeduction = async (modelId: string, quantity: number, note: string) => {
          const modelRow = await stampService.getStampModelById(modelId)
          if (!modelRow) return
          const currentStock = modelRow.bestand ?? 0
          if (currentStock <= 0) return
          const newStock = Math.max(0, currentStock - quantity)
          await stampService.updateStampModelStock(modelId, newStock)
          const user = await authService.getUser()
          await stampService.createStockMovement({
            modell_id: modelId,
            menge: quantity,
            typ: 'AUTOABGANG',
            notiz: note,
            person_id: user?.id ?? null,
          })
        }

        if (subOrder.typ === 'TRODAT_KISSEN' && stampDetail.kissen_modell_id) {
          await bookStampStockDeduction(String(stampDetail.kissen_modell_id), quantity, stampNote)
        } else if (stampDetail.modell_id) {
          const stampId = String(stampDetail.modell_id)
          await bookStampStockDeduction(stampId, quantity, stampNote)

          const stampColor = stampDetail.farbe
          if (stampColor != null && String(stampColor).trim() !== '') {
            const stampModelRow = await stampService.getStampModelForOrder(stampId)
            if (stampModelRow) {
              const articleNumber = stampModelRow.ersatzkissen_artikelnummer?.trim() || null
              if (articleNumber) {
                const padRow = await stampService.findReplacementPad(articleNumber, String(stampColor))
                if (padRow) {
                  const padCurrentStock = padRow.bestand ?? 0
                  if (padCurrentStock > 0) {
                    await bookStampStockDeduction(padRow.id, quantity, stampNote + ' (Kissen zu Stempel)')
                  }
                }
              }
            }
          }
        }
      }

      // Textil: Automatischer Lagerabgang (vor Status-Update).
      if (subOrder.bereich === 'TEXTIL') {
        const textileNote = 'Automatisch bei Produktionsfreigabe ' + (order.auftragsnummer ?? '')
        const user = await authService.getUser()
        const userId = user?.id ?? null

        const positionList = await textileService.getEigenwarePositionsBySubOrder(subOrder.id)

        for (const position of positionList) {
          const variantId = position.variante_id ? String(position.variante_id) : ''
          if (!variantId) continue
          const quantity = Number.isFinite(position.stueckzahl) && position.stueckzahl >= 1 ? Math.floor(position.stueckzahl) : 1

          const variantRow = await textileMasterDataService.getVariantStockById(variantId)
          const currentStock = variantRow?.bestand ?? 0
          if (currentStock <= 0) continue

          const newStock = Math.max(0, currentStock - quantity)
          await textileMasterDataService.updateVariantStock(variantId, newStock)
          await textileMasterDataService.createTextileStockMovement({
            variante_id: variantId,
            menge: quantity,
            typ: 'AUTOABGANG',
            notiz: textileNote,
            person_id: userId,
          })
        }
      }

      const data = await subOrderService.setSubOrderStatus(subOrder.id, 'PRODUCTION_READY')

      try {
        await historyService.writeHistory({
          auftrag_id: order.id,
          teilauftrag_id: subOrder.id,
          ereignisart: 'PRODUKTION_BEREIT_GESETZT',
        })
      } catch {
        console.error('Historie Produktion fehlgeschlagen')
      }

      onSubOrderUpdated(data)
      await syncOrderStatusAfterSubOrderAction()
    } catch {
      fehler('Status konnte nicht geändert werden')
    } finally {
      setBusy(false)
    }
  }

  const handleProduktionFrei = () => {
    if (busy || !subOrder || subOrder.status !== 'PREPRESS_READY') return
    if (subOrder.kundenfreigabe_erforderlich && !subOrder.kundenfreigabe_liegt_vor) return
    if (subOrder.bereich === 'STEMPEL') {
      if (isStampStockCritical(stampStock, padStock)) {
        setProductionStockZeroDialogOpen(true)
        return
      }
    }
    void executeProductionRelease()
  }

  const handleFertigMelden = async () => {
    if (busy || !subOrder || subOrder.status !== 'PRODUCTION_READY') return
    if (!window.confirm('Teilauftrag als fertig markieren?')) return
    setBusy(true)
    try {
      const data = await subOrderService.setSubOrderStatus(subOrder.id, 'DONE')
      await historyService.writeHistory({
        auftrag_id: order.id,
        teilauftrag_id: subOrder.id,
        ereignisart: 'FERTIG_GEMELDET',
      })
      onSubOrderUpdated(data)
      await syncOrderStatusAfterSubOrderAction()
    } catch {
      fehler('Status konnte nicht geändert werden')
    } finally {
      setBusy(false)
    }
  }

  const handleNotfallOeffnen = () => {
    if (busy || !subOrder) return
    if (subOrder.status === 'QUOTE' || subOrder.status === 'DONE') return
    setEmergencyReason('')
    setEmergencyDialogOpen(true)
  }

  const handleNotfallBestaetigt = async () => {
    if (busy || !subOrder) return
    const reason = emergencyReason.trim()
    if (!reason) {
      fehler('Bitte eine Begründung eingeben')
      return
    }
    const nextStatus = nextEmergencyStatus(subOrder.status)
    if (nextStatus === subOrder.status) {
      setEmergencyDialogOpen(false)
      return
    }
    setBusy(true)
    setEmergencyDialogOpen(false)
    try {
      const data = await subOrderService.setSubOrderEmergency(subOrder.id, {
        status: nextStatus,
        notfall_aktiv: true,
        notfall_begruendung: reason,
      })
      await historyService.writeHistory({
        auftrag_id: order.id,
        teilauftrag_id: subOrder.id,
        ereignisart: 'NOTFALL_AUSGELOEST',
        begruendung: reason,
      })
      onSubOrderUpdated(data)
      await syncOrderStatusAfterSubOrderAction()
    } catch {
      fehler('Status konnte nicht geändert werden')
    } finally {
      setBusy(false)
    }
  }

  const handleNotfallZurueck = async () => {
    if (busy || !subOrder || !subOrder.notfall_aktiv) return
    setBusy(true)
    try {
      const data = await subOrderService.setSubOrderEmergency(subOrder.id, {
        status: 'INCOMPLETE',
        notfall_aktiv: false,
        notfall_begruendung: null,
      })
      await historyService.writeHistory({
        auftrag_id: order.id,
        teilauftrag_id: subOrder.id,
        ereignisart: 'RUECKSPRUNG',
      })
      onSubOrderUpdated(data)
      await syncOrderStatusAfterSubOrderAction()
    } catch {
      fehler('Status konnte nicht geändert werden')
    } finally {
      setBusy(false)
    }
  }

  const handleCustomerApprovalToggle = async (enabled: boolean) => {
    if (busy || !subOrder) return
    if (subOrder.status === 'QUOTE') return
    setBusy(true)
    try {
      const approvalPatch = enabled
        ? { kundenfreigabe_erforderlich: true }
        : {
            kundenfreigabe_erforderlich: false,
            kundenfreigabe_liegt_vor: false,
            kundenfreigabe_datei_id: null,
          }
      const data = await subOrderService.setCustomerApproval(subOrder.id, approvalPatch)
      // DB-Enum hat kein KUNDENFREIGABE_DEAKTIVIERT; bei Abschaltung der Anforderung VERFALLEN als nächstliegender Wert.
      const historyEvent: HistoryEvent = enabled ? 'KUNDENFREIGABE_AKTIVIERT' : 'KUNDENFREIGABE_VERFALLEN'
      await historyService.writeHistory({
        auftrag_id: order.id,
        teilauftrag_id: subOrder.id,
        ereignisart: historyEvent,
        meta: { aktiv: enabled } as unknown as Record<string, unknown>,
      })
      onSubOrderUpdated(data)
      await syncOrderStatusAfterSubOrderAction()
    } catch {
      fehler('Status konnte nicht geändert werden')
    } finally {
      setBusy(false)
    }
  }

  const handleCustomerApprovalFileOpen = () => {
    if (busy || !subOrder) return
    setCustomerApprovalFileId(orderFiles[0]?.id ?? '')
    setDialogCustomerApprovalFile(true)
  }

  const handleCustomerApprovalFileConfirmed = async () => {
    if (busy || !subOrder || !customerApprovalFileId) return
    setBusy(true)
    setDialogCustomerApprovalFile(false)
    try {
      const data = await subOrderService.setCustomerApproval(subOrder.id, {
        kundenfreigabe_liegt_vor: true,
        kundenfreigabe_datei_id: customerApprovalFileId,
      })
      await historyService.writeHistory({
        auftrag_id: order.id,
        teilauftrag_id: subOrder.id,
        ereignisart: 'KUNDENFREIGABE_ERTEILT',
        meta: { datei_id: customerApprovalFileId } as unknown as Record<string, unknown>,
      })
      onSubOrderUpdated(data)
      await syncOrderStatusAfterSubOrderAction()
      erfolg('Freigabe erteilt')
    } catch {
      fehler('Status konnte nicht geändert werden')
    } finally {
      setBusy(false)
    }
  }

  const handleStorno = async () => {
    if (!subOrder || cancelInProgress) return
    if (!window.confirm('Teilauftrag stornieren? Er wird ausgeblendet, aber nicht gelöscht.')) return
    setCancelInProgress(true)
    try {
      await subOrderService.cancelSubOrder(subOrder.id)
      onSubOrderRemoved(subOrder.id)
      try {
        await syncOrderStatusAfterSubOrderAction()
      } catch {
        fehler('Status konnte nicht geändert werden')
      }
    } catch {
      fehler('Status konnte nicht geändert werden')
    } finally {
      setCancelInProgress(false)
    }
  }

  const handleLoeschen = async () => {
    if (!subOrder || deleteInProgress || subOrder.status !== 'INCOMPLETE') return
    if (!window.confirm('Teilauftrag endgültig löschen?')) return
    setDeleteInProgress(true)
    try {
      await subOrderService.deleteSubOrder(subOrder.id)
      onSubOrderRemoved(subOrder.id)
      try {
        await syncOrderStatusAfterSubOrderAction()
      } catch {
        fehler('Status konnte nicht geändert werden')
      }
    } catch {
      fehler('Status konnte nicht geändert werden')
    } finally {
      setDeleteInProgress(false)
    }
  }

  const prodDisabled =
    !!subOrder && subOrder.status === 'PREPRESS_READY' && subOrder.kundenfreigabe_erforderlich && !subOrder.kundenfreigabe_liegt_vor
  const currentStampDetail = subOrder? subOrderDetailToFieldMap(subOrder.detail) : {}
  const completionBlockedByStock =
    !!subOrder &&
    subOrder.bereich === 'STEMPEL' &&
    subOrder.status === 'PRODUCTION_READY' &&
    hasStampModelLinked(currentStampDetail) &&
    isStampStockCritical(stampStock, padStock)
  const emergencyVisible =
    subOrder && subOrder.status !== 'QUOTE' && subOrder.status !== 'DONE' && nextEmergencyStatus(subOrder.status) !== subOrder.status
  const customerApprovalGrantVisible =
    !!subOrder &&
    subOrder.kundenfreigabe_erforderlich &&
    !subOrder.kundenfreigabe_liegt_vor &&
    orderFiles.length > 0

  const hints: string[] = []
  if (subOrder && subOrder.kundenfreigabe_erforderlich && !subOrder.kundenfreigabe_liegt_vor) {
    hints.push('Kundenfreigabe fehlt — Produktion blockiert')
  }
  if (subOrder?.notfall_aktiv) {
    hints.push(`Notfall aktiv: ${subOrder.notfall_begruendung ?? '—'}`)
  }
  if (subOrder && subOrder.status === 'PREPRESS_READY' && !subOrder.kundenfreigabe_erforderlich) {
    hints.push('Bereit zur Produktionsfreigabe')
  }
  if (order.status === 'DONE') {
    hints.push('Auftrag abgeschlossen')
  }

  return (
    <div className="cp">
      <div className="cp-sektion">
        <h2>Status</h2>
        <div className="cp-status-komp">
          {subOrder && (
            <div className="cp-st-zeile">
              <span className={`badge ${statusBadgeGlobal(subOrder.status)} cp-badge-lg`}>{subOrder.status}</span>
            </div>
          )}
          {subOrder?.notfall_aktiv && (
            <div className="cp-st-notfall">
              <span className="badge badge-rot cp-badge-lg">!! NOTFALL !!</span>
              {subOrder.notfall_begruendung && (
                <p className="cp-hinweis cp-hinweis--komp">{subOrder.notfall_begruendung}</p>
              )}
            </div>
          )}
          {subOrder?.bereich === 'STEMPEL' && hasStampModelLinked(currentStampDetail) && (
            <p className="cp-hinweis cp-hinweis--komp" style={{ marginTop: 6 }}>
              Lager: Stempel {stockDisplayValue(stampStock)} · Kissen {stockDisplayValue(padStock)}
            </p>
          )}
        </div>
      </div>
      {(() => {
        const customerContact = resolveCustomerContact(orderCustomer)
        if (!customerContact) return null
        const street = customerContact.strasse?.trim()
        const houseNumber = customerContact.hausnummer?.trim()
        const postalCode = customerContact.plz?.trim()
        const city = customerContact.ort?.trim()
        const addressLine1 = [street, houseNumber].filter(Boolean).join(' ')
        const addressLine2 = [postalCode, city].filter(Boolean).join(' ')
        if (!addressLine1 && !addressLine2) return null
        return (
          <div className="cp-sektion">
            <h2>Kunde</h2>
            {addressLine1 ? (
              <p className="cp-hinweis cp-hinweis--komp" style={{ margin: '0 0 4px' }}>
                {addressLine1}
              </p>
            ) : null}
            {addressLine2 ? <p className="cp-hinweis cp-hinweis--komp" style={{ margin: 0 }}>{addressLine2}</p> : null}
          </div>
        )
      })()}
      <div className="cp-sektion">
        <h2>Aktionen</h2>
        <div className="cp-gruppe">
          {order.status === 'QUOTE' && (
            <button
              type="button"
              className="cp-btn"
              disabled={busy}
              onClick={() => void handleInBearbeitung()}
            >
              In Bearbeitung nehmen
            </button>
          )}
          {order.status === 'QUOTE' && (
            <button type="button" className="cp-btn" disabled={busy} onClick={onEditCustomer}>
              Kunde bearbeiten
            </button>
          )}
          {order.status === 'DONE' && (
            <button type="button" className="cp-btn" disabled={busy} onClick={() => void handleAbrechnen()}>
              Abrechnen
            </button>
          )}
          {order.status !== 'INVOICED' && (
            <button type="button" className="cp-btn" disabled={busy} onClick={() => void handleArchiv()}>
              Archivieren
            </button>
          )}
          {canCancelOrder && (
            <button
              type="button"
              className="cp-btn cp-btn-rot"
              disabled={busy}
              onClick={() => void handleAuftragStornieren()}
            >
              Auftrag stornieren
            </button>
          )}
          {canDeleteOrder && (
            <button
              type="button"
              className="cp-btn cp-btn-rot"
              disabled={busy}
              onClick={() => void handleAuftragLoeschen()}
            >
              Auftrag löschen
            </button>
          )}
        </div>

        {subOrderActive && (
          <>
            <div className="cp-gruppe-trenn" />
            <div className="cp-gruppe">
              {subOrder.status === 'INCOMPLETE' && order.status !== 'QUOTE' && (
                <button
                  type="button"
                  className="cp-btn"
                  disabled={busy}
                  onClick={() => void handlePrepressFrei()}
                >
                  Prepress freigeben
                </button>
              )}
              {subOrder.status === 'PREPRESS_READY' && (
                <>
                  <button
                    type="button"
                    className="cp-btn"
                    disabled={busy || prodDisabled}
                    onClick={() => void handleProduktionFrei()}
                  >
                    Produktion freigeben
                  </button>
                  {prodDisabled && <p className="cp-sublabel">Kundenfreigabe fehlt</p>}
                </>
              )}
              {subOrder.status === 'PRODUCTION_READY' && (
                <>
                  <button
                    type="button"
                    className="cp-btn"
                    disabled={busy || completionBlockedByStock}
                    onClick={() => void handleFertigMelden()}
                  >
                    Als fertig melden
                  </button>
                  {completionBlockedByStock && (
                    <p className="cp-sublabel">
                      {completionBlockedHint(stampStock, padStock)}
                    </p>
                  )}
                </>
              )}
              {subOrderActive && subOrder.status !== 'QUOTE' && (
                <button
                  type="button"
                  className="cp-btn cp-btn-grau"
                  disabled={busy}
                  onClick={() =>
                    void (async () => {
                      const ok = await generateAndDownloadPdf(subOrder.id, order.id)
                      if (!ok) fehler('PDF konnte nicht erstellt werden')
                    })()
                  }
                >
                  PDF laden
                </button>
              )}
            </div>
            <div className="cp-gruppe-trenn" />
            <div className="cp-gruppe">
              {emergencyVisible && (
                <button
                  type="button"
                  className="cp-btn cp-btn-rot"
                  disabled={busy}
                  onClick={handleNotfallOeffnen}
                >
                  Notfall
                </button>
              )}
              {subOrder.notfall_aktiv && (
                <button
                  type="button"
                  className="cp-btn"
                  disabled={busy}
                  onClick={() => void handleNotfallZurueck()}
                >
                  Notfall zurücknehmen
                </button>
              )}
              {subOrder.status !== 'QUOTE' && (
                <label className="cp-toggle">
                  <input
                    type="checkbox"
                    checked={subOrder.kundenfreigabe_erforderlich}
                    disabled={busy}
                    onChange={e => void handleCustomerApprovalToggle(e.target.checked)}
                  />
                  <span>Kundenfreigabe erforderlich</span>
                </label>
              )}
              {customerApprovalGrantVisible && (
                <button type="button" className="cp-btn" disabled={busy} onClick={handleCustomerApprovalFileOpen}>
                  Kundenfreigabe erteilen
                </button>
              )}
            </div>
            <div className="cp-gruppe-trenn" />
            <div className="cp-gruppe cp-gruppe--admin">
              <button
                type="button"
                className="cp-btn cp-btn-grau"
                disabled={cancelInProgress}
                onClick={() => void handleStorno()}
              >
                Teilauftrag stornieren
              </button>
              <button
                type="button"
                className="cp-btn cp-btn-rot"
                disabled={subOrder.status !== 'INCOMPLETE' || deleteInProgress}
                onClick={() => void handleLoeschen()}
              >
                Teilauftrag löschen
              </button>
              {subOrder.status !== 'INCOMPLETE' && (
                <p className="cp-sublabel">Nur löschbar im Status Unvollständig</p>
              )}
            </div>
          </>
        )}
        {order && (
          <FileList
            activeOrderId={order.id}
            files={orderFiles}
            filesLoading={false}
            onFileChanged={onFileChanged}
          />
        )}
      </div>

      {hints.length > 0 && (
        <div className="cp-sektion">
          <h2>Hinweise</h2>
          {hints.map((hint, i) => (
            <p key={i} className="cp-hinweis">
              {hint}
            </p>
          ))}
        </div>
      )}

      <div className="cp-sektion">
        <div className="cp-gruppe" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className="cp-btn cp-btn-grau"
            onClick={() => window.open('/bestandspflege', '_blank')}
            title="Stempel-Bestandspflege öffnen"
          >
            Bestandspflege ↗
          </button>
          <button
            type="button"
            className="cp-btn cp-btn-grau"
            onClick={() => window.open('/textil-bestand', '_blank')}
            title="Textil-Bestand öffnen"
          >
            Textil-Bestand ↗
          </button>
        </div>
      </div>

      <HistoryPanel
        activeOrderId={order.id}
        contextRefreshTick={contextRefreshTick}
        subOrders={subOrderAreaList}
      />

      {emergencyDialogOpen && subOrder && (
        <div
          className="cp-modal-bg"
          role="dialog"
          aria-modal="true"
          aria-label="Notfall"
        >
          <div className="cp-modal">
            <h3>Notfall</h3>
            <p className="cp-hinweis">Begründung (Pflicht). Der Status wird eine Stufe weitergesetzt.</p>
            <textarea
              className="cp-textarea"
              rows={3}
              value={emergencyReason}
              onChange={e => setEmergencyReason(e.target.value)}
              placeholder="Begründung …"
            />
            <div className="cp-modal-bar">
              <button type="button" className="cp-btn" onClick={() => setEmergencyDialogOpen(false)}>
                Abbrechen
              </button>
              <button
                type="button"
                className="cp-btn"
                disabled={!emergencyReason.trim() || busy}
                onClick={() => void handleNotfallBestaetigt()}
              >
                Bestätigen
              </button>
            </div>
          </div>
        </div>
      )}

      {productionStockZeroDialogOpen && subOrder && (
        <div
          className="cp-modal-bg"
          role="dialog"
          aria-modal="true"
          aria-label="Bestand"
        >
          <div className="cp-modal">
            <h3>{productionStockModalTitle(stampStock, padStock)}</h3>
            <p className="cp-hinweis">Trotzdem auf Produktion setzen?</p>
            <div className="cp-modal-bar">
              <button type="button" className="cp-btn" onClick={() => setProductionStockZeroDialogOpen(false)}>
                Abbrechen
              </button>
              <button
                type="button"
                className="cp-btn"
                disabled={busy}
                onClick={() => {
                  setProductionStockZeroDialogOpen(false)
                  void executeProductionRelease()
                }}
              >
                Trotzdem freigeben
              </button>
            </div>
          </div>
        </div>
      )}

      {dialogCustomerApprovalFile && subOrder && (
        <div
          className="cp-modal-bg"
          role="dialog"
          aria-modal="true"
          aria-label="Kundenfreigabe"
        >
          <div className="cp-modal">
            <h3>Kundenfreigabe erteilen</h3>
            <p className="cp-hinweis">FileRow wählen:</p>
            <select
              className="cp-select"
              value={customerApprovalFileId}
              onChange={e => setCustomerApprovalFileId(e.target.value)}
            >
              {orderFiles.map(d => (
                <option key={d.id} value={d.id}>
                  {d.anzeigename}
                </option>
              ))}
            </select>
            <div className="cp-modal-bar">
              <button type="button" className="cp-btn" onClick={() => setDialogCustomerApprovalFile(false)}>
                Abbrechen
              </button>
              <button
                type="button"
                className="cp-btn"
                disabled={!customerApprovalFileId || busy}
                onClick={() => void handleCustomerApprovalFileConfirmed()}
              >
                Bestätigen
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
