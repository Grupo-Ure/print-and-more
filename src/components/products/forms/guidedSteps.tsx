/**
 * Guided steps — the pieces of a pick made one question at a time: the list
 * answering the current question (`OptionStep`) and the trail of answers
 * already given (`StepPick`, joined by `PickSeparator`).
 *
 * Shared by the two editors of the textile batch form, which is why the test
 * ids are that form's: the garment editor asks for brand, model and colour,
 * the design editor for placement and size.
 */

import { useContext, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { TextileOption } from '@/lib/textileOptions'
import { TEST_IDS } from '@e2e/support/testIds'
import { ProductViewContext } from './formContexts'

const IDS = TEST_IDS.orders.productDetail.basicInfo.textile

type StepOption = TextileOption & { colorHex?: string | null }

/** Lists longer than this get a filter box above them. */
const FILTERABLE_FROM = 8

/**
 * One step of a guided pick: a question and the options answering it, as one
 * list — the same list the new-order dialog offers its customers in. The
 * editors show one step at a time, so the user is asked for the brand, then
 * the model, then the colour, instead of facing every field at once. `step`
 * names the step for the e2e suite; `loading` and `failed` are the state of
 * the list's query, where there is one.
 */
export function OptionStep({
  step,
  title,
  options,
  loading = false,
  failed = false,
  emptyText = 'Nothing to choose from.',
  onPick,
}: {
  step: string
  title: string
  options: StepOption[]
  loading?: boolean
  failed?: boolean
  emptyText?: string
  onPick: (option: StepOption) => void
}) {
  const [filter, setFilter] = useState('')
  const needle = filter.trim().toLowerCase()
  const shown = needle === '' ? options : options.filter(option => option.label.toLowerCase().includes(needle))

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      {options.length > FILTERABLE_FROM && (
        <Input
          type="search"
          placeholder="Filter…"
          aria-label={`Filter ${title.toLowerCase()}`}
          className="h-8"
          value={filter}
          onChange={event => setFilter(event.target.value)}
        />
      )}
      <div className="max-h-64 overflow-y-auto rounded-md border">
        {loading ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">Loading…</p>
        ) : failed ? (
          <p className="px-3 py-2 text-xs text-destructive">The catalog could not be loaded.</p>
        ) : shown.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">{options.length === 0 ? emptyText : 'No match'}</p>
        ) : (
          shown.map(option => (
            <button
              key={option.value}
              type="button"
              data-testid={IDS.stepOption}
              data-step={step}
              data-value={option.value}
              onClick={() => onPick(option)}
              className="flex w-full cursor-pointer items-center gap-2 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset focus-visible:outline-none"
            >
              {option.colorHex && <ColorSwatch hex={option.colorHex} />}
              <span className="min-w-0 flex-1 truncate font-medium">{option.label}</span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

/** A catalog colour's swatch; the hex comes from the data, so it cannot be a token. */
function ColorSwatch({ hex }: { hex: string }) {
  return <span aria-hidden className="size-3 shrink-0 rounded-full border border-border" style={{ backgroundColor: hex }} />
}

/**
 * A pick already made in a guided step, shown in the trail above the current
 * step. Clicking it reopens that step; without `onChange` (a read-only form,
 * or a stored row still resolving its ids) it is a plain badge.
 */
export function StepPick({
  step,
  label,
  colorHex,
  onChange,
}: {
  step: string
  label: string
  colorHex?: string | null
  onChange?: () => void
}) {
  const readOnly = useContext(ProductViewContext)
  if (readOnly || !onChange) {
    return (
      <Badge variant="secondary" data-testid={IDS.stepPick} data-step={step}>
        {colorHex && <ColorSwatch hex={colorHex} />}
        {label}
      </Badge>
    )
  }
  return (
    <Button
      type="button"
      variant="secondary"
      size="xs"
      data-testid={IDS.stepPick}
      data-step={step}
      title="Change"
      onClick={onChange}
    >
      {colorHex && <ColorSwatch hex={colorHex} />}
      {label}
    </Button>
  )
}

/** The chevron between two picks of a trail. */
export function PickSeparator() {
  return <ChevronRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
}
