import { type DeliveryChoice } from '../../types/database'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'

type DeliverySelectProps = {
  value: DeliveryChoice
  onChange: (value: DeliveryChoice) => void
}

export function DeliverySelect({ value, onChange }: DeliverySelectProps) {
  return (
    <label className="meta-pill" title="Delivery">
      <Select
        value={value}
        onValueChange={next => {
          if (next === 'PICKUP' || next === 'SHIPPING') onChange(next)
        }}
      >
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="PICKUP">Pickup</SelectItem>
          <SelectItem value="SHIPPING">Shipping</SelectItem>
        </SelectContent>
      </Select>
    </label>
  )
}
