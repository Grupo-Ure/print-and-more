import { supabase } from '../supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Database } from '../types/supabase'
import { type DuplicateOrderArgs, type OrderDetailRow, type OrderStatus, type OrderSummaryRow, type ProductStatus } from '../types/database'

/** Pause before a lost realtime channel is replaced. */
const RESUBSCRIBE_DELAY_MS = 2000

/** SELECT for `orders` incl. customer join (list, detail, status sync). */
const ORDER_COLUMNS =
  'id, order_number, status, customers(id, name, email, email_bounced_at, phone, note, street, house_number, postal_code, city), is_archived, deadline, delivery, priority, payment_method, created_at' as const

type OrderInsert = Database['public']['Tables']['orders']['Insert']
type OrderUpdate = Database['public']['Tables']['orders']['Update']
type PriorityEnum = Database['public']['Enums']['priority_type']
type DeliveryEnum = Database['public']['Enums']['delivery_type']

/**
 * Product fields carried in the order list: enough for the department pills and
 * for the derived "in production, missing info" alert. The old job model also
 * needed a nested product count here, because a job counted as incomplete
 * without products; a product cannot lack itself, so that count is gone.
 */
export type OrderListProduct = {
  id: string
  department: Database['public']['Enums']['department']
  status: ProductStatus
  deadline: string | null
  delivery: DeliveryEnum | null
  priority: PriorityEnum | null
  assignee_id: string | null
  is_cancelled: boolean
}

export type OrderListEntry = {
  id: string
  order_number: string
  status: OrderStatus
  created_at: string
  deadline: string | null
  delivery: DeliveryEnum | null
  priority: 'NORMAL' | 'HIGH'
  customer_id: string
  customers: { name: string } | null
  products: OrderListProduct[] | null
  /** The order's finish/close history events, newest first — the row's "Finished on" / "Billed on" date. */
  closing_events: OrderClosingEvent[] | null
}

/** History events that finish or close an order; the list embeds only these. */
const CLOSING_EVENT_TYPES = ['ORDER_FINISHED', 'ORDER_BILLED', 'ORDER_CLOSED_CASH'] as const

