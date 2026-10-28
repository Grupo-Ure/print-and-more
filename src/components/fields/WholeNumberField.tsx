import { useState, type KeyboardEvent } from 'react'
import { useToast } from '../Toast'
import { Input } from '@/components/ui/input'

/**
 * A number input that saves when it is left (or on Enter) and only then:
 * typing edits a draft, Escape drops it. A value outside `min`…`max`, or a
 * fraction, is refused with a toast and the stored value comes back. Empty
 * saves `null` where `allowEmpty` permits it. `data-value` always carries the
 * stored value, not the draft.
 */
export function WholeNumberField({
  testId,
  label,
  value,
  min,
  max,
  allowEmpty = false,
  placeholder,
  disabled,
  title,
  onSave,
}: {
  testId: string
  label: string
  value: number | null
  min: number
  max: number
  allowEmpty?: boolean
  placeholder?: string
  disabled: boolean
  title?: string
  onSave: (next: number | null) => Promise<unknown>
}) {
  const { showError } = useToast()
  const [draft, setDraft] = useState<string | null>(null)
  const stored = value === null ? '' : String(value)

  const commit = () => {
    if (draft === null) return
    const trimmed = draft.trim()
    const next = trimmed === '' ? null : Number(trimmed)
    const isValid = next === null ? allowEmpty : Number.isInteger(next) && next >= min && next <= max
    if (!isValid) {
      showError(`Enter a whole number from ${min} to ${max}${allowEmpty ? ', or leave it empty' : ''}`)
      setDraft(null)
      return
    }
    if (next === value) {
      setDraft(null)
      return
    }
    // The draft stays on screen while the save runs; the stored value replaces it after.
    void onSave(next).finally(() => setDraft(null))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur()
    if (event.key === 'Escape') setDraft(null)
  }

  return (
    <Input
      type="number"
      inputMode="numeric"
      step={1}
      min={min}
      max={max}
      data-testid={testId}
      data-value={stored}
      aria-label={label}
      title={title}
      placeholder={placeholder}
      value={draft ?? stored}
      disabled={disabled}
      onChange={event => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      className="h-8 w-24 text-sm"
    />
  )
}
