/**
 * Type definitions for the Laser engraving (Lasergravur) department.
 *
 * Laser jobs cover engraved signs (Schild), trophy plates
 * (Pokalschild), nametags (Namensschild), engraved gift articles
 * (Geschenkartikel), and miscellaneous laser jobs (Sonstige Laser).
 *
 * For sign-typen, the material comes from a fixed list of ABS color
 * combinations. Gift articles and miscellaneous typen use free-text
 * material plus an origin flag (customer-supplied vs in-house material).
 *
 * The shape of a laser job's `detail` JSONB column varies by typ.
 * See `validateLaserDetail` in `src/lib/laser/` for the per-typ field
 * requirements.
 */

/** All laser typen, in dropdown order. */
export const LASER_TYPES = [
  'SIGN',
  'TROPHY_PLATE',
  'NAME_TAG',
  'GIFT_ITEM',
  'OTHER_LASER',
] as const

/** Discriminator for the kind of laser work, stored in `jobs.type`. */
export type LaserType = (typeof LASER_TYPES)[number]

/** Display labels for {@link LaserType}, rendered in dropdowns and tabs. */
export const LASER_TYPE_LABELS: Record<LaserType, string> = {
  SIGN: 'Sign',
  TROPHY_PLATE: 'Trophy Plate',
  NAME_TAG: 'Name Tag',
  GIFT_ITEM: 'Gift Item',
  OTHER_LASER: 'Other (Laser)',
}

/** Material options for sign typen (SIGN / TROPHY_PLATE / NAME_TAG). */
export const LASER_SIGN_MATERIALS = [
  'ABS_SW',
  'ABS_WS',
  'ABS_GS',
  'ABS_SS',
  'SONSTIGE',
] as const

export type LaserSignMaterial = (typeof LASER_SIGN_MATERIALS)[number]

/** Display labels for {@link LaserSignMaterial}. */
export const LASER_SIGN_MATERIAL_LABELS: Record<LaserSignMaterial, string> = {
  ABS_SW: 'ABS black/white',
  ABS_WS: 'ABS white/black',
  ABS_GS: 'ABS gold/black',
  ABS_SS: 'ABS silver/black',
  SONSTIGE: 'Other',
}

/**
 * Origin of the workpiece for laser jobs that aren't on a stock
 * sign material: customer-supplied or pulled from in-house stock.
 */
export const LASER_ORIGINS = ['KUNDENMATERIAL', 'EIGENMATERIAL'] as const
export type LaserOrigin = (typeof LASER_ORIGINS)[number]

/** Display labels for {@link LaserOrigin}. */
export const LASER_ORIGIN_LABELS: Record<LaserOrigin, string> = {
  KUNDENMATERIAL: 'Customer material',
  EIGENMATERIAL: 'In-house material',
}

/**
 * Shape of the JSONB `detail` column for a laser job.
 *
 * Keys vary per `typ` — only set keys relevant to the current typ. See
 * `validateLaserDetail` for the per-typ field set.
 */
export type LaserDetailJson = Record<string, unknown>
