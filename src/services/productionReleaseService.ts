import { authService } from './authService'
import { stampService } from './stampService'
import { textileService } from './textileService'
import { textileMasterDataService } from './textileMasterDataService'
import { departmentProductService } from './departmentProductService'
import type { JobRow } from '../types/database'

/**
 * Automatic stock deduction booked when a job is released to production
 * (the only point stock is consumed — not on "mark done"). Stamp: per product,
 * decrement the referenced stamp model and, for model stamps with an ink
 * colour, the matching replacement pad. Textile: decrement each own-stock
 * garment variant. Each deduction is logged as an `AUTO_DEDUCTION` stock
 * movement. Stock never goes below zero.
 */
export async function deductProductionStock(job: JobRow, orderNumber: string | null): Promise<void> {
  if (job.department === 'STAMP') {
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

    const products = await departmentProductService.getProductsByJobId(job.id)
    for (const product of products) {
      const rawQuantity = product.quantity ?? 1
      const quantity = Number.isFinite(rawQuantity) && rawQuantity >= 1 ? Math.floor(rawQuantity) : 1

      if (product.type === 'TRODAT_PRINTY' || product.type === 'WOODEN_STAMP') {
        const { model_id: modelId, color } = product.child
        if (!modelId) continue
        await bookStampStockDeduction(modelId, quantity, stampNote)

        // Model stamps ship with a pad in the chosen ink colour: deduct the
        // matching replacement pad too. 'OTHER' has no catalog pad.
        if (color && color !== 'OTHER') {
          const stampModelRow = await stampService.getStampModelForOrder(modelId)
          const articleNumber = stampModelRow?.replacement_pad_article_number?.trim() || null
          if (articleNumber) {
            const padRow = await stampService.findReplacementPad(articleNumber, color)
            if (padRow && (padRow.stock ?? 0) > 0) {
              await bookStampStockDeduction(padRow.id, quantity, stampNote + ' (Pad for stamp)')
            }
          }
        }
      } else if (product.type === 'TRODAT_PAD') {
        const { pad_variant_id: padVariantId } = product.child
        if (!padVariantId) continue
        await bookStampStockDeduction(padVariantId, quantity, stampNote)
      }
      // Other stamp types (custom-made stamps, plates, refill ink, loose ink
      // pads) have no stamp_models reference — nothing to deduct.
    }
  }

  if (job.department === 'TEXTILE') {
    const textileNote = 'Automatic on production release ' + (orderNumber ?? '')
    const user = await authService.getUser()
    const userId = user?.id ?? null

    const garmentUsage = await textileService.getTextileGarmentStockUsageByJob(job.id)

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
