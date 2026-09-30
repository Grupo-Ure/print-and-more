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

/** Thrown when the deduction RPC rejects a release for insufficient stock. */
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
 * Stock consumption on release to production (the only point stock is consumed
 * — not on "mark done"). A release is now always a single product. The
 * requirements are collected client-side, where the product-type knowledge
 * lives next to the schemas; the deduction itself is booked atomically by the
 * `book_production_deductions` RPC (conditional decrement + AUTO_DEDUCTION
 * movement rows in one transaction), so concurrent releases can never lose an
 * update or drive stock negative.
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
   * Book the product's stock deductions atomically via the
   * `book_production_deductions` RPC. With `allowShortage: false` (normal
   * release) any shortage aborts the whole booking and raises
   * `InsufficientStockError`; with `allowShortage: true` (admin force release)
   * stock is floored at 0 and the movements record what was actually deducted.
   */
  async deductProductionStock(
    product: LoadedProduct,
    orderNumber: string | null,
    opts: { allowShortage?: boolean } = {},
  ): Promise<void> {
    const requirements = await this.collectStockRequirements(product)
    if (requirements.length === 0) return

    const { error } = await supabase.rpc('book_production_deductions', {
      deductions: requirements.map(r => ({ target: r.target, id: r.targetId, quantity: r.quantity })),
      note: 'Automatic on production release ' + (orderNumber ?? ''),
      allow_shortage: opts.allowShortage ?? false,
    })
    if (error) {
      if (error.message.includes('INSUFFICIENT_STOCK')) {
        let shortages: InsufficientStockError['shortages'] = []
        try {
          shortages = JSON.parse(error.details ?? '[]')
        } catch {
          // keep the empty list — the error itself is what matters
        }
        throw new InsufficientStockError(shortages)
      }
      throw error
    }
  }
}

export const productionReleaseService = new ProductionReleaseService()
