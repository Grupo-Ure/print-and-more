import { supabase } from '../supabase'
import type { Database } from '../types/supabase'
import { ORDER_COLUMNS } from '../const/orderSelect'
import { calculateOrderStatus } from '../lib/orderStatus'
import { type Auftrag, type DuplicateOrderArgs, type OrderStatus, type OrderSummaryRow } from '../types/database'

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
  'id, order_number, status, created_at, deadline, priority, is_emergency, customer_id, customers(name), sub_orders:department_orders(department, status)'

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

/**
 * Service layer for the `orders` table. All DB access goes through here so
 * components/queries don't touch `supabase` directly. Read methods that select a
 * `customers(...)` join return it flattened to a single row via
 * {@link flattenCustomerJoin}.
 *
 * Note on status: order status is *derived* from the sub-orders, never set by the
 * user directly except for terminal transitions. Two collaborators do this work —
 * see {@link recalculateOrderStatus} for the calculate-vs-recalculate split.
 */
class OrderService {
  /** Filtered order list for the sidebar (archived flag, customer, status, deadline/intake ranges). Newest first. */
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

  /** Lightweight, non-archived order summaries (id, number, status, created, customer name). Newest first. */
  async getOrders(): Promise<OrderSummaryRow[]> {
    const { data, error } = await supabase
      .from('orders')
      .select(ORDER_LIST_COLUMNS)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
    if (error) throw error
    return ((data ?? []) as unknown as OrderSummaryRow[]).map(flattenCustomerJoin)
  }

  /** Full order row by id, or `null` if not found. */
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

  /** Insert a new order and return the created row. */
  async createOrder(payload: OrderInsert): Promise<Auftrag> {
    const { data, error } = await supabase
      .from('orders')
      .insert(payload)
      .select(ORDER_COLUMNS)
      .single()
    if (error) throw error
    return flattenCustomerJoin(data as unknown as Auftrag)
  }

  /** Patch arbitrary order fields and return the updated row. */
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

  /**
   * Write an explicit status to the order — a *direct* set, no derivation.
   * Use this only for deliberate manual transitions where the caller already knows
   * the target status. To re-derive status from the sub-orders, use
   * {@link recalculateOrderStatus} instead.
   */
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

  /** Soft-archive an order (`is_archived = true`); excludes it from the sidebar list. */
  async archiveOrder(id: string): Promise<void> {
    const { error } = await supabase
      .from('orders')
      .update({ is_archived: true })
      .eq('id', id)
    if (error) throw error
  }

  /** Cancel all not-yet-cancelled sub-orders, then archive the order. Two writes, not transactional. */
  async archiveOrderWithCancelledSubOrders(orderId: string): Promise<void> {
    const { error: subError } = await supabase
      .from('department_orders')
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

  /** Terminal transition: mark `INVOICED` and archive in one update. */
  async markOrderBilled(id: string): Promise<void> {
    const { error } = await supabase
      .from('orders')
      .update({ status: 'INVOICED', is_archived: true })
      .eq('id', id)
    if (error) throw error
  }

  /** Hard-delete an order row (cascades per FK constraints). Prefer {@link archiveOrder} for normal flow. */
  async deleteOrder(id: string): Promise<void> {
    const { error } = await supabase.from('orders').delete().eq('id', id)
    if (error) throw error
  }

  /**
   * Re-derive and persist the order's aggregate status from its sub-orders via a
   * DB-round-trip: reads the order + its sub-orders fresh from the database,
   * computes the next status with the pure {@link calculateOrderStatus}, and writes
   * it back. It re-reads from the DB rather than trusting the client cache.
   *
   * @deprecated TRANSITIONAL — to be removed. This is the legacy "distrust the cache,
   * re-read from the DB" strategy for keeping order status fresh. The refactor is
   * converging on the optimistic alternative: compute from the already-authoritative
   * React Query cache and persist directly — `calculateOrderStatus` + `setOrderStatus`
   * + `patchOrderStatusInCache`. See `useCreateSubOrder` (src/queries/subOrderQueries.ts)
   * for the canonical example of that pattern.
   *
   * The pure {@link calculateOrderStatus} is NOT deprecated — both strategies depend on
   * it. Only this DB-round-trip wrapper is going away.
   *
   * DO NOT add new callers. Removal blockers — the only thing keeping it alive:
   *   - `ContextPanel` is the sole live consumer (not yet migrated): one direct call
   *     plus the `recalculateOrderStatusAfterSubOrderAction` helper used after each
   *     manual workflow action (~11 call sites total).
   *   - The `useRecalculateOrderStatus` wrapper in src/queries/orderQueries.ts is
   *     ALREADY orphaned (zero callers) and can be deleted immediately.
   *
   * Removal checklist:
   *   1. Migrate each `ContextPanel` action to the optimistic trio above. Note the
   *      multi-row actions (e.g. `archiveOrderWithCancelledSubOrders`, which cancels
   *      all sub-orders at once) need their cache writes in place first, so the
   *      cached sub-order list reflects the change before `calculateOrderStatus` runs.
   *   2. Delete `useRecalculateOrderStatus` (already unused).
   *   3. Delete this method.
   *
   * Historical: this replaced the former Postgres RPC `fn_calculate_order_status`
   * (reimplemented in TS); it is the cache-independent safety net only until the
   * migration above completes.
   */
  async recalculateOrderStatus(orderId: string): Promise<Auftrag> {
    const { data: inputs, error: readError } = await supabase
      .from('orders')
      .select('status, sub_orders:department_orders(status, is_cancelled)')
      .eq('id', orderId)
      .single()
    if (readError) throw readError
    if (inputs == null) throw new Error('recalculateOrderStatus: order not found')

    const currentStatus = inputs.status as OrderStatus
    const subOrders = (inputs.sub_orders ?? []) as { status: OrderStatus; is_cancelled: boolean }[]
    const nextStatus = calculateOrderStatus(currentStatus, subOrders)

    const { data, error } = await supabase
      .from('orders')
      .update({ status: nextStatus })
      .eq('id', orderId)
      .select(ORDER_COLUMNS)
      .single()
    if (error) throw error
    if (data == null) throw new Error('recalculateOrderStatus: no row returned after update')
    return flattenCustomerJoin(data as unknown as Auftrag)
  }

  /**
   * Deep-copy an order via the `duplicate_order` Postgres RPC — sub-orders, products
   * (incl. typed child by `type`), `product_files`, and textile rows — in one
   * transaction. This stays server-side *because* it must be atomic; it's the one
   * status/data RPC deliberately kept (unlike the retired `fn_calculate_order_status`).
   * Returns the new order id.
   */
  async duplicateOrder(params: {
    source_order_id: string
    new_priority: PriorityEnum | null
    new_delivery: DeliveryEnum | null
    new_deadline: string | null
    selected_department_order_ids: string[]
    created_by_user_id: string | null
  }): Promise<string> {
    const { data, error } = await supabase.rpc('duplicate_order', params as unknown as DuplicateOrderArgs)
    if (error) throw new Error(error.message)
    return data as string
  }

  /**
   * Realtime subscription: fires `onChanged(customerId)` on any customers
   * INSERT/UPDATE/DELETE so the order list can refresh denormalized customer names.
   * Returns an unsubscribe function.
   */
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
