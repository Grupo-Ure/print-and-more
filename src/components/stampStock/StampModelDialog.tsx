import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '../Toast'
import { REFILL_INK_COLORS, STAMP_COLOR_LABELS } from '../../types/stamp'
import {
  useCreateStampModel,
  usePadArticleNumbers,
  useUpdateStampModel,
} from '../../queries/stampStockQueries'
import { stockInputClass } from '../stock/stockShared'
import { STAMP_TYPE_FILTER_OPTIONS, typeLabel, type StampModelRow, type StampType } from './stampStockShared'

/** Types that are physical stamp bodies with a print area. */
const STAMP_BODY_TYPES: readonly StampType[] = ['TRODAT_PRINTY', 'WOODEN_STAMP', 'STAND_STAMP', 'DATE_STAMP']

const PAD_SIZES = ['SMALL', 'MEDIUM', 'LARGE'] as const
const PAD_SIZE_LABELS: Record<(typeof PAD_SIZES)[number], string> = {
  SMALL: 'Small',
  MEDIUM: 'Medium',
  LARGE: 'Large',
}

type FormState = {
  type: StampType
  name: string
  article_number: string
  max_width_mm: string
  max_height_mm: string
  print_area: string
  replacement_pad_article_number: string
  color: string
  size: string
  net_price: string
  min_stock: string
  note: string
}

const EMPTY_FORM: FormState = {
  type: 'TRODAT_PRINTY',
  name: '',
  article_number: '',
  max_width_mm: '',
  max_height_mm: '',
  print_area: '',
  replacement_pad_article_number: '',
  color: '',
  size: '',
  net_price: '',
  min_stock: '0',
  note: '',
}

function formFromModel(model: StampModelRow): FormState {
  return {
    type: model.type as StampType,
    name: model.name,
    article_number: model.article_number ?? '',
    max_width_mm: model.max_width_mm != null ? String(model.max_width_mm) : '',
    max_height_mm: model.max_height_mm != null ? String(model.max_height_mm) : '',
    print_area: model.print_area ?? '',
    replacement_pad_article_number: model.replacement_pad_article_number ?? '',
    color: model.color ?? '',
    size: model.size ?? '',
    net_price: model.net_price != null ? String(model.net_price) : '',
    min_stock: String(model.min_stock ?? 0),
    note: model.note ?? '',
  }
}

type StampModelDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Present ⇒ edit mode; absent ⇒ create mode. */
  model?: StampModelRow | null
}

/** Create/edit dialog for a `stamp_models` row; fields adapt to the type. */
export function StampModelDialog({ open, onOpenChange, model }: StampModelDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {/* Keyed remount seeds the form per target — no effect needed. */}
        <StampModelForm key={model?.id ?? 'new'} model={model} onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  )
}

