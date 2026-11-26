import { supabase } from '../supabase'
import type { Json } from '../types/supabase'

/** Which stock a booking or entry concerns: stamp models or textile variants. */
export type StockKind = 'STAMP' | 'TEXTILE'

export type StockBookingType = 'INBOUND' | 'OUTBOUND'

/** A stock entry as the movement lists show it: a booking in or out, or a release's deduction. */
export type StockMovementFields = {
  type: StockBookingType | 'AUTO_DEDUCTION'
  quantity: number
  note: string | null
}

type StockEntryBase = {
  id: string
  created_at: string
  event_type: 'STOCK_BOOKED' | 'STOCK_AUTO_DEDUCTED'
  user_id: string | null
  meta: Json | null
}

export type StampStockEntry = StockEntryBase & {
  stamp_models: { name: string } | null
}

export type TextileStockEntry = StockEntryBase & {
  textile_variants: {
    color: string
    size: string
    textile_models: {
      name: string
      textile_brands: { name: string } | null
    } | null
  } | null
}

const STOCK_EVENTS = ['STOCK_BOOKED', 'STOCK_AUTO_DEDUCTED'] as const

/** How many entries a movement list loads, newest first. */
const ENTRY_LIMIT = 200

/**
 * Stock as the database keeps it (decision 11 of TRANSACTION_RECORD.md): a
 * number changes only through `book_stock` or a release, each writing its
 * history entry in the same transaction, and the history is the only record
 * of what moved.
 */
class StockService {
  /**
   * Books goods in or out of a stamp model or textile variant. The database
   * locks the item, computes the new stock, refuses an outbound booking past
   * the available stock and writes STOCK_BOOKED. Admins only.
   *
   * @returns the item's new stock.
   */
  async bookStock(params: {
    kind: StockKind
    itemId: string
    type: StockBookingType
    quantity: number
    note?: string
  }): Promise<number> {
    const { data, error } = await supabase.rpc('book_stock', {
      p_kind: params.kind,
      p_item_id: params.itemId,
      p_type: params.type,
      p_quantity: params.quantity,
      p_note: params.note,
    })
    if (error) throw error
    return data
  }

  /** The newest stock entries of every stamp model, with the model's name. */
  async getStampStockEntries(): Promise<StampStockEntry[]> {
    const { data, error } = await supabase
      .from('history')
      .select('id, created_at, event_type, user_id, meta, stamp_models(name)')
      .in('event_type', STOCK_EVENTS)
      .not('stamp_model_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(ENTRY_LIMIT)
    if (error) throw error
    return (data ?? []) as unknown as StampStockEntry[]
  }

  /** The newest stock entries of every textile variant, with its colour, size, model and brand. */
  async getTextileStockEntries(): Promise<TextileStockEntry[]> {
    const { data, error } = await supabase
      .from('history')
      .select('id, created_at, event_type, user_id, meta, textile_variants(color, size, textile_models(name, textile_brands(name)))')
      .in('event_type', STOCK_EVENTS)
      .not('textile_variant_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(ENTRY_LIMIT)
    if (error) throw error
    return (data ?? []) as unknown as TextileStockEntry[]
  }
}

/**
 * Reads a stock entry's movement from its meta: the direction of a booking,
 * or AUTO_DEDUCTION for a release's deduction, the quantity and the note.
 */
export function stockMovementFields(entry: StockEntryBase): StockMovementFields {
  const meta = entry.meta !== null && typeof entry.meta === 'object' && !Array.isArray(entry.meta) ? entry.meta : {}
  const direction = meta.direction === 'INBOUND' ? 'INBOUND' : 'OUTBOUND'
  return {
    type: entry.event_type === 'STOCK_AUTO_DEDUCTED' ? 'AUTO_DEDUCTION' : direction,
    quantity: typeof meta.quantity === 'number' ? meta.quantity : 0,
    note: typeof meta.note === 'string' ? meta.note : null,
  }
}

export const stockService = new StockService()
