import type { Json } from './supabase'

/** Gemeinsame Status-Werte (Auftrag: Aggregat; Teilauftrag: ohne ANGEBOT) */
export type OrderStatus =
  | 'ANGEBOT'
  | 'UNVOLLSTAENDIG'
  | 'PREPRESS_BEREIT'
  | 'PRODUKTION_BEREIT'
  | 'FERTIG'
  | 'ABGERECHNET'

export const ORDER_STATUS_LIST: readonly OrderStatus[] = [
  'ANGEBOT',
  'UNVOLLSTAENDIG',
  'PREPRESS_BEREIT',
  'PRODUKTION_BEREIT',
  'FERTIG',
  'ABGERECHNET',
]

/** Werte = Supabase-Enum `teilauftrag_bereich` (Großbuchstaben, kein Leerzeichen) */
export const SUB_ORDER_DEPARTMENTS = [
  'LFP',
  'COPYSHOP',
  'TEXTIL',
  'STEMPEL',
  'LASERGRAVUR',
  'SONSTIGE',
] as const

export type SubOrderDepartment = (typeof SUB_ORDER_DEPARTMENTS)[number]

export const SUB_ORDER_DEPARTMENT_LABELS: Record<SubOrderDepartment, string> = {
  LFP: 'LFP',
  COPYSHOP: 'CopyShop',
  TEXTIL: 'Textil',
  STEMPEL: 'Stempel',
  LASERGRAVUR: 'Lasergravur',
  SONSTIGE: 'Sonstige',
}

export type Department = SubOrderDepartment

export function subOrderDepartmentLabel(department: string): string {
  if (department in SUB_ORDER_DEPARTMENT_LABELS) {
    return SUB_ORDER_DEPARTMENT_LABELS[department as SubOrderDepartment]
  }
  return department
}

/** Entspricht `prioritaet_typ` in der DB (Auftrag und Teilauftrag). */
export type Priority = 'NORMAL' | 'HOCH'

/** Flaches Objekt für Validierung von JSONB-Details; Arrays/Primitiv oben = leer. */
export function subOrderDetailToFieldMap(detail: Json | null): Record<string, unknown> {
  if (detail === null) return {}
  if (typeof detail === 'object' && !Array.isArray(detail)) {
    return detail
  }
  return {}
}

export type CustomerName = {
  name: string
}

export type CustomerContactRow = {
  id: string
  name: string
  email: string | null
  telefon: string | null
  notiz: string | null
  strasse: string | null
  hausnummer: string | null
  plz: string | null
  ort: string | null
}

/** PostgREST liefert eingebettete FK-Zeile als Objekt oder 1-Element-Array (je nach Client-Inferenz). */
export type CustomerJoin = CustomerName | CustomerName[] | null

export type CustomerContactJoin = CustomerContactRow | CustomerContactRow[] | null

/** SELECT für die Auftragsliste (OrderList) */
export type OrderSummaryRow = {
  id: string
  auftragsnummer: string
  status: OrderStatus
  erstellt_am: string
  kunden: CustomerJoin
}

/** SELECT einzelner Auftrag im Arbeitsbereich */
export type OrderDetailRow = {
  id: string
  auftragsnummer: string
  status: OrderStatus
  kunden: CustomerContactJoin
  erp_exportiert: boolean
  archiviert: boolean
  termin: string | null
  lieferung: DeliveryChoice | null
  prioritaet: Priority
  notfall_aktiv: boolean
  erstellt_am: string
}

/** Rechte Spalte / Kontext (identisch mit geladenem Auftrag) */
export type Auftrag = OrderDetailRow

export type DeliveryChoice = 'ABHOLUNG' | 'VERSAND'

export type SubOrderRow = {
  id: string
  auftrag_id: string
  bereich: SubOrderDepartment
  typ: string | null
  status: OrderStatus
  termin: string | null
  lieferung: DeliveryChoice | null
  prioritaet: Priority
  verantwortlicher_id: string | null
  satzzeit_minuten: number | null
  /** Bereichsspezifische Daten (LFP, …) — JSONB */
  detail: Json | null
  notfall_aktiv: boolean
  notfall_begruendung: string | null
  storniert: boolean
  kundenfreigabe_erforderlich: boolean
  kundenfreigabe_liegt_vor: boolean
  kundenfreigabe_datei_id: string | null
}

export type NewSubOrderEntry = {
  auftrag_id: string
  bereich: SubOrderDepartment
  status: 'UNVOLLSTAENDIG'
  prioritaet: 'NORMAL'
}
