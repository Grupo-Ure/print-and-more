import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import type { HistoryRow } from '../services/historyService'
import { useHistoryForOrder } from '../queries/historyQueries'
import { useJobsByOrderId } from '../queries/jobQueries'
import { useUsers } from '../queries/userQueries'
import { JOB_STATUS_META, ORDER_STATUS_META, type StatusMeta } from '../const/orderStatus'
import { COPY_SHOP_TYPE_LABELS } from '../types/copyshop'
import { LASER_TYPE_LABELS } from '../types/laser'
import { LFP_TYPE_LABELS } from '../types/lfp'
import { STAMP_TYPE_LABELS } from '../types/stamp'
import { cn } from '../lib/utils'

/** Human labels for every product type, for the PRODUCT_* sentences. */
const PRODUCT_TYPE_LABELS: Record<string, string> = {
  ...COPY_SHOP_TYPE_LABELS,
  ...LASER_TYPE_LABELS,
  ...LFP_TYPE_LABELS,
  ...STAMP_TYPE_LABELS,
  TEXTILE_GARMENT: 'Garment',
  OTHER: 'Product',
}

/** SETTINGS_CHANGED meta.field → the word used in the sentence. */
const SETTING_FIELD_LABELS: Record<string, string> = {
  deadline: 'deadline',
  delivery: 'delivery type',
  priority: 'priority',
}

/** SETTINGS_CHANGED meta value → display text (dates formatted, enums labelled). */
function settingValueText(field: string, value: unknown): string | null {
  if (value == null || value === '') return null
  const raw = String(value)
  if (field === 'deadline') {
    const date = new Date(raw)
    return Number.isNaN(date.getTime())
      ? raw
      : date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })
  }
  const labels: Record<string, string> = { PICKUP: 'Pickup', SHIPPING: 'Shipping', HIGH: 'High', NORMAL: 'Normal' }
  return labels[raw] ?? raw
}

function formatHistoryTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function metaRecord(entry: HistoryRow): Record<string, unknown> | null {
  const meta = entry.meta
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null
  return meta as Record<string, unknown>
}

/** Name from a meta snapshot (written at event time), falling back to the current users map. */
function metaName(
  meta: Record<string, unknown> | null,
  nameKey: string,
  idKey: string,
  staffById: Map<string, string>,
): string | null {
  if (!meta) return null
  const name = meta[nameKey]
  if (typeof name === 'string' && name) return name
  const id = meta[idKey]
  if (typeof id === 'string' && id) return staffById.get(id) ?? '—'
  return null
}

/**
 * A sentence is a list of segments so each part can carry its own styling:
 * plain strings render as-is, persons/jobs get a colour highlight, statuses
 * render as a chip in the status' actual colour.
 */
type Segment =
  | string
  | { kind: 'person'; text: string }
  | { kind: 'job'; text: string }
  | { kind: 'duration'; text: string }
  | { kind: 'status'; meta: StatusMeta }

function segmentText(segment: Segment): string {
  if (typeof segment === 'string') return segment
  return segment.kind === 'status' ? segment.meta.label : segment.text
}

/**
 * One human sentence per event: "Brian moved LFP-01 to <Prepress>",
 * "Brian logged 45 min for Anna on TEX-02". The date is prefixed by the
 * renderer so it can be styled separately.
 */
