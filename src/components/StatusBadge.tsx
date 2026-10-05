import type { StatusMeta } from '../lib/statusLabels'
import { cn } from '../lib/utils'
import { Badge } from './ui/badge'

/**
 * Order and product statuses are separate systems with their own label/color
 * maps — callers pass the resolved meta (`ORDER_STATUS_META[order.status]` or
 * `PRODUCT_STATUS_META[product.status]`).
 */
export function StatusBadge({ meta }: { meta: StatusMeta }) {
  return (
    <Badge className={cn('text-sm w-22', meta.color)}>
      {meta.label}
    </Badge>
  )
}
