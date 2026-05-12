import { supabase } from '../supabase'
import type { Database } from '../types/supabase'
import type {
  TextileMotifRow,
  TextilePositionRow,
  TextileAssignmentRow,
} from '../types/textile'

type MotifInsert = Database['public']['Tables']['textile_motifs']['Insert']
type MotifUpdate = Database['public']['Tables']['textile_motifs']['Update']
type PositionInsert = Database['public']['Tables']['textile_positions']['Insert']
type PositionUpdate = Database['public']['Tables']['textile_positions']['Update']
type AssignmentInsert = Database['public']['Tables']['textile_assignments']['Insert']

const ASSIGNMENT_EMBED_SELECT =
  'id, sub_order_id, motif_id, position_id, textile_motifs(type, content, file_id, placement, size, print_method), textile_positions(origin, type, color, brand, model, size)'

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

export type PositionWithVariant = Database['public']['Tables']['textile_positions']['Row'] & {
  textile_variants: { id: string; textile_products: { name: string } | null } | null
}

class TextileService {
  async getTextileDataForSubOrder(subOrderId: string): Promise<{
    motifs: TextileMotifRow[]
    positions: TextilePositionRow[]
    assignments: TextileAssignmentRow[]
  }> {
    const [motifResult, positionResult, assignmentResult] = await Promise.all([
      supabase.from('textile_motifs').select('*').eq('sub_order_id', subOrderId),
      supabase.from('textile_positions').select('*').eq('sub_order_id', subOrderId),
      supabase.from('textile_assignments').select(ASSIGNMENT_EMBED_SELECT).eq('sub_order_id', subOrderId),
    ])
    if (motifResult.error) throw motifResult.error
    if (positionResult.error) throw positionResult.error
    if (assignmentResult.error) throw assignmentResult.error
    return {
      motifs: (motifResult.data ?? []) as unknown as TextileMotifRow[],
      positions: (positionResult.data ?? []) as unknown as TextilePositionRow[],
      assignments: (assignmentResult.data ?? []) as unknown as TextileAssignmentRow[],
    }
  }

  async getVariantsByIds(ids: string[]): Promise<VariantWithProduct[]> {
    const { data, error } = await supabase
      .from('textile_variants')
      .select('id, stock, color, size, is_sample, textile_products(name, textile_brands(name))')
      .in('id', ids)
    if (error) throw error
    return (data ?? []) as unknown as VariantWithProduct[]
  }

  async getProductsByBrandId(markeId: string): Promise<{ id: string; name: string; article_number: string | null }[]> {
    const { data, error } = await supabase
      .from('textile_products')
      .select('id, name, article_number')
      .eq('brand_id', markeId)
      .eq('is_active', true)
      .order('name')
    if (error) throw error
    return (data ?? []) as { id: string; name: string; article_number: string | null }[]
  }

  async getVariantColorsByProduct(produktId: string): Promise<ColorOption[]> {
    const { data, error } = await supabase
      .from('textile_variants')
      .select('color, color_hex')
      .eq('product_id', produktId)
      .eq('is_active', true)
      .order('color')
    if (error) throw error
    return (data ?? []) as ColorOption[]
  }

  async getVariantSizesByProductAndColor(produktId: string, color: string): Promise<SizeOption[]> {
    const { data, error } = await supabase
      .from('textile_variants')
      .select('id, size, stock, is_sample')
      .eq('product_id', produktId)
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

  async getEigenwarePositionsBySubOrder(
    subOrderId: string,
  ): Promise<{ id: string; variant_id: string | null; quantity: number; origin: string }[]> {
    const { data, error } = await supabase
      .from('textile_positions')
      .select('id, variant_id, quantity, origin')
      .eq('sub_order_id', subOrderId)
      .eq('origin', 'OWN_STOCK')
      .not('variant_id', 'is', null)
    if (error) throw error
    return (data ?? []) as { id: string; variant_id: string | null; quantity: number; origin: string }[]
  }

  async createAssignment(payload: AssignmentInsert): Promise<TextileAssignmentRow> {
    const { data, error } = await supabase
      .from('textile_assignments')
      .insert(payload)
      .select(ASSIGNMENT_EMBED_SELECT)
      .single()
    if (error) throw error
    return data as unknown as TextileAssignmentRow
  }

  async deleteAssignment(id: string): Promise<void> {
    const { error } = await supabase.from('textile_assignments').delete().eq('id', id)
    if (error) throw error
  }

  async deleteAssignmentsByPosition(positionId: string): Promise<void> {
    const { error } = await supabase
      .from('textile_assignments')
      .delete()
      .eq('position_id', positionId)
    if (error) throw error
  }

  async getAssignmentIdsByMotif(motivId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('textile_assignments')
      .select('id')
      .eq('motif_id', motivId)
    if (error) throw error
    return (data ?? []).map(r => r.id)
  }

  async getAssignmentIdsByPosition(positionId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('textile_assignments')
      .select('id')
      .eq('position_id', positionId)
    if (error) throw error
    return (data ?? []).map(r => r.id)
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

  async createMotif(payload: MotifInsert): Promise<TextileMotifRow> {
    const { data, error } = await supabase
      .from('textile_motifs')
      .insert(payload)
      .select('*')
      .single()
    if (error) throw error
    return data as unknown as TextileMotifRow
  }

  async deleteMotif(id: string): Promise<void> {
    const { error } = await supabase.from('textile_motifs').delete().eq('id', id)
    if (error) throw error
  }

  async updatePosition(id: string, patch: PositionUpdate): Promise<TextilePositionRow> {
    const { data, error } = await supabase
      .from('textile_positions')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return data as unknown as TextilePositionRow
  }

  async createPosition(payload: PositionInsert): Promise<TextilePositionRow> {
    const { data, error } = await supabase
      .from('textile_positions')
      .insert(payload)
      .select('*')
      .single()
    if (error) throw error
    return data as unknown as TextilePositionRow
  }

  async deletePosition(id: string): Promise<void> {
    const { error } = await supabase.from('textile_positions').delete().eq('id', id)
    if (error) throw error
  }

  async getPositionsWithVariants(subOrderId: string): Promise<PositionWithVariant[]> {
    const { data, error } = await supabase
      .from('textile_positions')
      .select('*, textile_variants(id, textile_products(name))')
      .eq('sub_order_id', subOrderId)
      .order('id')
    if (error) throw error
    return (data ?? []) as unknown as PositionWithVariant[]
  }
}

export const textileService = new TextileService()
