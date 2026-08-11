import { supabase } from '../supabase'
import type { Database } from '../types/supabase'

type StampModelRow = Database['public']['Tables']['stamp_models']['Row']
type StampModelInsert = Database['public']['Tables']['stamp_models']['Insert']
type StampModelUpdate = Database['public']['Tables']['stamp_models']['Update']
type StockMovementInsert = Database['public']['Tables']['stamp_stock_movements']['Insert']

export type StampModelSuggestion = Pick<
  StampModelRow,
  'id' | 'name' | 'stock' | 'max_width_mm' | 'max_height_mm' | 'print_area'
>

export type StockMovementRow = Database['public']['Tables']['stamp_stock_movements']['Row'] & {
  stamp_models: { name: string } | null
}

export type ReorderItem = Pick<
  StampModelRow,
  'id' | 'name' | 'article_number' | 'type' | 'color' | 'stock' | 'min_stock'
>

class StampService {
  async getStampModels(): Promise<StampModelRow[]> {
    const { data, error } = await supabase
      .from('stamp_models')
      .select('*')
      .eq('is_active', true)
    if (error) throw error
    return (data ?? []) as StampModelRow[]
  }

  async getStampModelById(id: string): Promise<{ stock: number } | null> {
    const { data, error } = await supabase
      .from('stamp_models')
      .select('stock')
      .eq('id', id)
      .single()
    if (error) throw error
    return data as { stock: number } | null
  }

  /** Batch stock lookup for the production-release availability check. */
  async getStampModelStocksByIds(ids: string[]): Promise<{ id: string; name: string; stock: number }[]> {
    if (ids.length === 0) return []
    const { data, error } = await supabase
      .from('stamp_models')
      .select('id, name, stock')
      .in('id', ids)
    if (error) throw error
    return (data ?? []) as { id: string; name: string; stock: number }[]
  }

  async getStampModelForOrder(id: string): Promise<{ replacement_pad_article_number: string | null } | null> {
    const { data, error } = await supabase
      .from('stamp_models')
      .select('replacement_pad_article_number')
      .eq('id', id)
      .single()
    if (error) throw error
    return data as { replacement_pad_article_number: string | null } | null
  }

  async findReplacementPad(
    article_number: string,
    color: string,
  ): Promise<{ id: string; stock: number } | null> {
    const { data, error } = await supabase
      .from('stamp_models')
      .select('id, stock')
      .eq('type', 'TRODAT_PAD')
      .eq('article_number', article_number)
      .eq('color', color)
      .maybeSingle()
    if (error) throw error
    return data as { id: string; stock: number } | null
  }

  async findPadBySize(size: string): Promise<{ stock: number } | null> {
    const { data, error } = await supabase
      .from('stamp_models')
      .select('stock')
      .eq('type', 'INK_PAD_PRODUCT')
      .eq('size', size)
      .maybeSingle()
    if (error) throw error
    return data as { stock: number } | null
  }

  async getStampModelsForSuggestion(
    type: string,
    width: number,
    height: number,
  ): Promise<StampModelSuggestion[]> {
    const { data, error } = await supabase
      .from('stamp_models')
      .select('id, name, stock, max_width_mm, max_height_mm, print_area')
      .eq('type', type)
      .eq('is_active', true)
      .gte('max_width_mm', width)
      .gte('max_height_mm', height)
    if (error) throw error
    return (data ?? []) as StampModelSuggestion[]
  }

  /** All active models for a type — client filters by dimensions. */
  async getStampModelsByType(type: string): Promise<(StampModelSuggestion & { replacement_pad_article_number: string | null })[]> {
    const { data, error } = await supabase
      .from('stamp_models')
      .select('id, name, stock, max_width_mm, max_height_mm, print_area, replacement_pad_article_number')
      .eq('type', type)
      .eq('is_active', true)
    if (error) throw error
    return (data ?? []) as (StampModelSuggestion & { replacement_pad_article_number: string | null })[]
  }

  /** Cushion rows for a given replacement-part article number. */
  async getCushionsByArticleNumber(
    article_number: string,
  ): Promise<{ id: string; name: string; color: string | null; stock: number | null }[]> {
    const { data, error } = await supabase
      .from('stamp_models')
      .select('id, name, color, stock')
      .eq('type', 'TRODAT_PAD')
      .eq('article_number', article_number)
      .order('color', { ascending: true })
    if (error) throw error
    return (data ?? []) as { id: string; name: string; color: string | null; stock: number | null }[]
  }

  /** Full-text search across cushion name and article number. */
  async searchCushions(
    query: string,
  ): Promise<{ id: string; name: string; article_number: string | null; color: string | null; stock: number; net_price: number | null }[]> {
    const escaped = query.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
    const pattern = `%${escaped}%`
    const { data, error } = await supabase
      .from('stamp_models')
      .select('id, name, article_number, color, stock, net_price')
      .eq('type', 'TRODAT_PAD')
      .eq('is_active', true)
      .or(`name.ilike.${pattern},article_number.ilike.${pattern}`)
      .order('article_number', { ascending: true })
    if (error) throw error
    return (data ?? []) as { id: string; name: string; article_number: string | null; color: string | null; stock: number; net_price: number | null }[]
  }

  async getReorderReport(): Promise<ReorderItem[]> {
    const { data, error } = await supabase
      .from('stamp_models')
      .select('id, name, article_number, type, color, stock, min_stock')
    if (error) throw error
    return (data ?? []).filter(r => r.stock <= r.min_stock) as ReorderItem[]
  }

  /** All models including inactive ones — master-data view only. */
  async getAllStampModelsForMasterData(): Promise<StampModelRow[]> {
    const { data, error } = await supabase
      .from('stamp_models')
      .select('*')
      .order('name', { ascending: true })
    if (error) throw error
    return (data ?? []) as StampModelRow[]
  }

  async createStampModel(payload: StampModelInsert): Promise<void> {
    const { error } = await supabase.from('stamp_models').insert(payload)
    if (error) throw error
  }

  async updateStampModel(id: string, patch: StampModelUpdate): Promise<void> {
    const { error } = await supabase.from('stamp_models').update(patch).eq('id', id)
    if (error) throw error
  }

  /** Distinct TRODAT_PAD article numbers — feeds the replacement-pad picker. */
  async getPadArticleNumbers(): Promise<string[]> {
    const { data, error } = await supabase
      .from('stamp_models')
      .select('article_number')
      .eq('type', 'TRODAT_PAD')
      .not('article_number', 'is', null)
    if (error) throw error
    const numbers = (data ?? [])
      .map(row => (row.article_number ?? '').trim())
      .filter(articleNumber => articleNumber !== '')
    return Array.from(new Set(numbers)).sort()
  }

  async updateStampModelStock(id: string, stock: number): Promise<void> {
    const patch: StampModelUpdate = { stock }
    const { error } = await supabase.from('stamp_models').update(patch).eq('id', id)
    if (error) throw error
  }

  async updateStampModelMinimumStock(id: string, min_stock: number): Promise<void> {
    const patch: StampModelUpdate = { min_stock }
    const { error } = await supabase.from('stamp_models').update(patch).eq('id', id)
    if (error) throw error
  }

  async createStockMovement(payload: StockMovementInsert): Promise<void> {
    const { error } = await supabase.from('stamp_stock_movements').insert(payload)
    if (error) throw error
  }

  async getStockMovements(): Promise<StockMovementRow[]> {
    const { data, error } = await supabase
      .from('stamp_stock_movements')
      .select('*, stamp_models(name)')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) throw error
    return (data ?? []) as unknown as StockMovementRow[]
  }
}

export const stampService = new StampService()
