import { useEffect, useRef, useState } from 'react'
import { format, parse } from 'date-fns'
import {
  type DeliveryChoice,
  type OrderDetailRow,
  type OrderHeaderPatch,
  type Priority,
} from '../types/database'
import { Button } from './ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Calendar } from './ui/calendar'

type OrderSettingsProps = {
  order: OrderDetailRow
  onSave: (patch: OrderHeaderPatch) => void
}

export function OrderSettings({ order, onSave }: OrderSettingsProps) {
  const [headerDeadline, setHeaderDeadline] = useState('')
  const [headerDelivery, setHeaderDelivery] = useState<DeliveryChoice | ''>('')
  const [headerPriority, setHeaderPriority] = useState<Priority>('NORMAL')
  const headerSnapshot = useRef<{
    deadline: string | null
    delivery: DeliveryChoice | null
    priority: Priority
  }>({ deadline: null, delivery: null, priority: 'NORMAL' })

  useEffect(() => {
    const rawDeadline = order.deadline
    const isoDate =
      rawDeadline && rawDeadline.length > 0
        ? rawDeadline.length > 10
          ? rawDeadline.slice(0, 10)
          : rawDeadline
        : ''
    // eslint-disable-next-line react-hooks/set-state-in-effect -- form mirrors server row
    setHeaderDeadline(isoDate)
    setHeaderDelivery(order.delivery ?? '')
    setHeaderPriority(order.priority)
    headerSnapshot.current = {
      deadline: rawDeadline,
      delivery: order.delivery,
      priority: order.priority,
    }
  }, [order])

  const trimDeadline = (dateString: string | null) =>
    dateString && dateString.length > 10 ? dateString.slice(0, 10) : dateString || ''

  return (
    <section className="flex items-center gap-4" aria-label="Order meta">
      <DeadlinePicker
        value={headerDeadline}
        onChange={value => {
          setHeaderDeadline(value ?? '')
          const snapshot = trimDeadline(headerSnapshot.current.deadline)
          if ((value || '') !== (snapshot || '')) {
            onSave({ deadline: value })
          }
        }}
      />
      <DeliverySelect
        value={headerDelivery}
        onChange={value => {
          setHeaderDelivery(value ?? '')
          if (value !== headerSnapshot.current.delivery) {
            onSave({ delivery: value })
          }
        }}
      />
      <PrioritySelect
        value={headerPriority}
        onChange={value => {
          setHeaderPriority(value)
          if (value !== headerSnapshot.current.priority) {
            onSave({ priority: value })
          }
        }}
      />
    </section>
  )
}

type DeadlinePickerProps = {
  value: string
  onChange: (value: string | null) => void
}

function DeadlinePicker({ value, onChange }: DeadlinePickerProps) {
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

const DELIVERY_NONE = '__NONE__'

type DeliverySelectProps = {
  value: DeliveryChoice | ''
  onChange: (value: DeliveryChoice | null) => void
}

function DeliverySelect({ value, onChange }: DeliverySelectProps) {
  return (
    <label className="meta-pill" title="Delivery">
      <Select
        value={value === '' ? DELIVERY_NONE : value}
        onValueChange={next => {
          if (next === 'PICKUP' || next === 'SHIPPING') {
            onChange(next)
          } else {
            onChange(null)
          }
        }}
      >
        <SelectTrigger size="sm">
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={DELIVERY_NONE}>—</SelectItem>
          <SelectItem value="PICKUP">Pickup</SelectItem>
          <SelectItem value="SHIPPING">Shipping</SelectItem>
        </SelectContent>
      </Select>
    </label>
  )
}

type PrioritySelectProps = {
  value: Priority
  onChange: (value: Priority) => void
}

function PrioritySelect({ value, onChange }: PrioritySelectProps) {
  return (
    <label className="meta-pill" title="Priority">
      <Select
        value={value}
        onValueChange={next => {
          if (next === 'NORMAL' || next === 'HIGH') onChange(next)
        }}
      >
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="NORMAL">Normal</SelectItem>
          <SelectItem value="HIGH">High</SelectItem>
        </SelectContent>
      </Select>
    </label>
  )
}
