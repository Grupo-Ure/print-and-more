import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * The highlights shared by the order's log-like tabs (History, Emails), so a
 * product number or a quote reads the same in both.
 */

/**
 * The filter row above a log. The pickers in it (every `role="combobox"`
 * trigger) get a solid face and a light shadow, the look the settings fields
 * share (see `SettingSelect`).
 */
export function FilterBar({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex shrink-0 flex-wrap items-center gap-2 [&_[role=combobox]]:bg-background [&_[role=combobox]]:shadow-xs"
    >
      {children}
    </div>
  )
}

/**
 * A product number in a log line, in sky. With a product to open it is a link:
 * clicking it shows that product on the order's Products tab. Without one (the
 * product was deleted) it is plain text.
 */
export function ProductLink({
  productId,
  onOpen,
  children,
}: {
  productId: string | null
  onOpen?: (productId: string) => void
  children: ReactNode
}) {
  if (!productId || !onOpen) return <span className="font-medium text-sky-600 dark:text-sky-400">{children}</span>
  return (
    <button
      type="button"
      title="Open this product"
      className="cursor-pointer font-medium text-sky-600 hover:underline dark:text-sky-400"
      onClick={() => onOpen(productId)}
    >
      {children}
    </button>
  )
}

/**
 * Free text someone wrote — a message, a note — as a shaded block.
 * It holds a few lines' room even when short (or empty: `placeholder`), so
 * views showing one text and then another do not jump in height.
 */
export function QuoteBlock({ children, placeholder }: { children: string | null; placeholder: string }) {
  return (
    <p
      className={cn(
        'min-h-20 rounded-md border bg-muted/30 px-3 py-2 whitespace-pre-line',
        !children && 'text-muted-foreground italic',
      )}
    >
      {children || placeholder}
    </p>
  )
}

/** Quoted text in a log line — a subject, the customer's note — in dark yellow, inside curly quotes. */
export function Quote({ children }: { children: ReactNode }) {
  return <span className="font-medium text-yellow-700 dark:text-yellow-400">“{children}”</span>
}
