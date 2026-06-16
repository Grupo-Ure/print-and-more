/**
 * Textile product schema — one `type`, `TEXTILE_GARMENT`: a garment line.
 *
 * Origin is an in-schema branch (the old `eigenware_modus`): OWN_STOCK is either
 * a catalog variant (`variant_id`) or free-text (brand/model/color/size);
 * CUSTOMER_STOCK is customer-supplied (garment_type + color). The design
 * applications live in `d.links` (the attributed `textile_motif_links`): they
 * are validated here but excluded from the transform's output — the form
 * reconciles them separately, exactly like `fileIds` — so the inferred shape
 * still matches the `textile_garment_products` child (drift assertion below).
 */

import { z } from 'zod'
import type { TablesInsert } from '../../../types/supabase'
import { loose, isValidQuantity, parseRequiredString, parseEnum, qtyOut, strOut } from './_shared'

type Vals = Record<string, unknown>
const TEXTILE_ORIGINS = ['OWN_STOCK', 'CUSTOMER_STOCK'] as const

/** Maps the flat form fields to the `textile_garment_products` columns. */
export function textileGarmentToChild(d: Vals): Omit<TablesInsert<'textile_garment_products'>, 'department_product_id'> {
  return {
    origin: strOut(d.origin),
    variant_id: strOut(d.variant_id),
    garment_type: strOut(d.garment_type),
    brand: strOut(d.brand),
    model: strOut(d.model),
    color: strOut(d.color),
    size: strOut(d.size),
  }
}

/** Garment spine: origin branch (catalog variant / free-text / customer stock). */
function checkGarment(d: Vals, ctx: z.RefinementCtx) {
  const origin = parseEnum(d.origin, TEXTILE_ORIGINS)
  if (!origin) {
    ctx.addIssue({ code: 'custom', path: ['origin'], message: 'Required' })
    return
  }
  if (origin === 'OWN_STOCK') {
    // Either a catalog variant is chosen, or all free-text garment fields are set.
    if (parseRequiredString(d.variant_id)) return
    if (!parseRequiredString(d.brand)) ctx.addIssue({ code: 'custom', path: ['brand'], message: 'Required' })
    if (!parseRequiredString(d.model)) ctx.addIssue({ code: 'custom', path: ['model'], message: 'Required' })
    if (!parseRequiredString(d.color)) ctx.addIssue({ code: 'custom', path: ['color'], message: 'Required' })
    if (!parseRequiredString(d.size)) ctx.addIssue({ code: 'custom', path: ['size'], message: 'Required' })
  } else {
    if (!parseRequiredString(d.garment_type)) ctx.addIssue({ code: 'custom', path: ['garment_type'], message: 'Required' })
    if (!parseRequiredString(d.color)) ctx.addIssue({ code: 'custom', path: ['color'], message: 'Required' })
  }
}

/** At least one design applied, each with a placement and size. */
function checkLinks(links: unknown, ctx: z.RefinementCtx) {
  if (!Array.isArray(links) || links.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['links'], message: 'Apply at least one design' })
    return
  }
  for (const link of links) {
    const l = (link ?? {}) as Vals
    if (!parseRequiredString(l.motif_id) || !parseRequiredString(l.placement) || !parseRequiredString(l.size)) {
      ctx.addIssue({ code: 'custom', path: ['links'], message: 'Each design needs a placement and size' })
      return
    }
  }
}

export const textileGarmentSchema = loose([
  'quantity', 'origin', 'variant_id', 'garment_type', 'brand', 'model', 'color', 'size', 'links',
]).transform((d, ctx) => {
  if (!isValidQuantity(d.quantity)) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Integer ≥ 1' })
  checkGarment(d as Vals, ctx)
  checkLinks(d.links, ctx)
  return { quantity: qtyOut(d.quantity), ...textileGarmentToChild(d as Vals) }
})
export type TextileGarmentFields = z.infer<typeof textileGarmentSchema>
true satisfies TextileGarmentFields extends Omit<TablesInsert<'textile_garment_products'>, 'department_product_id'> ? true : never
