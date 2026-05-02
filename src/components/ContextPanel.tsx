import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { TEILAUFTRAG_SPALTEN } from '../const/teilauftragSelect'
import { schreibeHistorie } from '../lib/historie'
import { parseStatusFromRpc } from '../lib/auftragsStatus'
import { generiereUndLadePdf } from '../lib/pdf/auftragsPdf'
import {
  teilJsonAlsFeldertabelle,
  type Auftrag,
  type AuftragStatus,
  type KundeKontaktJoin,
  type KundeKontaktRow,
  type TeilauftragRow,
} from '../types/database'
import { DateiListe, type Datei } from './DateiListe'
import { HistoriePanel } from './HistoriePanel'
import { useToast } from './Toast'
import './ContextPanel.css'

type Props = {
  auftrag: Auftrag | null
  aktiverTeilauftrag: TeilauftragRow | null
  auftragKunde: KundeKontaktJoin | null
  auftragDateien: Datei[]
  onAuftragAktualisiert: (a: Auftrag) => void
  onAuftragGeloescht: (auftragId: string) => void
  onTeilauftragAktualisiert: (t: TeilauftragRow) => void
  onTeilauftragEntfernt: (id: string) => void
  onKundeBearbeiten: () => void
  kontextAktualisiert: number
  onDateiGeaendert?: () => void | Promise<void>
}

function statusBadgeGlobal(s: AuftragStatus): string {
  switch (s) {
    case 'ANGEBOT':
      return 'badge-grau'
    case 'UNVOLLSTAENDIG':
      return 'badge-orange'
    case 'PREPRESS_BEREIT':
      return 'badge-blau'
    case 'PRODUKTION_BEREIT':
      return 'badge-lila'
    case 'FERTIG':
      return 'badge-gruen'
    case 'ABGERECHNET':
      return 'badge-grau'
    default:
      return 'badge-grau'
  }
}

function naechsterNotfallStatus(s: AuftragStatus): AuftragStatus {
  if (s === 'ABGERECHNET') return s
  if (s === 'UNVOLLSTAENDIG') return 'PREPRESS_BEREIT'
  if (s === 'PREPRESS_BEREIT') return 'PRODUKTION_BEREIT'
  if (s === 'PRODUKTION_BEREIT') return 'FERTIG'
  return s
}

function einKundeKontakt(k: KundeKontaktJoin | null): KundeKontaktRow | null {
  if (k == null) return null
  return Array.isArray(k) ? (k[0] ?? null) : k
}

function hatStempelModellVerknuepft(detail: Record<string, unknown>): boolean {
  const k = detail.kissen_modell_id
  const m = detail.modell_id
  return !!(k && String(k).trim()) || !!(m && String(m).trim())
}

function istStempelBereichBestandKritisch(
  stempelBestand: number | null,
  kissenBestand: number | null
): boolean {
  return (
    (stempelBestand !== null && stempelBestand === 0) ||
    (kissenBestand !== null && kissenBestand === 0)
  )
}

function fertigGesperrtHinweis(
  stempelBestand: number | null,
  kissenBestand: number | null
): string {
  const st0 = stempelBestand !== null && stempelBestand === 0
  const k0 = kissenBestand !== null && kissenBestand === 0
  if (st0 && k0) {
    return 'Fertigmeldung nicht möglich — Stempel- und Kissen-Bestand sind 0'
  }
  if (st0) return 'Fertigmeldung nicht möglich — Stempel-Bestand ist 0'
  if (k0) return 'Fertigmeldung nicht möglich — Kissen-Bestand ist 0'
  return ''
}

function produktionBestandModalTitel(
  stempelBestand: number | null,
  kissenBestand: number | null
): string {
  const st0 = stempelBestand !== null && stempelBestand === 0
  const k0 = kissenBestand !== null && kissenBestand === 0
  if (st0 && k0) return 'Achtung: Stempel- und Kissen-Bestand sind 0'
  if (st0) return 'Achtung: Stempel-Bestand ist 0'
  if (k0) return 'Achtung: Kissen-Bestand ist 0'
  return 'Achtung: Bestand ist 0'
}

type StempelKissenBestand = { stempelBestand: number | null; kissenBestand: number | null }

/**
 * Lädt Stempel- und/oder Kissen-`bestand` je nach verknüpftem Modell, Farbe und Auftragstyp.
 */
