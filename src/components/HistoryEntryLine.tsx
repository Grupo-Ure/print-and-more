import type { ReactNode } from 'react'
import type { HistoryRow } from '../services/historyService'
import { historySegments, segmentText } from '../lib/historySentences'
import { formatDateTimeHuman } from '../lib/formatDate'
import { cn } from '../lib/utils'
import { ProductLink, Quote } from './LogText'

type HistoryEntryLineProps = {
  entry: HistoryRow
  /** Product number for product-scoped entries; null = no product. */
  productLabel: string | null
  /** The entry's product while it can be opened, to link to; null otherwise. */
  productId: string | null
  staffById: Map<string, string>
  onOpenProduct?: (productId: string) => void
  /** What the entry concerns, shown between the time and the sentence (the History page); omitted on the order's tab. */
  record?: ReactNode
  /** data-testid of the item; it carries `data-event-type` and `data-history-id`. */
  testId: string
}

/**
 * One history entry as a single styled sentence line: the date first in muted
 * gray, then the sentence — persons in the brand colour, product numbers in sky
 * (a link to the product), quotes in dark yellow, statuses as text in their own
 * status colour. Every item is one line high; overflow truncates
 * with the full plain-text sentence in the title tooltip. Shared by the order's
 * History tab and the History page.
 */
export function HistoryEntryLine({
  entry,
  productLabel,
  productId,
  staffById,
  onOpenProduct,
  record,
  testId,
}: HistoryEntryLineProps) {
  const segments = historySegments(entry, productLabel, productId, staffById)
  const time = formatDateTimeHuman(entry.created_at)
  const plain = `${time} — ${segments.map(segmentText).join('')}${entry.reason ? ` — ${entry.reason}` : ''}`

  return (
    <li data-testid={testId} data-event-type={entry.event_type} data-history-id={entry.id} className="py-1.5 text-sm">
      <p className="truncate" title={plain}>
        <span className="text-muted-foreground">{time}</span>
        <span className="text-muted-foreground"> — </span>
        {record && (
          <>
            {record}
            <span className="text-muted-foreground"> — </span>
          </>
        )}
        {segments.map((segment, i) => {
          if (typeof segment === 'string') return <span key={i}>{segment}</span>
          if (segment.kind === 'person')
            return (
              <span key={i} className="font-medium text-pink-800">
                {segment.text}
              </span>
            )
          if (segment.kind === 'product')
            return (
              <ProductLink key={i} productId={segment.productId} onOpen={onOpenProduct}>
                {segment.text}
              </ProductLink>
            )
          if (segment.kind === 'quote') return <Quote key={i}>{segment.text}</Quote>
          if (segment.kind === 'duration')
            return (
              <span key={i} className="font-medium text-primary">
                {segment.text}
              </span>
            )
          return (
            <span key={i} className={cn('font-medium', segment.meta.textColor)}>
              {segment.meta.label}
            </span>
          )
        })}
        {entry.reason && <span className="text-muted-foreground"> — {entry.reason}</span>}
      </p>
    </li>
  )
}
