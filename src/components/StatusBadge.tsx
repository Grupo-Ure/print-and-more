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
        'text-sm px-6',
        status === 'QUOTE' && 'bg-gray-500',
        status === 'INCOMPLETE' && 'bg-orange-500',
        status === 'PREPRESS_READY' && 'bg-pink-500',
        status === 'PRODUCTION_READY' && 'bg-blue-500',
        status === 'DONE' && 'bg-emerald-500',
        status === 'INVOICED' && 'bg-yellow-500',
      )}
    >
      {STATUS_LABEL[status]}
    </Badge>
  )
}
