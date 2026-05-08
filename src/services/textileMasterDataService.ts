import { supabase } from '../supabase'
import type { Database } from '../types/supabase'

type BrandInsert = Database['public']['Tables']['textil_marken']['Insert']
type BrandUpdate = Database['public']['Tables']['textil_marken']['Update']
type ProductInsert = Database['public']['Tables']['textil_produkte']['Insert']
type ProductUpdate = Database['public']['Tables']['textil_produkte']['Update']
type VariantInsert = Database['public']['Tables']['textil_varianten']['Insert']
type VariantUpdate = Database['public']['Tables']['textil_varianten']['Update']
type StockMovementInsert = Database['public']['Tables']['textil_lager_bewegungen']['Insert']

export type BrandRow = Database['public']['Tables']['textil_marken']['Row']
export type ProductRow = Database['public']['Tables']['textil_produkte']['Row']
export type VariantRow = Database['public']['Tables']['textil_varianten']['Row']

export type ProductWithBrand = ProductRow & {
  textil_marken: { name: string } | null
}

export type VariantWithDetails = VariantRow & {
  textil_produkte: {
    name: string
    artikelnummer: string | null
    textil_marken: { name: string } | null
  } | null
}

class TextileMasterDataService {
  async getBrands(): Promise<BrandRow[]> {
    const { data, error } = await supabase
      .from('textil_marken')
      .select('*')
      .order('name')
    if (error) throw error
    return (data ?? []) as BrandRow[]
  }

  async getBrandNames(): Promise<{ id: string; name: string }[]> {
    const { data, error } = await supabase
      .from('textil_marken')
      .select('id, name')
      .eq('aktiv', true)
      .order('name')
    if (error) throw error
    return (data ?? []) as { id: string; name: string }[]
  }

  async createBrand(name: string): Promise<BrandRow> {
    const payload: BrandInsert = { name, aktiv: true }
    const { data, error } = await supabase
      .from('textil_marken')
      .insert(payload)
      .select('*')
      .single()
    if (error) throw error
    return data as BrandRow
  }

  async updateBrand(id: string, patch: BrandUpdate): Promise<BrandRow> {
    const { data, error } = await supabase
      .from('textil_marken')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return data as BrandRow
  }

  async getProductsByBrand(markeId: string): Promise<ProductWithBrand[]> {
    const { data, error } = await supabase
      .from('textil_produkte')
      .select('*, textil_marken(name)')
      .eq('marke_id', markeId)
    if (error) throw error
    return (data ?? []) as unknown as ProductWithBrand[]
  }

  async createProduct(payload: ProductInsert): Promise<ProductRow> {
    const { data, error } = await supabase
      .from('textil_produkte')
      .insert(payload)
      .select('*')
      .single()
    if (error) throw error
    return data as ProductRow
  }

  async updateProduct(id: string, patch: ProductUpdate): Promise<ProductRow> {
    const { data, error } = await supabase
      .from('textil_produkte')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return data as ProductRow
  }

  async getVariantsByProduct(produktId: string): Promise<VariantWithDetails[]> {
    const { data, error } = await supabase
      .from('textil_varianten')
      .select('*, textil_produkte(name, artikelnummer, textil_marken(name))')
      .eq('produkt_id', produktId)
    if (error) throw error
    return (data ?? []) as unknown as VariantWithDetails[]
  }

  async getVariantsWithDetails(): Promise<VariantWithDetails[]> {
    const { data, error } = await supabase
      .from('textil_varianten')
      .select('*, textil_produkte(name, artikelnummer, textil_marken(name))')
    if (error) throw error
    return (data ?? []) as unknown as VariantWithDetails[]
  }

  async getMaxSortOrderForProduct(produktId: string): Promise<number | null> {
    const { data, error } = await supabase
      .from('textil_varianten')
      .select('sort_order')
      .eq('produkt_id', produktId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data?.sort_order ?? null
  }

  async createVariant(payload: VariantInsert): Promise<VariantRow> {
    const { data, error } = await supabase
      .from('textil_varianten')
      .insert(payload)
      .select('*')
      .single()
    if (error) throw error
    return data as VariantRow
  }

  async createVariantsBatch(payloads: VariantInsert[]): Promise<VariantRow[]> {
    const { data, error } = await supabase
      .from('textil_varianten')
      .insert(payloads)
      .select('*')
    if (error) throw error
    return (data ?? []) as VariantRow[]
  }

  async updateVariantStock(id: string, bestand: number): Promise<void> {
    const { error } = await supabase
      .from('textil_varianten')
      .update({ bestand } as VariantUpdate)
      .eq('id', id)
    if (error) throw error
  }

  async updateVariantMinimumStock(id: string, mindestbestand: number): Promise<void> {
    const { error } = await supabase
      .from('textil_varianten')
      .update({ mindestbestand } as VariantUpdate)
      .eq('id', id)
    if (error) throw error
  }

  async updateVariant(id: string, patch: VariantUpdate): Promise<VariantRow> {
    const { data, error } = await supabase
      .from('textil_varianten')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return data as VariantRow
  }

  async getVariantStockById(id: string): Promise<{ bestand: number } | null> {
    const { data, error } = await supabase
      .from('textil_varianten')
      .select('bestand')
      .eq('id', id)
      .single()
    if (error) throw error
    return data as { bestand: number } | null
  }

  async createTextileStockMovement(payload: StockMovementInsert): Promise<void> {
    const { error } = await supabase.from('textil_lager_bewegungen').insert(payload)
    if (error) throw error
  }

  async getSubOrdersUsingVariant(varianteId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('textil_positionen')
      .select('teilauftrag_id')
      .eq('variante_id', varianteId)
    if (error) throw error
    return [...new Set((data ?? []).map(r => r.teilauftrag_id))]
  }

  async getVariantUsageBySubOrder(
    subOrderId: string,
  ): Promise<{ variante_id: string | null; stueckzahl: number }[]> {
    const { data, error } = await supabase
      .from('textil_positionen')
      .select('variante_id, stueckzahl')
      .eq('teilauftrag_id', subOrderId)
    if (error) throw error
    return (data ?? []) as { variante_id: string | null; stueckzahl: number }[]
  }
}

export const textileMasterDataService = new TextileMasterDataService()
