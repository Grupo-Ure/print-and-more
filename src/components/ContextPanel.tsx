import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { AUFTRAG_SPALTEN } from '../const/auftragSelect'
import { TEILAUFTRAG_SPALTEN } from '../const/teilauftragSelect'
import { kundenName } from '../lib/kunde'
import { schreibeHistorie } from '../lib/historie'
import { synchronisiereAuftragsstatus } from '../lib/auftragsStatus'
import {
  type Auftrag,
  type AuftragStatus,
  type KundeJoin,
  type KundeKontaktJoin,
  type TeilauftragRow,
} from '../types/database'
import type { Datei } from './DateiListe'
import { HistoriePanel } from './HistoriePanel'
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
}

type ErpModus = 'EINZELN' | 'GESAMMELT'

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
    default:
      return 'badge-grau'
  }
}

function naechsterNotfallStatus(s: AuftragStatus): AuftragStatus {
  if (s === 'UNVOLLSTAENDIG') return 'PREPRESS_BEREIT'
  if (s === 'PREPRESS_BEREIT') return 'PRODUKTION_BEREIT'
  if (s === 'PRODUKTION_BEREIT') return 'FERTIG'
  return s
}

function kundeNameSafe(k: KundeKontaktJoin | null): string {
  if (k == null) return ''
  return kundenName(k as KundeJoin)
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
}: Props) {
  const [busy, setBusy] = useState(false)
  const [teilBereichListe, setTeilBereichListe] = useState<{ id: string; bereich: string }[]>([])
  const [stornoLaeuft, setStornoLaeuft] = useState(false)
  const [loeschenLaeuft, setLoeschenLaeuft] = useState(false)
  const [dialogErp, setDialogErp] = useState(false)
  const [erpModus, setErpModus] = useState<ErpModus>('EINZELN')
  const [dialogNotfall, setDialogNotfall] = useState(false)
  const [notfallBegr, setNotfallBegr] = useState('')
  const [dialogKfDatei, setDialogKfDatei] = useState(false)
  const [kfDateiId, setKfDateiId] = useState('')

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
          console.error(error)
          setTeilBereichListe([])
          return
        }
        setTeilBereichListe((data ?? []) as { id: string; bereich: string }[])
      })
  }, [auftrag, kontextAktualisiert])

  const kundeNameForExport = kundeNameSafe(auftragKunde)

  async function ladeAuftrag(auftragId: string): Promise<Auftrag> {
    const { data, error } = await supabase
      .from('auftraege')
      .select(AUFTRAG_SPALTEN)
      .eq('id', auftragId)
      .single()
    if (error) throw error
    return data as Auftrag
  }

  if (!auftrag) {
    return (
      <div className="cp" style={{ padding: 0 }}>
        <p className="cp-hinweis">Wählen Sie links einen Auftrag.</p>
      </div>
    )
  }

  const teil = aktiverTeilauftrag
  const teilBlock = teil && !teil.storniert

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
      onAuftragAktualisiert(await ladeAuftrag(auftrag.id))
    } catch (e) {
      console.error(e)
    } finally {
      setBusy(false)
    }
  }

  const handleErpStart = () => {
    if (busy || auftrag.status !== 'FERTIG' || auftrag.erp_exportiert) return
    setErpModus('EINZELN')
    setDialogErp(true)
  }

  const handleErpBestaetigt = async () => {
    if (busy) return
    setBusy(true)
    setDialogErp(false)
    try {
      const { error: e1 } = await supabase.from('erp_exporte').insert({
        auftrag_id: auftrag.id,
        modus: erpModus,
        exportdaten: {
          auftragsnummer: auftrag.auftragsnummer,
          kunde_name: kundeNameForExport,
          zeitpunkt: new Date().toISOString(),
        },
      } as never)
      if (e1) throw e1
      const { error: e2 } = await supabase
        .from('auftraege')
        .update({ erp_exportiert: true })
        .eq('id', auftrag.id)
      if (e2) throw e2
      await schreibeHistorie({
        auftrag_id: auftrag.id,
        ereignisart: 'ERP_EXPORTIERT',
        meta: { modus: erpModus } as unknown as Record<string, unknown>,
      })
      onAuftragAktualisiert(await ladeAuftrag(auftrag.id))
    } catch (e) {
      console.error(e)
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
    } catch (e) {
      console.error(e)
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
    } catch (e) {
      console.error(e)
    } finally {
      setBusy(false)
    }
  }

  const teilNaechstNachTeilAktion = async () => {
    const a = await synchronisiereAuftragsstatus(auftrag.id)
    onAuftragAktualisiert(a)
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
      await teilNaechstNachTeilAktion()
    } catch (e) {
      console.error(e)
    } finally {
      setBusy(false)
    }
  }

  const handleProduktionFrei = async () => {
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
      await schreibeHistorie({
        auftrag_id: auftrag.id,
        teilauftrag_id: teil.id,
        ereignisart: 'PRODUKTION_BEREIT_GESETZT',
      })
      onTeilauftragAktualisiert(data as TeilauftragRow)
      await teilNaechstNachTeilAktion()
    } catch (e) {
      console.error(e)
    } finally {
      setBusy(false)
    }
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
      const row = data as TeilauftragRow
      const det = (row.detail as Record<string, unknown> | null) ?? {}
      const rawM = det.stueckzahl
      const mengeParsed =
        typeof rawM === 'number'
          ? rawM
          : typeof rawM === 'string' && rawM.trim() !== ''
            ? parseInt(rawM, 10)
            : 1
      const menge = Number.isFinite(mengeParsed) && mengeParsed >= 1 ? Math.floor(mengeParsed) : 1

      const notizStempel = 'Automatisch bei Fertigmeldung ' + (auftrag.auftragsnummer ?? '')

      const lagerAutoabgang = async (modellId: string, mengeLocal: number, notiz: string) => {
        const { data: modell, error: eMod } = await supabase
          .from('stempel_modelle')
          .select('bestand')
          .eq('id', modellId)
          .single()
        if (eMod) {
          console.error(eMod)
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
          console.error(eUp)
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
        if (eIns) console.error(eIns)
      }

      if (row.bereich === 'STEMPEL') {
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
              console.error(eErs)
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
                  console.error(eKis)
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
      onTeilauftragAktualisiert(data as TeilauftragRow)
      const a = await synchronisiereAuftragsstatus(auftrag.id)
      onAuftragAktualisiert(a)
    } catch (e) {
      console.error(e)
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
    if (!b) return
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
    } catch (e) {
      console.error(e)
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
    } catch (e) {
      console.error(e)
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
    } catch (e) {
      console.error(e)
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
    } catch (e) {
      console.error(e)
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
        const a = await synchronisiereAuftragsstatus(auftrag.id)
        onAuftragAktualisiert(a)
      } catch (e) {
        console.error(e)
      }
    } catch (e) {
      console.error(e)
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
        const a = await synchronisiereAuftragsstatus(auftrag.id)
        onAuftragAktualisiert(a)
      } catch (e) {
        console.error(e)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoeschenLaeuft(false)
    }
  }

  const prodDisabled =
    !!teil && teil.status === 'PREPRESS_BEREIT' && teil.kundenfreigabe_erforderlich && !teil.kundenfreigabe_liegt_vor
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
    if (!auftrag.erp_exportiert) {
      hinweise.push('ERP-Export ausstehend')
    }
  }

  return (
    <div className="cp">
      <div className="cp-sektion">
        <h2>Status</h2>
        <div className="cp-status-komp">
          <div className="cp-st-zeile">
            <span className="cp-st-l">Auftrag</span>
            <span className={`badge ${statusBadgeGlobal(auftrag.status)} cp-badge-lg`}>
              {auftrag.status}
            </span>
          </div>
          {teil && (
            <div className="cp-st-zeile">
              <span className="cp-st-l">Teilauftrag</span>
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
          {auftrag.status === 'FERTIG' && !auftrag.erp_exportiert && (
            <button type="button" className="cp-btn" disabled={busy} onClick={handleErpStart}>
              ERP exportieren
            </button>
          )}
          <button type="button" className="cp-btn" disabled={busy} onClick={() => void handleArchiv()}>
            Archivieren
          </button>
          <button
            type="button"
            className="cp-btn cp-btn-rot"
            disabled={busy}
            onClick={() => void handleAuftragLoeschen()}
          >
            Auftrag löschen
          </button>
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
                <button
                  type="button"
                  className="cp-btn"
                  disabled={busy}
                  onClick={() => void handleFertigMelden()}
                >
                  Als fertig melden
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
        <div className="cp-gruppe">
          <button
            type="button"
            className="cp-btn cp-btn-grau"
            onClick={() => window.open('/bestandspflege', '_blank')}
            title="Bestandspflege öffnen"
          >
            Bestandspflege ↗
          </button>
        </div>
      </div>

      <HistoriePanel
        aktiverAuftragId={auftrag.id}
        kontextAktualisiert={kontextAktualisiert}
        teilauftraege={teilBereichListe}
      />

      {dialogErp && (
        <div
          className="cp-modal-bg"
          role="dialog"
          aria-modal="true"
          aria-label="ERP exportieren"
        >
          <div className="cp-modal">
            <h3>ERP exportieren</h3>
            <p className="cp-hinweis">Modus wählen:</p>
            <div className="cp-stack" style={{ marginBottom: 12 }}>
              <label className="cp-toggle">
                <input
                  type="radio"
                  name="erp-modus"
                  checked={erpModus === 'EINZELN'}
                  onChange={() => setErpModus('EINZELN')}
                />
                <span>EINZELN</span>
              </label>
              <label className="cp-toggle">
                <input
                  type="radio"
                  name="erp-modus"
                  checked={erpModus === 'GESAMMELT'}
                  onChange={() => setErpModus('GESAMMELT')}
                />
                <span>GESAMMELT</span>
              </label>
            </div>
            <div className="cp-modal-bar">
              <button type="button" className="cp-btn" onClick={() => setDialogErp(false)}>
                Abbrechen
              </button>
              <button
                type="button"
                className="cp-btn"
                disabled={busy}
                onClick={() => void handleErpBestaetigt()}
              >
                Exportieren
              </button>
            </div>
          </div>
        </div>
      )}

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
