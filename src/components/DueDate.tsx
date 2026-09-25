import { CalendarClock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateDe, formatDateHuman, relativeDay } from '../lib/formatDate'

/**
 * A deadline for list rows (order sidebar, production feed): calendar icon,
 * then "Due today" / "Due tomorrow" / "Due Sep 28th". The day word is red for
 * today and orange for tomorrow; the tooltip keeps the exact date.
 */
export function DueDate({ deadline, testId }: { deadline: string | null; testId?: string }) {
  const relative = relativeDay(deadline)

  return (
    <span
      data-testid={testId}
      className="flex min-w-0 items-center gap-1.5 text-lg text-neutral-500"
      title={deadline ? `Deadline: ${formatDateDe(deadline)}` : 'No deadline'}
    >
      <CalendarClock size={20} className="shrink-0" aria-label="Deadline" />
      <span className="truncate">
        {deadline ? (
          <>
            {'Due '}
            <span
              className={cn(
                relative === 'today' && 'text-red-600',
                relative === 'tomorrow' && 'text-orange-500',
              )}
            >
              {relative ?? formatDateHuman(deadline)}
            </span>
          </>
        ) : (
          'no deadline'
        )}
      </span>
    </span>
  )
}
