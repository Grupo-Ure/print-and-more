import { supabase } from '../supabase'
import { AUFTRAG_SPALTEN } from '../const/auftragSelect'
import type { Auftrag, AuftragStatus } from '../types/database'

/** Muss mit dem Union-Typ `AuftragStatus` in `types/database` übereinstimmen. */
const GUELTIGE_AUFTRAGS_STATUS = [
  'ANGEBOT',
  'UNVOLLSTAENDIG',
  'PREPRESS_BEREIT',
  'PRODUKTION_BEREIT',
  'FERTIG',
  'ABGERECHNET',
] as const satisfies readonly AuftragStatus[]

function parseStatusString(raw: string): AuftragStatus {
  if (!(GUELTIGE_AUFTRAGS_STATUS as readonly string[]).includes(raw)) {
    throw new Error(`fn_berechne_auftragsstatus: ungültiger Status "${raw}"`)
  }
  return raw as AuftragStatus
}

export function parseStatusFromRpc(data: unknown): AuftragStatus {
  if (data == null) {
    throw new Error('fn_berechne_auftragsstatus: leeres Ergebnis')
  }
  if (typeof data === 'string') {
    return parseStatusString(data)
  }
  if (typeof data === 'object' && 'status' in (data as object)) {
    const s = (data as { status: unknown }).status
    if (typeof s === 'string') return parseStatusString(s)
    throw new Error('fn_berechne_auftragsstatus: Feld status ist kein String')
  }
  if (typeof data === 'object' && 'fn_berechne_auftragsstatus' in (data as object)) {
    const s = (data as { fn_berechne_auftragsstatus: unknown }).fn_berechne_auftragsstatus
    if (typeof s === 'string') return parseStatusString(s)
    throw new Error('fn_berechne_auftragsstatus: Feld fn_berechne_auftragsstatus ist kein String')
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
