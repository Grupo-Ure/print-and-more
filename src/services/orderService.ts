import { supabase } from '../supabase'
import type { Database } from '../types/supabase'
import { ORDER_COLUMNS } from '../const/orderSelect'
import { ORDER_STATUS_LIST, type Auftrag, type OrderStatus, type OrderSummaryRow } from '../types/database'

type OrderInsert = Database['public']['Tables']['auftraege']['Insert']
type OrderUpdate = Database['public']['Tables']['auftraege']['Update']
type PriorityEnum = Database['public']['Enums']['prioritaet_typ']
type DeliveryEnum = Database['public']['Enums']['lieferung_typ']

export type OrderListEntry = {
  id: string
  auftragsnummer: string
  status: OrderStatus
  erstellt_am: string
  termin: string | null
  prioritaet: 'NORMAL' | 'HOCH'
  notfall_aktiv: boolean
  kunde_id: string
  kunden: { name: string } | { name: string }[] | null
  teilauftraege: { bereich: string; status: string }[] | null
}

const ORDER_LIST_SELECT =
  'id, auftragsnummer, status, erstellt_am, termin, prioritaet, notfall_aktiv, kunde_id, kunden(name), teilauftraege(bereich, status)'

export type OrderListParams = {
  archiviert?: boolean
  customerIds?: string[]
  statuses?: OrderStatus[]
  deadlineFrom?: string
  deadlineTo?: string
  intakeFrom?: string
  intakeTo?: string
}

const ORDER_LIST_COLUMNS = 'id, auftragsnummer, status, erstellt_am, kunden(name)'

function parseStatusString(raw: string): OrderStatus {
  if (!(ORDER_STATUS_LIST as readonly string[]).includes(raw)) {
    throw new Error(`fn_berechne_auftragsstatus: invalid status "${raw}"`)
  }
  return raw as OrderStatus
}

function parseStatusFromRpc(data: unknown): OrderStatus {
  if (data == null) throw new Error('fn_berechne_auftragsstatus: empty result')
  if (typeof data === 'string') return parseStatusString(data)
  if (typeof data === 'object' && 'status' in (data as object)) {
    const v = (data as { status: unknown }).status
    if (typeof v === 'string') return parseStatusString(v)
    throw new Error('fn_berechne_auftragsstatus: field status is not a string')
  }
  if (typeof data === 'object' && 'fn_berechne_auftragsstatus' in (data as object)) {
    const v = (data as { fn_berechne_auftragsstatus: unknown }).fn_berechne_auftragsstatus
    if (typeof v === 'string') return parseStatusString(v)
    throw new Error('fn_berechne_auftragsstatus: field fn_berechne_auftragsstatus is not a string')
  }
  throw new Error('fn_berechne_auftragsstatus: unexpected format')
}

class OrderService {
  async getOrdersForList(params: OrderListParams): Promise<OrderListEntry[]> {
    let query = supabase
      .from('auftraege')
      .select(ORDER_LIST_SELECT)
      .order('erstellt_am', { ascending: false })
    if (params.archiviert !== undefined) query = query.eq('archiviert', params.archiviert)
    if (params.customerIds) query = query.in('kunde_id', params.customerIds)
    if (params.statuses) query = query.in('status', params.statuses)
    if (params.deadlineFrom) query = query.gte('termin', params.deadlineFrom)
    if (params.deadlineTo) query = query.lte('termin', params.deadlineTo)
    if (params.intakeFrom) query = query.gte('erstellt_am', `${params.intakeFrom}T00:00:00`)
    if (params.intakeTo) query = query.lte('erstellt_am', `${params.intakeTo}T23:59:59.999`)
    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as unknown as OrderListEntry[]
  }

  async getOrders(): Promise<OrderSummaryRow[]> {
    const { data, error } = await supabase
      .from('auftraege')
      .select(ORDER_LIST_COLUMNS)
      .eq('archiviert', false)
      .order('erstellt_am', { ascending: false })
    if (error) throw error
    return (data ?? []) as unknown as OrderSummaryRow[]
  }

  async getOrderById(id: string): Promise<Auftrag | null> {
    const { data, error } = await supabase
      .from('auftraege')
      .select(ORDER_COLUMNS)
      .eq('id', id)
      .single()
    if (error) throw error
    return data as unknown as Auftrag | null
  }

  async createOrder(payload: OrderInsert): Promise<Auftrag> {
    const { data, error } = await supabase
      .from('auftraege')
      .insert(payload)
      .select(ORDER_COLUMNS)
      .single()
    if (error) throw error
    return data as unknown as Auftrag
  }

  async updateOrder(id: string, patch: OrderUpdate): Promise<Auftrag> {
    const { data, error } = await supabase
      .from('auftraege')
      .update(patch)
      .eq('id', id)
      .select(ORDER_COLUMNS)
      .single()
    if (error) throw error
    return data as unknown as Auftrag
  }

  async setOrderStatus(id: string, status: OrderStatus): Promise<Auftrag> {
    const { data, error } = await supabase
      .from('auftraege')
      .update({ status })
      .eq('id', id)
      .select(ORDER_COLUMNS)
      .single()
    if (error) throw error
    return data as unknown as Auftrag
  }

  async archiveOrder(id: string): Promise<void> {
    const { error } = await supabase
      .from('auftraege')
      .update({ archiviert: true })
      .eq('id', id)
    if (error) throw error
  }

  async archiveOrderWithCancelledSubOrders(orderId: string): Promise<void> {
    const { error: subError } = await supabase
      .from('teilauftraege')
      .update({ storniert: true })
      .eq('auftrag_id', orderId)
      .neq('storniert', true)
    if (subError) throw subError
    const { error } = await supabase
      .from('auftraege')
      .update({ archiviert: true })
      .eq('id', orderId)
    if (error) throw error
  }

  async markOrderBilled(id: string): Promise<void> {
    const { error } = await supabase
      .from('auftraege')
      .update({ status: 'ABGERECHNET', archiviert: true })
      .eq('id', id)
    if (error) throw error
  }

  async deleteOrder(id: string): Promise<void> {
    const { error } = await supabase.from('auftraege').delete().eq('id', id)
    if (error) throw error
  }

  async synchronizeOrderStatus(auftragId: string): Promise<Auftrag> {
    const { data: raw, error: rpcError } = await supabase.rpc('fn_berechne_auftragsstatus', {
      p_auftrag_id: auftragId,
    })
    if (rpcError) throw rpcError
    const status = parseStatusFromRpc(raw)
    const { data, error } = await supabase
      .from('auftraege')
      .update({ status })
      .eq('id', auftragId)
      .select(ORDER_COLUMNS)
      .single()
    if (error) throw error
    if (data == null) throw new Error('synchronizeOrderStatus: no row returned after update')
    return data as unknown as Auftrag
  }

  async duplicateOrder(params: {
    p_auftrag_id: string
    p_prioritaet: PriorityEnum | null
    p_lieferung: DeliveryEnum | null
    p_termin: string | null
    p_teilauftrag_ids: string[]
    p_user_id: string | null
  }): Promise<string> {
    const { data, error } = await supabase.rpc('dupliziere_auftrag', params)
    if (error) throw error
    return data as string
  }
}

export const orderService = new OrderService()