function historySegments(
  entry: HistoryRow,
  jobLabel: string | null,
  staffById: Map<string, string>,
): Segment[] {
  const actor: Segment = {
    kind: 'person',
    text: entry.user_id ? (staffById.get(entry.user_id) ?? 'Someone') : 'The system',
  }
  const job: Segment = jobLabel ? { kind: 'job', text: jobLabel } : 'a job'
  const meta = metaRecord(entry)

  switch (entry.event_type) {
    case 'ORDER_CREATED':
      return [actor, ' created the order']
    case 'PROCESSING_STARTED':
      return [actor, ' moved the order to ', { kind: 'status', meta: ORDER_STATUS_META.IN_PROGRESS }]
    case 'PREPRESS_READY_AUTO':
      return [job, ' became ready for ', { kind: 'status', meta: JOB_STATUS_META.PREPRESS }]
    case 'PREPRESS_READY_MANUAL':
      return [actor, ' moved ', job, ' to ', { kind: 'status', meta: JOB_STATUS_META.PREPRESS }]
    case 'PRODUCTION_READY_SET':
      return [actor, ' released ', job, ' to ', { kind: 'status', meta: JOB_STATUS_META.IN_PRODUCTION }]
    case 'MARKED_DONE':
      return [actor, ' marked ', job, ' as ', { kind: 'status', meta: JOB_STATUS_META.DONE }]
    case 'ORDER_FINISHED':
      return [actor, ' marked the order as ', { kind: 'status', meta: ORDER_STATUS_META.FINISHED }]
    case 'ORDER_REOPENED':
      return [actor, ' reopened the order']
    case 'ORDER_BILLED':
      return [actor, ' marked the order as ', { kind: 'status', meta: ORDER_STATUS_META.BILLED }]
    case 'EMERGENCY_TRIGGERED':
      return [actor, ' force-released ', job, ' to ', { kind: 'status', meta: JOB_STATUS_META.IN_PRODUCTION }]
    case 'CUSTOMER_APPROVAL_ACTIVATED':
      return [actor, ' requested customer approval for ', job]
    case 'CUSTOMER_APPROVAL_DEACTIVATED':
      return [actor, ' removed the customer-approval requirement for ', job]
    case 'CUSTOMER_APPROVAL_GRANTED':
      return [actor, ' granted customer approval for ', job]
    case 'CUSTOMER_APPROVAL_EXPIRED':
      return ['Customer approval for ', job, ' expired']
    case 'CUSTOMER_APPROVAL_BYPASSED':
      return [actor, ' bypassed customer approval for ', job]
    case 'ROLLED_BACK':
      return [
        'A content change moved ',
        jobLabel ? job : 'a job',
        ' back to ',
        { kind: 'status', meta: JOB_STATUS_META.IN_SETUP },
      ]
    case 'ERP_EXPORTED':
      return [actor, ' exported the order to ERP']
    case 'CANCELLED':
      return [actor, ' cancelled the order']
    case 'ORDER_ARCHIVED':
      return [actor, ' archived the order']
    case 'JOB_CREATED':
      return [actor, ' created ', job]
    case 'JOB_CANCELLED':
      return [actor, ' cancelled ', job]
    case 'JOB_DELETED': {
      // The job row is gone (job_id is null); its number was snapshotted into meta.
      const number =
        typeof meta?.job_number === 'string' ? meta.job_number.split('-').slice(-2).join('-') : null
      return [actor, ' deleted ', number ? { kind: 'job', text: number } : 'a job']
    }
    case 'SETTINGS_CHANGED': {
      const field = typeof meta?.field === 'string' ? meta.field : null
      const fieldLabel = (field && SETTING_FIELD_LABELS[field]) ?? 'settings'
      const next = field ? settingValueText(field, meta?.next) : null
      if (jobLabel) {
        // Job override: next null = the override was cleared back to the order's value.
        if (!next) return [actor, ` reset the ${fieldLabel} of `, job, " to the order's"]
        return [actor, ` set the ${fieldLabel} of `, job, ` to ${next}`]
      }
      if (!next) return [actor, ` cleared the order's ${fieldLabel}`]
      const previous = field ? settingValueText(field, meta?.previous) : null
      return [actor, ` changed the order's ${fieldLabel}${previous ? ` from ${previous}` : ''} to ${next}`]
    }
    case 'PRODUCT_CREATED':
    case 'PRODUCT_UPDATED':
    case 'PRODUCT_DELETED': {
      const type = typeof meta?.type === 'string' ? meta.type : null
      const product = (type && PRODUCT_TYPE_LABELS[type]) ?? 'a product'
      const quantity = typeof meta?.quantity === 'number' ? `${meta.quantity}× ` : ''
      const named = `${quantity}${product}`
      if (entry.event_type === 'PRODUCT_CREATED') return [actor, ` added ${named} to `, job]
      if (entry.event_type === 'PRODUCT_UPDATED') return [actor, ` updated ${named} on `, job]
      return [actor, ` removed ${named} from `, job]
    }
    case 'FILE_ADDED':
    case 'FILE_REMOVED': {
      const name = typeof meta?.display_name === 'string' ? meta.display_name : 'a file'
      return entry.event_type === 'FILE_ADDED'
        ? [actor, ` added file ${name}`]
        : [actor, ` removed file ${name}`]
    }
    case 'ASSIGNEE_CHANGED': {
      const previous = metaName(meta, 'previous_assignee_name', 'previous_assignee_id', staffById)
      const next = metaName(meta, 'new_assignee_name', 'new_assignee_id', staffById)
      if (next && previous)
        return [actor, ' reassigned ', job, ' from ', { kind: 'person', text: previous }, ' to ', { kind: 'person', text: next }]
      if (next) return [actor, ' assigned ', job, ' to ', { kind: 'person', text: next }]
      if (previous) return [actor, ' unassigned ', { kind: 'person', text: previous }, ' from ', job]
      return [actor, ' changed the assignee of ', job]
    }
    case 'TIME_LOGGED':
    case 'TIME_LOG_DELETED': {
      const minutes: Segment =
        typeof meta?.minutes === 'number' ? { kind: 'duration', text: `${meta.minutes} min` } : 'time'
      const attributed = metaName(meta, 'user_name', 'user_id', staffById)
      const forWhom: Segment[] =
        attributed && meta?.user_id !== entry.user_id ? [' for ', { kind: 'person', text: attributed }] : []
      return entry.event_type === 'TIME_LOGGED'
        ? [actor, ' logged ', minutes, ...forWhom, ' on ', job]
        : [actor, ' deleted a ', minutes, ' log', ...forWhom, ' on ', job]
    }
    default:
      return [actor, `: ${(entry.event_type as string).replace(/_/g, ' ').toLowerCase()}`, ...(jobLabel ? [' (', job, ')'] : [])]
  }
}

