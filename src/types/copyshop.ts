/**
 * Type definitions for the CopyShop department.
 *
 * CopyShop covers in-house digital and offset print work that doesn't go
 * through the wide-format printer: posters, flyers, folded flyers,
 * brochures, business cards, bound documents, and ad-hoc print outs.
 *
 * Most CopyShop types support both digital ("Copy-Center") and offset
 * production paths, with different material/format constraints per path.
 * Each type's spec columns live in its own child table; the per-type field
 * requirements are the Zod schemas in `src/lib/products/schemas/copyshop.ts`.
 */

/** All CopyShop types, in dropdown order. */
export const COPY_SHOP_TYPES = [
  'POSTER',
  'CARD_FLYER',
  'FOLDED_FLYER',
  'BROCHURE',
  'BUSINESS_CARD',
  'BINDING',
  'PRINTOUT',
] as const

/** Discriminator for the kind of CopyShop work, stored in `products.type`. */
export type CopyShopType = (typeof COPY_SHOP_TYPES)[number]

/** Display labels for {@link CopyShopType}, rendered in dropdowns and tabs. */
export const COPY_SHOP_TYPE_LABELS: Record<CopyShopType, string> = {
  POSTER: 'Poster',
  CARD_FLYER: 'Card & Flyer',
  FOLDED_FLYER: 'Folded Flyer',
  BROCHURE: 'Brochure',
  BUSINESS_CARD: 'Business Card',
  BINDING: 'Binding',
  PRINTOUT: 'Print-out',
}
