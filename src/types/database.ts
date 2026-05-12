import type { Enums, Tables, TablesInsert, TablesUpdate } from './supabase'
import { Constants } from './supabase'

export type OrderStatus = Enums<'order_status'>

export const ORDER_STATUS_LIST: readonly OrderStatus[] = Constants.public.Enums.order_status

export type SubOrderDepartment = Enums<'sub_order_department'>

export const SUB_ORDER_DEPARTMENTS: readonly SubOrderDepartment[] = Constants.public.Enums.sub_order_department

export type Department = SubOrderDepartment

/** Entspricht `prioritaet_typ` in der DB (Auftrag und Teilauftrag). */
export type Priority = Enums<'priority_type'>

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
export type OrderDetailRow = Tables<'orders'> & {
  customers: CustomerContactJoin
}

/** Rechte Spalte / Kontext (identisch mit geladenem Auftrag) */
export type Auftrag = OrderDetailRow

/** Patch for the order header fields editable in WorkArea. */
export type OrderHeaderPatch = Partial<Pick<Tables<'orders'>, 'deadline' | 'delivery' | 'priority'>>

/** Shape of order data needed for PDF generation. */
export type OrderPdfRow = Pick<Tables<'orders'>, 'order_number' | 'deadline' | 'delivery' | 'priority' | 'created_at'> & {
  customers: CustomerContactJoin
}

export type DeliveryChoice = Enums<'delivery_type'>

export type SubOrderRow = Tables<'sub_orders'>

export type SubOrderUpdate = TablesUpdate<'sub_orders'>

export type NewSubOrderEntry = Pick<TablesInsert<'sub_orders'>, 'order_id' | 'department' | 'status' | 'priority'>
