import { teilJsonAlsFeldertabelle, type AuftragStatus, type TeilauftragRow } from '../types/database'
import { textileDetailMarkedComplete } from './textil/validateTextileDetail'

export type LieferungEnum = 'ABHOLUNG' | 'VERSAND'

const UUID_LOOSE = /^[0-9a-fA-F-]{30,40}$/

function automatischesPrepressErlaubt(merged: TeilauftragRow): boolean {
  // Standard: automatisch erlaubt, außer explizit ausgeschlossen.
  // SONSTIGE_* bleiben manuell (siehe UI-Hinweise).
  if (merged.bereich === 'STEMPEL') {
    if (merged.typ === 'SONSTIGE_STEMPEL') return false
    // Explizit erlaubte Stempel-Typen (inkl. neue Artikeltypen).
    return (
      merged.typ === 'TRODAT_PRINTY' ||
      merged.typ === 'HOLZSTEMPEL' ||
      merged.typ === 'STATIVSTEMPEL' ||
      merged.typ === 'DATUMSSTEMPEL' ||
      merged.typ === 'NACHFUELLFARBE' ||
      merged.typ === 'STEMPELKISSEN' ||
      merged.typ === 'TRODAT_KISSEN' ||
      merged.typ === 'STEMPELPLATTE'
    )
  }
  if (merged.bereich === 'SONSTIGE') return false
  if (merged.bereich === 'LASERGRAVUR' && merged.typ === 'SONSTIGE_LASER') return false
  if (merged.bereich === 'LFP' && merged.typ === 'SONSTIGE_LFP') return false
  return true
}

export function validateGlobalTeilfelder(
  t: Pick<TeilauftragRow, 'termin' | 'lieferung' | 'prioritaet' | 'verantwortlicher_id' | 'satzzeit_minuten'>,
  teilStatus: AuftragStatus
): Record<string, string> {
  const o: Record<string, string> = {}
  if (teilStatus === 'ANGEBOT') return o
  if (t.lieferung !== 'ABHOLUNG' && t.lieferung !== 'VERSAND') o.lieferung = 'Pflichtfeld'
  if (!t.termin) o.termin = 'Pflichtfeld'
  if (t.prioritaet !== 'NORMAL' && t.prioritaet !== 'HOCH') {
    o.prioritaet = 'Pflichtfeld'
  }
  const vIdRaw = t.verantwortlicher_id
  const vid = typeof vIdRaw === 'string' ? vIdRaw.trim() : ''
  if (vid && !UUID_LOOSE.test(vid)) o.verantwortlicher_id = 'Gültige UUID'
  if (t.satzzeit_minuten != null) {
    const n = Number(t.satzzeit_minuten)
    if (!Number.isInteger(n) || n <= 0) o.satzzeit_minuten = 'Ganze Zahl > 0'
  }
  return o
}

