import { useState } from 'react'
import { cn } from '@/lib/utils'
import { stockInputClass } from './stockShared'

type MinimumStockFieldProps = {
  currentMinimum: number | null
  onSave: (minimumStock: number) => void
}

/** Inline minimum-stock editor: saves on blur, only when the value changed. */
export function MinimumStockField({ currentMinimum, onSave }: MinimumStockFieldProps) {
  const [value, setValue] = useState(String(currentMinimum ?? 0))

  // Track server-side changes (refetch after save/invalidation) by adjusting
  // state during render instead of via an effect.
  const [lastMinimum, setLastMinimum] = useState(currentMinimum)
  if (lastMinimum !== currentMinimum) {
    setLastMinimum(currentMinimum)
    setValue(String(currentMinimum ?? 0))
  }

  const save = (): void => {
    const raw = value.trim()
    const minimumValue = raw === '' ? 0 : parseInt(raw, 10)
    if (!Number.isInteger(minimumValue) || minimumValue < 0) return
    if (minimumValue === (currentMinimum ?? 0)) return
    onSave(minimumValue)
  }

  return (
    <input
      type="number"
      min={0}
      step={1}
      value={value}
      onChange={event => setValue(event.target.value)}
      onBlur={save}
      className={cn(stockInputClass, 'w-20 px-2 text-right tabular-nums')}
      aria-label="Minimum stock"
    />
  )
}
