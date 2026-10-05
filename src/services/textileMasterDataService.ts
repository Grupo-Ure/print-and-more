import { supabase } from '../supabase'
import type { Database } from '../types/supabase'

type BrandInsert = Database['public']['Tables']['textile_brands']['Insert']
type BrandUpdate = Database['public']['Tables']['textile_brands']['Update']
type ModelInsert = Database['public']['Tables']['textile_models']['Insert']
type ModelUpdate = Database['public']['Tables']['textile_models']['Update']
type VariantInsert = Database['public']['Tables']['textile_variants']['Insert']
type VariantUpdate = Database['public']['Tables']['textile_variants']['Update']
type StockMovementInsert = Database['public']['Tables']['textile_stock_movements']['Insert']

export type BrandRow = Database['public']['Tables']['textile_brands']['Row']
export type TextileModelRow = Database['public']['Tables']['textile_models']['Row']
export type VariantRow = Database['public']['Tables']['textile_variants']['Row']

export type ModelWithBrand = TextileModelRow & {
  textile_brands: { name: string } | null
}

export type VariantWithDetails = VariantRow & {
  textile_models: {
    name: string
    article_number: string | null
    textile_brands: { name: string } | null
  } | null
}

export type TextileStockMovementRow = Database['public']['Tables']['textile_stock_movements']['Row'] & {
  textile_variants: {
    color: string
    size: string
    textile_models: {
      name: string
      textile_brands: { name: string } | null
    } | null
  } | null
}

/**
 * A garment line's claim on a catalog variant. The quantity lives on the line
 * itself now — the job model kept it on the parent, which is why every usage
 * query used to join it.
 */
function toVariantUsage(row: { variant_id: string | null; quantity: number | null }): {
  variant_id: string | null
  quantity: number
} {
  return { variant_id: row.variant_id ?? null, quantity: Number(row.quantity ?? 0) }
}

class TextileMasterDataService {
  async getBrands(): Promise<BrandRow[]> {
    const { data, error } = await supabase
      .from('textile_brands')
      .select('*')
      .order('name')
    if (error) throw error
    return (data ?? []) as BrandRow[]
  }

  async getBrandNames(): Promise<{ id: string; name: string }[]> {
    const { data, error } = await supabase
      .from('textile_brands')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
    if (error) throw error
    return (data ?? []) as { id: string; name: string }[]
  }

  async createBrand(name: string): Promise<BrandRow> {
    const payload: BrandInsert = { name, is_active: true }
    const { data, error } = await supabase
      .from('textile_brands')
      .insert(payload)
      .select('*')
      .single()
    if (error) throw error
    return data as BrandRow
  }

  async updateBrand(id: string, patch: BrandUpdate): Promise<BrandRow> {
    const { data, error } = await supabase
      .from('textile_brands')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return data as BrandRow
  }

  async getModelsByBrand(brandId: string): Promise<ModelWithBrand[]> {
    const { data, error } = await supabase
      .from('textile_models')
      .select('*, textile_brands(name)')
      .eq('brand_id', brandId)
      .order('name')
    if (error) throw error
    return (data ?? []) as unknown as ModelWithBrand[]
  }

  async createModel(payload: ModelInsert): Promise<TextileModelRow> {
    const { data, error } = await supabase
      .from('textile_models')
      .insert(payload)
      .select('*')
      .single()
    if (error) throw error
    return data as TextileModelRow
  }

  async updateModel(id: string, patch: ModelUpdate): Promise<TextileModelRow> {
    const { data, error } = await supabase
      .from('textile_models')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return data as TextileModelRow
  }

  async getVariantsByModel(modelId: string): Promise<VariantWithDetails[]> {
    const { data, error } = await supabase
      .from('textile_variants')
      .select('*, textile_models(name, article_number, textile_brands(name))')
      .eq('model_id', modelId)
      .order('sort_order')
    if (error) throw error
    return (data ?? []) as unknown as VariantWithDetails[]
  }

  async getVariantsWithDetails(): Promise<VariantWithDetails[]> {
    const { data, error } = await supabase
      .from('textile_variants')
      .select('*, textile_models(name, article_number, textile_brands(name))')
      .eq('is_active', true)
      .order('sort_order')
    if (error) throw error
    return (data ?? []) as unknown as VariantWithDetails[]
  }