type Props = {
  orderId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OrderHistoryDialog({ orderId, open, onOpenChange }: Props) {
  const historyQuery = useHistoryForOrder(open ? orderId : null)
  const jobsQuery = useJobsByOrderId(open ? orderId : null)
  const { data: users } = useUsers()

  const staffById = new Map((users ?? []).map(user => [user.id, user.name ?? user.id]))
  const jobs = jobsQuery.data ?? []
  const entries = historyQuery.data ?? []

  // "LFP-01" — the job number without the redundant order-number prefix
  // (every entry in this dialog belongs to the same order).
  const jobShortNumber = (jobId: string | null): string | null => {
    if (!jobId) return null
    const jobNumber = jobs.find(job => job.id === jobId)?.job_number
    return jobNumber ? jobNumber.split('-').slice(-2).join('-') : 'Job'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Order history</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {historyQuery.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {historyQuery.isError && (
            <p className="text-sm text-destructive">History could not be loaded</p>
          )}
          {historyQuery.isSuccess && entries.length === 0 && (
            <p className="text-sm text-muted-foreground">No history entries yet</p>
          )}
          {entries.length > 0 && (
            <ul className="divide-y divide-border">
              {entries.map(entry => (
                <HistoryItem
                  key={entry.id}
                  entry={entry}
                  jobLabel={jobShortNumber(entry.job_id)}
                  staffById={staffById}
                />
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

type HistoryItemProps = {
  entry: HistoryRow
  /** Short job number ("LFP-01") for job-scoped entries; null = order-scoped. */
  jobLabel: string | null
  staffById: Map<string, string>
}

/**
 * One history entry as a single styled sentence line: the date first in muted
 * gray, then the sentence — persons in the brand colour, job numbers in sky,
 * statuses as text in their own status colour. Every item is one line high; overflow truncates
 * with the full plain-text sentence in the title tooltip.
 */
function HistoryItem({ entry, jobLabel, staffById }: HistoryItemProps) {
  const segments = historySegments(entry, jobLabel, staffById)
  const time = formatHistoryTime(entry.created_at)
  const plain = `${time} — ${segments.map(segmentText).join('')}${entry.reason ? ` — ${entry.reason}` : ''}`

  return (
    <li className="py-1.5 text-sm">
      <p className="truncate" title={plain}>
        <span className="text-muted-foreground">{time}</span>
        <span className="text-muted-foreground"> — </span>
        {segments.map((segment, i) => {
          if (typeof segment === 'string') return <span key={i}>{segment}</span>
          if (segment.kind === 'person')
            return (
              <span key={i} className="font-medium text-pink-800">
                {segment.text}
              </span>
            )
          if (segment.kind === 'job')
            return (
              <span key={i} className="font-medium text-sky-600 dark:text-sky-400">
                {segment.text}
              </span>
            )
          if (segment.kind === 'duration')
            return (
              <span key={i} className="font-medium text-primary">
                {segment.text}
              </span>
            )
          return (
            <span key={i} className={cn('font-medium', segment.meta.textColor)}>
              {segment.meta.label}
            </span>
          )
        })}
        {entry.reason && <span className="text-muted-foreground"> — {entry.reason}</span>}
      </p>
    </li>
  )
}
