import { type Priority } from '../../types/database'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'

type PrioritySelectProps = {
  value: Priority
  onChange: (value: Priority) => void
  disabled?: boolean
}

export function PrioritySelect({ value, onChange, disabled = false }: PrioritySelectProps) {
  return (
    <label className="meta-pill" title="Priority">
      <Select
        value={value}
        disabled={disabled}
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
