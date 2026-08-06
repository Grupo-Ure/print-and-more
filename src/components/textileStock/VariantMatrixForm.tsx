import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useToast } from '../Toast'
import { errorToString } from '../../lib/errorToString'
import { textileMasterDataService } from '../../services/textileMasterDataService'
import { useCreateTextileVariantsBatch } from '../../queries/textileStockQueries'
import { stockInputClass } from '../stock/stockShared'
import { sizeRunLabel, sizesForPreset, type SizeRunPreset } from './textileStockShared'
import type { Database } from '../../types/supabase'

type VariantInsert = Database['public']['Tables']['textile_variants']['Insert']

type MatrixColor = {
  id: string
  name: string
  hex: string
  sizeRun: SizeRunPreset
  customSizes: string[]
}

type VariantMatrixFormProps = {
  productId: string
  singleFormShown: boolean
  onToggleSingleForm: () => void
}

/** Bulk variant creation: colours × per-colour size runs, deduped against existing rows. */
export function VariantMatrixForm({ productId, singleFormShown, onToggleSingleForm }: VariantMatrixFormProps) {
  const { showError, showSuccess } = useToast()
  const createVariantsBatch = useCreateTextileVariantsBatch()

  const [colors, setColors] = useState<MatrixColor[]>([])
  const [colorName, setColorName] = useState('')
  const [colorHex, setColorHex] = useState('#000000')
  const [sizeRun, setSizeRun] = useState<SizeRunPreset>('STANDARD')
  const [customInput, setCustomInput] = useState('')
  const [customTags, setCustomTags] = useState<string[]>([])
  const [minimumStock, setMinimumStock] = useState('0')
  const [allSamples, setAllSamples] = useState(false)
  const [busy, setBusy] = useState(false)

  const preview = useMemo(() => {
    if (colors.length === 0) return { total: 0, summaryText: '' }
    const parts: string[] = []
    let total = 0
    for (const colorEntry of colors) {
      const sizeCount = sizesForPreset(colorEntry.sizeRun, colorEntry.customSizes).length
      total += sizeCount
      parts.push(`${colorEntry.name} (${sizeCount} sizes)`)
    }
    return { total, summaryText: `${parts.join(' + ')} = ${total} variants total` }
  }, [colors])

  const addCustomTag = (): void => {
    const raw = customInput.trim()
    if (!raw) return
    const clean = raw.replace(/\s+/g, ' ')
    setCustomTags(previous => (previous.includes(clean) ? previous : [...previous, clean]))
    setCustomInput('')
  }

  const addColor = (): void => {
    const name = colorName.trim()
    if (!name) return
    if (sizeRun === 'CUSTOM' && customTags.length === 0) {
      showError('For "Custom…" add at least one size as a tag')
      return
    }
    const hex = (colorHex || '#000000').toUpperCase()
    const key = name.toLowerCase()
    const customSizes = sizeRun === 'CUSTOM' ? [...customTags] : []
    setColors(previous => {
      if (previous.some(existing => existing.name.toLowerCase() === key)) return previous
      return [...previous, { id: crypto.randomUUID(), name, hex, sizeRun, customSizes }]
    })
    setColorName('')
    setCustomTags([])
    setCustomInput('')
  }

  const reset = (): void => {
    setColors([])
    setColorName('')
    setColorHex('#000000')
    setSizeRun('STANDARD')
    setCustomInput('')
    setCustomTags([])
    setMinimumStock('0')
    setAllSamples(false)
  }

  const createMatrix = async (): Promise<void> => {
    if (!productId || busy) return
    if (colors.length === 0) {
      showError('Add at least 1 colour')
      return
    }
    for (const colorEntry of colors) {
      if (sizesForPreset(colorEntry.sizeRun, colorEntry.customSizes).length === 0) {
        showError(`No sizes for colour "${colorEntry.name}"`)
        return
      }
    }
    const minimumRaw = minimumStock.trim()
    const minimumValue = minimumRaw === '' ? 0 : parseInt(minimumRaw, 10)
    if (!Number.isInteger(minimumValue) || minimumValue < 0) {
      showError('Invalid minimum stock')
      return
    }

    const allColorNames = colors.map(colorEntry => colorEntry.name)
    const allSizes = new Set<string>()
    for (const colorEntry of colors) {
      for (const sizeValue of sizesForPreset(colorEntry.sizeRun, colorEntry.customSizes)) allSizes.add(sizeValue)
    }

    setBusy(true)
    try {
      const existingVariants = await textileMasterDataService.getExistingVariantCombinations(
        productId,
        allColorNames,
        [...allSizes],
      )
      const existingCombinations = new Set(existingVariants.map(row => `${row.color}|||${row.size}`))

      const variantInserts: VariantInsert[] = []
      let sortCounter = 0
      for (const colorEntry of colors) {
        for (const sizeValue of sizesForPreset(colorEntry.sizeRun, colorEntry.customSizes)) {
          if (existingCombinations.has(`${colorEntry.name}|||${sizeValue}`)) continue
          variantInserts.push({
            product_id: productId,
            color: colorEntry.name,
            color_hex: colorEntry.hex,
            size: sizeValue,
            is_sample: allSamples,
            min_stock: minimumValue,
            stock: 0,
            sort_order: sortCounter++,
            is_active: true,
          })
        }
      }

      if (variantInserts.length === 0) {
        showSuccess('No new variants — all already exist')
        return
      }

      await createVariantsBatch.mutateAsync(variantInserts)
      showSuccess(`${variantInserts.length} variants created`)
      reset()
    } catch (error) {
      showError(errorToString(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-3 rounded-xl border border-border bg-background p-3">
      <div className="grid gap-3">
        <div>
          <div className="mb-1.5 text-sm font-bold">Step 1: Colours each with their own size run</div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className={cn(stockInputClass, 'min-w-40')}
              placeholder="Colour name"
              value={colorName}
              onChange={event => setColorName(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addColor()
                }
              }}
            />
            <input
              type="color"
              value={colorHex}
              onChange={event => setColorHex(event.target.value)}
              className="h-8 w-11 border-none p-0"
              aria-label="Colour picker"
            />
            <select
              className={cn(stockInputClass, 'min-w-55')}
              value={sizeRun}
              onChange={event => setSizeRun(event.target.value as SizeRunPreset)}
              disabled={busy}
              aria-label="Select size run"
            >
              <option value="STANDARD">Standard (XS–5XL)</option>
              <option value="REDUCED">Reduced (XS–3XL)</option>
              <option value="KIDS">Kids</option>
              <option value="UNISEX">Unisex (XS–5XL)</option>
              <option value="CUSTOM">Custom…</option>
            </select>
            <Button type="button" variant="outline" onClick={addColor} disabled={busy}>
              + Add
            </Button>
          </div>
          {sizeRun === 'CUSTOM' && (
            <div className="mt-2.5">
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
                />
                <Button type="button" variant="outline" onClick={addCustomTag} disabled={busy}>
                  + Add
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
                        disabled={busy}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {colors.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {colors.map(colorEntry => (
                <span
                  key={colorEntry.id}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-2.5 py-1.5 text-sm"
                >
                  <span
                    aria-hidden
                    className="size-2.5 rounded-full border border-black/15"
                    style={{ background: colorEntry.hex }}
                  />
                  <span className="font-semibold">{colorEntry.name}</span>
                  <span className="opacity-75">{colorEntry.hex.toUpperCase()}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {sizeRunLabel(colorEntry.sizeRun, colorEntry.customSizes)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setColors(previous => previous.filter(existing => existing.id !== colorEntry.id))}
                    className="cursor-pointer border-none bg-transparent p-0 text-sm leading-none opacity-75"
                    aria-label={`Remove ${colorEntry.name}`}
                    disabled={busy}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-1.5 text-sm font-bold">Step 2: Preview</div>
          <p className="m-0 text-sm leading-normal text-muted-foreground">
            {colors.length === 0 ? 'No colours yet — preview appears after adding.' : preview.summaryText}
          </p>
        </div>

        <div>
          <div className="mb-1.5 text-sm font-bold">Step 3: Options</div>
          <div className="mb-2.5 flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm">
              Min. stock for all
              <input
                type="number"
                className={cn(stockInputClass, 'max-w-24')}
                min={0}
                value={minimumStock}
                onChange={event => setMinimumStock(event.target.value)}
                disabled={busy}
              />
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allSamples}
                onChange={event => setAllSamples(event.target.checked)}
                disabled={busy}
              />
              Mark all as samples
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              type="button"
              onClick={() => void createMatrix()}
              disabled={busy || colors.length === 0 || preview.total === 0}
            >
              Create variants
            </Button>
            <Button type="button" variant="outline" onClick={reset} disabled={busy}>
              Reset
            </Button>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleSingleForm}
          className="cursor-pointer self-start border-none bg-transparent p-0 text-sm text-primary underline"
          disabled={busy}
        >
          {singleFormShown ? 'Close single variant' : 'Add single variant'}
        </button>
      </div>
    </div>
  )
}
