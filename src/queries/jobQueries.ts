import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { jobService } from '../services/jobService'
import { historyService, type HistoryEvent } from '../services/historyService'
import { productionReleaseService } from '../services/productionReleaseService'
import { resolveEffectiveJob } from '../lib/jobShared'
import type { JobRow, JobStatus } from '../types/database'
import type { Database } from '../types/supabase'
import { orderKeys, useOrderById } from './orderQueries'
import { historyKeys } from './historyQueries'
import { stockAvailabilityKeys } from './stockQueries'

import type { JobInsert } from '../services/jobService'
type JobUpdate = Database['public']['Tables']['jobs']['Update']

type HistoryParams = { event_type: HistoryEvent; reason?: string; meta?: Record<string, unknown> }

export const jobKeys = {
  all: ['jobs'] as const,
  byOrderId: (orderId: string) => ['jobs', 'by-order-id', orderId] as const,
}

export function useJobsByOrderId(orderId: string | null) {
  return useQuery({
    queryKey: orderId ? jobKeys.byOrderId(orderId) : jobKeys.byOrderId('__none__'),
    queryFn: () => jobService.getJobsByOrderId(orderId as string),
    enabled: !!orderId,
  })
}

/** Imperative on-demand fetch through the cache (e.g. opening the duplicate dialog). */
export function fetchJobsByOrderId(queryClient: QueryClient, orderId: string) {
  return queryClient.fetchQuery({
    queryKey: jobKeys.byOrderId(orderId),
    queryFn: () => jobService.getJobsByOrderId(orderId),
  })
}

/**
 * Refresh the order lists after a job change. Order status is a manual,
 * independent lifecycle (no aggregation from jobs), but the sidebar still shows
 * job-derived data (e.g. the in-production-missing-info warning), so the lists
 * are invalidated whenever a job changes.
 */
function invalidateOrderLists(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: orderKeys.lists })
}

function patchJobInCache(queryClient: QueryClient, orderId: string, row: JobRow): void {
  queryClient.setQueryData<JobRow[]>(
    jobKeys.byOrderId(orderId),
    old => old?.map(r => (r.id === row.id ? row : r)) ?? old,
  )
}

/**
 * Persist a job status directly (no hook), patching the job cache. Used by the
 * status helpers that run outside a component — notably
 * {@link bounceBackIfCommitted}.
 */
export async function persistJobStatus(
  queryClient: QueryClient,
  id: string,
  orderId: string,
  status: JobStatus,
): Promise<void> {
  const row = await jobService.setJobStatus(id, status)
  patchJobInCache(queryClient, orderId, row)
  invalidateOrderLists(queryClient)
}

/** Locate a job by id across the cached per-order lists (gives status + order_id). */
function findCachedJob(queryClient: QueryClient, jobId: string): JobRow | null {
  const entries = queryClient.getQueriesData<JobRow[]>({ queryKey: jobKeys.all })
  for (const [, list] of entries) {
    const found = list?.find(s => s.id === jobId)
    if (found) return found
  }
  return null
}

/**
 * Bounce-back: if the job is committed (IN_PRODUCTION / DONE), drop it to
 * IN_SETUP. Called from the content mutations' `onSuccess` *only when the change was
 * meaningful* (see `isMeaningfulChange`). No-op for non-committed jobs, so the
 * caller doesn't need to know the current status.
 */
export async function bounceBackIfCommitted(queryClient: QueryClient, jobId: string): Promise<void> {
  const job = findCachedJob(queryClient, jobId)
  if (!job) return
  if (job.status !== 'IN_PRODUCTION' && job.status !== 'DONE') return
  await persistJobStatus(queryClient, job.id, job.order_id, 'IN_SETUP')
  await historyService.tryWriteHistory({
    order_id: job.order_id,
    job_id: job.id,
    event_type: 'ROLLED_BACK',
    meta: { previous_status: job.status },
  })
}

/**
 * The raw active job row, selected from the cached `useJobsByOrderId` list
 * by id. Returns `null` until the list has loaded or if no match. This is the *raw*
 * row (inherited common fields still null) — use it when you need the override/inherit
 * state (e.g. JobDetail's inheritance toggles). For the resolved fields use
 * {@link useEffectiveJob}.
 */
export function useJobById(orderId: string | null, jobId: string | null): JobRow | null {
  const { data: jobs } = useJobsByOrderId(orderId)
  return jobs?.find(s => s.id === jobId) ?? null
}

/**
 * The active job with its inherited common fields resolved against the order
 * (see {@link resolveEffectiveJob}). Composes {@link useJobById} +
 * `useOrderById` from the cache; returns `null` until both have loaded. Use this
 * wherever completeness/validation needs the *effective* fields rather than the raw
 * (inheriting) columns.
 */
