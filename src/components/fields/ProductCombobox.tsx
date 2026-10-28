import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { departmentIcon } from '../../lib/departmentIcons'
import { PRODUCT_TYPE_LABELS } from '../../lib/productTypeLabels'
import { shortProductNumber } from '../../lib/productShared'
import type { LoadedProduct } from '../../types/product'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'

type ProductComboboxProps = {
  /** The products on offer — an order's, cancelled ones included. */
  products: LoadedProduct[]
  value: string | null
  onChange: (productId: string | null) => void
  /** What the empty choice is called (e.g. "All products"). */
  emptyLabel?: string
  /** data-testid for the trigger. */
  testId?: string
  /** data-testid of the empty option in the list. */
  emptyOptionTestId?: string
  /** data-testid shared by the product options (each carries `data-product-id`). */
  optionTestId?: string
}

/** "ST-04 · Stand stamp" — the short number and what the product is. */
function productLabel(product: LoadedProduct): string {
  return `${shortProductNumber(product.product_number)} · ${PRODUCT_TYPE_LABELS[product.type] ?? product.type}`
}

/**
 * Picks one product of an order, or none. Modelled on `EmployeeCombobox`: a
 * trigger naming the choice, a popover with a search and the list, each
 * product with its department's icon.
 */
export function ProductCombobox({
  products,
  value,
  onChange,
  emptyLabel = 'All products',
  testId,
  emptyOptionTestId,
  optionTestId,
}: ProductComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const selected = products.find(product => product.id === value) ?? null

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return products
    return products.filter(product => productLabel(product).toLowerCase().includes(needle))
  }, [products, search])

  const pick = (productId: string | null) => {
    setOpen(false)
    setSearch('')
    onChange(productId)
  }

  const SelectedIcon = selected ? departmentIcon(selected.department).icon : null

  return (
    <Popover
      open={open}
      onOpenChange={next => {
        setOpen(next)
        if (!next) setSearch('')
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="combobox"
          size="sm"
          role="combobox"
          aria-expanded={open}
          aria-label="Product"
          data-testid={testId}
          data-value={value ?? undefined}
          className="w-44 justify-between"
        >
          <span className={cn('flex min-w-0 items-center gap-1.5', !selected && 'text-muted-foreground')}>
            {selected && SelectedIcon && (
              <SelectedIcon className={cn('size-4 shrink-0', departmentIcon(selected.department).colorClassName)} />
            )}
            <span className="truncate">{selected ? productLabel(selected) : emptyLabel}</span>
          </span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 min-w-70 p-4">
        <Input
          autoFocus
          placeholder="Search product…"
          className="mb-1 h-10 text-base outline-primary!"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="max-h-56 overflow-y-auto">
          <button
            type="button"
            data-testid={emptyOptionTestId}
            className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-primary/10"
            onClick={() => pick(null)}
          >
            <p>{emptyLabel}</p>
            {value === null && <Check className="ml-auto size-4" />}
          </button>
          {filtered.map(product => {
            const { icon: Icon, colorClassName } = departmentIcon(product.department)
            return (
              <button
                key={product.id}
                type="button"
                data-testid={optionTestId}
                data-product-id={product.id}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-primary/10',
                  product.is_cancelled && 'text-muted-foreground line-through',
                )}
                onClick={() => pick(product.id)}
              >
                <Icon className={cn('size-4 shrink-0', colorClassName)} />
                <p className="truncate">{productLabel(product)}</p>
                {product.id === value && <Check className="ml-auto size-4 shrink-0" />}
              </button>
            )
          })}
          {filtered.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">No products found</p>}
        </div>
      </PopoverContent>
    </Popover>
  )
}
