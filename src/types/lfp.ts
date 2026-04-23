/**
 * LFP-Teilauftrag: Werte in `typ` (Spalte) bzw. `detail` (JSONB) gemäss Spez.
 */

export type LfpTeiltyp =
  | 'AUFKLEBER'
  | 'SCHILD_UV'
  | 'SCHILD_FOLIE'
  | 'FOLIENPLOTT'
  | 'BANNER'
  | 'ROLLUP'
  | 'FAHRZEUGBESCHRIFTUNG'
  | 'SONSTIGE_LFP'

export const LFP_TEILTYPEN: LfpTeiltyp[] = [
  'AUFKLEBER',
  'SCHILD_UV',
  'SCHILD_FOLIE',
  'FOLIENPLOTT',
  'BANNER',
  'ROLLUP',
  'FAHRZEUGBESCHRIFTUNG',
  'SONSTIGE_LFP',
]

export const LFP_TEILTYP_ANZEIGE: Record<LfpTeiltyp, string> = {
  AUFKLEBER: 'Aufkleber',
  SCHILD_UV: 'Schild UV',
  SCHILD_FOLIE: 'Schild Folie',
  FOLIENPLOTT: 'Folienplott',
  BANNER: 'Banner',
  ROLLUP: 'Rollup',
  FAHRZEUGBESCHRIFTUNG: 'Fahrzeugbeschriftung',
  SONSTIGE_LFP: 'Sonstige LFP',
}

/** Inhalt der JSONB-Spalte `detail` für LFP; nur für aktuellen `typ` relevante Keys setzen. */
export type LfpDetailJson = Record<string, unknown>
