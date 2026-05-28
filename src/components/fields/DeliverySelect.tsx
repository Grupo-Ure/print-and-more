import { type DeliveryChoice } from '../../types/database'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'

const DELIVERY_NONE = '__NONE__'

type DeliverySelectProps = {
  value: DeliveryChoice | ''
  onChange: (value: DeliveryChoice | null) => void
}

export function DeliverySelect({ value, onChange }: DeliverySelectProps) {
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
