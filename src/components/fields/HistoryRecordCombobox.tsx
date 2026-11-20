import { useEffect, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { HistoryRecord } from '../../services/historyService'
import { useHistoryRecordSearch } from '../../queries/historyQueries'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'

const KIND_LABELS: Record<HistoryRecord['kind'], string> = {
  order: 'Order',
  customer: 'Customer',
  stampModel: 'Stamp model',
  textileVariant: 'Textile',
  file: 'File',
}

type HistoryRecordComboboxProps = {
  value: HistoryRecord | null
  onChange: (record: HistoryRecord | null) => void
  /** data-testid for the trigger. */
  testId?: string
  /** data-testid of the search field. */
  searchTestId?: string
  /** data-testid of the empty option in the list. */
  emptyOptionTestId?: string
  /** data-testid shared by the records found (each carries `data-record-id` and `data-record-kind`). */
  optionTestId?: string
}

/**
 * Picks the one record the History page is narrowed to — an order by its
 * number, a customer, a stock item or a file by name — or none. The list is a
 * search across all four, a few of each kind, as typed.
 */
export function HistoryRecordCombobox({
  value,
  onChange,
  testId,
  searchTestId,
  emptyOptionTestId,
  optionTestId,
}: HistoryRecordComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 250)
    return () => clearTimeout(timer)
  }, [search])

  const { data: records = [], isFetching } = useHistoryRecordSearch(debounced)

  const pick = (record: HistoryRecord | null) => {
    setOpen(false)
    setSearch('')
    onChange(record)
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
          aria-label="Record"
          data-testid={testId}
          data-value={value?.id}
          data-record-kind={value?.kind}
          className="w-56 justify-between"
        >
          <span className={cn('truncate', !value && 'text-muted-foreground')}>
            {value ? `${KIND_LABELS[value.kind]}: ${value.label}` : 'Every record'}
          </span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-4">
        <Input
          autoFocus
          placeholder="Order number, customer, stock item, file…"
          className="mb-1 h-10 text-base outline-primary!"
          data-testid={searchTestId}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="max-h-64 overflow-y-auto">
          <button
            type="button"
            data-testid={emptyOptionTestId}
            className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-primary/10"
            onClick={() => pick(null)}
          >
            <p>Every record</p>
            {value === null && <Check className="ml-auto size-4" />}
          </button>
          {records.map(record => (
            <button
              key={`${record.kind}-${record.id}`}
              type="button"
              data-testid={optionTestId}
              data-record-id={record.id}
              data-record-kind={record.kind}
              className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-primary/10"
              onClick={() => pick(record)}
            >
              <span className="w-20 shrink-0 text-left text-xs text-muted-foreground">{KIND_LABELS[record.kind]}</span>
              <p className="truncate">{record.label}</p>
              {record.kind === value?.kind && record.id === value.id && <Check className="ml-auto size-4 shrink-0" />}
            </button>
          ))}
          {debounced.trim() && !isFetching && records.length === 0 && (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">No records found</p>
          )}
          {!debounced.trim() && (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">Type to search</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
