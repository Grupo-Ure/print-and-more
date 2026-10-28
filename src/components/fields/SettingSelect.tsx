import type { ComponentType } from 'react'
import { ChevronsUpDown, type LucideProps } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'

type SettingSelectProps<T extends string> = {
  value: T
  onChange: (value: T) => void
  options: readonly { value: T; label: string }[]
  /** Leads the trigger, naming the setting at a glance. */
  icon: ComponentType<LucideProps>
  /** The setting's name, as tooltip and accessible label. */
  title: string
  disabled?: boolean
  /** data-testid for the trigger — the fields are shared by the order row and the product's Settings tab. */
  testId?: string
}

/**
 * One order/product setting picked from a short list (delivery, priority,
 * payment). A Radix select dressed as the app's comboboxes (`EmployeeCombobox`,
 * the log filters): a solid face with a light shadow, an icon before the value
 * and the up/down chevrons after it.
 */
export function SettingSelect<T extends string>({
  value,
  onChange,
  options,
  icon: Icon,
  title,
  disabled = false,
  testId,
}: SettingSelectProps<T>) {
  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={next => {
        const option = options.find(candidate => candidate.value === next)
        if (option) onChange(option.value)
      }}
    >
      <SelectTrigger
        size="sm"
        title={title}
        aria-label={title}
        data-testid={testId}
        data-value={value}
        className="h-8 w-34 border-gray-200 bg-background shadow-xs [&>svg:last-child]:hidden"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <Icon className="size-4 shrink-0 opacity-60" />
          <SelectValue />
        </span>
        <ChevronsUpDown className="opacity-50" />
      </SelectTrigger>
      <SelectContent>
        {options.map(option => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
