import { useState } from 'react'
import { format, parse, startOfToday } from 'date-fns'
import { CalendarIcon, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Calendar } from '../ui/calendar'

type DeadlinePickerProps = {
  value: string
  /** A deadline can be changed but not removed: the picker always hands out a date. */
  onChange: (value: string) => void
  disabled?: boolean
  /** data-testid for the trigger — the field is shared by the order row and the product's Settings tab. */
  testId?: string
  /** data-testid for the calendar popover (portalled, so it cannot be found through the trigger). */
  calendarTestId?: string
}

export function DeadlinePicker({ value, onChange, disabled = false, testId, calendarTestId }: DeadlinePickerProps) {
  const [open, setOpen] = useState(false)
  const selectedDate = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined
  const triggerLabel = selectedDate ? format(selectedDate, 'PPP') : 'No deadline'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {/* Dressed as the app's comboboxes, like the setting selects beside it (`SettingSelect`). */}
        <Button
          variant="combobox"
          size="sm"
          title="Deadline"
          aria-label="Deadline"
          data-testid={testId}
          data-value={value || undefined}
          disabled={disabled}
          className="h-8 justify-between gap-2 bg-background shadow-xs"
        >
          <span className={cn('flex min-w-0 items-center gap-1.5', !selectedDate && 'text-muted-foreground')}>
            <CalendarIcon className="size-4 shrink-0 opacity-60" />
            <span className="truncate">{triggerLabel}</span>
          </span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0" data-testid={calendarTestId}>
        <Calendar
          mode="single"
          // Clicking the selected day keeps it: a deadline cannot be cleared.
          required
          selected={selectedDate}
          disabled={{ before: startOfToday() }}
          onSelect={date => {
            onChange(format(date, 'yyyy-MM-dd'))
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
