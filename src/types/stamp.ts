/**
 * Type definitions for the Stamp (Stempel) department.
 *
 * The Stamp department covers the in-house stamp production: rubber
 * stamps in plastic Trodat-Printy housings, traditional wooden stamps
 * (Holzstempel), tripod stamps (Stativstempel), date stamps
 * (Datumsstempel), and miscellaneous stamps. Beyond the stamp itself,
 * the same department also fulfills the consumable line of related
 * articles — refill ink (Nachfuellfarbe), stamp pads (Stempelkissen),
 * and replacement plates (Stempelplatte) — which the validator handles
 * via additional `typ` values declared inside `validateStampDetail`.
 *
 * The shape of a Stamp sub-order's `detail` JSONB column varies by typ.
 * See `validateStampDetail` in `src/lib/stamp/` for the per-typ field
 * requirements; for `TRODAT_PRINTY` and `WOODEN_STAMP` the `detail` also
 * carries a `modell_id` selected from the Stamp catalog
 * (`stempel_modelle` table).
 */

/** Core stamp typen, in dropdown order. The validator additionally
 * accepts a few "extra" typen for consumables — see the validator. */
export const STAMP_TYPES = [
  'TRODAT_PRINTY',
  'WOODEN_STAMP',
  'STAND_STAMP',
  'DATE_STAMP',
  'OTHER_STAMP',
] as const

/** Discriminator for the kind of stamp work, stored in `teilauftraege.typ`. */
export type StampType = (typeof STAMP_TYPES)[number]

/** Display labels for {@link StampType}, rendered in dropdowns and tabs. */
export const STAMP_TYPE_LABELS: Record<StampType, string> = {
  TRODAT_PRINTY: 'Trodat Printy',
  WOODEN_STAMP: 'Wooden Stamp',
  STAND_STAMP: 'Tripod Stamp',
  DATE_STAMP: 'Date Stamp',
  OTHER_STAMP: 'Other Stamps',
}

/** Standard ink colors for stamps. `SONSTIGE` requires a free-text spec. */
export const STAMP_COLORS = ['SCHWARZ', 'ROT', 'BLAU', 'GRUEN', 'SONSTIGE'] as const

export type StampColor = (typeof STAMP_COLORS)[number]

/** Display labels for {@link StampColor}. */
export const STAMP_COLOR_LABELS: Record<StampColor, string> = {
  SCHWARZ: 'Black',
  ROT: 'Red',
  BLAU: 'Blue',
  GRUEN: 'Green',
  SONSTIGE: 'Other',
}

/**
 * Shape of the JSONB `detail` column for a Stamp sub-order.
 *
 * Keys vary per `typ` — only set keys relevant to the current typ. Kept
 * with the `Json` suffix to disambiguate from the `StampDetail` React
 * component when both are imported into the same consumer file.
 */
export type StampDetailJson = Record<string, unknown>
