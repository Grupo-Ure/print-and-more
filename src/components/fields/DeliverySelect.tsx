import { Truck } from 'lucide-react'
import { type DeliveryChoice } from '../../types/database'
import { SettingSelect } from './SettingSelect'

const DELIVERY_OPTIONS: { value: DeliveryChoice; label: string }[] = [
  { value: 'PICKUP', label: 'Pickup' },
  { value: 'SHIPPING', label: 'Shipping' },
]

type DeliverySelectProps = {
  value: DeliveryChoice
  onChange: (value: DeliveryChoice) => void
  disabled?: boolean
  /** data-testid for the trigger — the field is shared by the order row and the product's Settings tab. */
  testId?: string
}

export function DeliverySelect({ value, onChange, disabled = false, testId }: DeliverySelectProps) {
  return (
    <SettingSelect
      value={value}
      onChange={onChange}
      options={DELIVERY_OPTIONS}
      icon={Truck}
      title="Delivery"
      disabled={disabled}
      testId={testId}
    />
  )
}
