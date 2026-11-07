/**
 * Thrown by a template's resolve when no later attempt can do better — the
 * address the mail goes to is not configured. The sender gives the mail up
 * at once instead of spending its retries.
 */
export class UnsendableEmail extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsendableEmail'
  }
}
