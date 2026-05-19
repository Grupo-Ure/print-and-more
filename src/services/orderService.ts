import { supabase } from '../supabase'
import type { Database } from '../types/supabase'
import { ORDER_COLUMNS } from '../const/orderSelect'
import { ORDER_STATUS_LIST, type Auftrag, type DuplicateOrderArgs, type OrderStatus, type OrderSummaryRow } from '../types/database'

type OrderInsert = Database['public']['Tables']['orders']['Insert']
type OrderUpdate = Database['public']['Tables']['orders']['Update']
type PriorityEnum = Database['public']['Enums']['priority_type']
type DeliveryEnum = Database['public']['Enums']['delivery_type']

export type OrderListEntry = {
  id: string
  order_number: string
  status: OrderStatus
  created_at: string
  deadline: string | null
  priority: 'NORMAL' | 'HIGH'
  is_emergency: boolean
  customer_id: string
  customers: { name: string } | null
  sub_orders: { department: string; status: string }[] | null
}

/**
 * Supabase emits joined relations as `Object | Object[] | null` even for one-to-one
 * cardinality. Every method that selects `customers(...)` flattens the result so the
 * published return types carry a single `customers` row (or `null`).
 */
function flattenCustomerJoin<T extends { customers: unknown }>(row: T): T {
  if (Array.isArray(row.customers)) {
    return { ...row, customers: row.customers[0] ?? null } as T
  }
  return row
}

const ORDER_LIST_SELECT =
  'id, order_number, status, created_at, deadline, priority, is_emergency, customer_id, customers(name), sub_orders(department, status)'

export type OrderListParams = {
  is_archived?: boolean
  customerIds?: string[]
  statuses?: OrderStatus[]
  deadlineFrom?: string
  deadlineTo?: string
  intakeFrom?: string
  intakeTo?: string
}

const ORDER_LIST_COLUMNS = 'id, order_number, status, created_at, customers(name)'

function parseStatusString(raw: string): OrderStatus {
  if (!(ORDER_STATUS_LIST as readonly string[]).includes(raw)) {
    throw new Error(`fn_calculate_order_status: invalid status "${raw}"`)
  }
  return raw as OrderStatus
}

function parseStatusFromRpc(data: unknown): OrderStatus {
  if (data == null) throw new Error('fn_calculate_order_status: empty result')
  if (typeof data === 'string') return parseStatusString(data)
  if (typeof data === 'object' && 'status' in (data as object)) {
    const v = (data as { status: unknown }).status
    if (typeof v === 'string') return parseStatusString(v)
    throw new Error('fn_calculate_order_status: field status is not a string')
  }
  if (typeof data === 'object' && 'fn_calculate_order_status' in (data as object)) {
    const v = (data as { fn_calculate_order_status: unknown }).fn_calculate_order_status
    if (typeof v === 'string') return parseStatusString(v)
    throw new Error('fn_calculate_order_status: field fn_calculate_order_status is not a string')
  }
  throw new Error('fn_calculate_order_status: unexpected format')
}

class OrderService {
  async getOrdersForList(params: OrderListParams): Promise<OrderListEntry[]> {
    let query = supabase
      .from('orders')
      .select(ORDER_LIST_SELECT)
      .order('created_at', { ascending: false })
    if (params.is_archived !== undefined) query = query.eq('is_archived', params.is_archived)
    if (params.customerIds) query = query.in('customer_id', params.customerIds)
    if (params.statuses) query = query.in('status', params.statuses)
    if (params.deadlineFrom) query = query.gte('deadline', params.deadlineFrom)
    if (params.deadlineTo) query = query.lte('deadline', params.deadlineTo)
    if (params.intakeFrom) query = query.gte('created_at', `${params.intakeFrom}T00:00:00`)
    if (params.intakeTo) query = query.lte('created_at', `${params.intakeTo}T23:59:59.999`)
    const { data, error } = await query
    if (error) throw error
    return ((data ?? []) as unknown as OrderListEntry[]).map(flattenCustomerJoin)
  }

