export type TextilMotivTyp = 'TEXT' | 'DATEI'

export type TextilSchriftklasse = 'SERIFENLOS' | 'SERIFEN' | 'ELEGANT' | 'VERSPIELT'

export type TextilHerkunft = 'KUNDENWARE' | 'EIGENWARE'

export type TextilKundenKleidungTyp =
  | 'T_SHIRT'
  | 'POLO'
  | 'SWEATSHIRT'
  | 'HOODIE'
  | 'ZIP_HOODIE'
  | 'JACKE'
  | 'SONSTIGES'

export type TextilPlatz =
  | 'BRUST_LINKS'
  | 'BRUST_MITTE'
  | 'BRUST_RECHTS'
  | 'RUECKEN'
  | 'ARM_LINKS'
  | 'ARM_RECHTS'
  | 'SONSTIGE'

export type TextilGroesseEnum = 'KLEIN' | 'MITTEL' | 'GROSS' | 'FREI'

export type TextilMotiveRow = {
  id: string
  teilauftrag_id: string
  typ: TextilMotivTyp
  platz: TextilPlatz
  groesse: string
  druckart: string | null
  inhalt: string | null
  farbe: string | null
  schriftklasse: string | null
  schriftart: string | null
  datei_id: string | null
}

export type TextilPositionenRow = {
  id: string
  teilauftrag_id: string
  herkunft: TextilHerkunft
  typ: string | null
  farbe: string | null
  stueckzahl: number
  marke: string | null
  modell: string | null
  groesse: string | null
  /** Stammdaten-Verknüpfung (DB `textil_positionen.variante_id`). */
  variante_id: string | null
}

export type TextilNestedMotive = {
  typ: TextilMotivTyp
  platz: string
  groesse: string
  druckart: string | null
  inhalt: string | null
  datei_id: string | null
}

export type TextilNestedPosition = {
  herkunft: TextilHerkunft
  typ: string | null
  farbe: string | null
  marke: string | null
  modell: string | null
  groesse: string | null
}

export type TextilZuordnungRow = {
  id: string
  teilauftrag_id: string
  motiv_id: string
  position_id: string
  /** PostgREST-Embed; kann Objekt oder Array sein. */
  textil_motive?: TextilNestedMotive | TextilNestedMotive[] | null
  textil_positionen?: TextilNestedPosition | TextilNestedPosition[] | null
}

export type DateiKurz = {
  id: string
  anzeigename: string
  rolle: string
}

export type TextilTeilDetailJson = {
  textil?: { voll?: boolean }
}