export function useEffectiveJob(
  orderId: string | null,
  jobId: string | null,
): JobRow | null {
  const job = useJobById(orderId, jobId)
  const { data: order } = useOrderById(orderId)
  // Memoize so the resolved row keeps a stable reference between renders (it only
  // changes when the job or order data changes) — important for consumers that
  // use it as an effect dependency (the status manager).
  return useMemo(
    () => (job && order ? resolveEffectiveJob(job, order) : null),
    [job, order],
  )
}

export function useCreateJob() {
  const queryClient = useQueryClient()
  return useMutation<JobRow, Error, JobInsert>({
    mutationFn: async payload => {
      const created = await jobService.createJob(payload)
      await historyService.tryWriteHistory({
        order_id: created.order_id,
        job_id: created.id,
        event_type: 'JOB_CREATED',
        meta: { job_number: created.job_number, department: created.department },
      })
      return created
    },
    onSuccess: created => {
      const orderId = created.order_id
      const cachedSiblings = queryClient.getQueryData<JobRow[]>(jobKeys.byOrderId(orderId)) ?? []
      queryClient.setQueryData<JobRow[]>(jobKeys.byOrderId(orderId), [...cachedSiblings, created])
      invalidateOrderLists(queryClient)
    },
  })
}

/**
 * Optimistic job field update. `orderId` is required so `onMutate` can
 * locate the cached sibling list and patch the row in place immediately (instant
 * UI); the snapshot is restored on error. Note: this persists the given fields
 * only — it does NOT recompute status (status calculation is decoupled; see
 * STATUS_WORKFLOW_SPEC.md). Status transitions live in ContextPanel.
 */
export function useUpdateJob() {
  const queryClient = useQueryClient()
  return useMutation<
    JobRow,
    Error,
    { id: string; orderId: string; patch: JobUpdate; history?: HistoryParams },
    { previous?: JobRow[] }
  >({
    mutationFn: async ({ id, orderId, patch, history }) => {
      const row = await jobService.updateJob(id, patch)
      if (history) await historyService.tryWriteHistory({ order_id: orderId, job_id: id, ...history })
      return row
    },
    onMutate: async ({ id, orderId, patch }) => {
      await queryClient.cancelQueries({ queryKey: jobKeys.byOrderId(orderId) })
      const previous = queryClient.getQueryData<JobRow[]>(jobKeys.byOrderId(orderId))
      queryClient.setQueryData<JobRow[]>(
        jobKeys.byOrderId(orderId),
        old => old?.map(row => (row.id === id ? ({ ...row, ...patch } as JobRow) : row)) ?? old,
      )
      return { previous }
    },
    onError: (_err, { orderId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(jobKeys.byOrderId(orderId), context.previous)
      }
    },
    onSuccess: updated => {
      queryClient.setQueryData<JobRow[]>(
        jobKeys.byOrderId(updated.order_id),
        old => old?.map(row => (row.id === updated.id ? updated : row)) ?? old,
      )
    },
    onSettled: (_data, _err, { orderId }) => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.byId(orderId) })
      void queryClient.invalidateQueries({ queryKey: orderKeys.lists })
    },
  })
}

/** Manual status transition (prepress / production / done). Optionally writes a history entry. */
export function useSetJobStatus() {
  const queryClient = useQueryClient()
  return useMutation<
    JobRow,
    Error,
    { id: string; orderId: string; status: JobStatus; history?: HistoryParams }
  >({
    mutationFn: async ({ id, orderId, status, history }) => {
      const row = await jobService.setJobStatus(id, status)
      if (history) await historyService.tryWriteHistory({ order_id: orderId, job_id: id, ...history })
      return row
    },
    onSuccess: (row, { orderId }) => {
      patchJobInCache(queryClient, orderId, row)
      invalidateOrderLists(queryClient)
    },
  })
}

/**
 * Release to production: book stock deductions (stamp/textile), set
 * IN_PRODUCTION, write the PRODUCTION_READY_SET history entry. The stock
 * deduction runs before the status write and is all-or-nothing: on
 * insufficient stock it throws InsufficientStockError and the job stays in
 * pre-press.
 */
export function useReleaseToProduction() {
  const queryClient = useQueryClient()
  return useMutation<JobRow, Error, { job: JobRow; orderId: string; orderNumber: string | null }>({
    mutationFn: async ({ job, orderId, orderNumber }) => {
      await productionReleaseService.deductProductionStock(job, orderNumber)
      const row = await jobService.setJobStatus(job.id, 'IN_PRODUCTION')
      await historyService.tryWriteHistory({
        order_id: orderId,
        job_id: job.id,
        event_type: 'PRODUCTION_READY_SET',
      })
      return row
    },
    onSuccess: (row, { orderId }) => {
      patchJobInCache(queryClient, orderId, row)
      invalidateOrderLists(queryClient)
      // Stock changed — other pre-press jobs' availability may have too.
      void queryClient.invalidateQueries({ queryKey: stockAvailabilityKeys.root })
    },
  })
}

