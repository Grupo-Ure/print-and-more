/**
 * Textile product schema — one `type`, `TEXTILE_GARMENT`: a **batch**.
 *
 * Textile is the one department whose product is not a single line. One batch
 * carries many garment lines (`d.garments` → `textile_garments`, one per model
 * × colour × size with its own quantity) and the designs applied to all of
 * them (`d.designs` → `textile_designs`, one per placement). The parent's
 * `quantity` stays null — the batch total is the sum of its lines — so unlike
 * every other schema this one emits no `quantity`.
 *
 * Origin is an in-schema branch: SHOP_SUPPLIED is either a catalog variant
 * (`variant_id`, stock-tracked) or free text (brand/model/colour/size, tracked
 * by nothing); CUSTOMER_SUPPLIED is the customer's own garment (garment_type +
 * colour). A design is either a linked order file (type FILE) or typed-out
 * text (type TEXT); the two are exclusive, matching the CHECKs on the table.
 */

import { z } from 'zod'
import type { TablesInsert } from '../../../types/supabase'
import { loose, parseEnum, parseRequiredString, isValidQuantity, qtyOut, strOut } from './_shared'

type Vals = Record<string, unknown>

const TEXTILE_ORIGINS = ['SHOP_SUPPLIED', 'CUSTOMER_SUPPLIED'] as const
const DESIGN_TYPES = ['TEXT', 'FILE'] as const
const FONT_CLASSES = ['SANS_SERIF', 'SERIF', 'ELEGANT', 'PLAYFUL'] as const

type GarmentLine = Omit<TablesInsert<'textile_garments'>, 'id' | 'product_id' | 'created_at'>
type DesignRow = Omit<TablesInsert<'textile_designs'>, 'id' | 'product_id' | 'created_at'>

/** Maps one flat garment row of the size grid to a `textile_garments` row. */
export function textileGarmentToLine(g: Vals, index: number): GarmentLine {
  return {
    origin: strOut(g.origin),
    variant_id: strOut(g.variant_id),
    garment_type: strOut(g.garment_type),
    brand: strOut(g.brand),
    model: strOut(g.model),
    color: strOut(g.color),
    size: strOut(g.size),
    // Unreachable fallback: checkGarments rejects a line without a quantity,
    // so a failed parse never reaches the caller.
    quantity: qtyOut(g.quantity) ?? 0,
    sort_order: index,
  }
}

/** Maps one flat design row to a `textile_designs` row. */
export function textileDesignToRow(d: Vals): DesignRow {
  return {
    // Unreachable fallback, as above: checkDesigns rejects an unknown type.
    type: parseEnum(d.type, DESIGN_TYPES) ?? 'TEXT',
    content: strOut(d.content),
    color: strOut(d.color),
    font_class: parseEnum(d.font_class, FONT_CLASSES),
    font_name: strOut(d.font_name),
    file_id: strOut(d.file_id),
    placement: parseRequiredString(d.placement) ?? '',
    size: parseRequiredString(d.size) ?? '',
    print_method: strOut(d.print_method),
  }
}

/** At least one line; each needs an origin, a quantity and its garment identified. */
function checkGarments(garments: unknown, ctx: z.RefinementCtx) {
  if (!Array.isArray(garments) || garments.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['garments'], message: 'Add at least one garment' })
    return
  }
  for (const raw of garments) {
    const g = (raw ?? {}) as Vals
    if (!isValidQuantity(g.quantity)) {
      ctx.addIssue({ code: 'custom', path: ['garments'], message: 'Every garment needs a quantity of 1 or more' })
      return
    }
    const origin = parseEnum(g.origin, TEXTILE_ORIGINS)
    if (!origin) {
      ctx.addIssue({ code: 'custom', path: ['garments'], message: 'Every garment needs an origin' })
      return
    }
    if (origin === 'SHOP_SUPPLIED') {
      // Either a catalog variant is chosen, or the garment is described in full.
      if (parseRequiredString(g.variant_id)) continue
      if (
        !parseRequiredString(g.brand) || !parseRequiredString(g.model) ||
        !parseRequiredString(g.color) || !parseRequiredString(g.size)
      ) {
        ctx.addIssue({ code: 'custom', path: ['garments'], message: 'Describe the garment: brand, model, colour and size' })
        return
      }
    } else if (!parseRequiredString(g.garment_type) || !parseRequiredString(g.color)) {
      ctx.addIssue({ code: 'custom', path: ['garments'], message: 'A customer-supplied garment needs a type and a colour' })
      return
    }
  }
}

/** At least one design; each needs a placement, a size and its own content. */
function checkDesigns(designs: unknown, ctx: z.RefinementCtx) {
  if (!Array.isArray(designs) || designs.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['designs'], message: 'Apply at least one design' })
    return
  }
  const placements = new Set<string>()
  for (const raw of designs) {
    const d = (raw ?? {}) as Vals
    const placement = parseRequiredString(d.placement)
    if (!placement || !parseRequiredString(d.size)) {
      ctx.addIssue({ code: 'custom', path: ['designs'], message: 'Each design needs a placement and size' })
      return
    }
    // Mirrors UNIQUE (product_id, placement): one design per spot.
    if (placements.has(placement)) {
      ctx.addIssue({ code: 'custom', path: ['designs'], message: 'Two designs share a placement' })
      return
    }
    placements.add(placement)

    const type = parseEnum(d.type, DESIGN_TYPES)
    if (!type) {
      ctx.addIssue({ code: 'custom', path: ['designs'], message: 'Each design must be a file or text' })
      return
    }
    if (type === 'FILE') {
      if (!parseRequiredString(d.file_id)) {
        ctx.addIssue({ code: 'custom', path: ['designs'], message: 'Pick the artwork file for this design' })
        return
      }
    } else if (
      !parseRequiredString(d.content) || !parseRequiredString(d.color) ||
      !parseEnum(d.font_class, FONT_CLASSES)
    ) {
      ctx.addIssue({ code: 'custom', path: ['designs'], message: 'A text design needs its text, a colour and a font' })
      return
    }
  }
}

export const textileGarmentSchema = loose(['garments', 'designs']).transform((d, ctx) => {
  checkGarments(d.garments, ctx)
  checkDesigns(d.designs, ctx)
  const garments = Array.isArray(d.garments) ? d.garments : []
  const designs = Array.isArray(d.designs) ? d.designs : []
  return {
    garments: garments.map((g, i) => textileGarmentToLine((g ?? {}) as Vals, i)),
    designs: designs.map(row => textileDesignToRow((row ?? {}) as Vals)),
  }
})

export type TextileBatchFields = z.infer<typeof textileGarmentSchema>

true satisfies TextileBatchFields['garments'][number] extends Omit<TablesInsert<'textile_garments'>, 'id' | 'product_id' | 'created_at'> ? true : never
true satisfies TextileBatchFields['designs'][number] extends Omit<TablesInsert<'textile_designs'>, 'id' | 'product_id' | 'created_at'> ? true : never
