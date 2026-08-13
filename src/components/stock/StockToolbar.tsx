import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Sticky action bar above a page-scrolled `StockTable`: filters and actions
 * stay reachable no matter how far down the table the user is.
 *
 * It pins to the top of the app's scroll area and publishes its measured
 * height as `--stock-toolbar-height` on its parent element; the table header
 * uses that variable as its own sticky offset, so toolbar and header pin as
 * one stacked block. Measuring (instead of a fixed offset) keeps the stack
 * correct when the toolbar wraps to multiple lines at compact widths.
 */
export function StockToolbar({ className, children }: { className?: string; children: ReactNode }) {
  const barRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const bar = barRef.current
    const parent = bar?.parentElement
    if (!bar || !parent) return
    const observer = new ResizeObserver(() => {
      parent.style.setProperty('--stock-toolbar-height', `${bar.offsetHeight}px`)
    })
    observer.observe(bar)
    return () => {
      observer.disconnect()
      parent.style.removeProperty('--stock-toolbar-height')
    }
  }, [])

  return (
    <div
      ref={barRef}
      // Padding instead of margins on both edges: the page's top gap and the
      // gap below are part of the sticky box itself, so the bar is pinned from
      // scroll position zero (no travel before it settles) and scrolled
      // content is painted over instead of peeking through between the pinned
      // toolbar and the pinned table header.
      className={cn(
        'sticky top-0 z-20 flex flex-wrap items-center gap-3 bg-background pt-3 pb-3',
        className,
      )}
    >
      {children}
    </div>
  )
}
