/** Gemeinsame Status-Werte (Auftrag: Aggregat; Teilauftrag: ohne ANGEBOT) */
export type AuftragStatus =
  | 'ANGEBOT'
  | 'UNVOLLSTAENDIG'
  | 'PREPRESS_BEREIT'
  | 'PRODUKTION_BEREIT'
  | 'FERTIG'

/** Werte = Supabase-Enum `teilauftrag_bereich` (Großbuchstaben, kein Leerzeichen) */
export const TEILAUFTRAG_BEREICHE = [
  'LFP',
  'COPYSHOP',
  'TEXTIL',
  'STEMPEL',
  'LASERGRAVUR',
  'SONSTIGE',
] as const

export type TeilauftragBereich = (typeof TEILAUFTRAG_BEREICHE)[number]

export const TEILAUFTRAG_BEREICH_ANZEIGE: Record<TeilauftragBereich, string> = {
  LFP: 'LFP',
  COPYSHOP: 'CopyShop',
  TEXTIL: 'Textil',
  STEMPEL: 'Stempel',
  LASERGRAVUR: 'Lasergravur',
  SONSTIGE: 'Sonstige',
}

export type Bereich = TeilauftragBereich

export function teilauftragBereichLabel(bereich: string): string {
  if (bereich in TEILAUFTRAG_BEREICH_ANZEIGE) {
    return TEILAUFTRAG_BEREICH_ANZEIGE[bereich as TeilauftragBereich]
  }
  return bereich
}

export type Prioritaet = 'NIEDRIG' | 'NORMAL' | 'HOCH'

export type KundeName = {
  name: string
}

export type KundeKontaktRow = {
  name: string
  email: string | null
  telefon: string | null
}

/** PostgREST liefert eingebettete FK-Zeile als Objekt oder 1-Element-Array (je nach Client-Inferenz). */
export type KundeJoin = KundeName | KundeName[] | null

export type KundeKontaktJoin = KundeKontaktRow | KundeKontaktRow[] | null

/** SELECT für die Auftragsliste (OrderList) */
export type AuftragListRow = {
  id: string
  auftragsnummer: string
  status: AuftragStatus
  erstellt_am: string
  kunden: KundeJoin
}

/** SELECT einzelner Auftrag im Arbeitsbereich */
export type AuftragDetailRow = {
  id: string
  auftragsnummer: string
  status: AuftragStatus
  kunden: KundeKontaktJoin
}

export type LieferungWahl = 'ABHOLUNG' | 'VERSAND'

export type TeilauftragRow = {
  id: string
  auftrag_id: string
  bereich: string
  typ: string | null
  status: AuftragStatus
  termin: string | null
  lieferung: LieferungWahl | null
  prioritaet: string
  verantwortlicher_id: string | null
  satzzeit_minuten: number | null
  /** Bereichsspezifische Daten (LFP, …) — JSONB */
  detail: Record<string, unknown> | null
}

export type NeuerTeilauftragEintrag = {
  auftrag_id: string
  bereich: TeilauftragBereich
  status: 'UNVOLLSTAENDIG'
  prioritaet: 'NORMAL'
}
