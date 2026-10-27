import { format } from 'date-fns'

/**
 * Whether a timestamp falls on a day within `from`…`to` (`YYYY-MM-DD`, both
 * inclusive, either empty for an open end). The day is the local one, so an
 * entry made late in the evening counts for the day the user saw it on.
 */
export function isInDateRange(iso: string, from: string, to: string): boolean {
  if (!from && !to) return true
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return false
  const day = format(date, 'yyyy-MM-dd')
  return (!from || day >= from) && (!to || day <= to)
}
