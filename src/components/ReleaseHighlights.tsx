import ReactMarkdown from 'react-markdown'
import { highlightsMarkdown } from '../lib/releaseNotes'
import type { GithubRelease } from '../services/releaseNotesService'

/** A slice of a release body (markdown), styled to this app's Tailwind look. Shared by the highlights below and the "Other changes" block on the release notes page. */
export function ReleaseMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      components={{
        h2: ({ children }) => <h3 className="text-sm font-semibold">{children}</h3>,
        ul: ({ children }) => <ul className="list-disc space-y-1 pl-4 text-sm">{children}</ul>,
        li: ({ children }) => <li>{children}</li>,
        p: ({ children }) => <p className="text-sm">{children}</p>,
      }}
    >
      {children}
    </ReactMarkdown>
  )
}

/** The user-facing part of a release's notes — everything before "Other changes". */
export function ReleaseHighlights({ release }: { release: GithubRelease }) {
  return <ReleaseMarkdown>{highlightsMarkdown(release.body ?? '')}</ReleaseMarkdown>
}
