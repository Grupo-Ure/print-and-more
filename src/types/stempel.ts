/**
 * Stempel-Teilaufträge: `typ` in Spalte `teilauftraege`, Detaildaten in JSONB `detail`.
 */

export const STEMPEL_TYPEN = [
  'TRODAT_PRINTY',
  'HOLZSTEMPEL',
  'STATIVSTEMPEL',
  'DATUMSSTEMPEL',
  'SONSTIGE_STEMPEL',
] as const

export type StempelTeiltyp = (typeof STEMPEL_TYPEN)[number]

export const STEMPEL_TYP_ANZEIGE: Record<StempelTeiltyp, string> = {
  TRODAT_PRINTY: 'Trodat Printy',
  HOLZSTEMPEL: 'Holzstempel',
  STATIVSTEMPEL: 'Stativstempel',
  DATUMSSTEMPEL: 'Datumsstempel',
  SONSTIGE_STEMPEL: 'Sonstige Stempel',
}

export const STEMPEL_FARBE = ['SCHWARZ', 'ROT', 'BLAU', 'GRUEN', 'SONSTIGE'] as const

export type StempelFarbe = (typeof STEMPEL_FARBE)[number]

export const STEMPEL_FARBE_ANZEIGE: Record<StempelFarbe, string> = {
  SCHWARZ: 'Schwarz',
  ROT: 'Rot',
  BLAU: 'Blau',
  GRUEN: 'Grün',
  SONSTIGE: 'Sonstige',
}

export type StempelDetailJson = Record<string, unknown>
