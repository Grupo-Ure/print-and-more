/**
 * Type definitions for the Laser engraving (Lasergravur) department.
 *
 * Laser sub-orders cover engraved signs (Schild), trophy plates
 * (Pokalschild), nametags (Namensschild), engraved gift articles
 * (Geschenkartikel), and miscellaneous laser jobs (Sonstige Laser).
 *
 * For sign-typen, the material comes from a fixed list of ABS color
 * combinations. Gift articles and miscellaneous typen use free-text
 * material plus an origin flag (customer-supplied vs in-house material).
 *
 * The shape of a laser sub-order's `detail` JSONB column varies by typ.
 * See `validateLaserDetail` in `src/lib/laser/` for the per-typ field
 * requirements.
 */

/** All laser typen, in dropdown order. */
export const LASER_TYPES = [
  'SCHILD',
  'POKALSCHILD',
  'NAMENSSCHILD',
  'GESCHENKARTIKEL',
  'SONSTIGE_LASER',
] as const

/** Discriminator for the kind of laser work, stored in `teilauftraege.typ`. */
export type LaserType = (typeof LASER_TYPES)[number]

/** German display labels for {@link LaserType}, rendered in dropdowns and tabs. */
export const LASER_TYPE_LABELS: Record<LaserType, string> = {
  SCHILD: 'Schild',
  POKALSCHILD: 'Pokalschild',
  NAMENSSCHILD: 'Namenschild',
  GESCHENKARTIKEL: 'Geschenkartikel',
  SONSTIGE_LASER: 'Sonstige Laser',
}

/** Material options for sign typen (SCHILD / POKALSCHILD / NAMENSSCHILD). */
export const LASER_SIGN_MATERIALS = [
  'ABS_SW',
  'ABS_WS',
  'ABS_GS',
  'ABS_SS',
  'SONSTIGE',
] as const

export type LaserSignMaterial = (typeof LASER_SIGN_MATERIALS)[number]

/** German display labels for {@link LaserSignMaterial}. */
export const LASER_SIGN_MATERIAL_LABELS: Record<LaserSignMaterial, string> = {
  ABS_SW: 'ABS schwarz/weiß',
  ABS_WS: 'ABS weiß/schwarz',
  ABS_GS: 'ABS gold/schwarz',
  ABS_SS: 'ABS silber/schwarz',
  SONSTIGE: 'Sonstiges',
}

/**
 * Origin of the workpiece for laser sub-orders that aren't on a stock
 * sign material: customer-supplied or pulled from in-house stock.
 */
export const LASER_ORIGINS = ['KUNDENMATERIAL', 'EIGENMATERIAL'] as const
export type LaserOrigin = (typeof LASER_ORIGINS)[number]

/** German display labels for {@link LaserOrigin}. */
export const LASER_ORIGIN_LABELS: Record<LaserOrigin, string> = {
  KUNDENMATERIAL: 'Kundenmaterial',
  EIGENMATERIAL: 'Eigenmaterial',
}

/**
 * Shape of the JSONB `detail` column for a laser sub-order.
 *
 * Keys vary per `typ` — only set keys relevant to the current typ. See
 * `validateLaserDetail` for the per-typ field set.
 */
export type LaserDetailJson = Record<string, unknown>
