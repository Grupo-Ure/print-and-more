/**
 * The design half of the textile batch form (`textile_designs`): one row per
 * design applied to the whole batch, added through the shared `FilePicker`
 * (plus the editor's own *Text* tab) and then given its placement and size one
 * step at a time. See `textile.tsx` for the form.
 */

import { useContext, useState } from 'react'
import { FileText, Plus, Trash2 } from 'lucide-react'
import { FilePicker } from '@/components/FilePicker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SectionHeader } from '@/components/ui/section-title'
import { useRevealFile } from '@/hooks/useRevealFile'
import { emptyDesign, type DesignDraft } from '@/lib/products/textileBatchDraft'
import {
  TEXTILE_APPLICATION_SIZE_OPTIONS,
  TEXTILE_FONT_CLASS_OPTIONS,
  TEXTILE_PLACEMENT_OPTIONS,
  textileOptionLabel,
} from '@/lib/textileOptions'
import type { FileRow } from '@/services/fileService'
import { TEST_IDS } from '@e2e/support/testIds'
import { OptionStep, PickSeparator, StepPick } from './guidedSteps'
import { ProductViewContext, useSubmitAttempted } from './formContexts'

const IDS = TEST_IDS.orders.productDetail.basicInfo.textile

/**
 * The *Text* tab of the design picker — the one design source that is not a
 * file, so it is the batch editor's own tab rather than part of the shared
 * picker. `fold` collapses the picker again, as applying a file does.
 */
function TextDesignTab({ onAddText, fold }: { onAddText: (content: string) => void; fold: () => void }) {
  const [text, setText] = useState('')

  const addText = () => {
    const content = text.trim()
    if (content === '') return
    onAddText(content)
    setText('')
    fold()
  }

  return (
    <div className="flex min-h-28 flex-col justify-center gap-2 px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">What should it say?</p>
      <div className="flex gap-2">
        <Input
          className="h-8 flex-1"
          placeholder="Text"
          aria-label="Text"
          data-testid={IDS.pickerText}
          value={text}
          onChange={event => setText(event.target.value)}
          onKeyDown={event => {
            // Enter adds the design; the form's submit is left alone.
            if (event.key !== 'Enter') return
            event.preventDefault()
            addText()
          }}
        />
        <Button type="button" size="sm" data-testid={IDS.addDesign} disabled={text.trim() === ''} onClick={addText}>
          <Plus /> Add
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Colour and font follow on the design once it is added.</p>
    </div>
  )
}

/**
 * One design, settled one step at a time: its placement, then its application
 * size, then the optional print method. A file design is named by its order
 * file; a text design states its text, colour and font above the steps.
 */
