/**
 * Cross-Bereich helpers shared by every sub-order detail mask.
 *
 * Every sub-order — regardless of its production department — runs the
 * same set of common-field checks (delivery, deadline, priority,
 * assignee, typesetting time) and the same status-transition logic.
 * This module is the single home for those, so per-department detail
 * components (`StampDetail`, `TextileDetail`, `LFPDetail`, etc.) all
 * delegate here.
 *
 * The module exports three functions:
 * - {@link validateSubOrderCommonFields}: per-field error map for the
 *   common header (delivery, deadline, priority, assignee, typesetting
 *   minutes). Empty map = valid.
 * - {@link isSubOrderComplete}: rolls up the common-field check plus the
 *   per-department completeness flag (Bereich-specific JSON keys for
 *   most departments, or the related-table check for Textile).
 * - {@link nextSubOrderStatus}: the central status-transition decision.
 *   Reads the planned-state diff against the last server snapshot,
 *   applies dirty-detection rules and per-Bereich auto-prepress
 *   eligibility, and returns the status the sub-order should land in.
 *
 * String values like `'STEMPEL'`, `'SONSTIGE_STEMPEL'`, status enums,
 * etc. mirror the Postgres enums and stay German; only the TypeScript
 * identifier surface is English here.
 */

import { teilJsonAlsFeldertabelle, type AuftragStatus, type TeilauftragRow } from '../types/database'
import { textileDetailMarkedComplete } from './textile/validateTextileDetail'

const UUID_LOOSE = /^[0-9a-fA-F-]{30,40}$/

/**
 * Whether {@link nextSubOrderStatus} is allowed to auto-advance this
 * sub-order into PREPRESS_BEREIT without an explicit user action.
 *
 * Default is allowed; explicitly excluded:
 * - Stamp `SONSTIGE_STEMPEL` (free-form descriptions need manual review).
 * - Anything in the Other (`SONSTIGE`) Bereich.
 * - Laser `SONSTIGE_LASER` and LFP `SONSTIGE_LFP` (same reason).
 *
 * Inside Stamp, only the structured typen are auto-advanced.
 */