async function ladeStempelBestand(detail: Record<string, unknown>): Promise<StempelKissenBestand> {
  const hasMod = detail.modell_id && String(detail.modell_id).trim()
  const hasKis = detail.kissen_modell_id && String(detail.kissen_modell_id).trim()
  const fr = detail.farbe
  const farbeSet = fr != null && String(fr).trim() !== ''

  async function bestandById(id: string): Promise<number | null> {
    const { data, error } = await supabase
      .from('stempel_modelle')
      .select('bestand')
      .eq('id', id)
      .single()
    if (error || !data) return null
    return (data as { bestand: number | null }).bestand ?? 0
  }

  if (hasKis && !hasMod) {
    const kb = await bestandById(String(detail.kissen_modell_id))
    return { stempelBestand: null, kissenBestand: kb }
  }

  let st: number | null = null
  let kis: number | null = null

  if (hasMod) {
    st = await bestandById(String(detail.modell_id))
    if (farbeSet) {
      const { data: stRow, error: eE } = await supabase
        .from('stempel_modelle')
        .select('ersatzkissen_artikelnummer')
        .eq('id', String(detail.modell_id))
        .single()
      if (!eE && stRow) {
        const ers = (stRow as { ersatzkissen_artikelnummer: string | null }).ersatzkissen_artikelnummer
        const artikel = ers && String(ers).trim()
        if (artikel) {
          const { data: kissen, error: eKis } = await supabase
            .from('stempel_modelle')
            .select('bestand')
            .eq('typ', 'TRODAT_KISSEN')
            .eq('artikelnummer', artikel)
            .eq('farbe', String(fr))
            .maybeSingle()
          if (eKis) {
            kis = 0
          } else if (kissen) {
            kis = (kissen as { bestand: number | null }).bestand ?? 0
          } else {
            kis = 0
          }
        }
      }
    }
  }

  return { stempelBestand: st, kissenBestand: kis }
}

