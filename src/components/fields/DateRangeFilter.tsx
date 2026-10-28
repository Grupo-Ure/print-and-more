import { useState } from 'react'
import { format, parse } from 'date-fns'
import { CalendarIcon, ChevronsUpDown } from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import { cn } from '@/lib/utils'
import { formatDateShort } from '../../lib/formatDate'
import { Button } from '../ui/button'
import { Calendar } from '../ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'

type DateRangeFilterProps = {
  /** `YYYY-MM-DD`, or empty for an open start. */
  from: string
  /** `YYYY-MM-DD`, or empty for an open end. */
  to: string
  onChange: (range: { from: string; to: string }) => void
  /** data-testid for the trigger; `data-from` / `data-to` carry the range. */
  testId?: string
  /** data-testid for the calendar popover (portalled, so it cannot be found through the trigger). */
  calendarTestId?: string
}

function toDate(value: string): Date | undefined {
  return value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined
}

function toValue(date: Date | undefined): string {
  return date ? format(date, 'yyyy-MM-dd') : ''
}

/** "Oct 3rd – Oct 17th", "From Oct 3rd", "Until Oct 17th", or null for no range. */
function rangeLabel(from: string, to: string): string | null {
  if (from && to) return from === to ? formatDateShort(from) : `${formatDateShort(from)} – ${formatDateShort(to)}`
  if (from) return `From ${formatDateShort(from)}`
  if (to) return `Until ${formatDateShort(to)}`
  return null
}

/**
 * A date range in a popover: shadcn's date range picker pattern — the
 * `Calendar` in range mode, two months side by side — behind a combobox-style
 * trigger that names the range. The first click starts the range, the second
 * ends it; *Any date* clears it.
 */
export function DateRangeFilter({ from, to, onChange, testId, calendarTestId }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false)
  const label = rangeLabel(from, to)
  const selected: DateRange | undefined = from || to ? { from: toDate(from), to: toDate(to) } : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="combobox"
          size="sm"
          role="combobox"
          aria-expanded={open}
          aria-label="Date range"
          data-testid={testId}
          data-from={from || undefined}
          data-to={to || undefined}
          className="w-52 justify-between"
        >
          <span className={cn('flex min-w-0 items-center gap-1.5', !label && 'text-muted-foreground')}>
            <CalendarIcon className="size-4 shrink-0 opacity-60" />
            <span className="truncate">{label ?? 'Any date'}</span>
          </span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0" data-testid={calendarTestId}>
        <Calendar
          mode="range"
          numberOfMonths={2}
          defaultMonth={toDate(from) ?? toDate(to)}
          selected={selected}
          onSelect={range => onChange({ from: toValue(range?.from), to: toValue(range?.to) })}
        />
        <div className="flex justify-end border-t p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!label}
            onClick={() => {
              onChange({ from: '', to: '' })
              setOpen(false)
            }}
          >
            Any date
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
