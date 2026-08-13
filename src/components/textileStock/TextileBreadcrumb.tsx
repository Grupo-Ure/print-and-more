import { ChevronRight } from 'lucide-react'

export type BreadcrumbSegment = {
  label: string
  /** Present ⇒ the segment navigates back up the tree; the current segment omits it. */
  onClick?: () => void
}

/**
 * Drill-down breadcrumb of the master-data views (brand ▸ product ▸ variant).
 * The current segment is styled like a section title so the path doubles as
 * the view's heading; ancestor segments navigate back up.
 */
export function TextileBreadcrumb({ segments }: { segments: BreadcrumbSegment[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 flex-wrap items-center gap-1.5 text-base desktop:text-lg"
    >
      {segments.map((segment, index) => {
        const isCurrent = index === segments.length - 1
        return (
          <span key={`${segment.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
            {index > 0 && (
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/70" aria-hidden />
            )}
            {!isCurrent && segment.onClick ? (
              <button
                type="button"
                onClick={segment.onClick}
                className="cursor-pointer truncate text-muted-foreground underline-offset-3 transition-colors hover:text-foreground hover:underline"
              >
                {segment.label}
              </button>
            ) : (
              <span
                aria-current={isCurrent ? 'page' : undefined}
                className={
                  isCurrent
                    ? 'truncate font-semibold text-secondary-accent'
                    : 'truncate text-muted-foreground'
                }
              >
                {segment.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
