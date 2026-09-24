export const OTHER_CHANGES_MARKER = '\n## Other changes'

/** Everything before the "Other changes" section — the shop-appropriate part of the body. */
export function highlightsMarkdown(body: string): string {
  const idx = body.indexOf(OTHER_CHANGES_MARKER)
  return (idx === -1 ? body : body.slice(0, idx)).trim()
}

/** The heading plus the first `maxItems` bullets (and their wrapped lines) — a short excerpt for the orders empty-state gadget. */
export function truncateHighlights(markdown: string, maxItems: number): string {
  const lines = markdown.split('\n')
  let bulletCount = 0
  const kept: string[] = []
  for (const line of lines) {
    if (line.startsWith('- ')) {
      bulletCount++
      if (bulletCount > maxItems) break
    }
    kept.push(line)
  }
  return kept.join('\n').trim()
}
