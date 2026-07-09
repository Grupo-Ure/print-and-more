import { supabase } from '../supabase'
import type { Database } from '../types/supabase'
import type { TextileMotifRow } from '../types/textile'

type MotifInsert = Database['public']['Tables']['textile_motifs']['Insert']
type MotifUpdate = Database['public']['Tables']['textile_motifs']['Update']

export type VariantWithProduct = {
  id: string
  stock: number
  color: string
  size: string
  is_sample: boolean
  textile_products: { name: string; textile_brands: { name: string } } | null
}

export type ColorOption = {
  color: string
  color_hex: string | null
}

export type SizeOption = {
  id: string
  size: string
  stock: number
  is_sample: boolean
}

/**
 * Textile per-order service. Textile is a product department (garment lines are
 * department_products of type TEXTILE_GARMENT, handled by departmentProductService);
 * this service owns the job's reusable **designs drawer** (textile_motifs)
 * and the catalog lookups feeding the garment form. Garment design *links*
 * (textile_motif_links) live on departmentProductService alongside product_files.
 */
class TextileService {
  // --- Designs drawer (job scoped reusable motifs) --------------------

  async getMotifsByJob(jobId: string): Promise<TextileMotifRow[]> {
    const { data, error } = await supabase
      .from('textile_motifs')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at')
    if (error) throw error
    return (data ?? []) as unknown as TextileMotifRow[]
  }

  async createMotif(payload: MotifInsert): Promise<TextileMotifRow> {
    const { data, error } = await supabase
      .from('textile_motifs')
      .insert(payload)
      .select('*')
      .single()
    if (error) throw error
    return data as unknown as TextileMotifRow
  }

  async updateMotif(id: string, patch: MotifUpdate): Promise<TextileMotifRow> {
    const { data, error } = await supabase
      .from('textile_motifs')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return data as unknown as TextileMotifRow
  }

  async deleteMotif(id: string): Promise<void> {
    const { error } = await supabase.from('textile_motifs').delete().eq('id', id)
    if (error) throw error
  }

  // --- Stock usage (release auto-deduction) ---------------------------------

  /**
   * OWN_STOCK garment lines with a catalog variant in a job, with their
   * parent quantity — the source for the production-release stock deduction.
   * Replaces the old position-based `getEigenwarePositionsByJob`.
   */
  async getTextileGarmentStockUsageByJob(
    jobId: string,
  ): Promise<{ variant_id: string; quantity: number }[]> {
    const { data, error } = await supabase
      .from('textile_garment_products')
      .select('variant_id, department_products!inner(quantity, job_id)')
      .eq('origin', 'OWN_STOCK')
      .not('variant_id', 'is', null)
      .eq('department_products.job_id', jobId)
    if (error) throw error
    return (data ?? [])
      .map(row => {
        const r = row as { variant_id: string | null; department_products: { quantity: number | null } | { quantity: number | null }[] | null }
        const parent = Array.isArray(r.department_products) ? r.department_products[0] : r.department_products
        return { variant_id: String(r.variant_id ?? ''), quantity: Number(parent?.quantity ?? 0) }
      })
      .filter(r => r.variant_id !== '' && r.quantity >= 1)
  }

  // --- Catalog lookups (feed the garment form) ------------------------------

  async getVariantsByIds(ids: string[]): Promise<VariantWithProduct[]> {
    const { data, error } = await supabase
      .from('textile_variants')
      .select('id, stock, color, size, is_sample, textile_products(name, textile_brands(name))')
      .in('id', ids)
    if (error) throw error
    return (data ?? []) as unknown as VariantWithProduct[]
  }

  async getProductsByBrandId(brandId: string): Promise<{ id: string; name: string; article_number: string | null }[]> {
    const { data, error } = await supabase
      .from('textile_products')
      .select('id, name, article_number')
      .eq('brand_id', brandId)
      .eq('is_active', true)
      .order('name')
    if (error) throw error
    return (data ?? []) as { id: string; name: string; article_number: string | null }[]
  }

  async getVariantColorsByProduct(productId: string): Promise<ColorOption[]> {
    const { data, error } = await supabase
      .from('textile_variants')
      .select('color, color_hex')
      .eq('product_id', productId)
      .eq('is_active', true)
      .order('color')
    if (error) throw error
    return (data ?? []) as ColorOption[]
  }

  async getVariantSizesByProductAndColor(productId: string, color: string): Promise<SizeOption[]> {
    const { data, error } = await supabase
      .from('textile_variants')
      .select('id, size, stock, is_sample')
      .eq('product_id', productId)
      .eq('color', color)
      .eq('is_active', true)
      .order('sort_order')
    if (error) throw error
    return (data ?? []) as SizeOption[]
  }

  async getVariantById(id: string): Promise<{ id: string; product_id: string; color: string; size: string } | null> {
    const { data, error } = await supabase
      .from('textile_variants')
      .select('id, product_id, color, size')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data as { id: string; product_id: string; color: string; size: string } | null
  }

  async getProductById(id: string): Promise<{ id: string; brand_id: string } | null> {
    const { data, error } = await supabase
      .from('textile_products')
      .select('id, brand_id')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data as { id: string; brand_id: string } | null
  }
}

export const textileService = new TextileService()
