import { differenceInCalendarDays, format, isSameYear, isValid, parse } from 'date-fns'

/** Today's date as `YYYY-MM-DD`. */
export function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10)
}

/** `YYYY-MM-DD` date-only portion of an ISO/date string; null for empty input. */
export function toDateOnly(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  if (trimmed === '') return null
  return trimmed.length > 10 ? trimmed.slice(0, 10) : trimmed
}

export function formatDateDe(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * A date in human terms for lists: "Today", "Tomorrow", "Yesterday", otherwise
 * month name and ordinal day ("Sep 28th"), with the year only when it is not
 * the current one ("Jan 5th, 2027"). Date-only values are read as local dates,
 * so a deadline never shifts by a day across time zones. '—' for empty or
 * invalid input.
 */
export function formatDateHuman(iso: string | null | undefined, now: Date = new Date()): string {
  const date = parseLocalDate(iso, now)
  if (!date) return '—'
  const relative = relativeDay(iso, now)
  if (relative) return relative.charAt(0).toUpperCase() + relative.slice(1)
  return monthDay(date, now)
}

/**
 * A date as month name and ordinal day ("Sep 28th"; "Jan 5th, 2027" outside
 * the current year), never relative — for a date that is the content of a
 * sentence ("changed the deadline to Sep 28th"), where "Tomorrow" would go
 * stale. Date-only values are read as local dates. '—' for empty or invalid input.
 */
export function formatDateShort(iso: string | null | undefined, now: Date = new Date()): string {
  const date = parseLocalDate(iso, now)
  return date ? monthDay(date, now) : '—'
}

/**
 * A moment in human terms for logs: "Today, 14:05", "Yesterday, 09:30",
 * "Sep 28th, 14:05", with the year only when it is not the current one
 * ("Jan 5th, 2027, 14:05"). A timestamp is read in local time, so the day is
 * the one the user lived it on. Returns the input unchanged if it is not a
 * valid date.
 */
export function formatDateTimeHuman(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const dayDiff = differenceInCalendarDays(date, now)
  const day =
    dayDiff === 0 ? 'Today' : dayDiff === 1 ? 'Tomorrow' : dayDiff === -1 ? 'Yesterday' : monthDay(date, now)
  return `${day}, ${format(date, 'HH:mm')}`
}

function monthDay(date: Date, now: Date): string {
  return format(date, isSameYear(date, now) ? 'MMM do' : 'MMM do, yyyy')
}

export type RelativeDay = 'today' | 'tomorrow' | 'yesterday'

/** "today" / "tomorrow" / "yesterday" when the date is one of them, else null. */
export function relativeDay(iso: string | null | undefined, now: Date = new Date()): RelativeDay | null {
  const date = parseLocalDate(iso, now)
  if (!date) return null
  const dayDiff = differenceInCalendarDays(date, now)
  if (dayDiff === 0) return 'today'
  if (dayDiff === 1) return 'tomorrow'
  if (dayDiff === -1) return 'yesterday'
  return null
}

/** The date-only part of an ISO string as a local date; null when empty or invalid. */
function parseLocalDate(iso: string | null | undefined, now: Date): Date | null {
  const dateOnly = toDateOnly(iso)
  if (!dateOnly) return null
  const date = parse(dateOnly, 'yyyy-MM-dd', now)
  return isValid(date) ? date : null
}

/** Short de-DE date + time; returns the input unchanged if it is not a valid date. */
export function formatDateTimeDe(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
}
