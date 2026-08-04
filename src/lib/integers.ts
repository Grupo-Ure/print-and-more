/** Safe integer from a DB/JSON value; prevents `[object Object]` leaking into calculations. */
export function toInteger(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = parseInt(value, 10)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

/** `toInteger` floored at 0 — for stock/quantity display cells. */
export function toNonNegativeInteger(value: unknown): number {
  const result = toInteger(value)
  return result < 0 ? 0 : result
}
