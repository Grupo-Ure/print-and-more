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
 * String values like `'STAMP'`, `'OTHER_STAMP'`, status enums,
 * etc. mirror the Postgres enums and stay German; only the TypeScript
 * identifier surface is English here.
 */

import { type OrderStatus, type SubOrderRow } from '../types/database'
import { subOrderDetailToFieldMap } from './utils'
import { textileDetailMarkedComplete } from './textile/validateTextileDetail'

const UUID_LOOSE = /^[0-9a-fA-F-]{30,40}$/

/**
 * Whether {@link nextSubOrderStatus} is allowed to auto-advance this
 * sub-order into PREPRESS_BEREIT without an explicit user action.
 *
 * Default is allowed; explicitly excluded:
 * - Stamp `OTHER_STAMP` (free-form descriptions need manual review).
 * - Anything in the Other (`SONSTIGE`) Bereich.
 * - Laser `OTHER_LASER` and LFP `OTHER_LFP` (same reason).
 *
 * Inside Stamp, only the structured typen are auto-advanced.
 */
function autoPrepressAllowed(merged: SubOrderRow): boolean {
  if (merged.department === 'STAMP') {
    if (merged.type === 'OTHER_STAMP') return false
    return (
      merged.type === 'TRODAT_PRINTY' ||
      merged.type === 'WOODEN_STAMP' ||
      merged.type === 'STAND_STAMP' ||
      merged.type === 'DATE_STAMP' ||
      merged.type === 'REFILL_INK' ||
      merged.type === 'INK_PAD' ||
      merged.type === 'TRODAT_PAD' ||
      merged.type === 'STAMP_PLATE'
    )
  }
  if (merged.department === 'OTHER') return false
  if (merged.department === 'LASER_ENGRAVING' && merged.type === 'OTHER_LASER') return false
  if (merged.department === 'LFP' && merged.type === 'OTHER_LFP') return false
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
  subOrder: Pick<SubOrderRow, 'deadline' | 'delivery' | 'priority' | 'assignee_id' | 'typesetting_minutes'>,
  status: OrderStatus
): Record<string, string> {
  const errors: Record<string, string> = {}
  if (status === 'QUOTE') return errors
  if (subOrder.delivery !== 'PICKUP' && subOrder.delivery !== 'SHIPPING') errors.lieferung = 'Required'
  if (!subOrder.deadline) errors.termin = 'Required'
  if (subOrder.priority !== 'NORMAL' && subOrder.priority !== 'HIGH') {
    errors.prioritaet = 'Required'
  }
  const rawAssigneeId = subOrder.assignee_id
  const assigneeId = typeof rawAssigneeId === 'string' ? rawAssigneeId.trim() : ''
  if (assigneeId && !UUID_LOOSE.test(assigneeId)) errors.verantwortlicher_id = 'Valid UUID'
  if (subOrder.typesetting_minutes != null) {
    const minutes = Number(subOrder.typesetting_minutes)
    if (!Number.isInteger(minutes) || minutes <= 0) errors.satzzeit_minuten = 'Integer > 0'
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
    merged.type !== snap.type ||
    merged.deadline !== snap.deadline ||
    merged.delivery !== snap.delivery ||
    merged.priority !== snap.priority ||
    merged.assignee_id !== snap.assignee_id ||
    merged.typesetting_minutes !== snap.typesetting_minutes
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
    merged.type !== snap.type ||
    merged.deadline !== snap.deadline ||
    merged.delivery !== snap.delivery ||
    merged.priority !== snap.priority ||
    merged.assignee_id !== snap.assignee_id ||
    merged.typesetting_minutes !== snap.typesetting_minutes
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
    merged.type !== snap.type ||
    !equalDetail(merged.detail, snap.detail) ||
    merged.deadline !== snap.deadline ||
    merged.delivery !== snap.delivery ||
    merged.priority !== snap.priority ||
    merged.assignee_id !== snap.assignee_id ||
    merged.typesetting_minutes !== snap.typesetting_minutes
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
    subOrder.department === 'LFP' ||
    subOrder.department === 'COPYSHOP' ||
    subOrder.department === 'STAMP' ||
    subOrder.department === 'LASER_ENGRAVING' ||
    subOrder.department === 'OTHER'
  ) {
    const detailFields = subOrderDetailToFieldMap(subOrder.detail)
    return detailFields?.hat_produkte === true
  }
  if (subOrder.department === 'TEXTILE') {
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
    if (merged.department === 'STAMP' || merged.department === 'OTHER') {
      if (descriptionDetailChangedAfterProduction(snap, merged)) return 'INCOMPLETE'
      return before
    }
    if (merged.department === 'LASER_ENGRAVING') {
      if (motifDetailChangedAfterProduction(snap, merged)) return 'INCOMPLETE'
      return before
    }
    if (subOrderHasContentChange(snap, merged)) return 'INCOMPLETE'
    return before
  }
  const lfp = merged.department === 'LFP'
  const copyShop = merged.department === 'COPYSHOP'
  const stamp = merged.department === 'STAMP'
  const other = merged.department === 'OTHER'
  const laser = merged.department === 'LASER_ENGRAVING'
  const textile = merged.department === 'TEXTILE'
  if (textile) {
    if (!complete) return 'INCOMPLETE'
    if (customerPrepressOk) return capPrepress('PREPRESS_READY')
    return 'INCOMPLETE'
  }
  // Unknown department → always INCOMPLETE.
  if (!lfp && !copyShop && !stamp && !other && !laser) {
    if (!complete) return 'INCOMPLETE'
    return 'INCOMPLETE'
  }
  if (other) {
    if (!complete) return 'INCOMPLETE'
    if (before === 'PREPRESS_READY') return capPrepress('PREPRESS_READY')
    return 'INCOMPLETE'
  }
  if (laser && merged.type === 'OTHER_LASER') {
    if (!complete) return 'INCOMPLETE'
    if (before === 'PREPRESS_READY') return capPrepress('PREPRESS_READY')
    return 'INCOMPLETE'
  }
  if (lfp && merged.type === 'OTHER_LFP') {
    if (!complete) return 'INCOMPLETE'
    if (before === 'PREPRESS_READY') return capPrepress('PREPRESS_READY')
    return 'INCOMPLETE'
  }
  if (stamp && merged.type === 'OTHER_STAMP') {
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
