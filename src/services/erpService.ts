import { supabase } from '../supabase'
import type { Database, Json } from '../types/supabase'

type ErpExportInsert = Database['public']['Tables']['erp_exporte']['Insert']

export type ErpExportRow = {
  id: string
  auftrag_id: string
  modus: string
  exportdaten: Json
  exportiert_am: string
  exportiert_von: string | null
}

class ErpService {
  async createErpExport(payload: ErpExportInsert): Promise<ErpExportRow> {
    const { data, error } = await supabase
      .from('erp_exporte')
      .insert(payload)
      .select('id, auftrag_id, modus, exportdaten, exportiert_am, exportiert_von')
      .single()
    if (error) throw error
    return data as ErpExportRow
  }

  async getErpExportsByOrderId(orderId: string): Promise<ErpExportRow[]> {
    const { data, error } = await supabase
      .from('erp_exporte')
      .select('id, auftrag_id, modus, exportdaten, exportiert_am, exportiert_von')
      .eq('auftrag_id', orderId)
      .order('exportiert_am', { ascending: false })
    if (error) throw error
    return (data ?? []) as ErpExportRow[]
  }
}

export const erpService = new ErpService()
