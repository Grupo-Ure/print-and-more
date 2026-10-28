import { Flag } from 'lucide-react'
import { type Priority } from '../../types/database'
import { SettingSelect } from './SettingSelect'

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
]

type PrioritySelectProps = {
  value: Priority
  onChange: (value: Priority) => void
  disabled?: boolean
  /** data-testid for the trigger — the field is shared by the order row and the product's Settings tab. */
  testId?: string
}

export function PrioritySelect({ value, onChange, disabled = false, testId }: PrioritySelectProps) {
  return (
    <SettingSelect
      value={value}
      onChange={onChange}
      options={PRIORITY_OPTIONS}
      icon={Flag}
      title="Priority"
      disabled={disabled}
      testId={testId}
    />
  )
}
