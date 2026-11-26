import { useEffect, useState } from 'react'

type NextPageSentinelProps = {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => unknown
}

/**
 * The end of a list read a page at a time: placed after the list, inside its
 * scroll area, it loads the next page once it scrolls into view, and says so
 * while that page is on its way. Renders nothing once the last page is in.
 */
export function NextPageSentinel({ hasNextPage, isFetchingNextPage, fetchNextPage }: NextPageSentinelProps) {
  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!sentinel) return
    const observer = new IntersectionObserver(
      observed => {
        if (observed[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) void fetchNextPage()
      },
      { rootMargin: '200px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [sentinel, hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <>
      {isFetchingNextPage && <p className="py-1.5 text-sm text-muted-foreground">Loading…</p>}
      {hasNextPage && <div ref={setSentinel} aria-hidden className="h-px" />}
    </>
  )
}
