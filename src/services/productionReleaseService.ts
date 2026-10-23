import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { stampService } from './stampService'
import { textileService } from './textileService'
import type { LoadedProduct } from '../types/product'

/** One stock target a product's release will deduct from. */
export type StockRequirement = {
  /** The product being released (pad deductions carry their stamp product's id). */
  productId: string
  /** For a textile batch: the `textile_garments` line this came from, so the grid can highlight it. */
  lineId?: string
  target: 'STAMP' | 'TEXTILE'
  /** stamp_models.id or textile_variants.id */
  targetId: string
  quantity: number
}

/** A requirement whose target has less stock than required. */
export type StockShortage = {
  productId: string
  lineId?: string
  target: 'STAMP' | 'TEXTILE'
  targetId: string
  targetLabel: string
  required: number
  available: number
}

/** Thrown when the release RPC rejects a release for insufficient stock. */
export class InsufficientStockError extends Error {
  shortages: { target: string; id: string; required: number; available: number }[]

  constructor(shortages: { target: string; id: string; required: number; available: number }[]) {
    super('Not enough stock to release this product to production')
    this.name = 'InsufficientStockError'
    this.shortages = shortages
  }
}

const floorQuantity = (raw: number | null | undefined): number =>
  Number.isFinite(raw) && (raw as number) >= 1 ? Math.floor(raw as number) : 1

/**
 * The release to production (the only point stock is consumed — not on "mark
 * done"). The release itself is the database's: `release_to_production` and
 * `force_release_to_production` check the gates, book the deductions
 * (`fn_production_deductions` + `book_production_deductions`, conditional
 * decrements and AUTO_DEDUCTION movements in one transaction) and move the
 * product. The requirements and shortages are still computed here, as the
 * database computes them, for what the app shows before a release: the
 * banner, the size grid, the approval request's stock warning.
 */
class ProductionReleaseService {
  /**
   * The stock deductions this product's release would book. Pure read —
   * nothing is written.
   *
   * STAMP: a model stamp deducts its stamp model plus, for a catalog ink
   * colour, the matching replacement pad; a TRODAT_PAD product deducts its pad
   * variant. Other stamp types have no `stamp_models` reference.
   * TEXTILE: every shop-supplied garment line with a catalog variant deducts
   * that variant by the line's own quantity.
   */
  async collectStockRequirements(product: LoadedProduct): Promise<StockRequirement[]> {
    const requirements: StockRequirement[] = []

    if (product.department === 'STAMP' && 'child' in product) {
      const quantity = floorQuantity(product.quantity)

      if (product.type === 'TRODAT_PRINTY' || product.type === 'WOODEN_STAMP') {
        const { model_id: modelId, color } = product.child
        if (!modelId) return requirements
        requirements.push({ productId: product.id, target: 'STAMP', targetId: modelId, quantity })

        // Model stamps ship with a pad in the chosen ink colour: deduct the
        // matching replacement pad too. 'OTHER' has no catalog pad.
        if (color && color !== 'OTHER') {
          const stampModelRow = await stampService.getStampModelForOrder(modelId)
          const articleNumber = stampModelRow?.replacement_pad_article_number?.trim() || null
          if (articleNumber) {
            const padRow = await stampService.findReplacementPad(articleNumber, color)
            if (padRow) {
              requirements.push({ productId: product.id, target: 'STAMP', targetId: padRow.id, quantity })
            }
          }
        }
      } else if (product.type === 'TRODAT_PAD') {
        const { pad_variant_id: padVariantId } = product.child
        if (padVariantId) {
          requirements.push({ productId: product.id, target: 'STAMP', targetId: padVariantId, quantity })
        }
      }
      // Other stamp types (custom-made stamps, plates, refill ink, loose ink
      // pads) have no stamp_models reference — nothing to deduct.
    }

    if (product.department === 'TEXTILE' && 'garments' in product) {
      for (const line of product.garments) {
        if (line.origin !== 'SHOP_SUPPLIED' || !line.variant_id) continue
        requirements.push({
          productId: product.id,
          lineId: line.id,
          target: 'TEXTILE',
          targetId: line.variant_id,
          quantity: floorQuantity(line.quantity),
        })
      }
    }

    return requirements
  }

