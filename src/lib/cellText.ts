/** Display text for a table cell from an untyped value; objects and empty values render the fallback. */
export function cellText(value: unknown, fallback: string = '—'): string {
  if (value == null) return fallback
  if (typeof value === 'string') return value.trim() === '' ? fallback : value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  if (typeof value === 'object') return fallback
  return String(value)
}
