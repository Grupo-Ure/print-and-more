import { useRef, useState, type ReactNode } from 'react'
import { Info } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

/**
 * One setting of a one-row settings section: its title and what it does on
 * the left, its field on the right. With `descriptionAsHint` the description
 * moves behind an info icon beside the title.
 */
export function SettingRow({
  title,
  description,
  descriptionAsHint = false,
  children,
}: {
  title: string
  description: string
  descriptionAsHint?: boolean
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-neutral-200 px-4 py-3 last:border-b-0">
      <div className="min-w-0">
        {descriptionAsHint ? (
          <div className="flex items-center gap-1.5">
            <h2 className="font-semibold">{title}</h2>
            <InfoHint label={title}>{description}</InfoHint>
          </div>
        ) : (
          <>
            <h2 className="font-semibold">{title}</h2>
            <p className="text-xs text-neutral-500 desktop:text-sm">{description}</p>
          </>
        )}
      </div>
      {children}
    </div>
  )
}

/** Pause before a hover-opened hint closes, so the pointer can cross from the icon to the text. */
const HOVER_CLOSE_DELAY_MS = 150

/**
 * An info icon that shows its text in a small pop-up — on hover, or pinned
 * open by a click (closed again by a second click, Escape or a click outside).
 */
export function InfoHint({ label, children }: { label: string; children: ReactNode }) {
  const [hovered, setHovered] = useState(false)
  const [pinned, setPinned] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const enter = () => {
    clearTimeout(closeTimer.current)
    setHovered(true)
  }
  const leave = () => {
    clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setHovered(false), HOVER_CLOSE_DELAY_MS)
  }

  return (
    <Popover
      open={hovered || pinned}
      onOpenChange={open => {
        // Radix reports a close on Escape or a click outside; a click on the icon is handled below.
        if (!open) {
          setPinned(false)
          setHovered(false)
        }
      }}
    >
      <PopoverTrigger
        aria-label={`About ${label}`}
        className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-neutral-400 hover:text-neutral-700 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        onPointerEnter={enter}
        onPointerLeave={leave}
        onClick={event => {
          event.preventDefault()
          if (pinned) setHovered(false)
          setPinned(!pinned)
        }}
      >
        <Info className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-72 text-xs text-neutral-600 desktop:text-sm"
        onPointerEnter={enter}
        onPointerLeave={leave}
        onOpenAutoFocus={event => event.preventDefault()}
      >
        {children}
      </PopoverContent>
    </Popover>
  )
}
