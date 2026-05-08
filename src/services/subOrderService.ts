import { supabase } from '../supabase'
import type { Database } from '../types/supabase'
import { SUB_ORDER_COLUMNS } from '../const/subOrderSelect'
import type { SubOrderRow, OrderStatus, SubOrderDepartment } from '../types/database'

type SubOrderInsert = Database['public']['Tables']['teilauftraege']['Insert']
type SubOrderUpdate = Database['public']['Tables']['teilauftraege']['Update']

export type SubOrderSummary = {
  id: string
  bereich: SubOrderDepartment
}

export type ActiveSubOrderSlim = {
  id: string
  status: OrderStatus
  bereich: SubOrderDepartment
  detail: Database['public']['Tables']['teilauftraege']['Row']['detail']
  storniert: boolean
}

class SubOrderService {
  async getSubOrdersByOrderId(orderId: string): Promise<SubOrderRow[]> {
    const { data, error } = await supabase
      .from('teilauftraege')
      .select(SUB_ORDER_COLUMNS)
      .eq('auftrag_id', orderId)
      .order('id', { ascending: true })
    if (error) throw error
    return (data ?? []) as unknown as SubOrderRow[]
  }

  async getSubOrderById(id: string): Promise<SubOrderRow | null> {
    const { data, error } = await supabase
      .from('teilauftraege')
      .select(SUB_ORDER_COLUMNS)
      .eq('id', id)
      .single()
    if (error) throw error
    return data as unknown as SubOrderRow | null
  }

  async createSubOrder(payload: SubOrderInsert): Promise<SubOrderRow> {
    const { data, error } = await supabase
      .from('teilauftraege')
      .insert(payload)
      .select(SUB_ORDER_COLUMNS)
      .single()
    if (error) throw error
    return data as unknown as SubOrderRow
  }

  async updateSubOrder(id: string, patch: SubOrderUpdate): Promise<SubOrderRow> {
    const { data, error } = await supabase
      .from('teilauftraege')
      .update(patch)
      .eq('id', id)
      .select(SUB_ORDER_COLUMNS)
      .single()
    if (error) throw error
    return data as unknown as SubOrderRow
  }

  async setSubOrderStatus(id: string, status: OrderStatus): Promise<SubOrderRow> {
    const { data, error } = await supabase
      .from('teilauftraege')
      .update({ status })
      .eq('id', id)
      .select(SUB_ORDER_COLUMNS)
      .single()
    if (error) throw error
    return data as unknown as SubOrderRow
  }

  async setSubOrderEmergency(
    id: string,
    patch: Pick<SubOrderUpdate, 'notfall_aktiv' | 'notfall_begruendung' | 'status'>,
  ): Promise<SubOrderRow> {
    const { data, error } = await supabase
      .from('teilauftraege')
      .update(patch)
      .eq('id', id)
      .select(SUB_ORDER_COLUMNS)
      .single()
    if (error) throw error
    return data as unknown as SubOrderRow
  }

  async setCustomerApproval(
    id: string,
    patch: Pick<
      SubOrderUpdate,
      'kundenfreigabe_erforderlich' | 'kundenfreigabe_liegt_vor' | 'kundenfreigabe_datei_id'
    >,
  ): Promise<SubOrderRow> {
    const { data, error } = await supabase
      .from('teilauftraege')
      .update(patch)
      .eq('id', id)
      .select(SUB_ORDER_COLUMNS)
      .single()
    if (error) throw error
    return data as unknown as SubOrderRow
  }

  async cancelSubOrder(id: string): Promise<void> {
    const { error } = await supabase
      .from('teilauftraege')
      .update({ storniert: true })
      .eq('id', id)
    if (error) throw error
  }

  async cancelAllSubOrdersForOrder(orderId: string): Promise<void> {
    const { error } = await supabase
      .from('teilauftraege')
      .update({ storniert: true })
      .eq('auftrag_id', orderId)
    if (error) throw error
  }

  async deleteSubOrder(id: string): Promise<void> {
    const { error } = await supabase.from('teilauftraege').delete().eq('id', id)
    if (error) throw error
  }

  async getSubOrderSummariesForOrder(orderId: string): Promise<SubOrderSummary[]> {
    const { data, error } = await supabase
      .from('teilauftraege')
      .select('id, bereich')
      .eq('auftrag_id', orderId)
    if (error) throw error
    return (data ?? []) as unknown as SubOrderSummary[]
  }

  async getActiveSubOrdersByBereich(bereich: SubOrderDepartment): Promise<ActiveSubOrderSlim[]> {
    const { data, error } = await supabase
      .from('teilauftraege')
      .select('id, status, bereich, detail, storniert')
      .eq('bereich', bereich)
    if (error) throw error
    return (data ?? []) as unknown as ActiveSubOrderSlim[]
  }
}

export const subOrderService = new SubOrderService()
