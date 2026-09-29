import { useState } from 'react'
import { Clock, List, Plus, Trash2 } from 'lucide-react'
import { formatDateDe } from '../lib/formatDate'
import { formatMinutes } from '../lib/formatMinutes'
import { cn } from '../lib/utils'
import type { TimeLogRow } from '../services/timeLogService'
import {
  useCreateTimeLog,
  useDeleteTimeLog,
  useTimeLogMinutesByOrderId,
  useTimeLogsByJobId,
} from '../queries/timeLogQueries'
import { useCurrentUser, useIsAdmin } from '../queries/userQueries'
import { EmployeeCombobox } from './fields/EmployeeCombobox'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { UserAvatar } from './UserAvatar'
import { useConfirm } from './ConfirmDialog'
import { useToast } from './Toast'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.orders.jobDetail.timeLogs
const QUICK_IDS = TEST_IDS.orders.jobDetail.quickTimeLog

/**
 * Worked-time log for one job: total, the individual entries (minutes, date,
 * attributed employee), and a form to log a new entry. Time is attributed to
 * the signed-in user; admins may pick someone else (RLS enforces both).
 * Admins can also delete a mistaken entry — every create/delete is written
 * to history by the service.
 */
export function JobTimeLogs({
  orderId,
  jobId,
  disabled,
}: {
  orderId: string
  jobId: string
  /** True once the job is DONE — the log becomes read-only. */
  disabled: boolean
}) {
  const logsQuery = useTimeLogsByJobId(jobId)
  const { isAdmin } = useIsAdmin()
  const deleteLog = useDeleteTimeLog()
  const confirm = useConfirm()
  const { showError } = useToast()

  const logs = logsQuery.data ?? []
  const total = logs.reduce((sum, log) => sum + log.minutes, 0)

  const handleDelete = async (log: TimeLogRow) => {
    const confirmed = await confirm({
      title: 'Delete this time log?',
      description: `${formatMinutes(log.minutes)} logged for ${log.user?.name ?? 'unknown'} on ${formatDateDe(log.created_at)}.`,
      confirmLabel: 'Delete log',
      destructive: true,
    })
    if (!confirmed) return
    deleteLog.mutate(
      { orderId, log },
      { onError: () => showError('Time log could not be deleted') },
    )
  }

  return (
    // Rendered as the job's Time logs tab; the job detail's column scrolls.
    <div data-testid={IDS.root} className="flex flex-col gap-2">
      <div className="text-base">
        Total:{' '}
        <span data-testid={IDS.total} data-minutes={total} className="font-semibold text-foreground tabular-nums">
          {formatMinutes(total)}
        </span>
      </div>

      {/* min-h keeps the entry form from jumping while the list loads. */}
      <div className="min-h-24">
        {logsQuery.isLoading ? (
          <p className="text-sm! text-muted-foreground">Loading…</p>
        ) : logs.length === 0 ? (
          <p data-testid={IDS.empty} className="text-sm! text-muted-foreground">No time logged yet.</p>
        ) : (
          <ul data-testid={IDS.list} className="divide-y divide-border" aria-label="Time logs">
          {logs.map(log => (
            <li
              key={log.id}
              data-testid={IDS.item}
              data-log-id={log.id}
              data-minutes={log.minutes}
              // Roomy rows: little information per entry, so larger type
              // makes the log readable at a glance.
              className="group grid grid-cols-[1fr_1fr_2fr_auto] items-center gap-3 py-3 text-base"
            >
              <span className="shrink-0 font-semibold tabular-nums">{formatMinutes(log.minutes)}</span>
              <span className="shrink-0 text-muted-foreground tabular-nums">
                {formatDateDe(log.created_at)}
              </span>
              <span
                className="flex min-w-0 items-center gap-2"
                title={
                  log.created_by && log.created_by.id !== log.user?.id
                    ? `Logged by ${log.created_by.name}`
                    : undefined
                }
              >
                {log.user && (
                  <UserAvatar name={log.user.name} avatarUrl={log.user.avatar_url} className="size-8 text-base" />
                )}
                <span className="truncate">{log.user?.name ?? '—'}</span>
                {log.created_by && log.created_by.id !== log.user?.id && (
                  <span className="shrink-0 text-sm text-muted-foreground">(by {log.created_by.name})</span>
                )}
              </span>
              {isAdmin && !disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title="Delete log"
                  aria-label="Delete log"
                  data-testid={IDS.itemDelete}
                  className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-destructive hover:text-destructive"
                  disabled={deleteLog.isPending}
                  onClick={() => void handleDelete(log)}
                >
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
          </ul>
        )}
      </div>

      {!disabled && (
        <div className="shrink-0 border-t pt-3">
          <TimeLogEntryForm orderId={orderId} jobId={jobId} ids={IDS} />
        </div>
      )}
    </div>
  )
}

/**
 * Quick-log widget for the job's Products tab: log time for the job at hand
 * without opening the Time logs tab. Shows the job's total so the entry is
 * visibly counted, and a shortcut to the full log. Not rendered for a DONE
 * job — the caller decides, as with the tab.
 */
export function QuickTimeLog({
  orderId,
  jobId,
  onShowAll,
  className,
}: {
  orderId: string
  jobId: string
  /** Switches the job detail to the Time logs tab. */
  onShowAll: () => void
  className?: string
}) {
  // The per-order minute map is already loaded for the job list, so the
  // total costs no extra request here (the mutation invalidates it).
  const minutesQuery = useTimeLogMinutesByOrderId(orderId)
  const total = minutesQuery.data?.[jobId] ?? 0

  return (
    <section
      data-testid={QUICK_IDS.root}
      aria-label="Log time"
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md border bg-muted/40 px-3 py-2',
        className,
      )}
    >
      <div className="flex items-center gap-2 text-sm">
        <Clock className="size-4 text-muted-foreground" />
        <span className="font-medium">Log time</span>
        <span className="text-muted-foreground">
          Logged so far:{' '}
          <span data-testid={QUICK_IDS.total} data-minutes={total} className="font-semibold text-foreground tabular-nums">
            {formatMinutes(total)}
          </span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <TimeLogEntryForm orderId={orderId} jobId={jobId} ids={QUICK_IDS} announceSuccess />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid={QUICK_IDS.showAll}
          onClick={onShowAll}
        >
          <List />
          All logs
        </Button>
      </div>
    </section>
  )
}

/**
 * The entry form shared by the tab and the quick-log widget: minutes, the
 * admin-only "on behalf of" picker, and the submit button. Time is attributed
 * to the signed-in user unless an admin picks someone else (RLS enforces both).
 */
function TimeLogEntryForm({
  orderId,
  jobId,
  ids,
  announceSuccess = false,
}: {
  orderId: string
  jobId: string
  ids: { minutes: string; onBehalfOf: string; submit: string }
  /** Toast on success — for the widget, where the new entry is not shown in a list. */
  announceSuccess?: boolean
}) {
  const { data: currentUser } = useCurrentUser()
  const { isAdmin } = useIsAdmin()
  const createLog = useCreateTimeLog()
  const { showError, showSuccess } = useToast()

  const [minutesInput, setMinutesInput] = useState('')
  // Admin-only "log on behalf of" target; null = the signed-in user.
  const [onBehalfOf, setOnBehalfOf] = useState<{ id: string; name: string } | null>(null)

  const parsedMinutes = parseInt(minutesInput, 10)
  const minutesValid = Number.isInteger(parsedMinutes) && parsedMinutes > 0

  const handleCreate = () => {
    if (!minutesValid || !currentUser || createLog.isPending) return
    const target = onBehalfOf ?? { id: currentUser.id, name: currentUser.name }
    createLog.mutate(
      { orderId, jobId, minutes: parsedMinutes, user: target },
      {
        onSuccess: () => {
          setMinutesInput('')
          if (announceSuccess) showSuccess(`${formatMinutes(parsedMinutes)} logged for ${target.name}`)
        },
        onError: () => showError('Time could not be logged'),
      },
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Input
        type="number"
        min={1}
        placeholder="min"
        className="w-20 h-8 text-sm"
        value={minutesInput}
        onChange={e => setMinutesInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') handleCreate()
        }}
        aria-label="Minutes to log"
        data-testid={ids.minutes}
      />
      {isAdmin && (
        <EmployeeCombobox
          testId={ids.onBehalfOf}
          value={onBehalfOf?.id ?? currentUser?.id ?? null}
          onChange={user => setOnBehalfOf(user)}
          disabled={createLog.isPending}
        />
      )}
      <Button
        type="button"
        variant="default"
        size="sm"
        data-testid={ids.submit}
        disabled={!minutesValid || !currentUser || createLog.isPending}
        onClick={handleCreate}
      >
        <Plus />
        Log time
      </Button>
    </div>
  )
}
