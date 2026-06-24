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