/**
 * Emergency force release: bypass the completeness/prepress gate and put the
 * job straight into IN_PRODUCTION. Books the same stock deductions as the
 * regular release and writes an EMERGENCY_TRIGGERED history entry with the
 * reason — history is the sole record of the override. IN_PRODUCTION is
 * outside the automatic status band, so the status manager leaves the job alone.
 * The stock gate is bypassed too: available stock is deducted (floored at 0)
 * and the movements record what was actually taken.
 */
export function useForceReleaseToProduction() {
  const queryClient = useQueryClient()
  return useMutation<
    JobRow,
    Error,
    { job: JobRow; orderId: string; orderNumber: string | null; reason: string }
  >({
    mutationFn: async ({ job, orderId, orderNumber, reason }) => {
      await productionReleaseService.deductProductionStock(job, orderNumber, { allowShortage: true })
      const row = await jobService.setJobStatus(job.id, 'IN_PRODUCTION')
      await historyService.tryWriteHistory({
        order_id: orderId,
        job_id: job.id,
        event_type: 'EMERGENCY_TRIGGERED',
        reason,
      })
      return row
    },
    onSuccess: (row, { orderId }) => {
      patchJobInCache(queryClient, orderId, row)
      invalidateOrderLists(queryClient)
      // Stock changed — other pre-press jobs' availability may have too.
      void queryClient.invalidateQueries({ queryKey: stockAvailabilityKeys.root })
    },
  })
}

/**
 * Assign / unassign a job's responsible user (admin-only — the UI gates on
 * useIsAdmin and a DB trigger enforces it). Always writes an ASSIGNEE_CHANGED
 * history entry; names are snapshotted into meta so the entry stays readable
 * if a user is later deleted.
 */
export function useSetJobAssignee() {
  const queryClient = useQueryClient()
  return useMutation<
    JobRow,
    Error,
    {
      id: string
      orderId: string
      assignee: { id: string; name: string } | null
      previousAssignee: { id: string; name: string } | null
    }
  >({
    mutationFn: async ({ id, orderId, assignee, previousAssignee }) => {
      const row = await jobService.updateJob(id, { assignee_id: assignee?.id ?? null })
      await historyService.tryWriteHistory({
        order_id: orderId,
        job_id: id,
        event_type: 'ASSIGNEE_CHANGED',
        meta: {
          previous_assignee_id: previousAssignee?.id ?? null,
          previous_assignee_name: previousAssignee?.name ?? null,
          new_assignee_id: assignee?.id ?? null,
          new_assignee_name: assignee?.name ?? null,
        },
      })
      return row
    },
    onSuccess: (row, { orderId }) => {
      patchJobInCache(queryClient, orderId, row)
      void queryClient.invalidateQueries({ queryKey: historyKeys.byOrderId(orderId) })
    },
  })
}

/** Customer-approval requirement / grant. Does not change status. */
export function useSetCustomerApproval() {
  const queryClient = useQueryClient()
  return useMutation<
    JobRow,
    Error,
    {
      id: string
      orderId: string
      patch: Pick<
        JobUpdate,
        'customer_approval_required' | 'customer_approval_granted' | 'customer_approval_file_id'
      >
      history?: HistoryParams
    }
  >({
    mutationFn: async ({ id, orderId, patch, history }) => {
      const row = await jobService.setCustomerApproval(id, patch)
      if (history) await historyService.tryWriteHistory({ order_id: orderId, job_id: id, ...history })
      return row
    },
    onSuccess: (row, { orderId }) => {
      patchJobInCache(queryClient, orderId, row)
    },
  })
}

/** Cancel a job (hidden from the workspace; keeps its data). */
export function useCancelJob() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, { id: string; orderId: string }>({
    mutationFn: async ({ id, orderId }) => {
      await jobService.cancelJob(id)
      await historyService.tryWriteHistory({ order_id: orderId, job_id: id, event_type: 'JOB_CANCELLED' })
    },
    onSuccess: (_void, { id, orderId }) => {
      queryClient.setQueryData<JobRow[]>(
        jobKeys.byOrderId(orderId),
        old => old?.map(r => (r.id === id ? { ...r, is_cancelled: true } : r)) ?? old,
      )
      invalidateOrderLists(queryClient)
    },
  })
}

/** Permanently delete a job (only while IN_SETUP). */
export function useDeleteJob() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, { id: string; orderId: string }>({
    mutationFn: async ({ id, orderId }) => {
      // Snapshot before the delete: the history entry can't reference the dead
      // row (job_id stays null), so the job is identified via meta.
      const job = queryClient
        .getQueryData<JobRow[]>(jobKeys.byOrderId(orderId))
        ?.find(r => r.id === id)
      await jobService.deleteJob(id)
      await historyService.tryWriteHistory({
        order_id: orderId,
        event_type: 'JOB_DELETED',
        meta: { job_number: job?.job_number ?? null, department: job?.department ?? null },
      })
    },
    onSuccess: (_void, { id, orderId }) => {
      queryClient.setQueryData<JobRow[]>(
        jobKeys.byOrderId(orderId),
        old => old?.filter(r => r.id !== id) ?? old,
      )
      invalidateOrderLists(queryClient)
    },
  })
}
