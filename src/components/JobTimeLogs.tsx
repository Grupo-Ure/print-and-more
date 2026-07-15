import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { formatDateDe } from '../lib/formatDate'
import type { TimeLogRow } from '../services/timeLogService'
import { useCreateTimeLog, useDeleteTimeLog, useTimeLogsByJobId } from '../queries/timeLogQueries'
import { useCurrentUser, useIsAdmin } from '../queries/userQueries'
import { EmployeeCombobox } from './fields/EmployeeCombobox'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { UserAvatar } from './UserAvatar'
import { useConfirm } from './ConfirmDialog'
import { useToast } from './Toast'

function formatMinutes(total: number): string {
  if (total < 60) return `${total} min`
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return minutes === 0 ? `${hours} h` : `${hours} h ${String(minutes).padStart(2, '0')} min`
}

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
  const { data: currentUser } = useCurrentUser()
  const { isAdmin } = useIsAdmin()
  const createLog = useCreateTimeLog()
  const deleteLog = useDeleteTimeLog()
  const confirm = useConfirm()
  const { showError } = useToast()

  const [minutesInput, setMinutesInput] = useState('')
  // Admin-only "log on behalf of" target; null = the signed-in user.
  const [onBehalfOf, setOnBehalfOf] = useState<{ id: string; name: string } | null>(null)

  const logs = logsQuery.data ?? []
  const total = logs.reduce((sum, log) => sum + log.minutes, 0)

  const parsedMinutes = parseInt(minutesInput, 10)
  const minutesValid = Number.isInteger(parsedMinutes) && parsedMinutes > 0

  const handleCreate = () => {
    if (!minutesValid || !currentUser || createLog.isPending) return
    const target = onBehalfOf ?? { id: currentUser.id, name: currentUser.name }
    createLog.mutate(
      { orderId, jobId, minutes: parsedMinutes, user: target },
      {
        onSuccess: () => setMinutesInput(''),
        onError: () => showError('Time could not be logged'),
      },
    )
  }

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
    // Full width inside the compact tab panel; fixed column width in the
    // desktop side-by-side layout (stable, never content-driven).
    <div className="flex w-full desktop:w-96 flex-col gap-2">
      <div className="text-[13px]">
        Total: <span className="font-semibold text-foreground">{formatMinutes(total)}</span>
      </div>

      {/* Fixed-height viewport: the list scrolls inside; the section never
          grows or shrinks with the number of entries. */}
      <div className="h-28 shrink-0 overflow-y-auto px-2 border-gray-200 border rounded-md">
        {logsQuery.isLoading ? (
          <p className="p-1 text-xs text-muted-foreground">Loading…</p>
        ) : logs.length === 0 ? (
          <p className="p-1 text-xs text-muted-foreground">No time logged yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border" aria-label="Time logs">
          {logs.map(log => (
            // fr-based columns resolve against the row width, so the entries
            // spread across it and line up between rows:
            // minutes | date | employee | delete action.
            <li key={log.id} className="group grid grid-cols-[1fr_1fr_2fr_auto] items-center gap-2 py-1 border-gray-200!">
              <span className="shrink-0 font-medium tabular-nums">{formatMinutes(log.minutes)}</span>
              <span className="shrink-0 text-muted-foreground tabular-nums">
                {formatDateDe(log.created_at)}
              </span>
              <span
                className="flex min-w-0 items-center gap-1.5"
                title={
                  log.created_by && log.created_by.id !== log.user?.id
                    ? `Logged by ${log.created_by.name}`
                    : undefined
                }
              >
                {log.user && <UserAvatar name={log.user.name} avatarUrl={log.user.avatar_url} />}
                <span className="truncate">{log.user?.name ?? '—'}</span>
                {log.created_by && log.created_by.id !== log.user?.id && (
                  <span className="text-[11px] text-muted-foreground shrink-0">(by {log.created_by.name})</span>
                )}
              </span>
              {isAdmin && !disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  title="Delete log"
                  aria-label="Delete log"
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
        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
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
          />
          {isAdmin && (
            <EmployeeCombobox
              value={onBehalfOf?.id ?? currentUser?.id ?? null}
              onChange={user => setOnBehalfOf(user)}
              disabled={createLog.isPending}
            />
          )}
          <Button
            type="button"
            variant="default"
            size="sm"
            disabled={!minutesValid || !currentUser || createLog.isPending}
            onClick={handleCreate}
          >
            <Plus />
            Log time
          </Button>
        </div>
      )}
    </div>
  )
}
