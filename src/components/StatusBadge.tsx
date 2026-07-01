import type { OrderStatus } from '../types/database'
import { STATUS_META } from '../const/orderStatus'
import { cn } from '../lib/utils'
import { Badge } from './ui/badge'

export function StatusBadge({ status }: { status: OrderStatus }) {
  const { label, color } = STATUS_META[status]
  return (
    <Badge className={cn('text-sm px-6', color)}>
      {label}
    </Badge>
  )
}
