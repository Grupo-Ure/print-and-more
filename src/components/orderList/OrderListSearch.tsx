import { useRef } from 'react'

type Props = {
  value: string
  onChange: (value: string) => void
  onClear: () => void
}

export function OrderListSearch({ value, onChange, onClear }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="ol-suche" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input
        ref={inputRef}
        className="input-compact"
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Search customer..."
        aria-label="Search customer"
        style={{ flex: 1, minWidth: 0, boxSizing: 'border-box' }}
      />
      <button
        type="button"
        className="ol-icon-btn"
        title="Clear search"
        aria-label="Clear search"
        onClick={() => {
          onClear()
          queueMicrotask(() => inputRef.current?.focus())
        }}
      >
        ×
      </button>
    </div>
  )
}
