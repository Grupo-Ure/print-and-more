/**
 * Type definitions for the Stamp (Stempel) department.
 *
 * The Stamp department covers the in-house stamp production: rubber
 * stamps in plastic Trodat-Printy housings, traditional wooden stamps
 * (Holzstempel), tripod stamps (Stativstempel), date stamps
 * (Datumsstempel), and miscellaneous stamps. Beyond the stamp itself,
 * the same department also fulfills the consumable line of related
 * articles — refill ink, stamp pads, and replacement plates — which have
 * their own product types under `src/lib/products/schemas/stamp.ts`.
 */

/** Core stamp types, in dropdown order. The product schemas additionally
 * cover the consumable types (STAMP_PLATE, REFILL_INK, INK_PAD, TRODAT_PAD). */
export const STAMP_TYPES = [
  'TRODAT_PRINTY',
  'WOODEN_STAMP',
  'STAND_STAMP',
  'DATE_STAMP',
  'OTHER_STAMP',
] as const

/** Discriminator for the kind of stamp work, stored in `jobs.type`. */
export type StampType = (typeof STAMP_TYPES)[number]

/** Display labels for {@link StampType}, rendered in dropdowns and tabs. */
export const STAMP_TYPE_LABELS: Record<StampType, string> = {
  TRODAT_PRINTY: 'Trodat Printy',
  WOODEN_STAMP: 'Wooden Stamp',
  STAND_STAMP: 'Tripod Stamp',
  DATE_STAMP: 'Date Stamp',
  OTHER_STAMP: 'Other Stamps',
}

/**
 * Standard ink colors for stamps. `OTHER` requires a free-text spec.
 * Codes match the `stamp_ink_colors` lookup table (FK-enforced on the
 * stamp product tables and `stamp_models.color`).
 */
export const STAMP_COLORS = ['BLACK', 'RED', 'BLUE', 'GREEN', 'OTHER'] as const

export type StampColor = (typeof STAMP_COLORS)[number]

/** Catalog subset: `stamp_models.color` / consumables have no `OTHER`. */
export const REFILL_INK_COLORS = ['BLACK', 'RED', 'BLUE', 'GREEN'] as const

export type RefillInkColor = (typeof REFILL_INK_COLORS)[number]

/** Display labels for {@link StampColor}. */
export const STAMP_COLOR_LABELS: Record<StampColor, string> = {
  BLACK: 'Black',
  RED: 'Red',
  BLUE: 'Blue',
  GREEN: 'Green',
  OTHER: 'Other',
}