function autoPrepressAllowed(merged: TeilauftragRow): boolean {
  if (merged.bereich === 'STEMPEL') {
    if (merged.typ === 'SONSTIGE_STEMPEL') return false
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

/**
 * Validate the common header fields every sub-order carries (delivery,
 * deadline, priority, assignee UUID, typesetting minutes).
 *
 * Returns a map of field-key → German error message; empty map means
 * valid. In `ANGEBOT` (quote stage) nothing is required.
 */
export function validateSubOrderCommonFields(
  t: Pick<TeilauftragRow, 'termin' | 'lieferung' | 'prioritaet' | 'verantwortlicher_id' | 'satzzeit_minuten'>,
  status: AuftragStatus
): Record<string, string> {
  const errors: Record<string, string> = {}
  if (status === 'ANGEBOT') return errors
  if (t.lieferung !== 'ABHOLUNG' && t.lieferung !== 'VERSAND') errors.lieferung = 'Pflichtfeld'
  if (!t.termin) errors.termin = 'Pflichtfeld'
  if (t.prioritaet !== 'NORMAL' && t.prioritaet !== 'HOCH') {
    errors.prioritaet = 'Pflichtfeld'
  }
  const vIdRaw = t.verantwortlicher_id
  const vid = typeof vIdRaw === 'string' ? vIdRaw.trim() : ''
  if (vid && !UUID_LOOSE.test(vid)) errors.verantwortlicher_id = 'Gültige UUID'
  if (t.satzzeit_minuten != null) {
    const n = Number(t.satzzeit_minuten)
    if (!Number.isInteger(n) || n <= 0) errors.satzzeit_minuten = 'Ganze Zahl > 0'
  }
  return errors
}

function equalDetail(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

/**
 * After PROD/FERTIG: for STEMPEL/SONSTIGE, only `detail.beschreibung`
 * counts as a content-changing edit (e.g. quantity changes for misc
 * sub-orders should NOT bounce status back to UNVOLLSTAENDIG).
 */
function descriptionDetailChangedAfterProduction(snap: TeilauftragRow, merged: TeilauftragRow): boolean {
  const rowChanged =
    merged.typ !== snap.typ ||
    merged.termin !== snap.termin ||
    merged.lieferung !== snap.lieferung ||
    merged.prioritaet !== snap.prioritaet ||
    merged.verantwortlicher_id !== snap.verantwortlicher_id ||
    merged.satzzeit_minuten !== snap.satzzeit_minuten
  if (rowChanged) return true
  const sd = teilJsonAlsFeldertabelle(snap.detail)
  const md = teilJsonAlsFeldertabelle(merged.detail)
  return String(sd.beschreibung ?? '') !== String(md.beschreibung ?? '')
}

/**
 * After PROD/FERTIG: for LASERGRAVUR, only `detail.motiv` counts as a
 * content-changing edit.
 */
function motifDetailChangedAfterProduction(snap: TeilauftragRow, merged: TeilauftragRow): boolean {
  const rowChanged =
    merged.typ !== snap.typ ||
    merged.termin !== snap.termin ||
    merged.lieferung !== snap.lieferung ||
    merged.prioritaet !== snap.prioritaet ||
    merged.verantwortlicher_id !== snap.verantwortlicher_id ||
    merged.satzzeit_minuten !== snap.satzzeit_minuten
  if (rowChanged) return true
  const sd = teilJsonAlsFeldertabelle(snap.detail)
  const md = teilJsonAlsFeldertabelle(merged.detail)
  return String(sd.motiv ?? '') !== String(md.motiv ?? '')
}

/**
 * Whether the planned-state `merged` differs from the last server
 * snapshot `snap` in any field that affects the sub-order's status.
 * Used by {@link nextSubOrderStatus} for general dirty detection
 * (Stamp/Other/Laser have narrower per-Bereich checks above).
 */
function subOrderHasContentChange(snap: TeilauftragRow, merged: TeilauftragRow): boolean {
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

/**
 * Whether the sub-order is complete enough to advance from
 * UNVOLLSTAENDIG. In `ANGEBOT` always true. Otherwise: common header
 * fields must be valid, and the per-Bereich completeness flag must be
 * set — the JSON `detail.hat_produkte` flag for most Bereiche, or the
 * related-table check for Textile.
 */
export function isSubOrderComplete(t: TeilauftragRow, status: AuftragStatus): boolean {
  if (status === 'ANGEBOT') return true
  const g = validateSubOrderCommonFields(t, status)
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
    if (Object.keys(validateSubOrderCommonFields(t, status)).length > 0) return false
    return textileDetailMarkedComplete(t.detail)
  }
  return true
}

/**
 * Decide the next sub-order status for a planned-state `merged`,
 * relative to last server snapshot `snap` (used for dirty detection).
 *
 * Rules:
 * - ANGEBOT stays ANGEBOT.
 * - From PRODUKTION_BEREIT or FERTIG: only narrow per-Bereich content
 *   changes (description for Stamp/Other, motif for Laser, anything for
 *   the rest) drop the status back to UNVOLLSTAENDIG.
 * - For Textile: complete + customer-prepress-ok auto-advances to
 *   PREPRESS_BEREIT.
 * - For "SONSTIGE_*" typen across Bereiche: never auto-advances; only
 *   manual transitions stay in PREPRESS_BEREIT.
 * - For other typen: complete + customer-prepress-ok +
 *   {@link autoPrepressAllowed} auto-advances to PREPRESS_BEREIT.
 * - When the parent Auftrag is still in ANGEBOT, PREPRESS_BEREIT is
 *   capped to UNVOLLSTAENDIG (you can't prepress before the order
 *   itself has been taken on).
 */
export function nextSubOrderStatus(
  before: AuftragStatus,
  snap: TeilauftragRow,
  merged: TeilauftragRow,
  complete: boolean,
  customerPrepressOk: boolean,
  orderStatus?: AuftragStatus
): AuftragStatus {
  function capPrepress(status: AuftragStatus): AuftragStatus {
    if (orderStatus === 'ANGEBOT' && status === 'PREPRESS_BEREIT') {
      return 'UNVOLLSTAENDIG'
    }
    return status
  }

  if (before === 'ANGEBOT') return 'ANGEBOT'
  if (before === 'PRODUKTION_BEREIT' || before === 'FERTIG') {
    if (merged.bereich === 'STEMPEL' || merged.bereich === 'SONSTIGE') {
      if (descriptionDetailChangedAfterProduction(snap, merged)) return 'UNVOLLSTAENDIG'
      return before
    }
    if (merged.bereich === 'LASERGRAVUR') {
      if (motifDetailChangedAfterProduction(snap, merged)) return 'UNVOLLSTAENDIG'
      return before
    }
    if (subOrderHasContentChange(snap, merged)) return 'UNVOLLSTAENDIG'
    return before
  }
  const lfp = merged.bereich === 'LFP'
  const copyShop = merged.bereich === 'COPYSHOP'
  const stamp = merged.bereich === 'STEMPEL'
  const other = merged.bereich === 'SONSTIGE'
  const laser = merged.bereich === 'LASERGRAVUR'
  const textile = merged.bereich === 'TEXTIL'
  if (textile) {
    if (!complete) return 'UNVOLLSTAENDIG'
    if (customerPrepressOk) return capPrepress('PREPRESS_BEREIT')
    return 'UNVOLLSTAENDIG'
  }
  // Unknown Bereich → always UNVOLLSTAENDIG.
  if (!lfp && !copyShop && !stamp && !other && !laser) {
    if (!complete) return 'UNVOLLSTAENDIG'
    return 'UNVOLLSTAENDIG'
  }
  if (other) {
    if (!complete) return 'UNVOLLSTAENDIG'
    if (before === 'PREPRESS_BEREIT') return capPrepress('PREPRESS_BEREIT')
    return 'UNVOLLSTAENDIG'
  }
  if (laser && merged.typ === 'SONSTIGE_LASER') {
    if (!complete) return 'UNVOLLSTAENDIG'
    if (before === 'PREPRESS_BEREIT') return capPrepress('PREPRESS_BEREIT')
    return 'UNVOLLSTAENDIG'
  }
  if (lfp && merged.typ === 'SONSTIGE_LFP') {
    if (!complete) return 'UNVOLLSTAENDIG'
    if (before === 'PREPRESS_BEREIT') return capPrepress('PREPRESS_BEREIT')
    return 'UNVOLLSTAENDIG'
  }
  if (stamp && merged.typ === 'SONSTIGE_STEMPEL') {
    if (!complete) return 'UNVOLLSTAENDIG'
    if (before === 'PREPRESS_BEREIT') return capPrepress('PREPRESS_BEREIT')
    return 'UNVOLLSTAENDIG'
  }
  if (complete && customerPrepressOk && autoPrepressAllowed(merged))
    return capPrepress('PREPRESS_BEREIT')
  if (before === 'PREPRESS_BEREIT' && (!complete || !customerPrepressOk)) {
    return 'UNVOLLSTAENDIG'
  }
  if (!complete) return 'UNVOLLSTAENDIG'
  if (!customerPrepressOk) return 'UNVOLLSTAENDIG'
  return 'UNVOLLSTAENDIG'
}
