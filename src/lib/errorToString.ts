/** Human-readable message from an unknown thrown value. */
export function errorToString(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) {
    const message = (e as { message: unknown }).message
    if (typeof message === 'string') return message
  }
  try {
    return JSON.stringify(e)
  } catch {
    return 'Unknown error'
  }
}
