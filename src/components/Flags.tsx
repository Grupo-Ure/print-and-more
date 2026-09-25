import { ArrowUp, CalendarX, CircleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Row flags shared by the order sidebar, the job list and the production feed.
 * All are the same red; the shape tells them apart.
 */
type FlagProps = {
  /** Icon size in px — each list sizes its flags to its own row. */
  size: number
  testId?: string
}

/** Something the job needs is missing (`isMissingInfo`). */
export function MissingInfoFlag({ size, testId }: FlagProps) {
  return (
    <span data-testid={testId} title="Missing information" className="inline-flex shrink-0">
      <CircleAlert size={size} className="text-red-600" aria-label="Missing information" />
    </span>
  )
}

/** The deadline has passed while work is still open (`isDeadlineMissed`). */
export function DeadlineMissedFlag({ size, testId }: FlagProps) {
  return (
    <span data-testid={testId} title="Deadline missed" className="inline-flex shrink-0">
      <CalendarX size={size} className="text-red-600" aria-label="Deadline missed" />
    </span>
  )
}

/** The order or job has high priority (effective priority for a job). */
export function HighPriorityFlag({ size, testId, animate = false }: FlagProps & {
  /** Bounce the arrow — for lists where high priority must catch the eye. */
  animate?: boolean
}) {
  return (
    <span data-testid={testId} title="High priority" className="inline-flex shrink-0">
      <ArrowUp
        size={size}
        className={cn('text-red-600', animate && 'animate-bounce')}
        aria-label="High priority"
      />
    </span>
  )
}
