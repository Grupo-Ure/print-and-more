import type { GithubRelease } from '../services/releaseNotesService'

export const OTHER_CHANGES_MARKER = '\n## Other changes'

/** One feature line (e.g. "1.10") and its newest published release. */
export interface ReleaseLine {
  /** "1.10" */
  line: string
  /** The line's newest release. Its notes cover the whole line (scripts/release-notes.mjs). */
  latest: GithubRelease
}

const VERSION_TAG = /^v(\d+)\.(\d+)\.(\d+)$/

/**
 * Groups releases by feature line (major.minor), newest line first, each
 * represented by its newest patch. Tags that aren't `vX.Y.Z` are left out.
 */
export function groupReleasesByLine(releases: GithubRelease[]): ReleaseLine[] {
  const parsed = releases.flatMap(release => {
    const match = VERSION_TAG.exec(release.tag_name)
    return match ? [{ release, version: match.slice(1, 4).map(Number) }] : []
  })
  parsed.sort((a, b) => b.version[0] - a.version[0] || b.version[1] - a.version[1] || b.version[2] - a.version[2])

  const lines: ReleaseLine[] = []
  for (const { release, version } of parsed) {
    const line = `${version[0]}.${version[1]}`
    if (lines.at(-1)?.line !== line) lines.push({ line, latest: release })
  }
  return lines
}

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
