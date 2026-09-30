/**
 * Cross-department helpers shared by every product.
 *
 * Every product — regardless of its department — resolves the same inherited
 * fields against its order and runs the same completeness and warning checks.
 * This module is their single home.
 *
 * Key exports:
 * - {@link resolveEffectiveProduct}: resolve inherited fields against the order.
 * - {@link validateProductCommonFields}: per-field error map for the settings tab.
 * - {@link isProductComplete}: may this product leave IN_SETUP?
 *
 * Stored enum values (`'STAMP'`, statuses, …) mirror the Postgres enums.
 */

import { format } from 'date-fns'
import { type DeliveryChoice, type Priority, type ProductRow, type OrderStatus } from '../types/database'
import { toDateOnly } from './formatDate'

/**
 * Resolve a product's inherited fields against its order. A null `delivery` /
 * `priority` / `deadline` column means "inherit from the order"; this returns a
 * copy with those three resolved to their effective values (delivery falling
 * back to `PICKUP` when the order has none). Use it before
 * `validateProductCommonFields` / `isProductComplete` so completeness judges
 * the *effective* fields, not the raw (often-null, inheriting) columns.
 */
export function resolveEffectiveProduct<
  T extends Pick<ProductRow, 'delivery' | 'priority' | 'deadline'>,
>(
  product: T,
  order: { delivery: DeliveryChoice | null; priority: Priority; deadline: string | null },
): T {
  return {
    ...product,
    delivery: product.delivery ?? order.delivery ?? 'PICKUP',
    priority: product.priority ?? order.priority,
    deadline: product.deadline ?? order.deadline,
  }
}

const UUID_LOOSE = /^[0-9a-fA-F-]{30,40}$/

/**
 * Validate the settings fields a product carries (delivery, deadline,
 * priority, assignee UUID).
 *
 * Returns a map of field-key → error message; empty map means valid. While the
 * parent order is still a QUOTE nothing is required — the quote relaxation is
 * an *order*-level rule, so callers pass `orderIsQuote` from the order.
 */
export function validateProductCommonFields(
  product: Pick<ProductRow, 'deadline' | 'delivery' | 'priority' | 'assignee_id'>,
  orderIsQuote: boolean,
): Record<string, string> {
  const errors: Record<string, string> = {}
  if (orderIsQuote) return errors
  if (product.delivery !== 'PICKUP' && product.delivery !== 'SHIPPING') errors.delivery = 'Required'
  if (!product.deadline) errors.deadline = 'Required'
  if (product.priority !== 'NORMAL' && product.priority !== 'HIGH') errors.priority = 'Required'
  const rawAssigneeId = product.assignee_id
  const assigneeId = typeof rawAssigneeId === 'string' ? rawAssigneeId.trim() : ''
  if (assigneeId && !UUID_LOOSE.test(assigneeId)) errors.assignee_id = 'Valid UUID'
  return errors
}

/** The product fields the completeness check reads — a full `ProductRow` always qualifies. */
export type ProductCompletenessFields = Pick<
  ProductRow,
  'department' | 'status' | 'is_cancelled' | 'deadline' | 'delivery' | 'priority' | 'assignee_id'
>

/**
 * Whether the product is complete enough to advance from IN_SETUP. While the
 * parent order is a QUOTE, always true (nothing required yet).
 *
 * The job model also required "at least one product"; a product cannot lack
 * itself, so completeness reduces to the effective settings being valid —
 * which in practice means the deadline, since `resolveEffectiveProduct` always
 * yields a delivery and a priority.
 */
export function isProductComplete(product: ProductCompletenessFields, orderIsQuote: boolean): boolean {
  if (orderIsQuote) return true
  return Object.keys(validateProductCommonFields(product, orderIsQuote)).length === 0
}

/**
 * Whether the product is past setup (pre-press or production) with nobody
 * assigned. A warning only — it never blocks a release or the order.
 */
export function isMissingAssignee(
  product: Pick<ProductRow, 'status' | 'is_cancelled' | 'assignee_id'>,
): boolean {
  if (product.is_cancelled) return false
  return (product.status === 'PREPRESS' || product.status === 'IN_PRODUCTION') && !product.assignee_id
}

/**
 * Whether the open product's effective deadline (its own, else the order's)
 * lies strictly before today, local time. Done and cancelled products never
 * count. A warning only — a past deadline blocks nothing.
 */
export function isDeadlineMissed(
  product: Pick<ProductRow, 'status' | 'is_cancelled' | 'deadline'>,
  order: { deadline: string | null },
  now: Date = new Date(),
): boolean {
  if (product.is_cancelled || product.status === 'DONE') return false
  const deadline = toDateOnly(product.deadline ?? order.deadline)
  return deadline != null && deadline < format(now, 'yyyy-MM-dd')
}

/**
 * Whether the open product has no effective deadline (neither its own nor the
 * order's) once the order is past quote. A warning only — the release gates
 * enforce the deadline through `isProductComplete`, not through this.
 */
export function isMissingDeadline(
  product: Pick<ProductRow, 'status' | 'is_cancelled' | 'deadline'>,
  order: { status: OrderStatus; deadline: string | null },
): boolean {
  if (product.is_cancelled || product.status === 'DONE' || order.status === 'QUOTE') return false
  return !(product.deadline ?? order.deadline)
}

/**
 * Derived alert: the product has no deadline, is past setup with nobody
 * assigned, or sits in production but fails the completeness check — the trace
 * a force release leaves behind (or a required field cleared after a regular
 * release). Purely derived, no stored flag: it appears while the info is
 * missing and disappears once someone back-fills it. Shown as a warning icon
 * on the order (sidebar) and the product (product list); it never blocks
 * anything.
 */
export function isMissingInfo(
  product: ProductCompletenessFields,
  order: { status: OrderStatus; delivery: DeliveryChoice | null; priority: Priority; deadline: string | null },
): boolean {
  if (isMissingAssignee(product) || isMissingDeadline(product, order)) return true
  if (product.status !== 'IN_PRODUCTION' || product.is_cancelled) return false
  // A product in production implies the order is past QUOTE — validate strictly.
  return !isProductComplete(resolveEffectiveProduct(product, order), false)
}

/**
 * True when the order's work is complete: at least one non-cancelled product
 * and every one of them is DONE. Cancelled products do not count either way.
 * This is the condition for the order's "Mark finished" action and for the
 * automatic finish (`deriveAutomaticOrderStatus`).
 */
export function areAllProductsDone(
  products: readonly Pick<ProductRow, 'status' | 'is_cancelled'>[],
): boolean {
  const live = products.filter(product => !product.is_cancelled)
  return live.length > 0 && live.every(product => product.status === 'DONE')
}

/**
 * Short form of a product number for contexts already scoped to one order:
 * strips the `<order_number>` prefix and keeps the identifying
 * `<DEPT>-<NN>` suffix (e.g. `2026-07-0042-LFP-01` → `LFP-01`). The order
 * number itself contains dashes, so "last two segments" is the robust cut.
 */
export function shortProductNumber(productNumber: string): string {
  return productNumber.split('-').slice(-2).join('-')
}
