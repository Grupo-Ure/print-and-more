import { useState, type CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { Sidebar, SidebarContent, SidebarHeader, SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useIsMobile } from '@/hooks/use-mobile'
import { Login } from '../components/Login'
import { ReleaseHighlights, ReleaseMarkdown } from '../components/ReleaseHighlights'
import { useSupabaseSession } from '../hooks/useSupabaseSession'
import { useReleaseNotes } from '../queries/releaseNotesQueries'
import { formatDateDe } from '../lib/formatDate'
import { groupReleasesByLine, OTHER_CHANGES_MARKER, type ReleaseLine } from '../lib/releaseNotes'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.releaseNotesPage

/** One feature line in the sidebar list: line + date of its newest release, highlighted when selected. */
function ReleaseRow({ releaseLine, isActive, onSelect }: { releaseLine: ReleaseLine; isActive: boolean; onSelect: () => void }) {
  const release = releaseLine.latest
  return (
    <div
      role="button"
      tabIndex={0}
      data-testid={IDS.sidebarRow}
      data-line={releaseLine.line}
      aria-current={isActive ? 'true' : undefined}
      onClick={onSelect}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        'flex cursor-pointer items-center justify-between gap-2 border-l-6 border-neutral-200 bg-white p-3 text-left hover:bg-neutral-100',
        isActive && 'border-l-primary bg-primary/8',
      )}
    >
      <span className="font-semibold">{releaseLine.line}</span>
      <span className="text-[13px] text-neutral-500">{formatDateDe(release.published_at)}</span>
    </div>
  )
}

/** The selected line's full detail, from its newest release: highlights, "Other changes" (if any), and a link to GitHub. */
function ReleaseDetail({ releaseLine }: { releaseLine: ReleaseLine }) {
  const release = releaseLine.latest
  const body = release.body ?? ''
  const otherChangesIndex = body.indexOf(OTHER_CHANGES_MARKER)
  const otherChangesMarkdown = otherChangesIndex === -1 ? null : body.slice(otherChangesIndex).trim()

  return (
    <div data-testid={IDS.detail} className="flex flex-col gap-3 py-4 px-8">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{releaseLine.line}</h2>
        <span className="text-sm text-muted-foreground">
          Latest: {release.tag_name}, {formatDateDe(release.published_at)}
        </span>
      </div>

      <ReleaseHighlights release={release} />

      {otherChangesMarkdown && (
        <div className="mt-2 text-muted-foreground">
          <ReleaseMarkdown>{otherChangesMarkdown}</ReleaseMarkdown>
        </div>
      )}

      <a
        href={release.html_url}
        target="_blank"
        rel="noopener noreferrer"
        className="self-start text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        View on GitHub
      </a>
    </div>
  )
}

export function ReleaseNotesPage() {
  const { session, loading: sessionLoading } = useSupabaseSession()
  const { data: releases, isLoading, isError } = useReleaseNotes()
  const [selectedLine, setSelectedLine] = useState<string | null>(null)
  // Same fixed widths as the orders/production views, per breakpoint.
  const isCompact = useIsMobile()

  if (sessionLoading) return null
  if (!session) return <Login />

  const releaseLines = groupReleasesByLine(releases ?? [])
  const selected = releaseLines.find(l => l.line === selectedLine) ?? releaseLines[0] ?? null

  return (
    <SidebarProvider
      defaultOpen
      style={{ '--sidebar-width': isCompact ? '15rem' : '17.5rem' } as CSSProperties}
      className="h-full min-h-0 font-sans text-sm"
      data-testid={IDS.root}
    >
      <Sidebar collapsible="none" side="left" className="shrink-0 border-r! border-gray-200">
        <SidebarHeader className="border-b border-neutral-200 bg-neutral-50 px-3.5 py-2.5">
          <h1 className="font-bold uppercase text-neutral-500">Release notes</h1>
        </SidebarHeader>
        <SidebarContent className="p-0">
          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading && <div className="p-4 text-[13px] text-neutral-500">Loading…</div>}
            {isError && <div className="p-4 text-[13px] text-neutral-500">Could not be loaded.</div>}
            {!isLoading && !isError && releaseLines.length === 0 && (
              <div className="p-4 text-[13px] text-neutral-500">No releases yet.</div>
            )}
            {releaseLines.map(releaseLine => (
              <ReleaseRow
                key={releaseLine.line}
                releaseLine={releaseLine}
                isActive={releaseLine.line === selected?.line}
                onSelect={() => setSelectedLine(releaseLine.line)}
              />
            ))}
          </div>
        </SidebarContent>
      </Sidebar>

      <SidebarInset className="flex h-full flex-col overflow-auto">
        {selected && <ReleaseDetail releaseLine={selected} />}
      </SidebarInset>
    </SidebarProvider>
  )
}
