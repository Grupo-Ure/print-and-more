/**
 * Lasergravur-Teilaufträge: `typ` in `teilauftraege.typ`, Struktur in `detail` (JSONB).
 */

export const LASER_TYPEN = [
  'SCHILD',
  'POKALSCHILD',
  'NAMENSSCHILD',
  'GESCHENKARTIKEL',
  'SONSTIGE_LASER',
] as const

export type LaserTeiltyp = (typeof LASER_TYPEN)[number]

export const LASER_TYP_ANZEIGE: Record<LaserTeiltyp, string> = {
  SCHILD: 'Schild',
  POKALSCHILD: 'Pokalschild',
  NAMENSSCHILD: 'Namenschild',
  GESCHENKARTIKEL: 'Geschenkartikel',
  SONSTIGE_LASER: 'Sonstige Laser',
}

/** Material (SCHILD / POKALSCHILD / NAMENSSCHILD) */
export const LASER_MAT_SCHILD = [
  'ABS_SW',
  'ABS_WS',
  'ABS_GS',
  'ABS_SS',
  'SONSTIGE',
] as const

export type LaserMaterialSchild = (typeof LASER_MAT_SCHILD)[number]

export const LASER_MAT_SCHILD_ANZEIGE: Record<LaserMaterialSchild, string> = {
  ABS_SW: 'ABS schwarz/weiß',
  ABS_WS: 'ABS weiß/schwarz',
  ABS_GS: 'ABS gold/schwarz',
  ABS_SS: 'ABS silber/schwarz',
  SONSTIGE: 'Sonstiges',
}

export const LASER_HERKUNFT = ['KUNDENMATERIAL', 'EIGENMATERIAL'] as const
export type LaserHerkunft = (typeof LASER_HERKUNFT)[number]

export const LASER_HERKUNFT_ANZEIGE: Record<LaserHerkunft, string> = {
  KUNDENMATERIAL: 'Kundenmaterial',
  EIGENMATERIAL: 'Eigenmaterial',
}

export type LaserDetailJson = Record<string, unknown>
