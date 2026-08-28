import { useImperativeHandle, useState, type Ref } from 'react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useToast } from '../Toast'
import { stockInputClass } from '../stock/stockShared'
import { sizesForPreset, type SizeRunPreset } from './textileStockShared'
import type { Database } from '../../types/supabase'

type VariantInsert = Database['public']['Tables']['textile_variants']['Insert']

/** A variant row without its parent — the product may not exist yet. */
export type VariantRowInput = Omit<VariantInsert, 'product_id'>

export type VariantFieldsHandle = {
  /** Rows for the current input, or null when invalid — a toast names the problem. */
  buildRows: () => VariantRowInput[] | null
}

type VariantFieldsProps = {
  ref?: Ref<VariantFieldsHandle>
  /** Dims the block and blocks every control, without unmounting the input. */
  disabled?: boolean
}

const headClass = 'h-9 px-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase'

/** Pending rows are unique per colour + size; colours compare case-insensitively. */
function rowKey(color: string, size: string): string {
  return `${color.toLowerCase()}|||${size}`
}

/**
 * Input block for a product's variants: one row of inputs — a colour with a
 * size run plus its options — expands into one pending variant per size in
 * the table below. Collects only — the owning dialog pulls the rows through
 * `ref` and decides where they are written.
 */
export function VariantFields({ ref, disabled = false }: VariantFieldsProps) {
  const { showError } = useToast()

  const [rows, setRows] = useState<VariantRowInput[]>([])
  const [colorName, setColorName] = useState('')
  const [colorHex, setColorHex] = useState('#000000')
  const [sizeRun, setSizeRun] = useState<SizeRunPreset>('STANDARD')
  const [customInput, setCustomInput] = useState('')
  const [customTags, setCustomTags] = useState<string[]>([])
  const [minStock, setMinStock] = useState('0')

  const addCustomTag = (): void => {
    const raw = customInput.trim()
    if (!raw) return
    const clean = raw.replace(/\s+/g, ' ')
    setCustomTags(previous => (previous.includes(clean) ? previous : [...previous, clean]))
    setCustomInput('')
  }

  const addVariants = (): void => {
    const name = colorName.trim()
    if (!name) return
    if (sizeRun === 'CUSTOM' && customTags.length === 0) {
      showError('For "Custom…" add at least one size as a tag')
      return
    }
    const minimumRaw = minStock.trim()
    const minimumValue = minimumRaw === '' ? 0 : parseInt(minimumRaw, 10)
    if (!Number.isInteger(minimumValue) || minimumValue < 0) {
      showError('Invalid minimum stock')
      return
    }

    const hex = (colorHex || '#000000').toUpperCase()
    const taken = new Set(rows.map(row => rowKey(row.color, row.size)))
    const newRows: VariantRowInput[] = sizesForPreset(sizeRun, customTags)
      .filter(sizeValue => !taken.has(rowKey(name, sizeValue)))
      .map(sizeValue => ({
        color: name,
        color_hex: hex,
        size: sizeValue,
        min_stock: minimumValue,
        stock: 0,
        sample_stock: 0,
        sort_order: 0,
        is_active: true,
      }))
    if (newRows.length === 0) {
      showError('These variants are already in the list')
      return
    }
    setRows(previous => [...previous, ...newRows])
    setColorName('')
    setCustomTags([])
    setCustomInput('')
  }

  const buildRows = (): VariantRowInput[] | null => {
    if (rows.length === 0) {
      showError('Add at least 1 variant')
      return null
    }
    return rows.map((row, index) => ({ ...row, sort_order: index }))
  }

  // No deps: the handle is rebuilt each render, so the parent never pulls
  // rows from a stale closure.
  useImperativeHandle(ref, () => ({ buildRows }))

  return (
    <div
      className={cn(
        'mb-3 grid gap-2.5 rounded-xl border border-border bg-background p-3 transition-opacity',
        disabled && 'opacity-50',
      )}
      aria-disabled={disabled || undefined}
    >
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={cn(stockInputClass, 'min-w-36 flex-1')}
          placeholder="Colour name"
          value={colorName}
          onChange={event => setColorName(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault()
              addVariants()
            }
          }}
          aria-label="Colour name"
          disabled={disabled}
        />
        <input
          type="color"
          value={colorHex}
          onChange={event => setColorHex(event.target.value)}
          className="h-8 w-11 border-none p-0"
          aria-label="Colour picker"
          disabled={disabled}
        />
        <select
          className={stockInputClass}
          value={sizeRun}
          onChange={event => setSizeRun(event.target.value as SizeRunPreset)}
          aria-label="Select size run"
          disabled={disabled}
        >
          <option value="STANDARD">Standard (XS–5XL)</option>
          <option value="REDUCED">Reduced (XS–3XL)</option>
          <option value="KIDS">Kids</option>
          <option value="UNISEX">Unisex (XS–5XL)</option>
          <option value="CUSTOM">Custom…</option>
        </select>
        <input
          type="number"
          className={cn(stockInputClass, 'w-24')}
          min={0}
          value={minStock}
          onChange={event => setMinStock(event.target.value)}
          placeholder="Min. stock"
          title="Minimum stock for these variants"
          aria-label="Minimum stock"
          disabled={disabled}
        />
        <Button type="button" variant="outline" onClick={addVariants} disabled={disabled}>
          + Add
        </Button>
      </div>

      {sizeRun === 'CUSTOM' && (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className={cn(stockInputClass, 'min-w-50')}
              placeholder="Type size + Enter"
              value={customInput}
              onChange={event => setCustomInput(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addCustomTag()
                }
              }}
              aria-label="Custom size"
              disabled={disabled}
            />
            <Button type="button" variant="outline" onClick={addCustomTag} disabled={disabled}>
              + Add size
            </Button>
          </div>
          {customTags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {customTags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-2.5 py-1.5 text-sm"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => setCustomTags(previous => previous.filter(existing => existing !== tag))}
                    className="cursor-pointer border-none bg-transparent p-0 text-sm leading-none opacity-75"
                    aria-label={`Remove ${tag}`}
                    disabled={disabled}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border">
        <Table className="text-sm">
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className={headClass}>Colour</TableHead>
              <TableHead className={headClass}>Size</TableHead>
              <TableHead className={headClass}>Min. stock</TableHead>
              <TableHead className={cn(headClass, 'w-10')}>
                <span className="sr-only">Remove</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="px-3 py-4 text-center text-sm text-muted-foreground">
                  No variants yet — add a colour with its sizes above.
                </TableCell>
              </TableRow>
            )}
            {rows.map(row => (
              <TableRow key={rowKey(row.color, row.size)}>
                <TableCell className="px-3 py-1.5">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="size-2.5 rounded-full border border-black/15"
                      style={{ background: row.color_hex ?? undefined }}
                    />
                    {row.color}
                  </span>
                </TableCell>
                <TableCell className="px-3 py-1.5">{row.size}</TableCell>
                <TableCell className="px-3 py-1.5">{row.min_stock ?? 0}</TableCell>
                <TableCell className="px-3 py-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setRows(previous =>
                        previous.filter(existing => rowKey(existing.color, existing.size) !== rowKey(row.color, row.size)),
                      )
                    }
                    className="cursor-pointer border-none bg-transparent p-0 text-sm leading-none opacity-75 hover:opacity-100"
                    aria-label={`Remove ${row.color} ${row.size}`}
                    disabled={disabled}
                  >
                    ×
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
