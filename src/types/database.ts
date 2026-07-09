import type { Database, Enums, Tables, TablesInsert, TablesUpdate } from './supabase'
import { Constants } from './supabase'

export type OrderStatus = Enums<'order_status'>

export const ORDER_STATUS_LIST: readonly OrderStatus[] = Constants.public.Enums.order_status

export type SubOrderDepartment = Enums<'department'>

export const SUB_ORDER_DEPARTMENTS: readonly SubOrderDepartment[] = Constants.public.Enums.department

export type Department = SubOrderDepartment

/** Entspricht `prioritaet_typ` in der DB (Auftrag und Teilauftrag). */
export type Priority = Enums<'priority_type'>

export type CustomerContactRow = Tables<'customers'>

/** Flat customer shape used everywhere the app needs to read/edit a customer. */
export type Customer = {
  id: string
  name: string
  email: string | null
  phone: string | null
  note: string | null
  street: string | null
  house_number: string | null
  postal_code: string | null
  city: string | null
}

/** Order list row — minimal customer projection (only `name`). */
export type OrderSummaryRow = Pick<Tables<'orders'>, 'id' | 'order_number' | 'status' | 'created_at'> & {
  customers: { name: string } | null
}

/** Single-order row loaded into the workspace. */
export type OrderDetailRow = Tables<'orders'> & {
  customers: Customer | null
}

/** Alias used by the context panel and other workspace consumers. */
export type Auftrag = OrderDetailRow

/** Patch for the order header fields editable in WorkArea. */
export type OrderHeaderPatch = Partial<Pick<Tables<'orders'>, 'deadline' | 'delivery' | 'priority'>>

/** Shape of order data needed for PDF generation. */
export type OrderPdfRow = Pick<Tables<'orders'>, 'order_number' | 'deadline' | 'delivery' | 'priority' | 'created_at'> & {
  customers: Customer | null
}

export type DeliveryChoice = Enums<'delivery_type'>

export type SubOrderRow = Tables<'department_orders'>

export type SubOrderUpdate = TablesUpdate<'department_orders'>

export type NewSubOrderEntry = Pick<TablesInsert<'department_orders'>, 'order_id' | 'department' | 'status' | 'priority'>

export type DuplicateOrderArgs = Database['public']['Functions']['duplicate_order']['Args']

export type UserRole = Enums<'user_role'>

export type AppUserRow = Tables<'users'>
