import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'

export type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

/**
 * Nativer Datums-Input: schließt den Kalender nach Auswahl
 * (blur nach onChange, nach Parent-Handler).
 */
export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(function DateInput(
  { onChange, ...rest },
  ref
) {
  return (
    <input
      ref={ref}
      type="date"
      {...rest}
      onChange={e => {
        onChange?.(e)
        const el = e.currentTarget
        const v = el.value
        if (v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v)) {
          queueMicrotask(() => {
            el.blur()
          })
        }
      }}
    />
  )
})
