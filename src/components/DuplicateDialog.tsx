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
import { type Auftrag, type JobRow } from '../types/database'
import { JOB_DEPARTMENT_LABELS, jobDepartmentLabel } from '../const/departmentAbbreviation'
import { LFP_TYPE_LABELS } from '../types/lfp'
import { COPY_SHOP_TYPE_LABELS } from '../types/copyshop'
import { STAMP_TYPE_LABELS } from '../types/stamp'
import { LASER_TYPE_LABELS } from '../types/laser'
import { DateInput } from './DateInput'
import { useToast } from './Toast'

type Props = {
  order: Auftrag
  jobs: JobRow[]
  onSuccess: (neuerAuftrag: Auftrag) => void
  onCancel: () => void
}

function readableJobType(bereich: string, typ: string | null): string {
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

function jobLabel(job: JobRow): string {
  const department =
    job.department in JOB_DEPARTMENT_LABELS
      ? JOB_DEPARTMENT_LABELS[job.department as keyof typeof JOB_DEPARTMENT_LABELS]
      : jobDepartmentLabel(job.department)
  const type = readableJobType(job.department, job.type)
  return `${department} · ${type}`
}

export function DuplicateDialog({ order, jobs, onSuccess, onCancel }: Props) {
  const activeJobs = useMemo(() => jobs.filter(job => !job.is_cancelled), [jobs])

  const [selection, setSelection] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const job of activeJobs) initial[job.id] = true
    return initial
  })
  const [newDeadline, setNewDeadline] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { showError, showSuccess } = useToast()

  const selectedJobs = useMemo(
    () => activeJobs.filter(job => selection[job.id]),
    [activeJobs, selection]
  )
  const allSelected = activeJobs.length > 0 && selectedJobs.length === activeJobs.length
  const noneSelected = selectedJobs.length === 0
  const masterChecked: boolean | 'indeterminate' = allSelected ? true : noneSelected ? false : 'indeterminate'

  const blocksDuplicate = activeJobs.length > 0 && noneSelected
  const customerLabel = order.customers?.name?.trim() || order.id

  const toggle = (id: string) => {
    setSelection(previous => ({ ...previous, [id]: !previous[id] }))
  }

  const toggleAll = (next: boolean | 'indeterminate') => {
    const target = next === true || next === 'indeterminate'
    const updated: Record<string, boolean> = {}
    for (const job of activeJobs) updated[job.id] = target
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
        selected_job_ids: selectedJobs.map(job => job.id),
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
    } catch (duplicationError) {
      showError('Order could not be duplicated')
      setError(duplicationError instanceof Error ? duplicationError.message : String(duplicationError))
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

        {activeJobs.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="uppercase tracking-[0.06em] text-xs text-muted-foreground">
              Jobs
            </h2>
            <label className="flex items-center gap-2.5 rounded-md border bg-muted/40 px-3 py-2 cursor-pointer">
              <Checkbox
                checked={masterChecked}
                onCheckedChange={toggleAll}
              />
              <span className="text-sm font-medium">
                Select all ({selectedJobs.length}/{activeJobs.length})
              </span>
            </label>
            <div className="flex flex-col gap-1 rounded-md border p-1">
              {activeJobs.map(job => (
                <label
                  key={job.id}
                  className="flex items-start gap-2.5 rounded-sm px-2.5 py-2 hover:bg-muted cursor-pointer"
                >
                  <Checkbox
                    className="mt-0.5"
                    checked={!!selection[job.id]}
                    onCheckedChange={() => toggle(job.id)}
                  />
                  <span className="text-sm">{jobLabel(job)}</span>
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
            onChange={event => setNewDeadline(event.target.value)}
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