function DesignRow({
  design,
  file,
  onChange,
  onRemove,
}: {
  design: DesignDraft
  /** The design's order file, or `null` when the file is gone (or the design is text). */
  file: FileRow | null
  onChange: (patch: Partial<DesignDraft>) => void
  onRemove: () => void
}) {
  const readOnly = useContext(ProductViewContext)
  const revealFile = useRevealFile()
  const step = !design.placement ? 'placement' : !design.size ? 'size' : 'done'

  return (
    <div data-testid={IDS.designRow} data-design-type={design.type} className="flex items-start gap-2 rounded-md border p-2">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {design.type === 'FILE' ? (
          <div className="flex items-center gap-2 text-sm">
            <FileText className="size-4 shrink-0 text-primary" aria-hidden />
            {file ? (
              <button
                type="button"
                title={`Open in file manager\n${file.path}`}
                onClick={() => void revealFile(file.path)}
                className="min-w-0 cursor-pointer truncate rounded-sm text-left font-medium hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {file.display_name}
              </button>
            ) : (
              <span className="min-w-0 truncate font-medium text-destructive">This file is no longer linked to the order</span>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Input className="h-8 w-56" placeholder="Text" aria-label="Text" value={design.content} onChange={event => onChange({ content: event.target.value })} />
            <Input className="h-8 w-28" placeholder="#FFFFFF" aria-label="Colour" value={design.color} onChange={event => onChange({ color: event.target.value })} />
            <Select value={design.font_class || undefined} onValueChange={font_class => onChange({ font_class })}>
              <SelectTrigger size="sm" className="w-36" aria-label="Font"><SelectValue placeholder="Font…" /></SelectTrigger>
              <SelectContent>
                {TEXTILE_FONT_CLASS_OPTIONS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input className="h-8 w-40" placeholder="Font name (optional)" aria-label="Font name" value={design.font_name} onChange={event => onChange({ font_name: event.target.value })} />
          </div>
        )}

        {design.placement !== '' && (
          <div className="flex flex-wrap items-center gap-1">
            <StepPick
              step="placement"
              label={textileOptionLabel(TEXTILE_PLACEMENT_OPTIONS, design.placement)}
              onChange={() => onChange({ placement: '' })}
            />
            {design.size !== '' && (
              <>
                <PickSeparator />
                <StepPick
                  step="size"
                  label={textileOptionLabel(TEXTILE_APPLICATION_SIZE_OPTIONS, design.size)}
                  onChange={() => onChange({ size: '' })}
                />
              </>
            )}
          </div>
        )}

        {step === 'placement' && (
          <OptionStep step="placement" title="Where does it go?" options={TEXTILE_PLACEMENT_OPTIONS} onPick={option => onChange({ placement: option.value })} />
        )}
        {step === 'size' && (
          <OptionStep step="size" title="How large?" options={TEXTILE_APPLICATION_SIZE_OPTIONS} onPick={option => onChange({ size: option.value })} />
        )}
        {step === 'done' && (!readOnly || design.print_method !== '') && (
          <Input
            className="h-8 w-56"
            placeholder="Print method (optional)"
            aria-label="Print method"
            value={design.print_method}
            onChange={event => onChange({ print_method: event.target.value })}
          />
        )}
      </div>
      {!readOnly && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          data-testid={IDS.removeDesign}
          title="Remove this design"
          aria-label="Remove this design"
          className="shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 />
        </Button>
      )}
    </div>
  )
}

/**
 * The batch's designs. A design is declared once and holds for every garment
 * line, so there is no per-line application: one row = one design at one
 * placement (which the table's UNIQUE (product_id, placement) enforces).
 * Every design comes in through the picker below the rows — artwork dropped,
 * an order file, or a text.
 */
export function DesignsEditor({
  orderId,
  designs,
  orderFiles,
  error,
  onChange,
}: {
  orderId: string
  designs: DesignDraft[]
  orderFiles: FileRow[]
  error?: string
  onChange: (next: DesignDraft[]) => void
}) {
  const readOnly = useContext(ProductViewContext)
  // The batch error waits for a save attempt, like every field error does.
  const shownError = useSubmitAttempted() ? error : undefined
  const patchDesign = (key: string, patch: Partial<DesignDraft>) =>
    onChange(designs.map(design => (design.key === key ? { ...design, ...patch } : design)))

  const usage = new Map<string, number>()
  for (const design of designs) {
    if (design.type === 'FILE' && design.file_id) usage.set(design.file_id, (usage.get(design.file_id) ?? 0) + 1)
  }
  const filesById = new Map(orderFiles.map(file => [file.id, file]))

  return (
    <section data-testid={IDS.designs} className="flex flex-col gap-2">
      <SectionHeader title="Designs" />
      {designs.map(design => (
        <DesignRow
          key={design.key}
          design={design}
          file={design.type === 'FILE' ? (filesById.get(design.file_id) ?? null) : null}
          onChange={patch => patchDesign(design.key, patch)}
          onRemove={() => onChange(designs.filter(other => other.key !== design.key))}
        />
      ))}
      {!readOnly && (
        <FilePicker
          orderId={orderId}
          orderFiles={orderFiles}
          hasPicks={designs.length > 0}
          collapsedLabel="Add another design"
          // A design may take several placements, so an applied file stays
          // pickable; the badge says how often it is already in.
          fileBadge={file => {
            const applied = usage.get(file.id) ?? 0
            if (applied === 0) return null
            return <Badge variant="secondary">{applied === 1 ? 'Applied once' : `Applied ${applied}×`}</Badge>
          }}
          extraTabs={[
            {
              value: 'text',
              label: 'Text',
              triggerTestId: IDS.pickerTextTab,
              render: fold => (
                <TextDesignTab onAddText={content => onChange([...designs, { ...emptyDesign('TEXT'), content }])} fold={fold} />
              ),
            },
          ]}
          onPick={fileIds => onChange([...designs, ...fileIds.map(file_id => ({ ...emptyDesign('FILE'), file_id }))])}
        />
      )}
      {shownError && <p className="text-xs text-destructive">{shownError}</p>}
    </section>
  )
}
