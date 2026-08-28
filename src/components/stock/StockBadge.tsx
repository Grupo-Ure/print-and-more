import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { MOVEMENT_TYPE_BADGES, type MovementType, type StockStatus } from './stockShared'

/**
 * Solid colour chips for the stock pages, visually the same family as the
 * order/job `StatusBadge` (solid `bg-*-500`, fixed minimum width).
 */
function StockChip({ badgeClass, label }: { badgeClass: string; label: string }) {
  return <Badge className={cn('min-w-21 justify-center text-sm', badgeClass)}>{label}</Badge>
}

/** Stock-state chip (Out of stock / Reorder / At minimum / OK). */
export function StockStatusBadge({ status }: { status: StockStatus }) {
  return <StockChip badgeClass={status.badgeClass} label={status.label} />
}

/** Movement-type chip (Stock in / Stock out / Auto stock-out). */
export function MovementTypeBadge({ type }: { type: string }) {
  const meta = MOVEMENT_TYPE_BADGES[type as MovementType] ?? { badgeClass: 'bg-gray-500', label: type }
  return <StockChip badgeClass={meta.badgeClass} label={meta.label} />
}

/** Neutral metadata chip (Default / Inactive) in the same solid style. */
export function NeutralChip({ label }: { label: string }) {
  return <Badge className="bg-gray-500">{label}</Badge>
}
