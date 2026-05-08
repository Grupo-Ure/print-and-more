import { supabase } from '../supabase'
import { authService } from './authService'
import type { Database, Json } from '../types/supabase'

export type HistoryEvent = Database['public']['Enums']['historie_ereignis']

type HistoryInsert = Database['public']['Tables']['historie']['Insert']

export type HistoryRow = {
  id: string
  ereignisart: HistoryEvent
  begruendung: string | null
  meta: Json | null
  erstellt_am: string
  teilauftrag_id: string | null
  person_id: string | null
}

class HistoryService {
  async writeHistory(params: {
    auftrag_id: string
    teilauftrag_id?: string
    ereignisart: HistoryEvent
    begruendung?: string
    meta?: Record<string, unknown>
  }): Promise<void> {
    const user = await authService.getUser()

    const row: HistoryInsert = {
      auftrag_id: params.auftrag_id,
      teilauftrag_id: params.teilauftrag_id ?? null,
      ereignisart: params.ereignisart,
      begruendung: params.begruendung ?? null,
      meta: params.meta !== undefined ? (params.meta as Json) : null,
      person_id: user?.id ?? null,
    }

    const { error } = await supabase.from('historie').insert(row)
    if (error) throw error
  }

  async getHistoryForOrder(orderId: string): Promise<HistoryRow[]> {
    const { data, error } = await supabase
      .from('historie')
      .select('id, ereignisart, begruendung, meta, erstellt_am, teilauftrag_id, person_id')
      .eq('auftrag_id', orderId)
      .order('erstellt_am', { ascending: false })
      .limit(50)
    if (error) throw error
    return (data ?? []) as HistoryRow[]
  }
}

export const historyService = new HistoryService()