  /**
   * Compare the product's stock requirements against current stock and return
   * the shortages (empty array = releasable). Requirements hitting the same
   * target are summed before comparing; every contributing line is reported so
   * the UI can highlight each affected row.
   */
  async checkStockAvailability(product: LoadedProduct): Promise<StockShortage[]> {
    const requirements = await this.collectStockRequirements(product)
    if (requirements.length === 0) return []

    const stampIds = [...new Set(requirements.filter(r => r.target === 'STAMP').map(r => r.targetId))]
    const textileIds = [...new Set(requirements.filter(r => r.target === 'TEXTILE').map(r => r.targetId))]

    const [stampRows, textileRows] = await Promise.all([
      stampService.getStampModelStocksByIds(stampIds),
      textileIds.length > 0 ? textileService.getVariantsByIds(textileIds) : Promise.resolve([]),
    ])

    const stockByTarget = new Map<string, { label: string; stock: number }>()
    for (const row of stampRows) stockByTarget.set(row.id, { label: row.name, stock: row.stock ?? 0 })
    for (const row of textileRows) {
      const label = [row.textile_models?.name, row.color, row.size].filter(Boolean).join(' ')
      // textile availability excludes declared samples, mirroring the RPC
      stockByTarget.set(row.id, { label, stock: (row.stock ?? 0) - row.sample_stock })
    }

    const requiredByTarget = new Map<string, number>()
    for (const r of requirements) {
      requiredByTarget.set(r.targetId, (requiredByTarget.get(r.targetId) ?? 0) + r.quantity)
    }

    return requirements
      .filter(r => (stockByTarget.get(r.targetId)?.stock ?? 0) < (requiredByTarget.get(r.targetId) ?? 0))
      .map(r => ({
        productId: r.productId,
        lineId: r.lineId,
        target: r.target,
        targetId: r.targetId,
        targetLabel: stockByTarget.get(r.targetId)?.label ?? r.targetId,
        required: requiredByTarget.get(r.targetId) ?? r.quantity,
        available: stockByTarget.get(r.targetId)?.stock ?? 0,
      }))
  }

  /**
   * Release the product to production through the `release_to_production`
   * RPC, which checks every gate (pre-press, completeness, the newest approval
   * round, stock), books the deductions and moves the product in one
   * transaction. A shortage aborts it as `InsufficientStockError` — a
   * concurrent release may have taken the stock the banner still counted.
   */
  async release(productId: string): Promise<void> {
    const { error } = await supabase.rpc('release_to_production', { product_id: productId })
    if (error) throw toReleaseError(error)
  }

  /**
   * The admin override: `force_release_to_production` skips completeness,
   * stock and a newest round that came back without an approval, floors short
   * stock at 0 and records the reason as an EMERGENCY_TRIGGERED entry. Never
   * for a product still waiting for the customer.
   */
  async forceRelease(productId: string, reason: string): Promise<void> {
    const { error } = await supabase.rpc('force_release_to_production', { product_id: productId, reason })
    if (error) throw error
  }
}

/** The release RPC's refusal for a shortage carries the short targets as its detail. */
function toReleaseError(error: PostgrestError): Error {
  if (!error.message.includes('INSUFFICIENT_STOCK')) return error
  let shortages: InsufficientStockError['shortages'] = []
  try {
    shortages = JSON.parse(error.details ?? '[]')
  } catch {
    // keep the empty list — the error itself is what matters
  }
  return new InsufficientStockError(shortages)
}

export const productionReleaseService = new ProductionReleaseService()
