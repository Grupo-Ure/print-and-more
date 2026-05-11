import { supabase } from '../supabase'
import type { Database } from '../types/supabase'

type StampModelRow = Database['public']['Tables']['stempel_modelle']['Row']
type StampModelUpdate = Database['public']['Tables']['stempel_modelle']['Update']
type StockMovementInsert = Database['public']['Tables']['lager_bewegungen']['Insert']

export type StampModelSuggestion = Pick<
  StampModelRow,
  'id' | 'name' | 'bestand' | 'max_breite_mm' | 'max_hoehe_mm' | 'druckflaeche'
>

export type StockMovementRow = Database['public']['Tables']['lager_bewegungen']['Row'] & {
  stempel_modelle: { name: string } | null
}

export type ReorderItem = Pick<
  StampModelRow,
  'id' | 'name' | 'artikelnummer' | 'typ' | 'farbe' | 'bestand' | 'mindestbestand'
>

class StampService {
  async getStampModels(): Promise<StampModelRow[]> {
    const { data, error } = await supabase
      .from('stempel_modelle')
      .select('*')
      .eq('aktiv', true)
    if (error) throw error
    return (data ?? []) as StampModelRow[]
  }

  async getStampModelById(id: string): Promise<{ bestand: number } | null> {
    const { data, error } = await supabase
      .from('stempel_modelle')
      .select('bestand')
      .eq('id', id)
      .single()
    if (error) throw error
    return data as { bestand: number } | null
  }

  async getStampModelForOrder(id: string): Promise<{ ersatzkissen_artikelnummer: string | null } | null> {
    const { data, error } = await supabase
      .from('stempel_modelle')
      .select('ersatzkissen_artikelnummer')
      .eq('id', id)
      .single()
    if (error) throw error
    return data as { ersatzkissen_artikelnummer: string | null } | null
  }

  async findReplacementPad(
    artikelnummer: string,
    farbe: string,
  ): Promise<{ id: string; bestand: number } | null> {
    const { data, error } = await supabase
      .from('stempel_modelle')
      .select('id, bestand')
      .eq('typ', 'TRODAT_KISSEN')
      .eq('artikelnummer', artikelnummer)
      .eq('farbe', farbe)
      .maybeSingle()
    if (error) throw error
    return data as { id: string; bestand: number } | null
  }

  async findPadBySize(groesse: string): Promise<{ bestand: number } | null> {
    const { data, error } = await supabase
      .from('stempel_modelle')
      .select('bestand')
      .eq('typ', 'STEMPELKISSEN_PRODUKT')
      .eq('groesse', groesse)
      .maybeSingle()
    if (error) throw error
    return data as { bestand: number } | null
  }

  async getStampModelsForSuggestion(
    typ: string,
    breite: number,
    hoehe: number,
  ): Promise<StampModelSuggestion[]> {
    const { data, error } = await supabase
      .from('stempel_modelle')
      .select('id, name, bestand, max_breite_mm, max_hoehe_mm, druckflaeche')
      .eq('typ', typ)
      .eq('aktiv', true)
      .gte('max_breite_mm', breite)
      .gte('max_hoehe_mm', hoehe)
    if (error) throw error
    return (data ?? []) as StampModelSuggestion[]
  }

  /** All active models for a type — client filters by dimensions. */
  async getStampModelsByType(typ: string): Promise<(StampModelSuggestion & { ersatzkissen_artikelnummer: string | null })[]> {
    const { data, error } = await supabase
      .from('stempel_modelle')
      .select('id, name, bestand, max_breite_mm, max_hoehe_mm, druckflaeche, ersatzkissen_artikelnummer')
      .eq('typ', typ)
      .eq('aktiv', true)
    if (error) throw error
    return (data ?? []) as (StampModelSuggestion & { ersatzkissen_artikelnummer: string | null })[]
  }

  /** Cushion rows for a given replacement-part article number. */
  async getCushionsByArticleNumber(
    artikelnummer: string,
  ): Promise<{ id: string; name: string; farbe: string | null; bestand: number | null }[]> {
    const { data, error } = await supabase
      .from('stempel_modelle')
      .select('id, name, farbe, bestand')
      .eq('typ', 'TRODAT_KISSEN')
      .eq('artikelnummer', artikelnummer)
      .order('farbe', { ascending: true })
    if (error) throw error
    return (data ?? []) as { id: string; name: string; farbe: string | null; bestand: number | null }[]
  }

  /** Full-text search across cushion name and article number. */
  async searchCushions(
    query: string,
  ): Promise<{ id: string; name: string; artikelnummer: string | null; farbe: string | null; bestand: number; vk_preis_netto: number | null }[]> {
    const escaped = query.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
    const pattern = `%${escaped}%`
    const { data, error } = await supabase
      .from('stempel_modelle')
      .select('id, name, artikelnummer, farbe, bestand, vk_preis_netto')
      .eq('typ', 'TRODAT_KISSEN')
      .eq('aktiv', true)
      .or(`name.ilike.${pattern},artikelnummer.ilike.${pattern}`)
      .order('artikelnummer', { ascending: true })
    if (error) throw error
    return (data ?? []) as { id: string; name: string; artikelnummer: string | null; farbe: string | null; bestand: number; vk_preis_netto: number | null }[]
  }

  async getReorderReport(): Promise<ReorderItem[]> {
    const { data, error } = await supabase
      .from('stempel_modelle')
      .select('id, name, artikelnummer, typ, farbe, bestand, mindestbestand')
    if (error) throw error
    return (data ?? []).filter(r => r.bestand <= r.mindestbestand) as ReorderItem[]
  }

  async updateStampModelStock(id: string, bestand: number): Promise<void> {
    const patch: StampModelUpdate = { bestand }
    const { error } = await supabase.from('stempel_modelle').update(patch).eq('id', id)
    if (error) throw error
  }

  async updateStampModelMinimumStock(id: string, mindestbestand: number): Promise<void> {
    const patch: StampModelUpdate = { mindestbestand }
    const { error } = await supabase.from('stempel_modelle').update(patch).eq('id', id)
    if (error) throw error
  }

  async createStockMovement(payload: StockMovementInsert): Promise<void> {
    const { error } = await supabase.from('lager_bewegungen').insert(payload)
    if (error) throw error
  }

  async getStockMovements(): Promise<StockMovementRow[]> {
    const { data, error } = await supabase
      .from('lager_bewegungen')
      .select('*, stempel_modelle(name)')
      .order('erstellt_am', { ascending: false })
      .limit(200)
    if (error) throw error
    return (data ?? []) as unknown as StockMovementRow[]
  }
}

export const stampService = new StampService()
