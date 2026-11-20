import { supabase } from '../supabase'
import type { Database, Json } from '../types/supabase'

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

/**
 * Reads the history. Nothing here writes it: every entry is written by the
 * database, with the change it records.
 */
class HistoryService {
  async getHistoryForOrder(orderId: string): Promise<HistoryRow[]> {
    const { data, error } = await supabase
      .from('history')
      .select(
        'id, event_type, reason, meta, created_at, product_id, user_id, stamp_models(name, color), textile_variants(color, size, textile_models(name))',
      )
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw error
    return (data ?? []) as unknown as HistoryRow[]
  }
}

export const historyService = new HistoryService()
