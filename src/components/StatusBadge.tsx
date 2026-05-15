import type { OrderStatus } from '../types/database'
import { cn } from '../lib/utils'
import { Badge } from './ui/badge'

const STATUS_LABEL: Record<OrderStatus, string> = {
  QUOTE: 'Quote',
  INCOMPLETE: 'In Setup',
  PREPRESS_READY: 'In Prepress',
  PRODUCTION_READY: 'In Production',
  DONE: 'Done',
  INVOICED: 'Invoiced',
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge
      className={cn(
        status === 'QUOTE' && 'bg-gray-100 text-gray-700',
        status === 'INCOMPLETE' && 'bg-amber-100 text-amber-800',
        status === 'PREPRESS_READY' && 'bg-blue-100 text-blue-800',
        status === 'PRODUCTION_READY' && 'bg-violet-100 text-violet-800',
        status === 'DONE' && 'bg-emerald-100 text-emerald-800',
        status === 'INVOICED' && 'bg-gray-100 text-gray-700',
      )}
    >
      {STATUS_LABEL[status]}
    </Badge>
  )
}
