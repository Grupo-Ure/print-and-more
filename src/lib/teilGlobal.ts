import type { AuftragStatus, TeilauftragRow } from '../types/database'
import { validateCopyShopDetail } from './copyshop/validateCopyShopDetail'
import { validateLfpDetail } from './lfp/validateLfpDetail'
import { validateStempelDetail } from './stempel/validateStempelDetail'
import { validateSonstigeDetail } from './sonstige/validateSonstigeDetail'
import { validateLaserDetail } from './laser/validateLaserDetail'
import { textilDetailJsonMarkiertVoll } from './textil/validateTextilDetail'

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
  if (!t.termin || String(t.termin).trim() === '') o.termin = 'Pflichtfeld'
  if (t.lieferung !== 'ABHOLUNG' && t.lieferung !== 'VERSAND') o.lieferung = 'Pflichtfeld'
  if (t.prioritaet !== 'NORMAL' && t.prioritaet !== 'HOCH') o.prioritaet = 'Pflichtfeld'
  const vid = t.verantwortlicher_id?.trim() ?? ''
  if (!vid) o.verantwortlicher_id = 'Pflichtfeld'
  else if (!UUID_LOOSE.test(vid)) o.verantwortlicher_id = 'Gültige UUID'
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
  const sd = (snap.detail as Record<string, unknown> | null) ?? {}
  const md = (merged.detail as Record<string, unknown> | null) ?? {}
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
  const sd = (snap.detail as Record<string, unknown> | null) ?? {}
  const md = (merged.detail as Record<string, unknown> | null) ?? {}
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
  if (t.bereich === 'LFP') {
    const d = (t.detail as Record<string, unknown> | null) ?? {}
    const lf = validateLfpDetail(t.typ, d, teilStatus)
    return Object.keys(lf).length === 0
  }
  if (t.bereich === 'COPYSHOP') {
    const d = (t.detail as Record<string, unknown> | null) ?? {}
    const c = validateCopyShopDetail(t.typ, d, teilStatus)
    return Object.keys(c).length === 0
  }
  if (t.bereich === 'STEMPEL') {
    const d = (t.detail as Record<string, unknown> | null) ?? {}
    const s = validateStempelDetail(t.typ, d, teilStatus)
    return Object.keys(s).length === 0
  }
  if (t.bereich === 'SONSTIGE') {
    const d = (t.detail as Record<string, unknown> | null) ?? {}
    const s = validateSonstigeDetail(d, teilStatus)
    return Object.keys(s).length === 0
  }
  if (t.bereich === 'LASERGRAVUR') {
    const d = (t.detail as Record<string, unknown> | null) ?? {}
    const s = validateLaserDetail(t.typ, d, teilStatus)
    return Object.keys(s).length === 0
  }
  if (t.bereich === 'TEXTIL') {
    if (Object.keys(validateGlobalTeilfelder(t, teilStatus)).length > 0) return false
    return textilDetailJsonMarkiertVoll(t.detail)
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
  kundePrepressOk: boolean
): AuftragStatus {
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
    if (vollstaendig && kundePrepressOk) return 'PREPRESS_BEREIT'
    if (before === 'PREPRESS_BEREIT' && (!vollstaendig || !kundePrepressOk)) {
      return 'UNVOLLSTAENDIG'
    }
    if (!vollstaendig) return 'UNVOLLSTAENDIG'
    if (!kundePrepressOk) return 'UNVOLLSTAENDIG'
    return 'UNVOLLSTAENDIG'
  }
  if (!lfp && !copyShop && !stempel && !sonstige && !laser) {
    if (!vollstaendig) return 'UNVOLLSTAENDIG'
    return 'UNVOLLSTAENDIG'
  }
  if (sonstige) {
    if (!vollstaendig) return 'UNVOLLSTAENDIG'
    if (before === 'PREPRESS_BEREIT') return 'PREPRESS_BEREIT'
    return 'UNVOLLSTAENDIG'
  }
  if (laser && merged.typ === 'SONSTIGE_LASER') {
    if (!vollstaendig) return 'UNVOLLSTAENDIG'
    if (before === 'PREPRESS_BEREIT') return 'PREPRESS_BEREIT'
    return 'UNVOLLSTAENDIG'
  }
  if (lfp && merged.typ === 'SONSTIGE_LFP') {
    if (!vollstaendig) return 'UNVOLLSTAENDIG'
    if (before === 'PREPRESS_BEREIT') return 'PREPRESS_BEREIT'
    return 'UNVOLLSTAENDIG'
  }
  if (stempel && merged.typ === 'SONSTIGE_STEMPEL') {
    if (!vollstaendig) return 'UNVOLLSTAENDIG'
    if (before === 'PREPRESS_BEREIT') return 'PREPRESS_BEREIT'
    return 'UNVOLLSTAENDIG'
  }
  if (vollstaendig && kundePrepressOk && automatischesPrepressErlaubt(merged)) return 'PREPRESS_BEREIT'
  if (before === 'PREPRESS_BEREIT' && (!vollstaendig || !kundePrepressOk)) {
    return 'UNVOLLSTAENDIG'
  }
  if (!vollstaendig) return 'UNVOLLSTAENDIG'
  if (!kundePrepressOk) return 'UNVOLLSTAENDIG'
  return 'UNVOLLSTAENDIG'
}
