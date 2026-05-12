import { supabase } from '../supabase'
import type { Database, Json } from '../types/supabase'

type ErpExportInsert = Database['public']['Tables']['erp_exports']['Insert']

export type ErpExportRow = {
  id: string
  order_id: string
  mode: string
  export_data: Json
  exported_at: string
  exported_by: string | null
}

class ErpService {
  async createErpExport(payload: ErpExportInsert): Promise<ErpExportRow> {
    const { data, error } = await supabase
      .from('erp_exports')
      .insert(payload)
      .select('id, order_id, mode, export_data, exported_at, exported_by')
      .single()
    if (error) throw error
    return data as ErpExportRow
  }

  async getErpExportsByOrderId(orderId: string): Promise<ErpExportRow[]> {
    const { data, error } = await supabase
      .from('erp_exports')
      .select('id, order_id, mode, export_data, exported_at, exported_by')
      .eq('order_id', orderId)
      .order('exported_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as ErpExportRow[]
  }
}

export const erpService = new ErpService()
