import { supabase } from '../supabase'
import type { Database } from '../types/supabase'
import type {
  TextileMotifRow,
  TextilePositionRow,
  TextileAssignmentRow,
} from '../types/textile'

type MotifInsert = Database['public']['Tables']['textil_motive']['Insert']
type MotifUpdate = Database['public']['Tables']['textil_motive']['Update']
type PositionInsert = Database['public']['Tables']['textil_positionen']['Insert']
type PositionUpdate = Database['public']['Tables']['textil_positionen']['Update']
type AssignmentInsert = Database['public']['Tables']['textil_zuordnungen']['Insert']

const ASSIGNMENT_EMBED_SELECT =
  'id, teilauftrag_id, motiv_id, position_id, textil_motive(typ, inhalt, datei_id, platz, groesse, druckart), textil_positionen(herkunft, typ, farbe, marke, modell, groesse)'

export type VariantWithProduct = {
  id: string
  bestand: number
  farbe: string
  groesse: string
  ist_muster: boolean
  textil_produkte: { name: string; textil_marken: { name: string } } | null
}

export type ColorOption = {
  farbe: string
  farbe_hex: string | null
}

export type SizeOption = {
  id: string
  groesse: string
  bestand: number
  ist_muster: boolean
}

export type PositionWithVariant = Database['public']['Tables']['textil_positionen']['Row'] & {
  textil_varianten: { id: string; textil_produkte: { name: string } | null } | null
}

class TextileService {
  async getTextileDataForSubOrder(subOrderId: string): Promise<{
    motifs: TextileMotifRow[]
    positions: TextilePositionRow[]
    assignments: TextileAssignmentRow[]
  }> {
    const [motifResult, positionResult, assignmentResult] = await Promise.all([
      supabase.from('textil_motive').select('*').eq('teilauftrag_id', subOrderId),
      supabase.from('textil_positionen').select('*').eq('teilauftrag_id', subOrderId),
      supabase.from('textil_zuordnungen').select(ASSIGNMENT_EMBED_SELECT).eq('teilauftrag_id', subOrderId),
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
      .from('textil_varianten')
      .select('id, bestand, farbe, groesse, ist_muster, textil_produkte(name, textil_marken(name))')
      .in('id', ids)
    if (error) throw error
    return (data ?? []) as unknown as VariantWithProduct[]
  }

  async getProductsByBrandId(markeId: string): Promise<{ id: string; name: string; artikelnummer: string | null }[]> {
    const { data, error } = await supabase
      .from('textil_produkte')
      .select('id, name, artikelnummer')
      .eq('marke_id', markeId)
    if (error) throw error
    return (data ?? []) as { id: string; name: string; artikelnummer: string | null }[]
  }

  async getVariantColorsByProduct(produktId: string): Promise<ColorOption[]> {
    const { data, error } = await supabase
      .from('textil_varianten')
      .select('farbe, farbe_hex')
      .eq('produkt_id', produktId)
    if (error) throw error
    return (data ?? []) as ColorOption[]
  }

  async getVariantSizesByProductAndColor(produktId: string, farbe: string): Promise<SizeOption[]> {
    const { data, error } = await supabase
      .from('textil_varianten')
      .select('id, groesse, bestand, ist_muster')
      .eq('produkt_id', produktId)
      .eq('farbe', farbe)
    if (error) throw error
    return (data ?? []) as SizeOption[]
  }

  async getVariantById(id: string): Promise<{ id: string; produkt_id: string; farbe: string; groesse: string } | null> {
    const { data, error } = await supabase
      .from('textil_varianten')
      .select('id, produkt_id, farbe, groesse')
      .eq('id', id)
      .single()
    if (error) throw error
    return data as { id: string; produkt_id: string; farbe: string; groesse: string } | null
  }

  async getProductById(id: string): Promise<{ id: string; marke_id: string } | null> {
    const { data, error } = await supabase
      .from('textil_produkte')
      .select('id, marke_id')
      .eq('id', id)
      .single()
    if (error) throw error
    return data as { id: string; marke_id: string } | null
  }

  async createAssignment(payload: AssignmentInsert): Promise<TextileAssignmentRow> {
    const { data, error } = await supabase
      .from('textil_zuordnungen')
      .insert(payload)
      .select(ASSIGNMENT_EMBED_SELECT)
      .single()
    if (error) throw error
    return data as unknown as TextileAssignmentRow
  }

  async deleteAssignment(id: string): Promise<void> {
    const { error } = await supabase.from('textil_zuordnungen').delete().eq('id', id)
    if (error) throw error
  }

  async deleteAssignmentsByPosition(positionId: string): Promise<void> {
    const { error } = await supabase
      .from('textil_zuordnungen')
      .delete()
      .eq('position_id', positionId)
    if (error) throw error
  }

  async getAssignmentIdsByMotif(motivId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('textil_zuordnungen')
      .select('id')
      .eq('motiv_id', motivId)
    if (error) throw error
    return (data ?? []).map(r => r.id)
  }

  async getAssignmentIdsByPosition(positionId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('textil_zuordnungen')
      .select('id')
      .eq('position_id', positionId)
    if (error) throw error
    return (data ?? []).map(r => r.id)
  }

  async updateMotif(id: string, patch: MotifUpdate): Promise<TextileMotifRow> {
    const { data, error } = await supabase
      .from('textil_motive')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return data as unknown as TextileMotifRow
  }

  async createMotif(payload: MotifInsert): Promise<TextileMotifRow> {
    const { data, error } = await supabase
      .from('textil_motive')
      .insert(payload)
      .select('*')
      .single()
    if (error) throw error
    return data as unknown as TextileMotifRow
  }

  async deleteMotif(id: string): Promise<void> {
    const { error } = await supabase.from('textil_motive').delete().eq('id', id)
    if (error) throw error
  }

  async updatePosition(id: string, patch: PositionUpdate): Promise<TextilePositionRow> {
    const { data, error } = await supabase
      .from('textil_positionen')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return data as unknown as TextilePositionRow
  }

  async createPosition(payload: PositionInsert): Promise<TextilePositionRow> {
    const { data, error } = await supabase
      .from('textil_positionen')
      .insert(payload)
      .select('*')
      .single()
    if (error) throw error
    return data as unknown as TextilePositionRow
  }

  async deletePosition(id: string): Promise<void> {
    const { error } = await supabase.from('textil_positionen').delete().eq('id', id)
    if (error) throw error
  }

  async getPositionsWithVariants(subOrderId: string): Promise<PositionWithVariant[]> {
    const { data, error } = await supabase
      .from('textil_positionen')
      .select('*, textil_varianten(id, textil_produkte(name))')
      .eq('teilauftrag_id', subOrderId)
      .order('id')
    if (error) throw error
    return (data ?? []) as unknown as PositionWithVariant[]
  }
}

export const textileService = new TextileService()
