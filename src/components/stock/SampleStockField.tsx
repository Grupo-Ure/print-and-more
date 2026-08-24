import { useState } from 'react'
import { cn } from '@/lib/utils'
import { stockInputClass } from './stockShared'

type SampleStockFieldProps = {
  currentSampleStock: number
  /** Upper bound — a variant can't declare more samples than physical stock. */
  stock: number
  onSave: (sampleStock: number) => void
}

/** Inline sample-count editor: saves on blur, only when the value changed. */
export function SampleStockField({ currentSampleStock, stock, onSave }: SampleStockFieldProps) {
  const [value, setValue] = useState(String(currentSampleStock))

  // Track server-side changes (refetch after save/invalidation) by adjusting
  // state during render instead of via an effect.
  const [lastSampleStock, setLastSampleStock] = useState(currentSampleStock)
  if (lastSampleStock !== currentSampleStock) {
    setLastSampleStock(currentSampleStock)
    setValue(String(currentSampleStock))
  }

  const save = (): void => {
    const raw = value.trim()
    const sampleValue = raw === '' ? 0 : parseInt(raw, 10)
    if (!Number.isInteger(sampleValue) || sampleValue < 0 || sampleValue > stock) return
    if (sampleValue === currentSampleStock) return
    onSave(sampleValue)
  }

  return (
    <input
      type="number"
      min={0}
      max={stock}
      step={1}
      value={value}
      onChange={event => setValue(event.target.value)}
      onBlur={save}
      className={cn(stockInputClass, 'w-20 px-2 text-right tabular-nums')}
      aria-label="Sample stock"
    />
  )
}
