import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { HistoryRow } from '../services/historyService'
import { historyKeys, useHistoryForOrder } from '../queries/historyQueries'
import { useUsers } from '../queries/userQueries'
import { jobDepartmentLabel } from '../const/departmentAbbreviation'
import { useToast } from './Toast'
import './ContextPanel.css'

type Props = {
  activeOrderId: string
  contextRefreshTick: number
  jobs: { id: string; department: string }[]
}


const EVENT_LABELS: Record<string, string> = {
  ORDER_CREATED: 'Order created',
  PROCESSING_STARTED: 'Processing started',
  PREPRESS_READY_AUTO: 'PrePress — automatic',
  PREPRESS_READY_MANUAL: 'PrePress — manual',
  PRODUCTION_READY_SET: 'Released to production',
  MARKED_DONE: 'Job marked as done',
  ORDER_FINISHED: 'Order marked finished',
  ORDER_REOPENED: 'Order reopened',
  ORDER_BILLED: 'Order invoiced',
  EMERGENCY_TRIGGERED: 'Emergency triggered',
  CUSTOMER_APPROVAL_ACTIVATED: 'Customer approval activated',
  CUSTOMER_APPROVAL_GRANTED: 'Customer approval granted',
  CUSTOMER_APPROVAL_EXPIRED: 'Customer approval expired',
  CUSTOMER_APPROVAL_BYPASSED: 'Customer approval bypassed',
  ROLLED_BACK: 'Rolled back',
  ERP_EXPORTED: 'ERP exported',
  CANCELLED: 'Order cancelled',
  ASSIGNEE_CHANGED: 'Assignee changed',
}

function eventLabel(art: string): string {
  return EVENT_LABELS[art] ?? art.replace(/_/g, ' ')
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

/**
 * "previous → new" line for ASSIGNEE_CHANGED. Names are snapshotted into meta
 * at write time; fall back to the current users map, then to a dash.
 */
function assigneeChangeLine(entry: HistoryRow, staffById: Map<string, string>): string | null {
  const meta = entry.meta
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null
  const resolve = (idKey: string, nameKey: string): string => {
    const name = (meta as Record<string, unknown>)[nameKey]
    if (typeof name === 'string' && name) return name
    const id = (meta as Record<string, unknown>)[idKey]
    if (typeof id === 'string' && id) return staffById.get(id) ?? '—'
    return 'Unassigned'
  }
  return `${resolve('previous_assignee_id', 'previous_assignee_name')} → ${resolve('new_assignee_id', 'new_assignee_name')}`
}

export function HistoryPanel({ activeOrderId, contextRefreshTick, jobs }: Props) {
  const { showError } = useToast()
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)

  const { data: users, isError: usersError } = useUsers()
  const staffById = new Map((users ?? []).map(user => [user.id, user.name ?? user.id]))

  const historyQuery = useHistoryForOrder(activeOrderId)
  const entries = historyQuery.data ?? []
  const loading = historyQuery.isLoading

  // ContextPanel signals its own mutations through the tick — re-fetch then.
  useEffect(() => {
    if (contextRefreshTick > 0) {
      void queryClient.invalidateQueries({ queryKey: historyKeys.byOrderId(activeOrderId) })
    }
  }, [contextRefreshTick, activeOrderId, queryClient])

  useEffect(() => {
    if (usersError) showError('Staff data could not be loaded')
  }, [usersError, showError])

  useEffect(() => {
    if (historyQuery.isError) showError('History could not be loaded')
  }, [historyQuery.isError, showError])

  const jobDepartment = (jobId: string | null): string | null => {
    if (!jobId) return null
    return jobs.find(job => job.id === jobId)?.department ?? null
  }

  return (
    <div className="cp-hist">
      <button
        type="button"
        className="cp-hist-btn"
        onClick={() => setExpanded(previous => !previous)}
        aria-expanded={expanded}
      >
        <span>History {expanded ? '▼' : '▶'}</span>
      </button>

      {expanded && (
        <div className="cp-hist-body">
          {loading && <p className="cp-hinweis" style={{ margin: '0.25rem 0' }}>Loading…</p>}
          {!loading && entries.length === 0 && (
            <p className="cp-hinweis" style={{ margin: '0.25rem 0' }}>
              No history entries yet
            </p>
          )}
          {!loading &&
            entries.map(entry => {
              const staffName = entry.user_id ? staffById.get(entry.user_id) : ''
              const department = jobDepartment(entry.job_id)
              const assigneeChange =
                entry.event_type === 'ASSIGNEE_CHANGED' ? assigneeChangeLine(entry, staffById) : null
              return (
                <div key={entry.id} className="cp-hist-eintrag">
                  <div className="cp-hist-zeile" title={eventLabel(entry.event_type)}>
                    <span className="cp-hist-time">{formatHistoryTime(entry.created_at)}</span>
                    <span className="cp-hist-evt">{eventLabel(entry.event_type)}</span>
                    <span className="cp-hist-who">{staffName || '—'}</span>
                  </div>
                  {assigneeChange && <p className="cp-hist-sub">{assigneeChange}</p>}
                  {entry.reason && <p className="cp-hist-sub">{entry.reason}</p>}
                  {department && <p className="cp-hist-tl">Job: {jobDepartmentLabel(department)}</p>}
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