function StampModelForm({
  model,
  onOpenChange,
}: {
  model?: StampModelRow | null
  onOpenChange: (open: boolean) => void
}) {
  const { showError } = useToast()
  const createModel = useCreateStampModel()
  const updateModel = useUpdateStampModel()
  const padArticleNumbersQuery = usePadArticleNumbers()

  const isEdit = model != null
  const [form, setForm] = useState<FormState>(() => (model ? formFromModel(model) : EMPTY_FORM))

  const setField = (field: keyof FormState) => (value: string) =>
    setForm(state => ({ ...state, [field]: value }))

  const isBodyType = STAMP_BODY_TYPES.includes(form.type)
  const showColor = form.type === 'TRODAT_PAD' || form.type === 'INK_PAD_PRODUCT'
  const showSize = form.type === 'INK_PAD_PRODUCT'
  const showReplacementPad = form.type === 'TRODAT_PRINTY'

  const parseOptionalInt = (raw: string): number | null | 'invalid' => {
    const trimmed = raw.trim()
    if (trimmed === '') return null
    const value = parseInt(trimmed, 10)
    return Number.isInteger(value) && value >= 0 ? value : 'invalid'
  }

  const save = (): void => {
    const name = form.name.trim()
    if (!name) {
      showError('Name is required')
      return
    }
    const articleNumber = form.article_number.trim()
    if (form.type === 'TRODAT_PAD' && !articleNumber) {
      showError('Trodat pads need an article number — the automatic pad deduction matches on it')
      return
    }
    if (form.type === 'TRODAT_PAD' && !form.color) {
      showError('Trodat pads need a colour — the automatic pad deduction matches on it')
      return
    }
    if (form.type === 'INK_PAD_PRODUCT' && !form.size) {
      showError('Stamp pads need a size')
      return
    }
    const maxWidth = parseOptionalInt(form.max_width_mm)
    const maxHeight = parseOptionalInt(form.max_height_mm)
    if (maxWidth === 'invalid' || maxHeight === 'invalid') {
      showError('Invalid print-area dimensions')
      return
    }
    const minStock = parseOptionalInt(form.min_stock)
    if (minStock === 'invalid') {
      showError('Invalid minimum stock')
      return
    }
    const netPriceRaw = form.net_price.trim().replace(',', '.')
    const netPrice = netPriceRaw === '' ? null : Number(netPriceRaw)
    if (netPrice != null && (!Number.isFinite(netPrice) || netPrice < 0)) {
      showError('Invalid net price')
      return
    }

    const fields = {
      name,
      article_number: articleNumber || null,
      max_width_mm: isBodyType ? maxWidth : null,
      max_height_mm: isBodyType ? maxHeight : null,
      print_area: isBodyType ? form.print_area.trim() || null : null,
      replacement_pad_article_number: showReplacementPad
        ? form.replacement_pad_article_number.trim() || null
        : null,
      color: showColor ? form.color || null : null,
      size: showSize ? form.size || null : null,
      net_price: netPrice,
      min_stock: minStock ?? 0,
      note: form.note.trim() || null,
    }

    const mutationHandlers = {
      onSuccess: () => onOpenChange(false),
      onError: () => showError(isEdit ? 'Model could not be updated' : 'Model could not be created'),
    }
    if (isEdit) {
      updateModel.mutate({ modelId: model.id, patch: fields }, mutationHandlers)
    } else {
      // New models start at stock 0 — inventory is booked in via the Overview tab.
      createModel.mutate({ ...fields, type: form.type, stock: 0, is_active: true }, mutationHandlers)
    }
  }

  const saving = createModel.isPending || updateModel.isPending

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? `Edit ${model.name}` : 'New stamp model'}</DialogTitle>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
        <label className="flex flex-col gap-1 text-sm">
          Type
          <select
            className={stockInputClass}
            value={form.type}
            disabled={isEdit}
            onChange={event => setField('type')(event.target.value)}
            title={isEdit ? 'The type cannot be changed — orders reference it' : undefined}
          >
            {STAMP_TYPE_FILTER_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Name *
          <input
            className={stockInputClass}
            value={form.name}
            onChange={event => setField('name')(event.target.value)}
            placeholder={`e.g. ${typeLabel(form.type)} …`}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Article number{form.type === 'TRODAT_PAD' ? ' *' : ''}
          <input
            className={stockInputClass}
            value={form.article_number}
            onChange={event => setField('article_number')(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Net price (€)
          <input
            className={stockInputClass}
            inputMode="decimal"
            value={form.net_price}
            onChange={event => setField('net_price')(event.target.value)}
          />
        </label>

        {isBodyType && (
          <>
            <label className="flex flex-col gap-1 text-sm">
              Max. width (mm)
              <input
                className={stockInputClass}
                inputMode="numeric"
                value={form.max_width_mm}
                onChange={event => setField('max_width_mm')(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Max. height (mm)
              <input
                className={stockInputClass}
                inputMode="numeric"
                value={form.max_height_mm}
                onChange={event => setField('max_height_mm')(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Print area
              <input
                className={stockInputClass}
                value={form.print_area}
                onChange={event => setField('print_area')(event.target.value)}
                placeholder="e.g. 47 × 18 mm"
              />
            </label>
          </>
        )}

        {showReplacementPad && (
          <label className="flex flex-col gap-1 text-sm">
            Replacement pad article no.
            <input
              className={stockInputClass}
              list="stamp-pad-article-numbers"
              value={form.replacement_pad_article_number}
              onChange={event => setField('replacement_pad_article_number')(event.target.value)}
              title="Must match a Trodat pad's article number — the release auto-deduction looks the pad up by it"
            />
            <datalist id="stamp-pad-article-numbers">
              {(padArticleNumbersQuery.data ?? []).map(articleNumber => (
                <option key={articleNumber} value={articleNumber} />
              ))}
            </datalist>
          </label>
        )}

        {showColor && (
          <label className="flex flex-col gap-1 text-sm">
            Colour{form.type === 'TRODAT_PAD' ? ' *' : ''}
            <select
              className={stockInputClass}
              value={form.color}
              onChange={event => setField('color')(event.target.value)}
            >
              <option value="">—</option>
              {REFILL_INK_COLORS.map(colorCode => (
                <option key={colorCode} value={colorCode}>
                  {STAMP_COLOR_LABELS[colorCode]}
                </option>
              ))}
            </select>
          </label>
        )}

        {showSize && (
          <label className="flex flex-col gap-1 text-sm">
            Size *
            <select
              className={stockInputClass}
              value={form.size}
              onChange={event => setField('size')(event.target.value)}
            >
              <option value="">—</option>
              {PAD_SIZES.map(sizeCode => (
                <option key={sizeCode} value={sizeCode}>
                  {PAD_SIZE_LABELS[sizeCode]}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm">
          Min. stock
          <input
            className={stockInputClass}
            inputMode="numeric"
            value={form.min_stock}
            onChange={event => setField('min_stock')(event.target.value)}
          />
        </label>
        <label className="col-span-2 flex flex-col gap-1 text-sm">
          Note
          <textarea
            className="min-h-16 rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
            value={form.note}
            onChange={event => setField('note')(event.target.value)}
          />
        </label>
      </div>

      {!isEdit && (
        <p className="text-xs opacity-70">
          New models start with stock 0 — book the initial inventory via the Overview tab.
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="button" onClick={save} disabled={saving}>
          {isEdit ? 'Save' : 'Create'}
        </Button>
      </div>
    </>
  )
}
