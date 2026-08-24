/**
 * Domain-neutral primitives shared by the stamp and textile stock pages.
 * Anything specific to one department (labels, filters, master data) stays in
 * the respective stampStock/ / textileStock/ folder.
 */

export type MovementType = 'INBOUND' | 'OUTBOUND' | 'AUTO_DEDUCTION'

/**
 * Base classes for the plain inputs/selects used across the stock views —
 * same border/focus treatment as the ui `Input`, at toolbar height.
 */
export const stockInputClass =
  'h-8 rounded-lg border border-input bg-background px-2.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50'

export type SortDirection = 'asc' | 'desc'
export type SortState<K extends string> = { key: K; dir: SortDirection } | null

/** asc → desc → off cycle used by every sortable stock table. */
export function nextSortState<K extends string>(current: SortState<K>, key: K): SortState<K> {
  if (!current || current.key !== key) return { key, dir: 'asc' }
  if (current.dir === 'asc') return { key, dir: 'desc' }
  return null
}

export type StockStatus = {
  /** Solid chip colour, same family as the order/job status badges. */
  badgeClass: string
  label: string
  rank: number
}

/**
 * Stock state shared by both domains: out of stock < below minimum < at
 * minimum < OK. Rank sorts "worst first". Ranks 0–1 are the warning states
 * (they tint their table row red, like the shortage rows on the orders page).
 */
export function stockStatus(stock: number | null | undefined, minimumStock: number | null | undefined): StockStatus {
  const stockValue = stock ?? 0
  const minimumValue = minimumStock ?? 0
  if (stockValue <= 0) return { badgeClass: 'bg-red-500', label: 'Out of stock', rank: 0 }
  if (stockValue < minimumValue) return { badgeClass: 'bg-red-500', label: 'Reorder', rank: 1 }
  if (stockValue === minimumValue) return { badgeClass: 'bg-amber-500', label: 'At minimum', rank: 2 }
  return { badgeClass: 'bg-emerald-500', label: 'OK', rank: 3 }
}

/** True for the states that should visually alarm (row tint, reorder list). */
export function isStockWarning(status: StockStatus): boolean {
  return status.rank <= 1
}

export const MOVEMENT_TYPE_BADGES: Record<MovementType, { badgeClass: string; label: string }> = {
  INBOUND: { badgeClass: 'bg-emerald-500', label: 'Stock in' },
  OUTBOUND: { badgeClass: 'bg-gray-500', label: 'Stock out' },
  AUTO_DEDUCTION: { badgeClass: 'bg-blue-500', label: 'Auto stock-out' },
}

/** Reorder formula shared by both reorder lists: cover minimum + open demand. */
export function reorderQuantity(
  minimumStock: number | null | undefined,
  openQuantity: number,
  stock: number | null | undefined,
): number {
  return Math.max(0, (minimumStock ?? 0) + openQuantity - (stock ?? 0))
}
