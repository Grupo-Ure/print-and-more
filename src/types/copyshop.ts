/**
 * Type definitions for the CopyShop department.
 *
 * CopyShop covers in-house digital and offset print work that doesn't go
 * through the wide-format printer: posters, flyers, folded flyers,
 * brochures, business cards, bound documents, and ad-hoc print outs.
 *
 * Most CopyShop typen support both digital ("Copy-Center") and offset
 * production paths, with different material/format constraints per path.
 *
 * The shape of a CopyShop sub-order's `detail` JSONB column varies by
 * `typ`. See `validateCopyShopDetail` in `src/lib/copyshop/` for the
 * per-typ field requirements.
 */

/** All CopyShop typen, in dropdown order. */
export const COPY_SHOP_TYPES = [
  'PLAKAT_POSTER',
  'KARTE_FLYER',
  'FALZFLYER',
  'BROSCHUERE',
  'VISITENKARTE',
  'BINDUNG',
  'AUSDRUCK',
] as const

/** Discriminator for the kind of CopyShop work, stored in `teilauftraege.typ`. */
export type CopyShopType = (typeof COPY_SHOP_TYPES)[number]

/** German display labels for {@link CopyShopType}, rendered in dropdowns and tabs. */
export const COPY_SHOP_TYPE_LABELS: Record<CopyShopType, string> = {
  PLAKAT_POSTER: 'Plakat/Poster',
  KARTE_FLYER: 'Karte & Flyer',
  FALZFLYER: 'Falzflyer',
  BROSCHUERE: 'Broschüre',
  VISITENKARTE: 'Visitenkarte',
  BINDUNG: 'Bindung',
  AUSDRUCK: 'Ausdruck',
}

/**
 * Shape of the JSONB `detail` column for a CopyShop sub-order.
 *
 * Keys vary per `typ` — only set keys relevant to the current typ. Kept
 * with the `Json` suffix to disambiguate from the `CopyShopDetail`
 * React component when both are imported into the same consumer file.
 */
export type CopyShopDetailJson = Record<string, unknown>

/**
 * Production path for typen that can be done either as digital
 * (Copy-Center) or offset. Currently a declared union; consumers wire
 * the value through the JSONB `detail.produktionsweg` field.
 */
export type ProductionPath = 'COPYSHOP' | 'OFFSET'
