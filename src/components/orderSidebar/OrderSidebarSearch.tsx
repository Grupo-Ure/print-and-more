import { useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '../ui/input'

type Props = {
  value: string
  onChange: (value: string) => void
  onClear: () => void
  /** Compact-mode toggle state — focuses the input when it becomes visible. */
  open?: boolean
  className?: string
}

export function OrderSidebarSearch({ value, onChange, onClear, open = false, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  return (
    <div className={cn('relative mt-2 items-center', className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Search customer..."
        aria-label="Search customer"
        className="h-8 bg-white pl-8 pr-8 text-sm [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value !== '' && (
        <button
          type="button"
          title="Clear search"
          aria-label="Clear search"
          onClick={() => {
            onClear()
            queueMicrotask(() => inputRef.current?.focus())
          }}
          className="absolute right-1.5 top-1/2 inline-flex size-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}
