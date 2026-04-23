/** Hochformat: Breite × Höhe (mm) — Karte/Falz, gemeinsame DIN-Größen */
const CORE = {
  DIN_LANG: { b: 99, h: 210 },
  A7: { b: 74, h: 105 },
  A6: { b: 105, h: 148 },
  A5: { b: 148, h: 210 },
  A4: { b: 210, h: 297 },
  A3: { b: 297, h: 420 },
} as const

export type KarteFalzDinKey = keyof typeof CORE

export const KARTE_DIN: Record<Exclude<keyof typeof CORE, never>, { b: number; h: number }> = { ...CORE }

export const FALZ_DIN = {
  DIN_LANG: CORE.DIN_LANG,
  A7: CORE.A7,
  A6: CORE.A6,
  A5: CORE.A5,
  A4: CORE.A4,
} as const

export const BROS_DIN: Record<'A6' | 'A5' | 'A4', { b: number; h: number }> = {
  A6: CORE.A6,
  A5: CORE.A5,
  A4: CORE.A4,
}

export const KARTE_FORMAT_ORDER = [
  'DIN_LANG',
  'A7',
  'A6',
  'A5',
  'A4',
  'A3',
  'FREI',
] as const

export const FALZ_FORMAT_ORDER = [
  'DIN_LANG',
  'A7',
  'A6',
  'A5',
  'A4',
  'FREI',
] as const

export const BROSCH_FORMAT_ORDER = ['A6', 'A5', 'A4', 'FREI'] as const
