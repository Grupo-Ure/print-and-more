import { supabase } from '../supabase'
import { ORDER_COLUMNS } from '../const/orderSelect'
import { ORDER_STATUS_LIST, type Auftrag, type OrderStatus } from '../types/database'

function parseStatusString(raw: string): OrderStatus {
  if (!(ORDER_STATUS_LIST as readonly string[]).includes(raw)) {
    throw new Error(`fn_berechne_auftragsstatus: invalid status "${raw}"`)
  }
  return raw as OrderStatus
}

export function parseStatusFromRpc(data: unknown): OrderStatus {
  if (data == null) {
    throw new Error('fn_berechne_auftragsstatus: empty result')
  }
  if (typeof data === 'string') {
    return parseStatusString(data)
  }
  if (typeof data === 'object' && 'status' in (data as object)) {
    const statusValue = (data as { status: unknown }).status
    if (typeof statusValue === 'string') return parseStatusString(statusValue)
    throw new Error('fn_berechne_auftragsstatus: field status is not a string')
  }
  if (typeof data === 'object' && 'fn_berechne_auftragsstatus' in (data as object)) {
    const statusValue = (data as { fn_berechne_auftragsstatus: unknown }).fn_berechne_auftragsstatus
    if (typeof statusValue === 'string') return parseStatusString(statusValue)
    throw new Error('fn_berechne_auftragsstatus: field fn_berechne_auftragsstatus is not a string')
  }
  throw new Error('fn_berechne_auftragsstatus: unexpected format')
}

/** Computes the target status, writes auftraege.status, and returns the fresh row. */
export async function synchronizeOrderStatus(auftragId: string): Promise<Auftrag> {
  const { data: raw, error: rpcError } = await supabase.rpc('fn_berechne_auftragsstatus', {
    p_auftrag_id: auftragId,
  })
  if (rpcError) throw rpcError
  const status = parseStatusFromRpc(raw)
  const { data: row, error: updateError } = await supabase
    .from('auftraege')
    .update({ status })
    .eq('id', auftragId)
    .select(ORDER_COLUMNS)
    .single()
  if (updateError) throw updateError
  if (row == null) {
    throw new Error(
      'synchronizeOrderStatus: order not loaded after status update (no data row).',
    )
  }
  return row as Auftrag
}
