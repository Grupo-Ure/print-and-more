import { addDays, parse } from 'date-fns'
import { supabase } from '../supabase'
import type { Database, Json } from '../types/supabase'
import { stampModelLabel } from '../lib/historySentences'

export type HistoryEvent = Database['public']['Enums']['history_event']

export type HistoryRow = {
  id: string
  event_type: HistoryEvent
  reason: string | null
  meta: Json | null
  created_at: string
  product_id: string | null
  user_id: string | null
  /** The stamp model a stock entry concerns (STOCK_AUTO_DEDUCTED on the order's tab); pads of one name differ by colour. */
  stamp_models: { name: string; color: string | null } | null
  /** The textile variant a stock entry concerns. */
  textile_variants: { color: string; size: string; textile_models: { name: string } | null } | null
}

/** An entry as the feeds read it: the row plus every record it links to, named. */
export type HistoryFeedRow = HistoryRow & {
  order_id: string | null
  customer_id: string | null
  file_id: string | null
  stamp_model_id: string | null
  textile_variant_id: string | null
  orders: { order_number: string } | null
  products: { product_number: string; is_cancelled: boolean } | null
  customers: { name: string } | null
  files: { display_name: string } | null
}

/** A record the History page can be narrowed to: an order, a customer, a stock item or a file. */
export type HistoryRecord = {
  kind: 'order' | 'customer' | 'stampModel' | 'textileVariant' | 'file'
  id: string
  label: string
}

export type HistoryFeedFilter = {
  /** First day, `YYYY-MM-DD` (local), or empty. */
  from: string
  /** Last day, `YYYY-MM-DD` (local), inclusive, or empty. */
  to: string
  userId: string | null
  event: HistoryEvent | null
  record: HistoryRecord | null
  /** One product of the record's order (the order's History tab), or null. */
  productId: string | null
}

/** Where the next page starts: the last entry shown, in the page's order. */
export type HistoryCursor = { createdAt: string; id: string }

export const HISTORY_PAGE_SIZE = 50

const RECORD_SEARCH_LIMIT = 5

const FEED_COLUMNS =
  'id, event_type, reason, meta, created_at, product_id, user_id, order_id, customer_id, file_id, stamp_model_id, textile_variant_id, ' +
  'stamp_models(name, color), textile_variants(color, size, textile_models(name)), orders(order_number), ' +
  'products(product_number, is_cancelled), customers(name), files(display_name)'

/** The ISO instant a local day starts at, `days` after the given one. */
function localDayStart(day: string, days = 0): string {
  return addDays(parse(day, 'yyyy-MM-dd', new Date()), days).toISOString()
}

/**
 * Reads the history. Nothing here writes it: every entry is written by the
 * database, with the change it records.
 */
class HistoryService {
  /**
   * One page of every entry the caller may read, newest first, ordered by
   * `(created_at, id)` so entries of one transaction (which share their time)
   * keep their place between pages. The filters apply in the database. A
   * customer narrows to its own entries and those of its orders.
   */
  async listEntries(filter: HistoryFeedFilter, cursor: HistoryCursor | null): Promise<HistoryFeedRow[]> {
    let query = supabase
      .from('history')
      .select(FEED_COLUMNS)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(HISTORY_PAGE_SIZE)

    if (filter.from) query = query.gte('created_at', localDayStart(filter.from))
    if (filter.to) query = query.lt('created_at', localDayStart(filter.to, 1))
    if (filter.userId) query = query.eq('user_id', filter.userId)
    if (filter.event) query = query.eq('event_type', filter.event)
    if (filter.productId) query = query.eq('product_id', filter.productId)

    // PostgREST takes one `or` per request, so the alternatives (the customer's
    // links, the cursor's tie-break) are combined into one logic tree.
    const alternatives: string[] = []
    const record = filter.record
    if (record?.kind === 'order') query = query.eq('order_id', record.id)
    if (record?.kind === 'stampModel') query = query.eq('stamp_model_id', record.id)
    if (record?.kind === 'textileVariant') query = query.eq('textile_variant_id', record.id)
    if (record?.kind === 'file') query = query.eq('file_id', record.id)
    if (record?.kind === 'customer') {
      const orderIds = await this.customerOrderIds(record.id)
      if (orderIds.length === 0) query = query.eq('customer_id', record.id)
      else alternatives.push(`customer_id.eq.${record.id},order_id.in.(${orderIds.join(',')})`)
    }
    if (cursor) {
      alternatives.push(
        `created_at.lt."${cursor.createdAt}",and(created_at.eq."${cursor.createdAt}",id.lt.${cursor.id})`,
      )
    }
    if (alternatives.length === 1) query = query.or(alternatives[0])
    if (alternatives.length > 1) query = query.or(`and(${alternatives.map(group => `or(${group})`).join(',')})`)

    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as unknown as HistoryFeedRow[]
  }

  private async customerOrderIds(customerId: string): Promise<string[]> {
    const { data, error } = await supabase.from('orders').select('id').eq('customer_id', customerId)
    if (error) throw error
    return (data ?? []).map(order => order.id)
  }

  /**
   * The records whose name matches, a few of each kind: orders by number,
   * customers (archived ones too), stamp models, textile variants by their
   * model's name, and files by name.
   */
  async searchRecords(text: string): Promise<HistoryRecord[]> {
    const needle = text.trim()
    if (!needle) return []
    const like = `%${needle}%`

    const [orders, customers, stampModels, variants, files] = await Promise.all([
      supabase
        .from('orders')
        .select('id, order_number, customers(name)')
        .ilike('order_number', like)
        .order('order_number', { ascending: false })
        .limit(RECORD_SEARCH_LIMIT),
      supabase.from('customers').select('id, name').ilike('name', like).order('name').limit(RECORD_SEARCH_LIMIT),
      supabase
        .from('stamp_models')
        .select('id, name, color')
        .ilike('name', like)
        .order('name')
        .limit(RECORD_SEARCH_LIMIT),
      supabase
        .from('textile_variants')
        .select('id, color, size, textile_models!inner(name)')
        .ilike('textile_models.name', like)
        .limit(RECORD_SEARCH_LIMIT),
      supabase
        .from('files')
        .select('id, display_name, orders(order_number)')
        .ilike('display_name', like)
        .order('created_at', { ascending: false })
        .limit(RECORD_SEARCH_LIMIT),
    ])
    for (const result of [orders, customers, stampModels, variants, files]) {
      if (result.error) throw result.error
    }

    return [
      ...(orders.data ?? []).map(order => ({
        kind: 'order' as const,
        id: order.id,
        label: [`Order ${order.order_number}`, order.customers?.name].filter(Boolean).join(' · '),
      })),
      ...(customers.data ?? []).map(customer => ({ kind: 'customer' as const, id: customer.id, label: customer.name })),
      ...(stampModels.data ?? []).map(model => ({
        kind: 'stampModel' as const,
        id: model.id,
        label: stampModelLabel(model),
      })),
      ...(variants.data ?? []).map(variant => ({
        kind: 'textileVariant' as const,
        id: variant.id,
        label: [variant.textile_models?.name, variant.color, variant.size].filter(Boolean).join(' · '),
      })),
      ...(files.data ?? []).map(file => ({
        kind: 'file' as const,
        id: file.id,
        label: [file.display_name, file.orders ? `order ${file.orders.order_number}` : null].filter(Boolean).join(' · '),
      })),
    ]
  }
}

export const historyService = new HistoryService()