export function ContextPanel({
  auftrag,
  aktiverTeilauftrag,
  auftragKunde,
  auftragDateien,
  onAuftragAktualisiert,
  onAuftragGeloescht,
  onTeilauftragAktualisiert,
  onTeilauftragEntfernt,
  onKundeBearbeiten,
  kontextAktualisiert,
  onDateiGeaendert = async () => {},
}: Props) {
  const [busy, setBusy] = useState(false)
  const [teilBereichListe, setTeilBereichListe] = useState<{ id: string; bereich: string }[]>([])
  const [stornoLaeuft, setStornoLaeuft] = useState(false)
  const [loeschenLaeuft, setLoeschenLaeuft] = useState(false)
  const [dialogNotfall, setDialogNotfall] = useState(false)
  const [notfallBegr, setNotfallBegr] = useState('')
  const [dialogKfDatei, setDialogKfDatei] = useState(false)
  const [kfDateiId, setKfDateiId] = useState('')
  const [stempelBestand, setStempelBestand] = useState<number | null>(null)
  const [kissenBestand, setKissenBestand] = useState<number | null>(null)
  const [dialogProduktionBestand0, setDialogProduktionBestand0] = useState(false)
  const { fehler, erfolg } = useToast()

  useEffect(() => {
    if (!aktiverTeilauftrag || aktiverTeilauftrag.bereich !== 'STEMPEL') {
      setStempelBestand(null)
      setKissenBestand(null)
      return
    }
    const det = teilJsonAlsFeldertabelle(aktiverTeilauftrag.detail)
    let alive = true
    void ladeStempelBestand(det).then(r => {
      if (alive) {
        setStempelBestand(r.stempelBestand)
        setKissenBestand(r.kissenBestand)
      }
    })
    return () => {
      alive = false
    }
  }, [aktiverTeilauftrag, kontextAktualisiert])

  useEffect(() => {
    if (!auftrag) {
      setTeilBereichListe([])
      return
    }
    supabase
      .from('teilauftraege')
      .select('id, bereich')
      .eq('auftrag_id', auftrag.id)
      .then(({ data, error }) => {
        if (error) {
          fehler('Daten konnten nicht geladen werden')
          setTeilBereichListe([])
          return
        }
        setTeilBereichListe((data ?? []) as { id: string; bereich: string }[])
      })
  }, [auftrag, kontextAktualisiert, fehler])

  if (!auftrag) {
    return (
      <div className="cp" style={{ padding: 0 }}>
        <p className="cp-hinweis">Wählen Sie links einen Auftrag.</p>
      </div>
    )
  }

  const teil = aktiverTeilauftrag
  const teilBlock = teil && !teil.storniert
  const darfAuftragLoeschen = auftrag.status === 'ANGEBOT' || auftrag.status === 'UNVOLLSTAENDIG'
  const darfAuftragStornieren = auftrag.status !== 'ANGEBOT' && auftrag.status !== 'UNVOLLSTAENDIG'

  const handleInBearbeitung = async () => {
    if (busy || auftrag.status !== 'ANGEBOT') return
    setBusy(true)
    try {
      const { error: u1 } = await supabase
        .from('auftraege')
        .update({ status: 'UNVOLLSTAENDIG' as AuftragStatus })
        .eq('id', auftrag.id)
      if (u1) throw u1
      await schreibeHistorie({
        auftrag_id: auftrag.id,
        ereignisart: 'IN_BEARBEITUNG_GENOMMEN',
      })
      const { data: raw, error: eRpc } = await supabase.rpc('fn_berechne_auftragsstatus', {
        p_auftrag_id: auftrag.id,
      })
      if (eRpc) throw eRpc
      const neuerStatus = parseStatusFromRpc(raw)
      const { error: u2 } = await supabase
        .from('auftraege')
        .update({ status: neuerStatus })
        .eq('id', auftrag.id)
      if (u2) throw u2
      onAuftragAktualisiert({ ...auftrag, status: neuerStatus })
    } catch {
      fehler('Status konnte nicht geändert werden')
    } finally {
      setBusy(false)
    }
  }

  const handleArchiv = async () => {
    if (busy) return
    if (!window.confirm('Auftrag archivieren?\nEr wird aus der normalen Liste ausgeblendet.')) return
    setBusy(true)
    try {
      const { error } = await supabase.from('auftraege').update({ archiviert: true }).eq('id', auftrag.id)
      if (error) throw error
      onAuftragAktualisiert({ ...auftrag, archiviert: true })
    } catch {
      fehler('Status konnte nicht geändert werden')
    } finally {
      setBusy(false)
    }
  }

  const handleAbrechnen = async () => {
    if (busy) return
    if (!window.confirm('Auftrag als abgerechnet markieren?\nEr wird aus der Liste ausgeblendet.')) return
    setBusy(true)
    try {
      const { error } = await supabase
        .from('auftraege')
        .update({ status: 'ABGERECHNET' as AuftragStatus, archiviert: true })
        .eq('id', auftrag.id)
      if (error) throw error
      await schreibeHistorie({
        auftrag_id: auftrag.id,
        ereignisart: 'FERTIG_GEMELDET',
        meta: { abgerechnet_auftrag: true },
      })
      onAuftragAktualisiert({ ...auftrag, status: 'ABGERECHNET', archiviert: true })
    } catch {
      fehler('Status konnte nicht geändert werden')
    } finally {
      setBusy(false)
    }
  }

  const handleAuftragStornieren = async () => {
    if (busy) return
    if (
      !window.confirm(
        'Auftrag stornieren? Alle Teilaufträge werden storniert und der Auftrag wird ausgeblendet.'
      )
    )
      return
    setBusy(true)
    try {
      const { error: e1 } = await supabase
        .from('teilauftraege')
        .update({ storniert: true } as never)
        .eq('auftrag_id', auftrag.id)
      if (e1) throw e1
      const { error: e2 } = await supabase
        .from('auftraege')
        .update({ archiviert: true } as never)
        .eq('id', auftrag.id)
      if (e2) throw e2
      await schreibeHistorie({ auftrag_id: auftrag.id, ereignisart: 'STORNIERT' })
      onAuftragAktualisiert({ ...auftrag, archiviert: true })
    } catch {
      fehler('Status konnte nicht geändert werden')
    } finally {
      setBusy(false)
    }
  }

  const handleAuftragLoeschen = async () => {
    if (busy) return
    if (
      !window.confirm(
        'Auftrag endgültig löschen?\nAlle Teilaufträge und Dateien werden mitgelöscht.'
      )
    )
      return
    setBusy(true)
    try {
      const { error } = await supabase.from('auftraege').delete().eq('id', auftrag.id)
      if (error) throw error
      onAuftragGeloescht(auftrag.id)
    } catch {
      fehler('Status konnte nicht geändert werden')
    } finally {
      setBusy(false)
    }
  }

  const teilNaechstNachTeilAktion = async () => {
    const { data: raw, error: e1 } = await supabase.rpc('fn_berechne_auftragsstatus', {
      p_auftrag_id: auftrag.id,
    })
    if (e1) throw e1
    const neuerStatus = parseStatusFromRpc(raw)
    const { error: e2 } = await supabase
      .from('auftraege')
      .update({ status: neuerStatus })
      .eq('id', auftrag.id)
    if (e2) throw e2
    onAuftragAktualisiert({ ...auftrag, status: neuerStatus })
  }

  const handlePrepressFrei = async () => {
    if (busy || !teil || teil.status !== 'UNVOLLSTAENDIG') return
    setBusy(true)
    try {
      const { data, error } = await supabase
        .from('teilauftraege')
        .update({ status: 'PREPRESS_BEREIT' as AuftragStatus })
        .eq('id', teil.id)
        .select(TEILAUFTRAG_SPALTEN)
        .single()
      if (error) throw error
      await schreibeHistorie({
        auftrag_id: auftrag.id,
        teilauftrag_id: teil.id,
        ereignisart: 'PREPRESS_BEREIT_MANUELL',
      })
      onTeilauftragAktualisiert(data as TeilauftragRow)
      const pdfOk = await generiereUndLadePdf(teil.id, auftrag.id)
      if (!pdfOk) fehler('PDF konnte nicht erstellt werden')
      await teilNaechstNachTeilAktion()
    } catch {
      fehler('Status konnte nicht geändert werden')
    } finally {
      setBusy(false)
    }
  }

  const ausfuehrenProduktionFrei = async () => {
    if (busy || !teil || teil.status !== 'PREPRESS_BEREIT') return
    if (teil.kundenfreigabe_erforderlich && !teil.kundenfreigabe_liegt_vor) return
    setBusy(true)
    try {
      const { data, error } = await supabase
        .from('teilauftraege')
        .update({ status: 'PRODUKTION_BEREIT' as AuftragStatus })
        .eq('id', teil.id)
        .select(TEILAUFTRAG_SPALTEN)
        .single()
      if (error) throw error
      try {
        await schreibeHistorie({
          auftrag_id: auftrag.id,
          teilauftrag_id: teil.id,
          ereignisart: 'PRODUKTION_BEREIT_GESETZT',
        })
      } catch {
        console.error('Historie Produktion fehlgeschlagen')
      }

      const row = data as TeilauftragRow

      // Stempel: Automatischer Lagerabgang bei Produktionsfreigabe (Stempel + ggf. Kissen).
      if (row.bereich === 'STEMPEL') {
        const det = teilJsonAlsFeldertabelle(row.detail)
        const rawM = det.stueckzahl
        const mengeParsed =
          typeof rawM === 'number'
            ? rawM
            : typeof rawM === 'string' && rawM.trim() !== ''
              ? parseInt(rawM, 10)
              : 1
        const menge = Number.isFinite(mengeParsed) && mengeParsed >= 1 ? Math.floor(mengeParsed) : 1

        const notizStempel = 'Automatisch bei Produktionsfreigabe ' + (auftrag.auftragsnummer ?? '')

        const lagerAutoabgang = async (modellId: string, mengeLocal: number, notiz: string) => {
          const { data: modell, error: eMod } = await supabase
            .from('stempel_modelle')
            .select('bestand')
            .eq('id', modellId)
            .single()
          if (eMod) {
            fehler('Bestand konnte nicht geladen werden')
            return
          }
          if (!modell) return
          const alt = (modell as { bestand: number | null }).bestand ?? 0
          if (alt <= 0) return
          const neuerBestand = Math.max(0, alt - mengeLocal)
          const { error: eUp } = await supabase
            .from('stempel_modelle')
            .update({ bestand: neuerBestand } as never)
            .eq('id', modellId)
          if (eUp) {
            fehler('Bestand konnte nicht geladen werden')
            return
          }
          const {
            data: { user },
          } = await supabase.auth.getUser()
          const { error: eIns } = await supabase.from('lager_bewegungen').insert({
            modell_id: modellId,
            menge: mengeLocal,
            typ: 'AUTOABGANG',
            notiz,
            person_id: user?.id ?? null,
          } as never)
          if (eIns) fehler('Bestand konnte nicht geladen werden')
        }

        if (row.typ === 'TRODAT_KISSEN' && det.kissen_modell_id) {
          await lagerAutoabgang(String(det.kissen_modell_id), menge, notizStempel)
        } else if (det.modell_id) {
          const stampId = String(det.modell_id)
          await lagerAutoabgang(stampId, menge, notizStempel)

          const fr = det.farbe
          if (fr != null && String(fr).trim() !== '') {
            const { data: stRow, error: eErs } = await supabase
              .from('stempel_modelle')
              .select('ersatzkissen_artikelnummer')
              .eq('id', stampId)
              .single()
            if (eErs) {
              fehler('Bestand konnte nicht geladen werden')
            } else if (stRow) {
              const ers = (stRow as { ersatzkissen_artikelnummer: string | null }).ersatzkissen_artikelnummer
              const artikel = ers && String(ers).trim()
              if (artikel) {
                const { data: kissen, error: eKis } = await supabase
                  .from('stempel_modelle')
                  .select('id, bestand')
                  .eq('typ', 'TRODAT_KISSEN')
                  .eq('artikelnummer', artikel)
                  .eq('farbe', String(fr))
                  .maybeSingle()
                if (eKis) {
                  fehler('Bestand konnte nicht geladen werden')
                } else if (kissen) {
                  const b = (kissen as { bestand: number | null; id: string }).bestand ?? 0
                  if (b > 0) {
                    const kid = String((kissen as { id: string }).id)
                    await lagerAutoabgang(kid, menge, notizStempel + ' (Kissen zu Stempel)')
                  }
                }
              }
            }
          }
        }
      }

      // Textil: Automatischer Lagerabgang bei Produktionsfreigabe (nur Eigenware-Positionen mit variante_id).
      if (row.bereich === 'TEXTIL') {
        const notizTextil = 'Automatisch bei Produktionsfreigabe ' + (auftrag.auftragsnummer ?? '')
        const {
          data: { user },
        } = await supabase.auth.getUser()
        const userId = user?.id ?? null

        const { data: posData, error: ePos } = await supabase
          .from('textil_positionen')
          .select('id, variante_id, stueckzahl, herkunft')
          .eq('teilauftrag_id', row.id)
          .eq('herkunft', 'EIGENWARE')
          .not('variante_id', 'is', null)
        if (ePos) throw ePos

        const posList = (posData ?? []) as {
          id: string
          variante_id: string | null
          stueckzahl: number
          herkunft: string
        }[]

        for (const p of posList) {
          const vid = p.variante_id ? String(p.variante_id) : ''
          if (!vid) continue
          const mengeLocal = Number.isFinite(p.stueckzahl) && p.stueckzahl >= 1 ? Math.floor(p.stueckzahl) : 1

          const { data: vRow, error: eVar } = await supabase
            .from('textil_varianten')
            .select('bestand')
            .eq('id', vid)
            .single()
          if (eVar) throw eVar
          const alt = (vRow as { bestand: number | null } | null)?.bestand ?? 0
          if (alt <= 0) continue

          const neuerBestand = Math.max(0, alt - mengeLocal)
          const { error: eUp } = await supabase.from('textil_varianten').update({ bestand: neuerBestand }).eq('id', vid)
          if (eUp) throw eUp

          const { error: eIns } = await supabase.from('textil_lager_bewegungen').insert({
            variante_id: vid,
            menge: mengeLocal,
            typ: 'AUTOABGANG',
            notiz: notizTextil,
            person_id: userId,
          } as never)
          if (eIns) throw eIns
        }
      }
      onTeilauftragAktualisiert(data as TeilauftragRow)
      await teilNaechstNachTeilAktion()
    } catch {
      fehler('Status konnte nicht geändert werden')
    } finally {
      setBusy(false)
    }
  }

  const handleProduktionFrei = () => {
    if (busy || !teil || teil.status !== 'PREPRESS_BEREIT') return
    if (teil.kundenfreigabe_erforderlich && !teil.kundenfreigabe_liegt_vor) return
    if (teil.bereich === 'STEMPEL') {
      if (istStempelBereichBestandKritisch(stempelBestand, kissenBestand)) {
        setDialogProduktionBestand0(true)
        return
      }
    }
    void ausfuehrenProduktionFrei()
  }

  const handleFertigMelden = async () => {
    if (busy || !teil || teil.status !== 'PRODUKTION_BEREIT') return
    if (!window.confirm('Teilauftrag als fertig markieren?')) return
    setBusy(true)
    try {
      const { data, error } = await supabase
        .from('teilauftraege')
        .update({ status: 'FERTIG' as AuftragStatus })
        .eq('id', teil.id)
        .select(TEILAUFTRAG_SPALTEN)
        .single()
      if (error) throw error
      await schreibeHistorie({
        auftrag_id: auftrag.id,
        teilauftrag_id: teil.id,
        ereignisart: 'FERTIG_GEMELDET',
      })
      onTeilauftragAktualisiert(data as TeilauftragRow)
      await teilNaechstNachTeilAktion()
    } catch {
      fehler('Status konnte nicht geändert werden')
    } finally {
      setBusy(false)
    }
  }

  const handleNotfallOeffnen = () => {
    if (busy || !teil) return
    if (teil.status === 'ANGEBOT' || teil.status === 'FERTIG') return
    setNotfallBegr('')
    setDialogNotfall(true)
  }

  const handleNotfallBestaetigt = async () => {
    if (busy || !teil) return
    const b = notfallBegr.trim()
    if (!b) {
      fehler('Bitte eine Begründung eingeben')
      return
    }
    const neu = naechsterNotfallStatus(teil.status)
    if (neu === teil.status) {
      setDialogNotfall(false)
      return
    }
    setBusy(true)
    setDialogNotfall(false)
    try {
      const { data, error } = await supabase
        .from('teilauftraege')
        .update({
          status: neu,
          notfall_aktiv: true,
          notfall_begruendung: b,
        } as never)
        .eq('id', teil.id)
        .select(TEILAUFTRAG_SPALTEN)
        .single()
      if (error) throw error
      await schreibeHistorie({
        auftrag_id: auftrag.id,
        teilauftrag_id: teil.id,
        ereignisart: 'NOTFALL_AUSGELOEST',
        begruendung: b,
      })
      onTeilauftragAktualisiert(data as TeilauftragRow)
      await teilNaechstNachTeilAktion()
    } catch {
      fehler('Status konnte nicht geändert werden')
    } finally {
      setBusy(false)
    }
  }

  const handleNotfallZurueck = async () => {
    if (busy || !teil || !teil.notfall_aktiv) return
    setBusy(true)
    try {
      const { data, error } = await supabase
        .from('teilauftraege')
        .update({
          status: 'UNVOLLSTAENDIG' as AuftragStatus,
          notfall_aktiv: false,
          notfall_begruendung: null,
        } as never)
        .eq('id', teil.id)
        .select(TEILAUFTRAG_SPALTEN)
        .single()
      if (error) throw error
      await schreibeHistorie({
        auftrag_id: auftrag.id,
        teilauftrag_id: teil.id,
        ereignisart: 'RUECKSPRUNG',
      })
      onTeilauftragAktualisiert(data as TeilauftragRow)
      await teilNaechstNachTeilAktion()
    } catch {
      fehler('Status konnte nicht geändert werden')
    } finally {
      setBusy(false)
    }
  }

  const handleKfToggle = async (aktiv: boolean) => {
    if (busy || !teil) return
    if (teil.status === 'ANGEBOT') return
    setBusy(true)
    try {
      const patch = aktiv
        ? { kundenfreigabe_erforderlich: true }
        : {
            kundenfreigabe_erforderlich: false,
            kundenfreigabe_liegt_vor: false,
            kundenfreigabe_datei_id: null,
          }
      const { data, error } = await supabase
        .from('teilauftraege')
        .update(patch as never)
        .eq('id', teil.id)
        .select(TEILAUFTRAG_SPALTEN)
        .single()
      if (error) throw error
      await schreibeHistorie({
        auftrag_id: auftrag.id,
        teilauftrag_id: teil.id,
        ereignisart: 'KUNDENFREIGABE_AKTIVIERT',
        meta: { aktiv } as unknown as Record<string, unknown>,
      })
      onTeilauftragAktualisiert(data as TeilauftragRow)
      await teilNaechstNachTeilAktion()
    } catch {
      fehler('Status konnte nicht geändert werden')
    } finally {
      setBusy(false)
    }
  }

  const handleKfDateiOeffnen = () => {
    if (busy || !teil) return
    setKfDateiId(auftragDateien[0]?.id ?? '')
    setDialogKfDatei(true)
  }

  const handleKfDateiBestaetigt = async () => {
    if (busy || !teil || !kfDateiId) return
    setBusy(true)
    setDialogKfDatei(false)
    try {
      const { data, error } = await supabase
        .from('teilauftraege')
        .update({
          kundenfreigabe_liegt_vor: true,
          kundenfreigabe_datei_id: kfDateiId,
        } as never)
        .eq('id', teil.id)
        .select(TEILAUFTRAG_SPALTEN)
        .single()
      if (error) throw error
      await schreibeHistorie({
        auftrag_id: auftrag.id,
        teilauftrag_id: teil.id,
        ereignisart: 'KUNDENFREIGABE_ERTEILT',
        meta: { datei_id: kfDateiId } as unknown as Record<string, unknown>,
      })
      onTeilauftragAktualisiert(data as TeilauftragRow)
      await teilNaechstNachTeilAktion()
      erfolg('Freigabe erteilt')
    } catch {
      fehler('Status konnte nicht geändert werden')
    } finally {
      setBusy(false)
    }
  }

  const handleStorno = async () => {
    if (!teil || stornoLaeuft) return
    if (!window.confirm('Teilauftrag stornieren? Er wird ausgeblendet, aber nicht gelöscht.')) return
    setStornoLaeuft(true)
    try {
      const { error } = await supabase
        .from('teilauftraege')
        .update({ storniert: true } as never)
        .eq('id', teil.id)
      if (error) throw error
      onTeilauftragEntfernt(teil.id)
      try {
        await teilNaechstNachTeilAktion()
      } catch {
        fehler('Status konnte nicht geändert werden')
      }
    } catch {
      fehler('Status konnte nicht geändert werden')
    } finally {
      setStornoLaeuft(false)
    }
  }

  const handleLoeschen = async () => {
    if (!teil || loeschenLaeuft || teil.status !== 'UNVOLLSTAENDIG') return
    if (!window.confirm('Teilauftrag endgültig löschen?')) return
    setLoeschenLaeuft(true)
    try {
      const { error } = await supabase.from('teilauftraege').delete().eq('id', teil.id)
      if (error) throw error
      onTeilauftragEntfernt(teil.id)
      try {
        await teilNaechstNachTeilAktion()
      } catch {
        fehler('Status konnte nicht geändert werden')
      }
    } catch {
      fehler('Status konnte nicht geändert werden')
    } finally {
      setLoeschenLaeuft(false)
    }
  }

  const prodDisabled =
    !!teil && teil.status === 'PREPRESS_BEREIT' && teil.kundenfreigabe_erforderlich && !teil.kundenfreigabe_liegt_vor
  const stempelDetailAktuell = teil ? teilJsonAlsFeldertabelle(teil.detail) : {}
  const fertigGesperrtWegenBestand =
    !!teil &&
    teil.bereich === 'STEMPEL' &&
    teil.status === 'PRODUKTION_BEREIT' &&
    hatStempelModellVerknuepft(stempelDetailAktuell) &&
    istStempelBereichBestandKritisch(stempelBestand, kissenBestand)
  const notfallSichtbar =
    teil && teil.status !== 'ANGEBOT' && teil.status !== 'FERTIG' && naechsterNotfallStatus(teil.status) !== teil.status
  const kfErteilenSichtbar =
    !!teil &&
    teil.kundenfreigabe_erforderlich &&
    !teil.kundenfreigabe_liegt_vor &&
    auftragDateien.length > 0

  const hinweise: string[] = []
  if (teil && teil.kundenfreigabe_erforderlich && !teil.kundenfreigabe_liegt_vor) {
    hinweise.push('Kundenfreigabe fehlt — Produktion blockiert')
  }
  if (teil?.notfall_aktiv) {
    hinweise.push(`Notfall aktiv: ${teil.notfall_begruendung ?? '—'}`)
  }
  if (teil && teil.status === 'PREPRESS_BEREIT' && !teil.kundenfreigabe_erforderlich) {
    hinweise.push('Bereit zur Produktionsfreigabe')
  }
  if (auftrag.status === 'FERTIG') {
    hinweise.push('Auftrag abgeschlossen')
  }

  return (
    <div className="cp">
      <div className="cp-sektion">
        <h2>Status</h2>
        <div className="cp-status-komp">
          {teil && (
            <div className="cp-st-zeile">
              <span className={`badge ${statusBadgeGlobal(teil.status)} cp-badge-lg`}>{teil.status}</span>
            </div>
          )}
          {teil?.notfall_aktiv && (
            <div className="cp-st-notfall">
              <span className="badge badge-rot cp-badge-lg">!! NOTFALL !!</span>
              {teil.notfall_begruendung && (
                <p className="cp-hinweis cp-hinweis--komp">{teil.notfall_begruendung}</p>
              )}
            </div>
          )}
        </div>
      </div>
      {(() => {
        const row = einKundeKontakt(auftragKunde)
        if (!row) return null
        const s = row.strasse?.trim()
        const h = row.hausnummer?.trim()
        const p = row.plz?.trim()
        const o = row.ort?.trim()
        const zeile1 = [s, h].filter(Boolean).join(' ')
        const zeile2 = [p, o].filter(Boolean).join(' ')
        if (!zeile1 && !zeile2) return null
        return (
          <div className="cp-sektion">
            <h2>Kunde</h2>
            {zeile1 ? (
              <p className="cp-hinweis cp-hinweis--komp" style={{ margin: '0 0 4px' }}>
                {zeile1}
              </p>
            ) : null}
            {zeile2 ? <p className="cp-hinweis cp-hinweis--komp" style={{ margin: 0 }}>{zeile2}</p> : null}
          </div>
        )
      })()}
      <div className="cp-sektion">
        <h2>Aktionen</h2>
        <div className="cp-gruppe">
          {auftrag.status === 'ANGEBOT' && (
            <button
              type="button"
              className="cp-btn"
              disabled={busy}
              onClick={() => void handleInBearbeitung()}
            >
              In Bearbeitung nehmen
            </button>
          )}
          {auftrag.status === 'ANGEBOT' && (
            <button type="button" className="cp-btn" disabled={busy} onClick={onKundeBearbeiten}>
              Kunde bearbeiten
            </button>
          )}
          {auftrag.status === 'FERTIG' && (
            <button type="button" className="cp-btn" disabled={busy} onClick={() => void handleAbrechnen()}>
              Abrechnen
            </button>
          )}
          {auftrag.status !== 'ABGERECHNET' && (
            <button type="button" className="cp-btn" disabled={busy} onClick={() => void handleArchiv()}>
              Archivieren
            </button>
          )}
          {darfAuftragStornieren && (
            <button
              type="button"
              className="cp-btn cp-btn-rot"
              disabled={busy}
              onClick={() => void handleAuftragStornieren()}
            >
              Auftrag stornieren
            </button>
          )}
          {darfAuftragLoeschen && (
            <button
              type="button"
              className="cp-btn cp-btn-rot"
              disabled={busy}
              onClick={() => void handleAuftragLoeschen()}
            >
              Auftrag löschen
            </button>
          )}
        </div>

        {teilBlock && (
          <>
            <div className="cp-gruppe-trenn" />
            <div className="cp-gruppe">
              {teil.status === 'UNVOLLSTAENDIG' && (
                <button
                  type="button"
                  className="cp-btn"
                  disabled={busy}
                  onClick={() => void handlePrepressFrei()}
                >
                  Prepress freigeben
                </button>
              )}
              {teil.status === 'PREPRESS_BEREIT' && (
                <>
                  <button
                    type="button"
                    className="cp-btn"
                    disabled={busy || prodDisabled}
                    onClick={() => void handleProduktionFrei()}
                  >
                    Produktion freigeben
                  </button>
                  {prodDisabled && <p className="cp-sublabel">Kundenfreigabe fehlt</p>}
                </>
              )}
              {teil.status === 'PRODUKTION_BEREIT' && (
                <>
                  <button
                    type="button"
                    className="cp-btn"
                    disabled={busy || fertigGesperrtWegenBestand}
                    onClick={() => void handleFertigMelden()}
                  >
                    Als fertig melden
                  </button>
                  {fertigGesperrtWegenBestand && (
                    <p className="cp-sublabel">
                      {fertigGesperrtHinweis(stempelBestand, kissenBestand)}
                    </p>
                  )}
                </>
              )}
              {teilBlock && teil.status !== 'ANGEBOT' && (
                <button
                  type="button"
                  className="cp-btn cp-btn-grau"
                  disabled={busy}
                  onClick={() =>
                    void (async () => {
                      const ok = await generiereUndLadePdf(teil.id, auftrag.id)
                      if (!ok) fehler('PDF konnte nicht erstellt werden')
                    })()
                  }
                >
                  PDF laden
                </button>
              )}
            </div>
            <div className="cp-gruppe-trenn" />
            <div className="cp-gruppe">
              {notfallSichtbar && (
                <button
                  type="button"
                  className="cp-btn cp-btn-rot"
                  disabled={busy}
                  onClick={handleNotfallOeffnen}
                >
                  Notfall
                </button>
              )}
              {teil.notfall_aktiv && (
                <button
                  type="button"
                  className="cp-btn"
                  disabled={busy}
                  onClick={() => void handleNotfallZurueck()}
                >
                  Notfall zurücknehmen
                </button>
              )}
              {teil.status !== 'ANGEBOT' && (
                <label className="cp-toggle">
                  <input
                    type="checkbox"
                    checked={teil.kundenfreigabe_erforderlich}
                    disabled={busy}
                    onChange={e => void handleKfToggle(e.target.checked)}
                  />
                  <span>Kundenfreigabe erforderlich</span>
                </label>
              )}
              {kfErteilenSichtbar && (
                <button type="button" className="cp-btn" disabled={busy} onClick={handleKfDateiOeffnen}>
                  Kundenfreigabe erteilen
                </button>
              )}
            </div>
            <div className="cp-gruppe-trenn" />
            <div className="cp-gruppe cp-gruppe--admin">
              <button
                type="button"
                className="cp-btn cp-btn-grau"
                disabled={stornoLaeuft}
                onClick={() => void handleStorno()}
              >
                Teilauftrag stornieren
              </button>
              <button
                type="button"
                className="cp-btn cp-btn-rot"
                disabled={teil.status !== 'UNVOLLSTAENDIG' || loeschenLaeuft}
                onClick={() => void handleLoeschen()}
              >
                Teilauftrag löschen
              </button>
              {teil.status !== 'UNVOLLSTAENDIG' && (
                <p className="cp-sublabel">Nur löschbar im Status Unvollständig</p>
              )}
            </div>
          </>
        )}
        {auftrag && (
          <DateiListe
            aktiverAuftragId={auftrag.id}
            dateien={auftragDateien}
            dateienLaden={false}
            onDateiGeaendert={onDateiGeaendert}
          />
        )}
      </div>

      {hinweise.length > 0 && (
        <div className="cp-sektion">
          <h2>Hinweise</h2>
          {hinweise.map((h, i) => (
            <p key={i} className="cp-hinweis">
              {h}
            </p>
          ))}
        </div>
      )}

      <div className="cp-sektion">
        <div className="cp-gruppe" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className="cp-btn cp-btn-grau"
            onClick={() => window.open('/bestandspflege', '_blank')}
            title="Stempel-Bestandspflege öffnen"
          >
            Bestandspflege ↗
          </button>
          <button
            type="button"
            className="cp-btn cp-btn-grau"
            onClick={() => window.open('/textil-bestand', '_blank')}
            title="Textil-Bestand öffnen"
          >
            Textil-Bestand ↗
          </button>
        </div>
      </div>

      <HistoriePanel
        aktiverAuftragId={auftrag.id}
        kontextAktualisiert={kontextAktualisiert}
        teilauftraege={teilBereichListe}
      />

      {dialogNotfall && teil && (
        <div
          className="cp-modal-bg"
          role="dialog"
          aria-modal="true"
          aria-label="Notfall"
        >
          <div className="cp-modal">
            <h3>Notfall</h3>
            <p className="cp-hinweis">Begründung (Pflicht). Der Status wird eine Stufe weitergesetzt.</p>
            <textarea
              className="cp-textarea"
              rows={3}
              value={notfallBegr}
              onChange={e => setNotfallBegr(e.target.value)}
              placeholder="Begründung …"
            />
            <div className="cp-modal-bar">
              <button type="button" className="cp-btn" onClick={() => setDialogNotfall(false)}>
                Abbrechen
              </button>
              <button
                type="button"
                className="cp-btn"
                disabled={!notfallBegr.trim() || busy}
                onClick={() => void handleNotfallBestaetigt()}
              >
                Bestätigen
              </button>
            </div>
          </div>
        </div>
      )}

      {dialogProduktionBestand0 && teil && (
        <div
          className="cp-modal-bg"
          role="dialog"
          aria-modal="true"
          aria-label="Bestand"
        >
          <div className="cp-modal">
            <h3>{produktionBestandModalTitel(stempelBestand, kissenBestand)}</h3>
            <p className="cp-hinweis">Trotzdem auf Produktion setzen?</p>
            <div className="cp-modal-bar">
              <button type="button" className="cp-btn" onClick={() => setDialogProduktionBestand0(false)}>
                Abbrechen
              </button>
              <button
                type="button"
                className="cp-btn"
                disabled={busy}
                onClick={() => {
                  setDialogProduktionBestand0(false)
                  void ausfuehrenProduktionFrei()
                }}
              >
                Trotzdem freigeben
              </button>
            </div>
          </div>
        </div>
      )}

      {dialogKfDatei && teil && (
        <div
          className="cp-modal-bg"
          role="dialog"
          aria-modal="true"
          aria-label="Kundenfreigabe"
        >
          <div className="cp-modal">
            <h3>Kundenfreigabe erteilen</h3>
            <p className="cp-hinweis">Datei wählen:</p>
            <select
              className="cp-select"
              value={kfDateiId}
              onChange={e => setKfDateiId(e.target.value)}
            >
              {auftragDateien.map(d => (
                <option key={d.id} value={d.id}>
                  {d.anzeigename}
                </option>
              ))}
            </select>
            <div className="cp-modal-bar">
              <button type="button" className="cp-btn" onClick={() => setDialogKfDatei(false)}>
                Abbrechen
              </button>
              <button
                type="button"
                className="cp-btn"
                disabled={!kfDateiId || busy}
                onClick={() => void handleKfDateiBestaetigt()}
              >
                Bestätigen
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
