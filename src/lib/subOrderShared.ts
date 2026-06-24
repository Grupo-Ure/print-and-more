/**
 * Cross-Bereich helpers shared by every sub-order detail mask.
 *
 * Every sub-order — regardless of its production department — runs the
 * same set of common-field checks (delivery, deadline, priority,
 * assignee, typesetting time) plus shared inheritance/eligibility helpers.
 * This module is the single home for those, so per-department detail
 * components (`StampDetail`, `TextileDetail`, `LFPDetail`, etc.) all
 * delegate here.
 *
 * Key exports:
 * - {@link resolveEffectiveSubOrder}: resolve inherited common fields against the order.
 * - {@link validateSubOrderCommonFields}: per-field error map for the common header.
 * - {@link isSubOrderComplete}: common-field check + per-department content flag.
 * - {@link autoPrepressAllowed}: per-department auto-prepress eligibility (used by the
 *   status manager's `deriveAutomaticStatus`).
 *
 * String values like `'STAMP'`, `'OTHER_STAMP'`, status enums,
 * etc. mirror the Postgres enums and stay German; only the TypeScript
 * identifier surface is English here.
 */

import { type DeliveryChoice, type OrderStatus, type Priority, type SubOrderRow } from '../types/database'

/**
 * Resolve a sub-order's inherited common fields against its order. A null
 * `delivery` / `priority` / `deadline` column means "inherit from the order"; this
 * returns a copy of the sub-order with those three resolved to their effective
 * values (delivery falling back to `PICKUP` when the order has none). Use this
 * before `validateSubOrderCommonFields` / `isSubOrderComplete` so completeness
 * judges the *effective* fields, not the raw (often-null, inheriting) columns.
 *
 * Single source of truth for the resolution — consumed by `SubOrderDetail` (display
 * + validation), the status manager (auto-advance completeness), and ContextPanel's
 * manual prepress check.
 */
export function resolveEffectiveSubOrder(
  subOrder: SubOrderRow,
  order: { delivery: DeliveryChoice | null; priority: Priority; deadline: string | null },
): SubOrderRow {
  return {
    ...subOrder,
    delivery: subOrder.delivery ?? order.delivery ?? 'PICKUP',
    priority: subOrder.priority ?? order.priority,
    deadline: subOrder.deadline ?? order.deadline,
  }
}

const UUID_LOOSE = /^[0-9a-fA-F-]{30,40}$/

/**
 * Whether the status manager is allowed to auto-advance this sub-order into
 * PREPRESS_READY without an explicit user action.
 *
 * Default is allowed; explicitly excluded:
 * - Stamp `OTHER_STAMP` (free-form descriptions need manual review).
 * - Anything in the Other (`SONSTIGE`) Bereich.
 * - Laser `OTHER_LASER` and LFP `OTHER_LFP` (same reason).
 *
 * Inside Stamp, only the structured typen are auto-advanced.
 */
export function autoPrepressAllowed(merged: SubOrderRow): boolean {
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

/**
 * Whether the sub-order is complete enough to advance from
 * UNVOLLSTAENDIG. In `ANGEBOT` always true. Otherwise: common header
 * fields must be valid, and the per-Bereich content check must pass —
 * for the JSONB Bereiche that means at least one product exists
 * (`hasProducts`, derived by the caller from `sub_order_products`); for
 * Textile it's the related-table check.
 */
export function isSubOrderComplete(subOrder: SubOrderRow, status: OrderStatus, hasProducts: boolean): boolean {
  if (status === 'QUOTE') return true
  const errors = validateSubOrderCommonFields(subOrder, status)
  if (Object.keys(errors).length > 0) return false
  if (
    subOrder.department === 'LFP' ||
    subOrder.department === 'COPYSHOP' ||
    subOrder.department === 'STAMP' ||
    subOrder.department === 'LASER_ENGRAVING' ||
    subOrder.department === 'OTHER' ||
    subOrder.department === 'TEXTILE'
  ) {
    return hasProducts
  }
  return true
}

