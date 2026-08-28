import type { StatusMeta } from '../const/orderStatus'
import { cn } from '../lib/utils'
import { Badge } from './ui/badge'

/**
 * Order and job statuses are separate systems with their own label/color maps —
 * callers pass the resolved meta (`ORDER_STATUS_META[order.status]` or
 * `JOB_STATUS_META[job.status]`).
 */
export function StatusBadge({ meta }: { meta: StatusMeta }) {
  return (
    <Badge className={cn('text-sm w-21', meta.color)}>
      {meta.label}
    </Badge>
  )
}