export type OrderClosingEvent = {
  event_type: (typeof CLOSING_EVENT_TYPES)[number]
  created_at: string
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
  'id, order_number, status, created_at, deadline, delivery, priority, customer_id, customers(name), products(id, department, status, deadline, delivery, priority, assignee_id, is_cancelled), closing_events:history(event_type, created_at)'

export type OrderListParams = {
  /**
   * `false` lists non-archived orders plus billed ones (every billed order is
   * archived, so the status filter alone could never reach them); `true` adds
   * archived quotes and cancelled orders.
   */
  includeArchived: boolean
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
 * Note on status: order status is its own lifecycle (QUOTE → IN_PROGRESS →
 * FINISHED → BILLED), written via {@link setOrderStatus} / {@link markOrderBilled}.
 * Every transition is an explicit user action except IN_PROGRESS → FINISHED,
 * which the database also makes on its own once every product of an invoice
 * order is done (`fn_finish_order_if_done`, run by a trigger on products).
 */
class OrderService {
  /** Filtered order list for the sidebar (archived toggle, customer, status, deadline/intake ranges). Newest first. */
  async getOrdersForList(params: OrderListParams): Promise<OrderListEntry[]> {
    let query = supabase
      .from('orders')
      .select(ORDER_LIST_SELECT)
      .order('created_at', { ascending: false })
      .in('closing_events.event_type', CLOSING_EVENT_TYPES)
      .order('created_at', { referencedTable: 'closing_events', ascending: false })
    if (!params.includeArchived) query = query.or('is_archived.eq.false,status.eq.BILLED')
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

  /**
   * Full order row by id, or `null` if not found. Uses `maybeSingle()` so a
   * stale id (e.g. a bookmarked `?order=` of a deleted order) resolves to
   * `null` instead of throwing.
   */
  async getOrderById(id: string): Promise<OrderDetailRow | null> {
    const { data, error } = await supabase
      .from('orders')
      .select(ORDER_COLUMNS)
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    if (data == null) return null
    return flattenCustomerJoin(data as unknown as OrderDetailRow)
  }

  /** Insert a new order and return the created row. */
  async createOrder(payload: OrderInsert): Promise<OrderDetailRow> {
    const { data, error } = await supabase
      .from('orders')
      .insert(payload)
      .select(ORDER_COLUMNS)
      .single()
    if (error) throw error
    return flattenCustomerJoin(data as unknown as OrderDetailRow)
  }

  /** Patch arbitrary order fields and return the updated row. */
  async updateOrder(id: string, patch: OrderUpdate): Promise<OrderDetailRow> {
    const { data, error } = await supabase
      .from('orders')
      .update(patch)
      .eq('id', id)
      .select(ORDER_COLUMNS)
      .single()
    if (error) throw error
    return flattenCustomerJoin(data as unknown as OrderDetailRow)
  }

  /** Write an explicit status to the order — every order transition is a deliberate manual set. */
  async setOrderStatus(id: string, status: OrderStatus): Promise<OrderDetailRow> {
    const { data, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', id)
      .select(ORDER_COLUMNS)
      .single()
    if (error) throw error
    return flattenCustomerJoin(data as unknown as OrderDetailRow)
  }

  /** Soft-archive an order (`is_archived = true`); hidden from the sidebar list unless "Show archived" is on. */
  async archiveOrder(id: string): Promise<void> {
    const { error } = await supabase
      .from('orders')
      .update({ is_archived: true })
      .eq('id', id)
    if (error) throw error
  }

  /**
   * Cancel an order through the `cancel_order` function: every product not
   * yet cancelled is cancelled and the order archived, in one transaction.
   * The database refuses a billed order, and a finished one that still has a
   * product to cancel.
   */
  async cancelOrder(orderId: string): Promise<void> {
    const { error } = await supabase.rpc('cancel_order', { p_order_id: orderId })
    if (error) throw error
  }

  /** Terminal transition: mark `BILLED` and archive in one update. */
  async markOrderBilled(id: string): Promise<void> {
    const { error } = await supabase
      .from('orders')
      .update({ status: 'BILLED', is_archived: true })
      .eq('id', id)
    if (error) throw error
  }

  /**
   * Delete a quote with everything under it, through the `delete_quote`
   * function — the one way an order is deleted. The database refuses any
   * other status; past quote an order is archived or cancelled
   * ({@link archiveOrder}), never removed.
   */
  async deleteOrder(id: string): Promise<void> {
    const { error } = await supabase.rpc('delete_quote', { p_order_id: id })
    if (error) throw error
  }


  /**
   * Deep-copy an order via the `duplicate_order` Postgres RPC — products
   * (incl. typed child by `type`), `product_files`, and textile rows — in one
   * transaction. The database records the copy as a new order, under the
   * signed-in user. Returns the new order id.
   */
  async duplicateOrder(params: {
    source_order_id: string
    new_priority: PriorityEnum | null
    new_delivery: DeliveryEnum | null
    new_deadline: string | null
    selected_product_ids: string[]
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
      .channel(`order-list-customer-refresh:${crypto.randomUUID()}`) // unique per subscription, see productService.subscribeToProductChanges
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

  /**
   * Realtime subscription for the orders view: fires `onChanged(orderId)` on
   * any INSERT/UPDATE/DELETE of `orders` or `products`, whoever made it, so
   * the open order, its products and the order lists can refetch.
   *
   * `orderId` is the order the change concerns, or `null` when it is not
   * known: a product's DELETE carries only its primary key (the table keeps
   * the default replica identity), and a replaced channel cannot say what it
   * missed. `null` means "any order may have changed".
   *
   * Self-healing as `productService.subscribeToProductChanges` is: a channel
   * that errors, times out or closes unasked is replaced after a short pause,
   * and `onChanged(null)` fires once the replacement is subscribed.
   * Returns an unsubscribe function.
   */
  subscribeToOrderChanges(onChanged: (orderId: string | null) => void): () => void {
    let channel: RealtimeChannel | null = null
    let stopped = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let reconnecting = false

    const open = () => {
      // A unique topic per channel, so a remount never reuses one still being removed.
      const current: RealtimeChannel = supabase
        .channel(`orders-view-refresh:${crypto.randomUUID()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
          const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as { id?: string }
          onChanged(row.id ?? null)
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, payload => {
          const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as { order_id?: string }
          onChanged(row.order_id ?? null)
        })
        .subscribe(status => {
          // Ignore channels already replaced or unsubscribed on purpose.
          if (stopped || current !== channel) return
          if (status === 'SUBSCRIBED') {
            if (reconnecting) onChanged(null)
            reconnecting = false
            return
          }
          // CHANNEL_ERROR, TIMED_OUT, or CLOSED that we did not ask for.
          channel = null
          reconnecting = true
          void supabase.removeChannel(current)
          retryTimer = setTimeout(open, RESUBSCRIBE_DELAY_MS)
        })
      channel = current
    }

    open()
    return () => {
      stopped = true
      clearTimeout(retryTimer)
      if (channel) void supabase.removeChannel(channel)
    }
  }
}

export const orderService = new OrderService()