  async getOrders(): Promise<OrderSummaryRow[]> {
    const { data, error } = await supabase
      .from('orders')
      .select(ORDER_LIST_COLUMNS)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
    if (error) throw error
    return ((data ?? []) as unknown as OrderSummaryRow[]).map(flattenCustomerJoin)
  }

  async getOrderById(id: string): Promise<Auftrag | null> {
    const { data, error } = await supabase
      .from('orders')
      .select(ORDER_COLUMNS)
      .eq('id', id)
      .single()
    if (error) throw error
    if (data == null) return null
    return flattenCustomerJoin(data as unknown as Auftrag)
  }

  async createOrder(payload: OrderInsert): Promise<Auftrag> {
    const { data, error } = await supabase
      .from('orders')
      .insert(payload)
      .select(ORDER_COLUMNS)
      .single()
    if (error) throw error
    return flattenCustomerJoin(data as unknown as Auftrag)
  }

  async updateOrder(id: string, patch: OrderUpdate): Promise<Auftrag> {
    const { data, error } = await supabase
      .from('orders')
      .update(patch)
      .eq('id', id)
      .select(ORDER_COLUMNS)
      .single()
    if (error) throw error
    return flattenCustomerJoin(data as unknown as Auftrag)
  }

  async setOrderStatus(id: string, status: OrderStatus): Promise<Auftrag> {
    const { data, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', id)
      .select(ORDER_COLUMNS)
      .single()
    if (error) throw error
    return flattenCustomerJoin(data as unknown as Auftrag)
  }

  async archiveOrder(id: string): Promise<void> {
    const { error } = await supabase
      .from('orders')
      .update({ is_archived: true })
      .eq('id', id)
    if (error) throw error
  }

  async archiveOrderWithCancelledSubOrders(orderId: string): Promise<void> {
    const { error: subError } = await supabase
      .from('sub_orders')
      .update({ is_cancelled: true })
      .eq('order_id', orderId)
      .neq('is_cancelled', true)
    if (subError) throw subError
    const { error } = await supabase
      .from('orders')
      .update({ is_archived: true })
      .eq('id', orderId)
    if (error) throw error
  }

  async markOrderBilled(id: string): Promise<void> {
    const { error } = await supabase
      .from('orders')
      .update({ status: 'INVOICED', is_archived: true })
      .eq('id', id)
    if (error) throw error
  }

  async deleteOrder(id: string): Promise<void> {
    const { error } = await supabase.from('orders').delete().eq('id', id)
    if (error) throw error
  }

  async synchronizeOrderStatus(auftragId: string): Promise<Auftrag> {
    const { data: raw, error: rpcError } = await supabase.rpc('fn_calculate_order_status', {
      target_order_id: auftragId,
    })
    if (rpcError) throw rpcError
    const status = parseStatusFromRpc(raw)
    const { data, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', auftragId)
      .select(ORDER_COLUMNS)
      .single()
    if (error) throw error
    if (data == null) throw new Error('synchronizeOrderStatus: no row returned after update')
    return flattenCustomerJoin(data as unknown as Auftrag)
  }

  async duplicateOrder(params: {
    source_order_id: string
    new_priority: PriorityEnum | null
    new_delivery: DeliveryEnum | null
    new_deadline: string | null
    selected_sub_order_ids: string[]
    created_by_user_id: string | null
  }): Promise<string> {
    const { data, error } = await supabase.rpc('duplicate_order', params as unknown as DuplicateOrderArgs)
    if (error) throw error
    return data as string
  }

  subscribeToCustomerChanges(onChanged: (customerId: string) => void): () => void {
    const channel = supabase
      .channel('orderlist-kunden-refresh')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'customers' }, payload => {
        const customerId = (payload.new as { id?: string } | null)?.id
        if (customerId) onChanged(customerId)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'customers' }, payload => {
        const customerId = (payload.new as { id?: string } | null)?.id
        if (customerId) onChanged(customerId)
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'customers' }, payload => {
        const customerId = (payload.old as { id?: string } | null)?.id
        if (customerId) onChanged(customerId)
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }
}

export const orderService = new OrderService()
