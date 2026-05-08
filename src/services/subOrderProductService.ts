import { supabase } from '../supabase'
import type { Database, Json } from '../types/supabase'

type ProductInsert = Database['public']['Tables']['teilauftrag_produkte']['Insert']
type ProductUpdate = Database['public']['Tables']['teilauftrag_produkte']['Update']
type FileAssignInsert = Database['public']['Tables']['produkt_dateien']['Insert']

export type SubOrderProductRow = {
  id: string
  teilauftrag_id: string
  bereich: string
  detail: Json
  sort_order: number
  erstellt_am: string
}

class SubOrderProductService {
  async getProductsBySubOrderId(subOrderId: string): Promise<SubOrderProductRow[]> {
    const { data, error } = await supabase
      .from('teilauftrag_produkte')
      .select('*')
      .eq('teilauftrag_id', subOrderId)
      .order('sort_order')
    if (error) throw error
    return (data ?? []) as SubOrderProductRow[]
  }

  async createProduct(payload: ProductInsert): Promise<SubOrderProductRow> {
    const { data, error } = await supabase
      .from('teilauftrag_produkte')
      .insert(payload)
      .select('*')
      .single()
    if (error) throw error
    return data as SubOrderProductRow
  }

  async updateProduct(id: string, patch: ProductUpdate): Promise<void> {
    const { error } = await supabase
      .from('teilauftrag_produkte')
      .update(patch)
      .eq('id', id)
    if (error) throw error
  }

  async deleteProduct(id: string): Promise<void> {
    const { error } = await supabase.from('teilauftrag_produkte').delete().eq('id', id)
    if (error) throw error
  }

  async assignFileToProduct(produktId: string, dateiId: string): Promise<void> {
    const payload: FileAssignInsert = { produkt_id: produktId, datei_id: dateiId }
    const { error } = await supabase.from('produkt_dateien').insert(payload)
    if (error) throw error
  }

  async removeFileFromProduct(id: string): Promise<void> {
    const { error } = await supabase.from('produkt_dateien').delete().eq('id', id)
    if (error) throw error
  }
}

export const subOrderProductService = new SubOrderProductService()
