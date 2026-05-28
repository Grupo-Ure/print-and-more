import { useState } from 'react'
import { format, parse, startOfTomorrow } from 'date-fns'
import { Button } from '../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Calendar } from '../ui/calendar'

type DeadlinePickerProps = {
  value: string
  onChange: (value: string | null) => void
}

export function DeadlinePicker({ value, onChange }: DeadlinePickerProps) {
  const [open, setOpen] = useState(false)
  const selectedDate = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined
  const triggerLabel = selectedDate ? format(selectedDate, 'PPP') : 'No deadline'

  return (
    <label className="meta-pill" title="Deadline">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm">
            {triggerLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selectedDate}
            disabled={{ before: startOfTomorrow() }}
            onSelect={date => {
              onChange(date ? format(date, 'yyyy-MM-dd') : null)
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
    </label>
  )
}
