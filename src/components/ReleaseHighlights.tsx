import ReactMarkdown from 'react-markdown'
import { highlightsMarkdown, truncateHighlights } from '../lib/releaseNotes'
import type { GithubRelease } from '../services/releaseNotesService'

/** A slice of a release body (markdown), styled to this app's Tailwind look. Shared by the highlights below and the "Other changes" block on the release notes page. */
export function ReleaseMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      components={{
        h2: ({ children }) => <h3 className="text-base font-semibold">{children}</h3>,
        ul: ({ children }) => <ul className="list-disc space-y-1 pl-4 text-lg">{children}</ul>,
        li: ({ children }) => <li>{children}</li>,
        p: ({ children }) => <p className="text-base">{children}</p>,
      }}
    >
      {children}
    </ReactMarkdown>
  )
}

/**
 * The user-facing part of a release's notes — everything before "Other changes".
 * `maxItems` shows only the first N bullets (e.g. the orders empty-state gadget); omit it for the full list.
 */
export function ReleaseHighlights({ release, maxItems }: { release: GithubRelease; maxItems?: number }) {
  const markdown = highlightsMarkdown(release.body ?? '')
  return <ReleaseMarkdown>{maxItems != null ? truncateHighlights(markdown, maxItems) : markdown}</ReleaseMarkdown>
}
