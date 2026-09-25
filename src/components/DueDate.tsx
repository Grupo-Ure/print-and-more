import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { CalendarCheck, CalendarClock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateDe, formatDateHuman, formatDateTimeDe, relativeDay } from '../lib/formatDate'

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

/**
 * Where a closed order's row would show its deadline. `at` is the timestamp of
 * the closing event: "Finished 12 min ago" within the last hour, "Finished
 * today at 14:30", "Finished yesterday at 09:15", otherwise "Finished on Sep
 * 28th". Without an event (older orders) only the label shows.
 */
export function ClosedDate({
  label,
  at,
  testId,
}: {
  label: 'Finished' | 'Billed'
  at: string | null
  testId?: string
}) {
  const now = useNowWhileRecent(at)

  return (
    <span
      data-testid={testId}
      className="flex min-w-0 items-center gap-1.5 text-lg text-neutral-500"
      title={at ? `${label}: ${formatDateTimeDe(at)}` : label}
    >
      <CalendarCheck size={20} className="shrink-0" aria-label={label} />
      <span className="truncate">
        {closedText(label, at, now)}
      </span>
    </span>
  )
}

const HOUR_MS = 60 * 60 * 1000

function closedText(label: string, at: string | null, now: Date): string {
  if (!at) return label
  const date = new Date(at)
  if (Number.isNaN(date.getTime())) return label
  const elapsed = now.getTime() - date.getTime()
  if (elapsed < 60 * 1000) return `${label} just now`
  if (elapsed < HOUR_MS) return `${label} ${Math.floor(elapsed / 60000)} min ago`
  const localDate = format(date, 'yyyy-MM-dd')
  const relative = relativeDay(localDate, now)
  if (relative === 'today' || relative === 'yesterday') {
    return `${label} ${relative} at ${format(date, 'HH:mm')}`
  }
  return `${label} on ${formatDateHuman(localDate, now)}`
}

/**
 * The current time, re-read every minute while `at` lies within the last hour
 * so "12 min ago" keeps counting and turns into "today at …"; a fixed
 * render-time `now` otherwise.
 */
function useNowWhileRecent(at: string | null): Date {
  const [now, setNow] = useState(() => new Date())
  const recent = at != null && now.getTime() - new Date(at).getTime() < HOUR_MS

  useEffect(() => {
    if (!recent) return
    const id = setInterval(() => setNow(new Date()), 60 * 1000)
    return () => clearInterval(id)
  }, [recent])

  return now
}
