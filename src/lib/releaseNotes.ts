export const OTHER_CHANGES_MARKER = '\n## Other changes'

/** Everything before the "Other changes" section — the shop-appropriate part of the body. */
export function highlightsMarkdown(body: string): string {
  const idx = body.indexOf(OTHER_CHANGES_MARKER)
  return (idx === -1 ? body : body.slice(0, idx)).trim()
}
