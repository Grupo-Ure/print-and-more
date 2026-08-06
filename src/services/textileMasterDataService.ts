import { supabase } from '../supabase'
import type { Database } from '../types/supabase'

type BrandInsert = Database['public']['Tables']['textile_brands']['Insert']
type BrandUpdate = Database['public']['Tables']['textile_brands']['Update']
type ProductInsert = Database['public']['Tables']['textile_products']['Insert']
type ProductUpdate = Database['public']['Tables']['textile_products']['Update']
type VariantInsert = Database['public']['Tables']['textile_variants']['Insert']
type VariantUpdate = Database['public']['Tables']['textile_variants']['Update']
type StockMovementInsert = Database['public']['Tables']['textile_stock_movements']['Insert']

export type BrandRow = Database['public']['Tables']['textile_brands']['Row']
export type ProductRow = Database['public']['Tables']['textile_products']['Row']
export type VariantRow = Database['public']['Tables']['textile_variants']['Row']

export type ProductWithBrand = ProductRow & {
  textile_brands: { name: string } | null
}

export type VariantWithDetails = VariantRow & {
  textile_products: {
    name: string
    article_number: string | null
    textile_brands: { name: string } | null
  } | null
}

export type TextileStockMovementRow = Database['public']['Tables']['textile_stock_movements']['Row'] & {
  textile_variants: {
    color: string
    size: string
    textile_products: {
      name: string
      textile_brands: { name: string } | null
    } | null
  } | null
}

/** Flatten a textile_garment_products row embedding its parent into {variant_id, quantity}. */
function toVariantUsage(row: unknown): { variant_id: string | null; quantity: number } {
  const r = row as { variant_id: string | null; department_products: { quantity: number | null } | { quantity: number | null }[] | null }
  const parent = Array.isArray(r.department_products) ? r.department_products[0] : r.department_products
  return { variant_id: r.variant_id ?? null, quantity: Number(parent?.quantity ?? 0) }
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

  async getProductsByBrand(markeId: string): Promise<ProductWithBrand[]> {
    const { data, error } = await supabase
      .from('textile_products')
      .select('*, textile_brands(name)')
      .eq('brand_id', markeId)
      .order('name')
    if (error) throw error
    return (data ?? []) as unknown as ProductWithBrand[]
  }

  async createProduct(payload: ProductInsert): Promise<ProductRow> {
    const { data, error } = await supabase
      .from('textile_products')
      .insert(payload)
      .select('*')
      .single()
    if (error) throw error
    return data as ProductRow
  }

  async updateProduct(id: string, patch: ProductUpdate): Promise<ProductRow> {
    const { data, error } = await supabase
      .from('textile_products')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return data as ProductRow
  }

  async getVariantsByProduct(produktId: string): Promise<VariantWithDetails[]> {
    const { data, error } = await supabase
      .from('textile_variants')
      .select('*, textile_products(name, article_number, textile_brands(name))')
      .eq('product_id', produktId)
      .order('sort_order')
    if (error) throw error
    return (data ?? []) as unknown as VariantWithDetails[]
  }

  async getVariantsWithDetails(): Promise<VariantWithDetails[]> {
    const { data, error } = await supabase
      .from('textile_variants')
      .select('*, textile_products(name, article_number, textile_brands(name))')
      .eq('is_active', true)
      .order('sort_order')
    if (error) throw error
    return (data ?? []) as unknown as VariantWithDetails[]
  }

  async getExistingVariantCombinations(
    produktId: string,
    colors: string[],
    sizes: string[],
  ): Promise<{ color: string; size: string }[]> {
    const { data, error } = await supabase
      .from('textile_variants')
      .select('color, size')
      .eq('product_id', produktId)
      .in('color', colors)
      .in('size', sizes)
    if (error) throw error
    return (data ?? []) as { color: string; size: string }[]
  }

  async getEigenwarePositionsByJobs(
    jobIds: string[],
  ): Promise<{ variant_id: string | null; quantity: number }[]> {
    if (jobIds.length === 0) return []
    const { data, error } = await supabase
      .from('textile_garment_products')
      .select('variant_id, department_products!inner(quantity, job_id)')
      .eq('origin', 'OWN_STOCK')
      .not('variant_id', 'is', null)
      .in('department_products.job_id', jobIds)
    if (error) throw error
    return (data ?? []).map(toVariantUsage)
  }

  async getMaxSortOrderForProduct(produktId: string): Promise<number | null> {
    const { data, error } = await supabase
      .from('textile_variants')
      .select('sort_order')
      .eq('product_id', produktId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data?.sort_order ?? null
  }

  async createVariant(payload: VariantInsert): Promise<VariantRow> {
    const { data, error } = await supabase
      .from('textile_variants')
      .insert(payload)
      .select('*')
      .single()
    if (error) throw error
    return data as VariantRow
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
      .select('*, textile_variants(color, size, textile_products(name, textile_brands(name)))')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) throw error
    return (data ?? []) as unknown as TextileStockMovementRow[]
  }

  async createTextileStockMovement(payload: StockMovementInsert): Promise<void> {
    const { error } = await supabase.from('textile_stock_movements').insert(payload)
    if (error) throw error
  }

  async getJobsUsingVariant(varianteId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('textile_garment_products')
      .select('department_products!inner(job_id)')
      .eq('variant_id', varianteId)
    if (error) throw error
    const ids = (data ?? []).map(row => {
      const dp = (row as { department_products: { job_id: string } | { job_id: string }[] | null }).department_products
      const parent = Array.isArray(dp) ? dp[0] : dp
      return parent?.job_id ?? ''
    })
    return [...new Set(ids.filter(Boolean))]
  }

  async getVariantUsageByJob(
    jobId: string,
  ): Promise<{ variant_id: string | null; quantity: number }[]> {
    const { data, error } = await supabase
      .from('textile_garment_products')
      .select('variant_id, department_products!inner(quantity, job_id)')
      .eq('department_products.job_id', jobId)
    if (error) throw error
    return (data ?? []).map(toVariantUsage)
  }
}

export const textileMasterDataService = new TextileMasterDataService()
