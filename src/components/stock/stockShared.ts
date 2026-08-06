/**
 * Domain-neutral primitives shared by the stamp and textile stock pages.
 * Anything specific to one department (labels, filters, master data) stays in
 * the respective stampStock/ / textileStock/ folder.
 */

export type MovementType = 'INBOUND' | 'OUTBOUND' | 'AUTO_DEDUCTION'

/** Base classes for the plain inputs/selects used across the stock views. */
export const stockInputClass = 'h-8 rounded-lg border border-input bg-background px-2 text-sm'

export type SortDirection = 'asc' | 'desc'
export type SortState<K extends string> = { key: K; dir: SortDirection } | null

/** asc → desc → off cycle used by every sortable stock table. */
export function nextSortState<K extends string>(current: SortState<K>, key: K): SortState<K> {
  if (!current || current.key !== key) return { key, dir: 'asc' }
  if (current.dir === 'asc') return { key, dir: 'desc' }
  return null
}

export type StockStatus = {
  badgeClass: string
  label: string
  rank: number
}

/**
 * Stock state shared by both domains: out of stock < below minimum < at
 * minimum < OK. Rank sorts "worst first".
 */
export function stockStatus(stock: number | null | undefined, minimumStock: number | null | undefined): StockStatus {
  const stockValue = stock ?? 0
  const minimumValue = minimumStock ?? 0
  if (stockValue <= 0) return { badgeClass: 'badge-rot', label: 'Out of stock', rank: 0 }
  if (stockValue < minimumValue) return { badgeClass: 'badge-rot', label: 'Reorder', rank: 1 }
  if (stockValue === minimumValue) return { badgeClass: 'badge-orange', label: 'At minimum', rank: 2 }
  return { badgeClass: 'badge-gruen', label: 'OK', rank: 3 }
}

export const MOVEMENT_TYPE_BADGES: Record<MovementType, { badgeClass: string; label: string }> = {
  INBOUND: { badgeClass: 'badge-gruen', label: 'Stock in' },
  OUTBOUND: { badgeClass: 'badge-grau', label: 'Stock out' },
  AUTO_DEDUCTION: { badgeClass: 'badge-blau', label: 'Auto stock-out' },
}

/** Reorder formula shared by both reorder lists: cover minimum + open demand. */
export function reorderQuantity(
  minimumStock: number | null | undefined,
  openQuantity: number,
  stock: number | null | undefined,
): number {
  return Math.max(0, (minimumStock ?? 0) + openQuantity - (stock ?? 0))
}
