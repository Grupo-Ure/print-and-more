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

import { subOrderDetailToFieldMap, type OrderStatus, type SubOrderRow } from '../types/database'
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
function autoPrepressAllowed(merged: SubOrderRow): boolean {
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
  subOrder: Pick<SubOrderRow, 'termin' | 'lieferung' | 'prioritaet' | 'verantwortlicher_id' | 'satzzeit_minuten'>,
  status: OrderStatus
): Record<string, string> {
  const errors: Record<string, string> = {}
  if (status === 'QUOTE') return errors
  if (subOrder.lieferung !== 'ABHOLUNG' && subOrder.lieferung !== 'VERSAND') errors.lieferung = 'Pflichtfeld'
  if (!subOrder.termin) errors.termin = 'Pflichtfeld'
  if (subOrder.prioritaet !== 'NORMAL' && subOrder.prioritaet !== 'HOCH') {
    errors.prioritaet = 'Pflichtfeld'
  }
  const rawAssigneeId = subOrder.verantwortlicher_id
  const assigneeId = typeof rawAssigneeId === 'string' ? rawAssigneeId.trim() : ''
  if (assigneeId && !UUID_LOOSE.test(assigneeId)) errors.verantwortlicher_id = 'Gültige UUID'
  if (subOrder.satzzeit_minuten != null) {
    const minutes = Number(subOrder.satzzeit_minuten)
    if (!Number.isInteger(minutes) || minutes <= 0) errors.satzzeit_minuten = 'Ganze Zahl > 0'
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
function descriptionDetailChangedAfterProduction(snap: SubOrderRow, merged: SubOrderRow): boolean {
  const rowChanged =
    merged.typ !== snap.typ ||
    merged.termin !== snap.termin ||
    merged.lieferung !== snap.lieferung ||
    merged.prioritaet !== snap.prioritaet ||
    merged.verantwortlicher_id !== snap.verantwortlicher_id ||
    merged.satzzeit_minuten !== snap.satzzeit_minuten
  if (rowChanged) return true
  const sd = subOrderDetailToFieldMap(snap.detail)
  const md = subOrderDetailToFieldMap(merged.detail)
  return String(sd.beschreibung ?? '') !== String(md.beschreibung ?? '')
}

/**
 * After PROD/FERTIG: for LASERGRAVUR, only `detail.motiv` counts as a
 * content-changing edit.
 */
function motifDetailChangedAfterProduction(snap: SubOrderRow, merged: SubOrderRow): boolean {
  const rowChanged =
    merged.typ !== snap.typ ||
    merged.termin !== snap.termin ||
    merged.lieferung !== snap.lieferung ||
    merged.prioritaet !== snap.prioritaet ||
    merged.verantwortlicher_id !== snap.verantwortlicher_id ||
    merged.satzzeit_minuten !== snap.satzzeit_minuten
  if (rowChanged) return true
  const sd = subOrderDetailToFieldMap(snap.detail)
  const md = subOrderDetailToFieldMap(merged.detail)
  return String(sd.motiv ?? '') !== String(md.motiv ?? '')
}

/**
 * Whether the planned-state `merged` differs from the last server
 * snapshot `snap` in any field that affects the sub-order's status.
 * Used by {@link nextSubOrderStatus} for general dirty detection
 * (Stamp/Other/Laser have narrower per-Bereich checks above).
 */
function subOrderHasContentChange(snap: SubOrderRow, merged: SubOrderRow): boolean {
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
export function isSubOrderComplete(subOrder: SubOrderRow, status: OrderStatus): boolean {
  if (status === 'QUOTE') return true
  const errors = validateSubOrderCommonFields(subOrder, status)
  if (Object.keys(errors).length > 0) return false
  if (
    subOrder.bereich === 'LFP' ||
    subOrder.bereich === 'COPYSHOP' ||
    subOrder.bereich === 'STEMPEL' ||
    subOrder.bereich === 'LASERGRAVUR' ||
    subOrder.bereich === 'SONSTIGE'
  ) {
    const detailFields = subOrderDetailToFieldMap(subOrder.detail)
    return detailFields?.hat_produkte === true
  }
  if (subOrder.bereich === 'TEXTIL') {
    if (Object.keys(validateSubOrderCommonFields(subOrder, status)).length > 0) return false
    return textileDetailMarkedComplete(subOrder.detail)
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
  before: OrderStatus,
  snap: SubOrderRow,
  merged: SubOrderRow,
  complete: boolean,
  customerPrepressOk: boolean,
  orderStatus?: OrderStatus
): OrderStatus {
  function capPrepress(status: OrderStatus): OrderStatus {
    if (orderStatus === 'QUOTE' && status === 'PREPRESS_READY') {
      return 'INCOMPLETE'
    }
    return status
  }

  if (before === 'QUOTE') return 'QUOTE'
  if (before === 'PRODUCTION_READY' || before === 'DONE') {
    if (merged.bereich === 'STEMPEL' || merged.bereich === 'SONSTIGE') {
      if (descriptionDetailChangedAfterProduction(snap, merged)) return 'INCOMPLETE'
      return before
    }
    if (merged.bereich === 'LASERGRAVUR') {
      if (motifDetailChangedAfterProduction(snap, merged)) return 'INCOMPLETE'
      return before
    }
    if (subOrderHasContentChange(snap, merged)) return 'INCOMPLETE'
    return before
  }
  const lfp = merged.bereich === 'LFP'
  const copyShop = merged.bereich === 'COPYSHOP'
  const stamp = merged.bereich === 'STEMPEL'
  const other = merged.bereich === 'SONSTIGE'
  const laser = merged.bereich === 'LASERGRAVUR'
  const textile = merged.bereich === 'TEXTIL'
  if (textile) {
    if (!complete) return 'INCOMPLETE'
    if (customerPrepressOk) return capPrepress('PREPRESS_READY')
    return 'INCOMPLETE'
  }
  // Unknown Bereich → always INCOMPLETE.
  if (!lfp && !copyShop && !stamp && !other && !laser) {
    if (!complete) return 'INCOMPLETE'
    return 'INCOMPLETE'
  }
  if (other) {
    if (!complete) return 'INCOMPLETE'
    if (before === 'PREPRESS_READY') return capPrepress('PREPRESS_READY')
    return 'INCOMPLETE'
  }
  if (laser && merged.typ === 'SONSTIGE_LASER') {
    if (!complete) return 'INCOMPLETE'
    if (before === 'PREPRESS_READY') return capPrepress('PREPRESS_READY')
    return 'INCOMPLETE'
  }
  if (lfp && merged.typ === 'SONSTIGE_LFP') {
    if (!complete) return 'INCOMPLETE'
    if (before === 'PREPRESS_READY') return capPrepress('PREPRESS_READY')
    return 'INCOMPLETE'
  }
  if (stamp && merged.typ === 'SONSTIGE_STEMPEL') {
    if (!complete) return 'INCOMPLETE'
    if (before === 'PREPRESS_READY') return capPrepress('PREPRESS_READY')
    return 'INCOMPLETE'
  }
  if (complete && customerPrepressOk && autoPrepressAllowed(merged))
    return capPrepress('PREPRESS_READY')
  if (before === 'PREPRESS_READY' && (!complete || !customerPrepressOk)) {
    return 'INCOMPLETE'
  }
  if (!complete) return 'INCOMPLETE'
  if (!customerPrepressOk) return 'INCOMPLETE'
  return 'INCOMPLETE'
}
