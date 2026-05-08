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
