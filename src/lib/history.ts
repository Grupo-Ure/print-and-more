import { supabase } from '../supabase'
import type { Database, Json } from '../types/supabase'

export type HistoryEvent = Database['public']['Enums']['historie_ereignis']

type HistoryInsert = Database['public']['Tables']['historie']['Insert']

export async function writeHistory(params: {
  auftrag_id: string
  teilauftrag_id?: string
  ereignisart: HistoryEvent
  begruendung?: string
  meta?: Record<string, unknown>
}): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

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
