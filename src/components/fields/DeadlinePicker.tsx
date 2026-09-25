import { useState } from 'react'
import { format, parse, startOfToday } from 'date-fns'
import { cn } from '@/lib/utils'
import { Button } from '../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Calendar } from '../ui/calendar'

type DeadlinePickerProps = {
  value: string
  onChange: (value: string | null) => void
  disabled?: boolean
  /**
   * Pulse a red ring around the field to guide the user here (a job is blocked
   * for want of this deadline). When it drops back to false the ring turns
   * green once and fades out.
   */
  attention?: boolean
  /** data-testid for the trigger — the field is shared by the order row and the job dialog. */
  testId?: string
  /** data-testid for the calendar popover (portalled, so it cannot be found through the trigger). */
  calendarTestId?: string
}

export function DeadlinePicker({ value, onChange, disabled = false, attention = false, testId, calendarTestId }: DeadlinePickerProps) {
  const [open, setOpen] = useState(false)
  const selectedDate = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined
  const triggerLabel = selectedDate ? format(selectedDate, 'PPP') : 'No deadline'

  // Play the green settle exactly once, on the transition attention → none
  // ("adjust state during render" — no effect needed).
  const [prevAttention, setPrevAttention] = useState(attention)
  const [settling, setSettling] = useState(false)
  if (attention !== prevAttention) {
    setPrevAttention(attention)
    setSettling(!attention)
  }

  return (
    <label className="meta-pill" title="Deadline">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            data-testid={testId}
            data-value={value || undefined}
            disabled={disabled}
            className={cn(
              attention && 'animate-field-required',
              settling && 'animate-deadline-settled',
              "text-lg"
            )}
            onAnimationEnd={event => {
              if (event.animationName === 'deadline-settled') setSettling(false)
            }}
          >
            {triggerLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0" data-testid={calendarTestId}>
          <Calendar
            mode="single"
            selected={selectedDate}
            disabled={{ before: startOfToday() }}
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
