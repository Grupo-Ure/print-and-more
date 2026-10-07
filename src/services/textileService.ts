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

/** Where one variant sits in the catalog cascade — its colour, model and brand. */
export type VariantCascade = {
  variantId: string
  brandId: string
  modelId: string
  color: string
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

  /**
   * The colours a model is carried in, one option per colour. A variant row is
   * one colour × size, so the query returns a colour once per size; the rows
   * are collapsed here, keeping the first swatch a colour carries.
   */
  async getVariantColorsByModel(modelId: string): Promise<ColorOption[]> {
    const { data, error } = await supabase
      .from('textile_variants')
      .select('color, color_hex')
      .eq('model_id', modelId)
      .eq('is_active', true)
      .order('color')
    if (error) throw error
    const byColor = new Map<string, ColorOption>()
    for (const row of (data ?? []) as ColorOption[]) {
      const seen = byColor.get(row.color)
      if (!seen) byColor.set(row.color, row)
      else if (seen.color_hex == null && row.color_hex != null) seen.color_hex = row.color_hex
    }
    return [...byColor.values()]
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

  /**
   * The cascade walked back *up*: for each variant, the colour it is and the
   * model and brand it belongs to. A stored garment line references the
   * variant alone, so the batch editor resolves its grid rows through this
   * before it can offer the model's full size run. Variants that no longer
   * exist are simply absent from the result.
   *
   * Mapped straight off the row the client infers, with no assertion in
   * between: a column that leaves the schema turns `data` into a
   * `SelectQueryError` and stops this mapping from compiling. The model is
   * embedded through a NOT NULL key, so it is always there.
   */
  async getVariantCascades(ids: string[]): Promise<VariantCascade[]> {
    const { data, error } = await supabase
      .from('textile_variants')
      .select('id, color, model_id, textile_models(brand_id)')
      .in('id', ids)
    if (error) throw error
    return (data ?? []).map(row => ({
      variantId: row.id,
      modelId: row.model_id,
      brandId: row.textile_models.brand_id,
      color: row.color,
    }))
  }
}

export const textileService = new TextileService()
