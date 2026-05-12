import type { Enums, Tables, Json } from './supabase'
import { Constants } from './supabase'

export type OrderStatus = Enums<'order_status'>

export const ORDER_STATUS_LIST: readonly OrderStatus[] = Constants.public.Enums.order_status

export type SubOrderDepartment = Enums<'sub_order_department'>

export const SUB_ORDER_DEPARTMENTS: readonly SubOrderDepartment[] = Constants.public.Enums.sub_order_department

export type Department = SubOrderDepartment

/** Entspricht `prioritaet_typ` in der DB (Auftrag und Teilauftrag). */
export type Priority = Enums<'priority_type'>

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

export type CustomerContactRow = Tables<'customers'>

/** PostgREST liefert eingebettete FK-Zeile als Objekt oder 1-Element-Array (je nach Client-Inferenz). */
export type CustomerJoin = CustomerName | CustomerName[] | null

export type CustomerContactJoin = CustomerContactRow | CustomerContactRow[] | null

/** SELECT für die Auftragsliste (OrderList) */
export type OrderSummaryRow = Pick<Tables<'orders'>, 'id' | 'order_number' | 'status' | 'created_at'> & {
  customers: CustomerName | CustomerName[] | null
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

export type DeliveryChoice = Enums<'delivery_type'>

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
  status: 'INCOMPLETE'
  prioritaet: 'NORMAL'
}
