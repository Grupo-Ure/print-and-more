import { supabase } from '../supabase'

export type HistorieEreignis =
  | 'AUFTRAG_ERSTELLT'
  | 'IN_BEARBEITUNG_GENOMMEN'
  | 'ERP_EXPORTIERT'
  | 'PREPRESS_BEREIT_AUTO'
  | 'PREPRESS_BEREIT_MANUELL'
  | 'PRODUKTION_BEREIT_GESETZT'
  | 'FERTIG_GEMELDET'
  | 'NOTFALL_AUSGELOEST'
  | 'RUECKSPRUNG'
  | 'KUNDENFREIGABE_AKTIVIERT'
  | 'KUNDENFREIGABE_ERTEILT'
  | 'KUNDENFREIGABE_UEBERGANGEN'
  | 'KUNDENFREIGABE_VERFALLEN'
  | 'STORNIERT'

export async function schreibeHistorie(params: {
  auftrag_id: string
  teilauftrag_id?: string
  ereignisart: HistorieEreignis
  begruendung?: string
  meta?: Record<string, unknown>
}): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { error } = await supabase.from('historie').insert({
    ...params,
    person_id: user?.id ?? null,
  } as never)
  if (error) throw error
}
