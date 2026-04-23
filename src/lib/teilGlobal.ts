import type { AuftragStatus, TeilauftragRow } from '../types/database'
import { validateCopyShopDetail } from './copyshop/validateCopyShopDetail'
import { validateLfpDetail } from './lfp/validateLfpDetail'
import { validateStempelDetail } from './stempel/validateStempelDetail'

export type LieferungEnum = 'ABHOLUNG' | 'VERSAND'

const UUID_LOOSE = /^[0-9a-fA-F-]{30,40}$/

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

/** Nach PROD/FERTIG: bei STEMPEL nur `detail.beschreibung` (nicht z. B. Farbe) setzt inhaltlich zurück. */
function stempelNachProdAenderung(snap: TeilauftragRow, merged: TeilauftragRow): boolean {
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
    if (merged.bereich === 'STEMPEL') {
      if (stempelNachProdAenderung(snap, merged)) return 'UNVOLLSTAENDIG'
      return before
    }
    if (teilHatInhaltAenderung(snap, merged)) return 'UNVOLLSTAENDIG'
    return before
  }
  const lfp = merged.bereich === 'LFP'
  const copyShop = merged.bereich === 'COPYSHOP'
  const stempel = merged.bereich === 'STEMPEL'
  if (!lfp && !copyShop && !stempel) {
    if (!vollstaendig) return 'UNVOLLSTAENDIG'
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
  if (vollstaendig && kundePrepressOk) return 'PREPRESS_BEREIT'
  if (before === 'PREPRESS_BEREIT' && (!vollstaendig || !kundePrepressOk)) {
    return 'UNVOLLSTAENDIG'
  }
  if (!vollstaendig) return 'UNVOLLSTAENDIG'
  if (!kundePrepressOk) return 'UNVOLLSTAENDIG'
  return 'UNVOLLSTAENDIG'
}
