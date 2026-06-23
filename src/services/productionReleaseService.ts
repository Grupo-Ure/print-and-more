import { authService } from './authService'
import { stampService } from './stampService'
import { textileService } from './textileService'
import { textileMasterDataService } from './textileMasterDataService'
import { subOrderDetailToFieldMap } from '../lib/utils'
import type { SubOrderRow } from '../types/database'

/**
 * Automatic stock deduction booked when a sub-order is released to production
 * (the only point stock is consumed — not on "mark done"). Stamp: decrement the
 * stamp model and, if applicable, the matching replacement pad. Textile: decrement
 * each own-stock garment variant. Each deduction is logged as an `AUTO_DEDUCTION`
 * stock movement. Stock never goes below zero.
 */
export async function deductProductionStock(subOrder: SubOrderRow, orderNumber: string | null): Promise<void> {
  if (subOrder.department === 'STAMP') {
    const stampDetail = subOrderDetailToFieldMap(subOrder.detail)
    const rawQuantity = stampDetail.stueckzahl
    const parsedQuantity =
      typeof rawQuantity === 'number'
        ? rawQuantity
        : typeof rawQuantity === 'string' && rawQuantity.trim() !== ''
          ? parseInt(rawQuantity, 10)
          : 1
    const quantity = Number.isFinite(parsedQuantity) && parsedQuantity >= 1 ? Math.floor(parsedQuantity) : 1

    const stampNote = 'Automatic on production release ' + (orderNumber ?? '')

    const bookStampStockDeduction = async (modelId: string, quantity: number, note: string) => {
      const modelRow = await stampService.getStampModelById(modelId)
      if (!modelRow) return
      const currentStock = modelRow.stock ?? 0
      if (currentStock <= 0) return
      const newStock = Math.max(0, currentStock - quantity)
      await stampService.updateStampModelStock(modelId, newStock)
      const user = await authService.getUser()
      await stampService.createStockMovement({
        model_id: modelId,
        quantity,
        type: 'AUTO_DEDUCTION',
        note,
        user_id: user?.id ?? null,
      })
    }

    if (subOrder.type === 'TRODAT_PAD' && stampDetail.kissen_modell_id) {
      await bookStampStockDeduction(String(stampDetail.kissen_modell_id), quantity, stampNote)
    } else if (stampDetail.modell_id) {
      const stampId = String(stampDetail.modell_id)
      await bookStampStockDeduction(stampId, quantity, stampNote)

      const stampColor = stampDetail.farbe
      if (stampColor != null && String(stampColor).trim() !== '') {
        const stampModelRow = await stampService.getStampModelForOrder(stampId)
        if (stampModelRow) {
          const articleNumber = stampModelRow.replacement_pad_article_number?.trim() || null
          if (articleNumber) {
            const padRow = await stampService.findReplacementPad(articleNumber, String(stampColor))
            if (padRow) {
              const padCurrentStock = padRow.stock ?? 0
              if (padCurrentStock > 0) {
                await bookStampStockDeduction(padRow.id, quantity, stampNote + ' (Pad for stamp)')
              }
            }
          }
        }
      }
    }
  }

  if (subOrder.department === 'TEXTILE') {
    const textileNote = 'Automatic on production release ' + (orderNumber ?? '')
    const user = await authService.getUser()
    const userId = user?.id ?? null

    const garmentUsage = await textileService.getTextileGarmentStockUsageBySubOrder(subOrder.id)

    for (const usage of garmentUsage) {
      const variantId = usage.variant_id
      if (!variantId) continue
      const quantity = Number.isFinite(usage.quantity) && usage.quantity >= 1 ? Math.floor(usage.quantity) : 1

      const variantRow = await textileMasterDataService.getVariantStockById(variantId)
      const currentStock = variantRow?.stock ?? 0
      if (currentStock <= 0) continue

      const newStock = Math.max(0, currentStock - quantity)
      await textileMasterDataService.updateVariantStock(variantId, newStock)
      await textileMasterDataService.createTextileStockMovement({
        variant_id: variantId,
        quantity: quantity,
        type: 'AUTO_DEDUCTION',
        note: textileNote,
        user_id: userId,
      })
    }
  }
}
