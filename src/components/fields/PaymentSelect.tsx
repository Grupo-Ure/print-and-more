import { type PaymentMethod } from '../../types/database'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'

type PaymentSelectProps = {
  value: PaymentMethod
  onChange: (value: PaymentMethod) => void
  disabled?: boolean
}

export function PaymentSelect({ value, onChange, disabled = false }: PaymentSelectProps) {
  return (
    <label className="meta-pill" title="Payment method">
      <Select
        value={value}
        disabled={disabled}
        onValueChange={next => {
          if (next === 'INVOICE' || next === 'CASH') onChange(next)
        }}
      >
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="INVOICE">Invoice</SelectItem>
          <SelectItem value="CASH">Cash</SelectItem>
        </SelectContent>
      </Select>
    </label>
  )
}
