import { useRef } from 'react'
import { X } from 'lucide-react'

type Props = {
  value: string
  onChange: (value: string) => void
  onClear: () => void
}

export function OrderListSearch({ value, onChange, onClear }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Search customer..."
        aria-label="Search customer"
        className="flex-1 min-w-0 box-border px-2 py-1 text-[13px] border border-neutral-200 rounded-md bg-white"
      />
      <button
        type="button"
        title="Clear search"
        aria-label="Clear search"
        onClick={() => {
          onClear()
          queueMicrotask(() => inputRef.current?.focus())
        }}
        className="inline-flex items-center justify-center min-w-8 h-7 px-1.5 rounded-md border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}
