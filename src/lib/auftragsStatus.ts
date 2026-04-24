import { supabase } from '../supabase'
import { AUFTRAG_SPALTEN } from '../const/auftragSelect'
import type { Auftrag, AuftragStatus } from '../types/database'

export function parseStatusFromRpc(data: unknown): AuftragStatus {
  if (data == null) {
    throw new Error('fn_berechne_auftragsstatus: leeres Ergebnis')
  }
  if (typeof data === 'string') {
    return data as AuftragStatus
  }
  if (typeof data === 'object' && 'status' in (data as object)) {
    return (data as { status: AuftragStatus }).status
  }
  if (typeof data === 'object' && 'fn_berechne_auftragsstatus' in (data as object)) {
    return (data as { fn_berechne_auftragsstatus: AuftragStatus }).fn_berechne_auftragsstatus
  }
  throw new Error('fn_berechne_auftragsstatus: unerwartetes Format')
}

/** Berechnet den Soll-Status, schreibt auftraege.status und liefert die frische Zeile. */
export async function synchronisiereAuftragsstatus(auftragId: string): Promise<Auftrag> {
  const { data: raw, error: e1 } = await supabase.rpc('fn_berechne_auftragsstatus', {
    p_auftrag_id: auftragId,
  })
  if (e1) throw e1
  const status = parseStatusFromRpc(raw)
  const { data: row, error: e2 } = await supabase
    .from('auftraege')
    .update({ status })
    .eq('id', auftragId)
    .select(AUFTRAG_SPALTEN)
    .single()
  if (e2) throw e2
  return row as Auftrag
}
