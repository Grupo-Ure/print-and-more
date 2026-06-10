import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { authService } from '../services/authService'
import { orderService } from '../services/orderService'
import { type Auftrag, type SubOrderRow } from '../types/database'
import { subOrderDetailToFieldMap } from '../lib/utils'
import { SUB_ORDER_DEPARTMENT_LABELS, subOrderDepartmentLabel } from '../const/departmentAbbreviation'
import { LFP_TYPE_LABELS } from '../types/lfp'
import { COPY_SHOP_TYPE_LABELS } from '../types/copyshop'
import { STAMP_TYPE_LABELS } from '../types/stamp'
import { LASER_TYPE_LABELS } from '../types/laser'
import { DateInput } from './DateInput'
import { useToast } from './Toast'

type Props = {
  order: Auftrag
  teilauftraege: SubOrderRow[]
  onSuccess: (neuerAuftrag: Auftrag) => void
  onCancel: () => void
}

function readableSubOrderType(bereich: string, typ: string | null): string {
  if (!typ) return '—'
  if (bereich === 'LFP' && typ in LFP_TYPE_LABELS) return LFP_TYPE_LABELS[typ as keyof typeof LFP_TYPE_LABELS]
  if (bereich === 'COPYSHOP' && typ in COPY_SHOP_TYPE_LABELS)
    return COPY_SHOP_TYPE_LABELS[typ as keyof typeof COPY_SHOP_TYPE_LABELS]
  if (bereich === 'STAMP' && typ in STAMP_TYPE_LABELS)
    return STAMP_TYPE_LABELS[typ as keyof typeof STAMP_TYPE_LABELS]
  if (bereich === 'LASER_ENGRAVING' && typ in LASER_TYPE_LABELS)
    return LASER_TYPE_LABELS[typ as keyof typeof LASER_TYPE_LABELS]
  return typ
}

function formatDetailDimensions(detail: import('../types/database').SubOrderRow['detail']): string {
  const fields = subOrderDetailToFieldMap(detail)
  const widthRaw = fields.format_breite
  const heightRaw = fields.format_hoehe
  const width = typeof widthRaw === 'number' ? widthRaw : typeof widthRaw === 'string' && widthRaw.trim() !== '' ? Number(widthRaw) : null
  const height = typeof heightRaw === 'number' ? heightRaw : typeof heightRaw === 'string' && heightRaw.trim() !== '' ? Number(heightRaw) : null
  const widthValid = width != null && Number.isFinite(width) && width > 0
  const heightValid = height != null && Number.isFinite(height) && height > 0
  const widthText = widthValid ? String(Math.round(width as number)) : ''
  const heightText = heightValid ? String(Math.round(height as number)) : ''
  if (widthValid && heightValid) return `${widthText} × ${heightText} mm`
  if (widthValid) return `${widthText} mm width`
  if (heightValid) return `${heightText} mm height`
  return ''
}

function subOrderLabel(subOrder: SubOrderRow): string {
  const department =
    subOrder.department in SUB_ORDER_DEPARTMENT_LABELS
      ? SUB_ORDER_DEPARTMENT_LABELS[subOrder.department as keyof typeof SUB_ORDER_DEPARTMENT_LABELS]
      : subOrderDepartmentLabel(subOrder.department)
  const type = readableSubOrderType(subOrder.department, subOrder.type)
  const dims = formatDetailDimensions(subOrder.detail)
  return dims ? `${department} · ${type} · ${dims}` : `${department} · ${type}`
}

export function DuplicateDialog({ order, teilauftraege, onSuccess, onCancel }: Props) {
  const activeSubOrders = useMemo(() => teilauftraege.filter(subOrder => !subOrder.is_cancelled), [teilauftraege])

  const [selection, setSelection] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const subOrder of activeSubOrders) initial[subOrder.id] = true
    return initial
  })
  const [newDeadline, setNewDeadline] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { showError, showSuccess } = useToast()

  const selectedSubOrders = useMemo(
    () => activeSubOrders.filter(subOrder => selection[subOrder.id]),
    [activeSubOrders, selection]
  )
  const allSelected = activeSubOrders.length > 0 && selectedSubOrders.length === activeSubOrders.length
  const noneSelected = selectedSubOrders.length === 0
  const masterChecked: boolean | 'indeterminate' = allSelected ? true : noneSelected ? false : 'indeterminate'

  const blocksDuplicate = activeSubOrders.length > 0 && noneSelected
  const customerLabel = order.customers?.name?.trim() || order.id

  const toggle = (id: string) => {
    setSelection(previous => ({ ...previous, [id]: !previous[id] }))
  }

  const toggleAll = (next: boolean | 'indeterminate') => {
    const target = next === true || next === 'indeterminate'
    const updated: Record<string, boolean> = {}
    for (const subOrder of activeSubOrders) updated[subOrder.id] = target
    setSelection(updated)
  }

  const handleDuplicate = async () => {
    if (busy || blocksDuplicate) return
    setBusy(true)
    setError(null)
    try {
      const newOrderId = await orderService.duplicateOrder({
        source_order_id: order.id,
        new_priority: order.priority ?? null,
        new_delivery: order.delivery ?? null,
        new_deadline: newDeadline ? newDeadline : null,
        selected_department_order_ids: selectedSubOrders.map(subOrder => subOrder.id),
        created_by_user_id: (await authService.getUser())?.id ?? null,
      })

      if (!newOrderId.trim()) {
        showError('Order could not be duplicated')
        return
      }

      const newOrderData = await orderService.getOrderById(newOrderId)
      if (!newOrderData) throw new Error('Duplicated order not found')

      showSuccess('Order duplicated')
      onSuccess(newOrderData)
    } catch (e) {
      showError('Order could not be duplicated')
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={true}
      onOpenChange={open => {
        if (!open && !busy) onCancel()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Duplicate Order</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Customer: <strong className="text-foreground font-medium">{customerLabel}</strong>
        </p>

        {activeSubOrders.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="uppercase tracking-[0.06em] text-xs text-muted-foreground">
              Sub-orders
            </h2>
            <label className="flex items-center gap-2.5 rounded-md border bg-muted/40 px-3 py-2 cursor-pointer">
              <Checkbox
                checked={masterChecked}
                onCheckedChange={toggleAll}
              />
              <span className="text-sm font-medium">
                Select all ({selectedSubOrders.length}/{activeSubOrders.length})
              </span>
            </label>
            <div className="flex flex-col gap-1 rounded-md border p-1">
              {activeSubOrders.map(subOrder => (
                <label
                  key={subOrder.id}
                  className="flex items-start gap-2.5 rounded-sm px-2.5 py-2 hover:bg-muted cursor-pointer"
                >
                  <Checkbox
                    className="mt-0.5"
                    checked={!!selection[subOrder.id]}
                    onCheckedChange={() => toggle(subOrder.id)}
                  />
                  <span className="text-sm">{subOrderLabel(subOrder)}</span>
                </label>
              ))}
            </div>
          </section>
        )}

        <section className="flex flex-col gap-2">
          <h2 className="uppercase tracking-[0.06em] text-xs text-muted-foreground">
            New deadline (optional)
          </h2>
          <DateInput
            className="w-full h-12 min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50"
            value={newDeadline}
            onChange={e => setNewDeadline(e.target.value)}
            placeholder="No deadline — set later"
          />
        </section>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleDuplicate()}
            disabled={busy || blocksDuplicate}
          >
            {busy ? 'Duplicating…' : 'Duplicate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
