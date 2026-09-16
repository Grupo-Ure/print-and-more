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
  disabled?: boolean
  /** data-testid for the trigger — the field is shared by the order row and the job dialog. */
  testId?: string
}

export function DeliverySelect({ value, onChange, disabled = false, testId }: DeliverySelectProps) {
  return (
    <label className="meta-pill" title="Delivery">
      <Select
        value={value}
        disabled={disabled}
        onValueChange={next => {
          if (next === 'PICKUP' || next === 'SHIPPING') onChange(next)
        }}
      >
        <SelectTrigger size="sm" data-testid={testId} data-value={value}>
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