  async getExistingVariantCombinations(
    modelId: string,
    colors: string[],
    sizes: string[],
  ): Promise<{ color: string; size: string }[]> {
    const { data, error } = await supabase
      .from('textile_variants')
      .select('color, size')
      .eq('model_id', modelId)
      .in('color', colors)
      .in('size', sizes)
    if (error) throw error
    return (data ?? []) as { color: string; size: string }[]
  }

  /**
   * Open demand per catalog variant: every shop-supplied garment line of a
   * TEXTILE product that is neither done nor cancelled. Feeds the reorder
   * list. One round trip — the status filter rides on the product, and the
   * quantity on the line.
   */
  async getShopSuppliedDemand(): Promise<{ variant_id: string | null; quantity: number }[]> {
    const { data, error } = await supabase
      .from('textile_garments')
      .select('variant_id, quantity, products!inner(status, is_cancelled)')
      .eq('origin', 'SHOP_SUPPLIED')
      .not('variant_id', 'is', null)
      .eq('products.is_cancelled', false)
      .neq('products.status', 'DONE')
    if (error) throw error
    return (data ?? []).map(toVariantUsage)
  }

  async createVariantsBatch(payloads: VariantInsert[]): Promise<VariantRow[]> {
    const { data, error } = await supabase
      .from('textile_variants')
      .insert(payloads)
      .select('*')
    if (error) throw error
    return (data ?? []) as VariantRow[]
  }

  async updateVariantStock(id: string, stock: number): Promise<void> {
    const { error } = await supabase
      .from('textile_variants')
      .update({ stock } as VariantUpdate)
      .eq('id', id)
    if (error) throw error
  }

  async updateVariantMinimumStock(id: string, min_stock: number): Promise<void> {
    const { error } = await supabase
      .from('textile_variants')
      .update({ min_stock } as VariantUpdate)
      .eq('id', id)
    if (error) throw error
  }

  async updateVariant(id: string, patch: VariantUpdate): Promise<VariantRow> {
    const { data, error } = await supabase
      .from('textile_variants')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return data as VariantRow
  }

  async getVariantStockById(id: string): Promise<{ stock: number } | null> {
    const { data, error } = await supabase
      .from('textile_variants')
      .select('stock')
      .eq('id', id)
      .single()
    if (error) throw error
    return data as { stock: number } | null
  }

  async getStockMovements(): Promise<TextileStockMovementRow[]> {
    const { data, error } = await supabase
      .from('textile_stock_movements')
      .select('*, textile_variants(color, size, textile_models(name, textile_brands(name)))')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) throw error
    return (data ?? []) as unknown as TextileStockMovementRow[]
  }

  async createTextileStockMovement(payload: StockMovementInsert): Promise<void> {
    const { error } = await supabase.from('textile_stock_movements').insert(payload)
    if (error) throw error
  }

  async deleteVariant(id: string): Promise<void> {
    const { error } = await supabase.from('textile_variants').delete().eq('id', id)
    if (error) throw error
  }

  async deleteBrand(id: string): Promise<void> {
    const { error } = await supabase.from('textile_brands').delete().eq('id', id)
    if (error) throw error
  }

  async deleteModel(id: string): Promise<void> {
    // Variants first — the FK from textile_variants has no cascade.
    const { error: variantsError } = await supabase
      .from('textile_variants')
      .delete()
      .eq('model_id', id)
    if (variantsError) throw variantsError
    const { error } = await supabase.from('textile_models').delete().eq('id', id)
    if (error) throw error
  }

  /** The products whose garment lines use this catalog variant. */
  async getProductsUsingVariant(variantId: string): Promise<string[]> {
    return this.getProductsUsingVariants([variantId])
  }

  async getProductsUsingVariants(variantIds: string[]): Promise<string[]> {
    if (variantIds.length === 0) return []
    const { data, error } = await supabase
      .from('textile_garments')
      .select('product_id')
      .in('variant_id', variantIds)
    if (error) throw error
    return [...new Set((data ?? []).map(row => row.product_id).filter(Boolean))]
  }
}

export const textileMasterDataService = new TextileMasterDataService()
