import { supabase } from '../supabase'
import type { Database } from '../types/supabase'
import { SUB_ORDER_COLUMNS } from '../const/subOrderSelect'
import type { SubOrderRow, OrderStatus, SubOrderDepartment } from '../types/database'

type SubOrderInsert = Database['public']['Tables']['department_orders']['Insert']
type SubOrderUpdate = Database['public']['Tables']['department_orders']['Update']

export type SubOrderSummary = {
  id: string
  department: SubOrderDepartment
}

export type ActiveSubOrderSlim = {
  id: string
  status: OrderStatus
  department: SubOrderDepartment
  detail: Database['public']['Tables']['department_orders']['Row']['detail']
  is_cancelled: boolean
}

class SubOrderService {
  async getSubOrdersByOrderId(orderId: string): Promise<SubOrderRow[]> {
    const { data, error } = await supabase
      .from('department_orders')
      .select(SUB_ORDER_COLUMNS)
      .eq('order_id', orderId)
      .order('id', { ascending: true })
    if (error) throw error
    return (data ?? []) as unknown as SubOrderRow[]
  }

  async getSubOrderById(id: string): Promise<SubOrderRow | null> {
    const { data, error } = await supabase
      .from('department_orders')
      .select(SUB_ORDER_COLUMNS)
      .eq('id', id)
      .single()
    if (error) throw error
    return data as unknown as SubOrderRow | null
  }

  async createSubOrder(payload: SubOrderInsert): Promise<SubOrderRow> {
    const { data, error } = await supabase
      .from('department_orders')
      .insert(payload)
      .select(SUB_ORDER_COLUMNS)
      .single()
    if (error) throw error
    return data as unknown as SubOrderRow
  }

  async updateSubOrder(id: string, patch: SubOrderUpdate): Promise<SubOrderRow> {
    const { data, error } = await supabase
      .from('department_orders')
      .update(patch)
      .eq('id', id)
      .select(SUB_ORDER_COLUMNS)
      .single()
    if (error) throw error
    return data as unknown as SubOrderRow
  }

  async setSubOrderStatus(id: string, status: OrderStatus): Promise<SubOrderRow> {
    const { data, error } = await supabase
      .from('department_orders')
      .update({ status })
      .eq('id', id)
      .select(SUB_ORDER_COLUMNS)
      .single()
    if (error) throw error
    return data as unknown as SubOrderRow
  }

  async setSubOrderEmergency(
    id: string,
    patch: Pick<SubOrderUpdate, 'is_emergency' | 'emergency_reason' | 'status'>,
  ): Promise<SubOrderRow> {
    const { data, error } = await supabase
      .from('department_orders')
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
      'customer_approval_required' | 'customer_approval_granted' | 'customer_approval_file_id'
    >,
  ): Promise<SubOrderRow> {
    const { data, error } = await supabase
      .from('department_orders')
      .update(patch)
      .eq('id', id)
      .select(SUB_ORDER_COLUMNS)
      .single()
    if (error) throw error
    return data as unknown as SubOrderRow
  }

  async cancelSubOrder(id: string): Promise<void> {
    const { error } = await supabase
      .from('department_orders')
      .update({ is_cancelled: true })
      .eq('id', id)
    if (error) throw error
  }

  async cancelAllSubOrdersForOrder(orderId: string): Promise<void> {
    const { error } = await supabase
      .from('department_orders')
      .update({ is_cancelled: true })
      .eq('order_id', orderId)
    if (error) throw error
  }

  async deleteSubOrder(id: string): Promise<void> {
    const { error } = await supabase.from('department_orders').delete().eq('id', id)
    if (error) throw error
  }

  async getSubOrderSummariesForOrder(orderId: string): Promise<SubOrderSummary[]> {
    const { data, error } = await supabase
      .from('department_orders')
      .select('id, department')
      .eq('order_id', orderId)
    if (error) throw error
    return (data ?? []) as unknown as SubOrderSummary[]
  }

  async getActiveSubOrdersByBereich(department: SubOrderDepartment): Promise<ActiveSubOrderSlim[]> {
    const { data, error } = await supabase
      .from('department_orders')
      .select('id, status, department, detail, is_cancelled')
      .eq('department', department)
    if (error) throw error
    return (data ?? []) as unknown as ActiveSubOrderSlim[]
  }
}

export const subOrderService = new SubOrderService()
