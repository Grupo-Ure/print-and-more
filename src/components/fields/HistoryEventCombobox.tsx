import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { HISTORY_EVENT_LABELS } from '../../lib/historyEventLabels'
import type { HistoryEvent } from '../../services/historyService'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'

type HistoryEventComboboxProps = {
  /** The event types on offer — e.g. only those the order's history holds. */
  options: HistoryEvent[]
  value: HistoryEvent | null
  onChange: (event: HistoryEvent | null) => void
  /** What the empty choice is called (e.g. "All events"). */
  emptyLabel?: string
  /** data-testid for the trigger. */
  testId?: string
  /** data-testid of the empty option in the list. */
  emptyOptionTestId?: string
  /** data-testid shared by the event options (each carries `data-event-type`). */
  optionTestId?: string
}

/**
 * Picks one history event type, or none. Modelled on `EmployeeCombobox`: a
 * trigger naming the choice, a popover with a search and the list, sorted by
 * label.
 */
export function HistoryEventCombobox({
  options,
  value,
  onChange,
  emptyLabel = 'All events',
  testId,
  emptyOptionTestId,
  optionTestId,
}: HistoryEventComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const sorted = useMemo(
    () => [...options].sort((a, b) => HISTORY_EVENT_LABELS[a].localeCompare(HISTORY_EVENT_LABELS[b])),
    [options],
  )
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return sorted
    return sorted.filter(event => HISTORY_EVENT_LABELS[event].toLowerCase().includes(needle))
  }, [sorted, search])

  const pick = (event: HistoryEvent | null) => {
    setOpen(false)
    setSearch('')
    onChange(event)
  }

  return (
    <Popover
      open={open}
      onOpenChange={next => {
        setOpen(next)
        if (!next) setSearch('')
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="combobox"
          size="sm"
          role="combobox"
          aria-expanded={open}
          aria-label="Event"
          data-testid={testId}
          data-value={value ?? undefined}
          className="w-44 justify-between"
        >
          <span className={cn('truncate', !value && 'text-muted-foreground')}>
            {value ? HISTORY_EVENT_LABELS[value] : emptyLabel}
          </span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 min-w-70 p-4">
        <Input
          autoFocus
          placeholder="Search event…"
          className="mb-1 h-10 text-base outline-primary!"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="max-h-56 overflow-y-auto">
          <button
            type="button"
            data-testid={emptyOptionTestId}
            className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-primary/10"
            onClick={() => pick(null)}
          >
            <p>{emptyLabel}</p>
            {value === null && <Check className="ml-auto size-4" />}
          </button>
          {filtered.map(event => (
            <button
              key={event}
              type="button"
              data-testid={optionTestId}
              data-event-type={event}
              className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-primary/10"
              onClick={() => pick(event)}
            >
              <p className="truncate">{HISTORY_EVENT_LABELS[event]}</p>
              {event === value && <Check className="ml-auto size-4 shrink-0" />}
            </button>
          ))}
          {filtered.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">No events found</p>}
        </div>
      </PopoverContent>
    </Popover>
  )
}
