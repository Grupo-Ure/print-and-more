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
  /** data-testid for the trigger — the field is shared by the order row and the job dialog. */
  testId?: string
}

export function PrioritySelect({ value, onChange, disabled = false, testId }: PrioritySelectProps) {
  return (
    <label className="meta-pill" title="Priority">
      <Select
        value={value}
        disabled={disabled}
        onValueChange={next => {
          if (next === 'NORMAL' || next === 'HIGH') onChange(next)
        }}
      >
        <SelectTrigger size="sm" data-testid={testId} data-value={value}>
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
