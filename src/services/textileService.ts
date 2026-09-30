import { supabase } from '../supabase'

export type VariantWithModel = {
  id: string
  stock: number
  color: string
  size: string
  sample_stock: number
  textile_models: { name: string; textile_brands: { name: string } } | null
}

export type ColorOption = {
  color: string
  color_hex: string | null
}

export type SizeOption = {
  id: string
  size: string
  stock: number
  sample_stock: number
}

/**
 * Textile per-order reads: the catalog lookups that feed the batch editor's
 * model/colour/size cascade, plus the variant rows the release's shortage check
 * compares against.
 *
 * A batch's own content — its garment lines and its designs — is written and
 * read through `productService` with the rest of the product, because both are
 * children of the product. (The job model split them: designs sat here as a
 * per-job drawer, and their links sat on the product service.)
 */
class TextileService {
  // --- Catalog lookups (feed the batch editor) ------------------------------

  async getVariantsByIds(ids: string[]): Promise<VariantWithModel[]> {
    const { data, error } = await supabase
      .from('textile_variants')
      .select('id, stock, color, size, sample_stock, textile_models(name, textile_brands(name))')
      .in('id', ids)
    if (error) throw error
    return (data ?? []) as unknown as VariantWithModel[]
  }

  async getModelsByBrandId(brandId: string): Promise<{ id: string; name: string; article_number: string | null }[]> {
    const { data, error } = await supabase
      .from('textile_models')
      .select('id, name, article_number')
      .eq('brand_id', brandId)
      .eq('is_active', true)
      .order('name')
    if (error) throw error
    return (data ?? []) as { id: string; name: string; article_number: string | null }[]
  }

  async getVariantColorsByModel(modelId: string): Promise<ColorOption[]> {
    const { data, error } = await supabase
      .from('textile_variants')
      .select('color, color_hex')
      .eq('model_id', modelId)
      .eq('is_active', true)
      .order('color')
    if (error) throw error
    return (data ?? []) as ColorOption[]
  }

  /**
   * The sizes carried in one model and colour — one row of the batch editor's
   * size grid. The option's value *is* the variant id, so a picked size can
   * never name a SKU that does not exist.
   */
  async getVariantSizesByModelAndColor(modelId: string, color: string): Promise<SizeOption[]> {
    const { data, error } = await supabase
      .from('textile_variants')
      .select('id, size, stock, sample_stock')
      .eq('model_id', modelId)
      .eq('color', color)
      .eq('is_active', true)
      .order('sort_order')
    if (error) throw error
    return (data ?? []) as SizeOption[]
  }

  async getVariantById(id: string): Promise<{ id: string; model_id: string; color: string; size: string } | null> {
    const { data, error } = await supabase
      .from('textile_variants')
      .select('id, model_id, color, size')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data as { id: string; model_id: string; color: string; size: string } | null
  }

  async getModelById(id: string): Promise<{ id: string; brand_id: string } | null> {
    const { data, error } = await supabase
      .from('textile_models')
      .select('id, brand_id')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data as { id: string; brand_id: string } | null
  }
}

export const textileService = new TextileService()
