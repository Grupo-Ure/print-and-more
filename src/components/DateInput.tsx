import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'

export type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

/** Native date input: closes the calendar picker after a date is selected (blur after onChange, after the parent handler). */
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
        const value = el.value
        if (value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value)) {
          queueMicrotask(() => {
            el.blur()
          })
        }
      }}
    />
  )
})
