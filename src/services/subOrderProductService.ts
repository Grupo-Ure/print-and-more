import { supabase } from '../supabase'
import type { Database, Json } from '../types/supabase'

type ProductInsert = Database['public']['Tables']['sub_order_products']['Insert']
type ProductUpdate = Database['public']['Tables']['sub_order_products']['Update']
type FileAssignInsert = Database['public']['Tables']['product_files']['Insert']

export type SubOrderProductRow = {
  id: string
  sub_order_id: string
  department: string
  detail: Json
  sort_order: number
  created_at: string
}

export type ProductFileAssignment = {
  id: string
  product_id: string
  file_id: string
}

class SubOrderProductService {
  async getProductsBySubOrderId(subOrderId: string): Promise<SubOrderProductRow[]> {
    const { data, error } = await supabase
      .from('sub_order_products')
      .select('*')
      .eq('sub_order_id', subOrderId)
      .order('sort_order')
    if (error) throw error
    return (data ?? []) as SubOrderProductRow[]
  }

  async createProduct(payload: ProductInsert): Promise<SubOrderProductRow> {
    const { data, error } = await supabase
      .from('sub_order_products')
      .insert(payload)
      .select('*')
      .single()
    if (error) throw error
    return data as SubOrderProductRow
  }

  async updateProduct(id: string, patch: ProductUpdate): Promise<void> {
    const { error } = await supabase
      .from('sub_order_products')
      .update(patch)
      .eq('id', id)
    if (error) throw error
  }

  async deleteProduct(id: string): Promise<void> {
    const { error } = await supabase.from('sub_order_products').delete().eq('id', id)
    if (error) throw error
  }

  async getFilesByProductIds(ids: string[]): Promise<ProductFileAssignment[]> {
    if (ids.length === 0) return []
    const { data, error } = await supabase
      .from('product_files')
      .select('id, product_id, file_id')
      .in('product_id', ids)
    if (error) throw error
    return (data ?? []) as ProductFileAssignment[]
  }

  async assignFileToProduct(productId: string, fileId: string): Promise<void> {
    const payload: FileAssignInsert = { product_id: productId, file_id: fileId }
    const { error } = await supabase.from('product_files').insert(payload)
    if (error) throw error
  }

  async removeFileFromProduct(id: string): Promise<void> {
    const { error } = await supabase.from('product_files').delete().eq('id', id)
    if (error) throw error
  }
}

export const subOrderProductService = new SubOrderProductService()
