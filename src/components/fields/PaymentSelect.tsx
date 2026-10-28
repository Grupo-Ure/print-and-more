import { Wallet } from 'lucide-react'
import { type PaymentMethod } from '../../types/database'
import { SettingSelect } from './SettingSelect'

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'INVOICE', label: 'Invoice' },
  { value: 'CASH', label: 'Cash' },
]

type PaymentSelectProps = {
  value: PaymentMethod
  onChange: (value: PaymentMethod) => void
  disabled?: boolean
  /** data-testid for the trigger — the field is shared by the order row and the product's Settings tab. */
  testId?: string
}

export function PaymentSelect({ value, onChange, disabled = false, testId }: PaymentSelectProps) {
  return (
    <SettingSelect
      value={value}
      onChange={onChange}
      options={PAYMENT_OPTIONS}
      icon={Wallet}
      title="Payment method"
      disabled={disabled}
      testId={testId}
    />
  )
}