function equalDetail(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

/**
 * Nach PROD/FERTIG: bei STEMPEL/SONSTIGE nur `detail.beschreibung` (nicht z. B. Stückzahl bei Sonstigen)
 * setzt inhaltlich im Detail zurück.
 */
function beschreibungDetailNachProdAenderung(snap: TeilauftragRow, merged: TeilauftragRow): boolean {
  const rowAenderung =
    merged.typ !== snap.typ ||
    merged.termin !== snap.termin ||
    merged.lieferung !== snap.lieferung ||
    merged.prioritaet !== snap.prioritaet ||
    merged.verantwortlicher_id !== snap.verantwortlicher_id ||
    merged.satzzeit_minuten !== snap.satzzeit_minuten
  if (rowAenderung) return true
  const sd = teilJsonAlsFeldertabelle(snap.detail)
  const md = teilJsonAlsFeldertabelle(merged.detail)
  return String(sd.beschreibung ?? '') !== String(md.beschreibung ?? '')
}

/** Nach PROD/FERTIG: bei LASERGRAVUR nur `detail.motiv` setzt inhaltlich im Detail zurück. */
function motivDetailNachProdAenderung(snap: TeilauftragRow, merged: TeilauftragRow): boolean {
  const rowAenderung =
    merged.typ !== snap.typ ||
    merged.termin !== snap.termin ||
    merged.lieferung !== snap.lieferung ||
    merged.prioritaet !== snap.prioritaet ||
    merged.verantwortlicher_id !== snap.verantwortlicher_id ||
    merged.satzzeit_minuten !== snap.satzzeit_minuten
  if (rowAenderung) return true
  const sd = teilJsonAlsFeldertabelle(snap.detail)
  const md = teilJsonAlsFeldertabelle(merged.detail)
  return String(sd.motiv ?? '') !== String(md.motiv ?? '')
}

export function teilHatInhaltAenderung(
  snap: TeilauftragRow,
  merged: TeilauftragRow
): boolean {
  return (
    merged.typ !== snap.typ ||
    !equalDetail(merged.detail, snap.detail) ||
    merged.termin !== snap.termin ||
    merged.lieferung !== snap.lieferung ||
    merged.prioritaet !== snap.prioritaet ||
    merged.verantwortlicher_id !== snap.verantwortlicher_id ||
    merged.satzzeit_minuten !== snap.satzzeit_minuten
  )
}

export function istTeilAuftragVollstaendig(t: TeilauftragRow, teilStatus: AuftragStatus): boolean {
  if (teilStatus === 'ANGEBOT') return true
  const g = validateGlobalTeilfelder(t, teilStatus)
  if (Object.keys(g).length > 0) return false
  if (
    t.bereich === 'LFP' ||
    t.bereich === 'COPYSHOP' ||
    t.bereich === 'STEMPEL' ||
    t.bereich === 'LASERGRAVUR' ||
    t.bereich === 'SONSTIGE'
  ) {
    const d = teilJsonAlsFeldertabelle(t.detail)
    return d?.hat_produkte === true
  }
  if (t.bereich === 'TEXTIL') {
    if (Object.keys(validateGlobalTeilfelder(t, teilStatus)).length > 0) return false
    return textileDetailMarkedComplete(t.detail)
  }
  return true
}

/**
 * Nächster Status nach geplantem Zustand `merged` (relativ zu `snap` = letzter Serverstand für Dirty-Prüfung).
 */
export function nextTeilStatus(
  before: AuftragStatus,
  snap: TeilauftragRow,
  merged: TeilauftragRow,
  vollstaendig: boolean,
  kundePrepressOk: boolean,
  auftragStatus?: AuftragStatus
): AuftragStatus {
  function capPrepress(status: AuftragStatus): AuftragStatus {
    if (auftragStatus === 'ANGEBOT' && status === 'PREPRESS_BEREIT') {
      return 'UNVOLLSTAENDIG'
    }
    return status
  }

  if (before === 'ANGEBOT') return 'ANGEBOT'
  if (before === 'PRODUKTION_BEREIT' || before === 'FERTIG') {
    if (merged.bereich === 'STEMPEL' || merged.bereich === 'SONSTIGE') {
      if (beschreibungDetailNachProdAenderung(snap, merged)) return 'UNVOLLSTAENDIG'
      return before
    }
    if (merged.bereich === 'LASERGRAVUR') {
      if (motivDetailNachProdAenderung(snap, merged)) return 'UNVOLLSTAENDIG'
      return before
    }
    if (teilHatInhaltAenderung(snap, merged)) return 'UNVOLLSTAENDIG'
    return before
  }
  const lfp = merged.bereich === 'LFP'
  const copyShop = merged.bereich === 'COPYSHOP'
  const stempel = merged.bereich === 'STEMPEL'
  const sonstige = merged.bereich === 'SONSTIGE'
  const laser = merged.bereich === 'LASERGRAVUR'
  const textil = merged.bereich === 'TEXTIL'
  if (textil) {
    if (!vollstaendig) return 'UNVOLLSTAENDIG'
    if (kundePrepressOk) return capPrepress('PREPRESS_BEREIT')
    return 'UNVOLLSTAENDIG'
  }
  // Unbekannter Bereich → immer UNVOLLSTAENDIG
  if (!lfp && !copyShop && !stempel && !sonstige && !laser) {
    if (!vollstaendig) return 'UNVOLLSTAENDIG'
    return 'UNVOLLSTAENDIG'
  }
  if (sonstige) {
    if (!vollstaendig) return 'UNVOLLSTAENDIG'
    if (before === 'PREPRESS_BEREIT') return capPrepress('PREPRESS_BEREIT')
    return 'UNVOLLSTAENDIG'
  }
  if (laser && merged.typ === 'SONSTIGE_LASER') {
    if (!vollstaendig) return 'UNVOLLSTAENDIG'
    if (before === 'PREPRESS_BEREIT') return capPrepress('PREPRESS_BEREIT')
    return 'UNVOLLSTAENDIG'
  }
  if (lfp && merged.typ === 'SONSTIGE_LFP') {
    if (!vollstaendig) return 'UNVOLLSTAENDIG'
    if (before === 'PREPRESS_BEREIT') return capPrepress('PREPRESS_BEREIT')
    return 'UNVOLLSTAENDIG'
  }
  if (stempel && merged.typ === 'SONSTIGE_STEMPEL') {
    if (!vollstaendig) return 'UNVOLLSTAENDIG'
    if (before === 'PREPRESS_BEREIT') return capPrepress('PREPRESS_BEREIT')
    return 'UNVOLLSTAENDIG'
  }
  if (vollstaendig && kundePrepressOk && automatischesPrepressErlaubt(merged))
    return capPrepress('PREPRESS_BEREIT')
  if (before === 'PREPRESS_BEREIT' && (!vollstaendig || !kundePrepressOk)) {
    return 'UNVOLLSTAENDIG'
  }
  if (!vollstaendig) return 'UNVOLLSTAENDIG'
  if (!kundePrepressOk) return 'UNVOLLSTAENDIG'
  return 'UNVOLLSTAENDIG'
}
