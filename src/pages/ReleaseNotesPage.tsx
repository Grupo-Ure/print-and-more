import { useState, type CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { Sidebar, SidebarContent, SidebarHeader, SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useIsMobile } from '@/hooks/use-mobile'
import { Login } from '../components/Login'
import { ReleaseHighlights, ReleaseMarkdown } from '../components/ReleaseHighlights'
import { useSupabaseSession } from '../hooks/useSupabaseSession'
import { useReleaseNotes } from '../queries/releaseNotesQueries'
import { formatDateDe } from '../lib/formatDate'
import { OTHER_CHANGES_MARKER } from '../lib/releaseNotes'
import type { GithubRelease } from '../services/releaseNotesService'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.releaseNotesPage

/** One release in the sidebar list: version + date, highlighted when selected. */
function ReleaseRow({ release, isActive, onSelect }: { release: GithubRelease; isActive: boolean; onSelect: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      data-testid={IDS.sidebarRow}
      data-tag={release.tag_name}
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
      <span className="font-semibold">{release.tag_name}</span>
      <span className="text-[13px] text-neutral-500">{formatDateDe(release.published_at)}</span>
    </div>
  )
}

/** The selected release's full detail: highlights, "Other changes" (if any), and a link to GitHub. */
function ReleaseDetail({ release }: { release: GithubRelease }) {
  const body = release.body ?? ''
  const otherChangesIndex = body.indexOf(OTHER_CHANGES_MARKER)
  const otherChangesMarkdown = otherChangesIndex === -1 ? null : body.slice(otherChangesIndex).trim()

  return (
    <div data-testid={IDS.detail} className="flex flex-col gap-3 py-4 px-8">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{release.tag_name}</h2>
        <span className="text-sm text-muted-foreground">{formatDateDe(release.published_at)}</span>
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
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  // Same fixed widths as the orders/production views, per breakpoint.
  const isCompact = useIsMobile()

  if (sessionLoading) return null
  if (!session) return <Login />

  const selected = releases?.find(r => r.tag_name === selectedTag) ?? releases?.[0] ?? null

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
            {!isLoading && !isError && releases?.length === 0 && (
              <div className="p-4 text-[13px] text-neutral-500">No releases yet.</div>
            )}
            {releases?.map(release => (
              <ReleaseRow
                key={release.tag_name}
                release={release}
                isActive={release.tag_name === selected?.tag_name}
                onSelect={() => setSelectedTag(release.tag_name)}
              />
            ))}
          </div>
        </SidebarContent>
      </Sidebar>

      <SidebarInset className="flex h-full flex-col overflow-auto">
        {selected && <ReleaseDetail release={selected} />}
      </SidebarInset>
    </SidebarProvider>
  )
}
