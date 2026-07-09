import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { orderService } from '../services/orderService'
import { jobService } from '../services/jobService'
import { historyService, type HistoryEvent } from '../services/historyService'
import { deductProductionStock } from '../services/productionReleaseService'
import { calculateOrderStatus } from '../lib/orderStatus'
import { resolveEffectiveJob } from '../lib/jobShared'
import type { OrderDetailRow, JobRow, OrderStatus } from '../types/database'
import type { Database } from '../types/supabase'
import { orderKeys, patchOrderStatusInCache, useOrderById } from './orderQueries'
import { historyKeys } from './historyQueries'

type JobInsert = Database['public']['Tables']['jobs']['Insert']
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

/**
 * Re-derive the order's aggregate status from the *cached* job list and
 * persist it if it changed (the optimistic pattern that replaces the deprecated
 * `orderService.recalculateOrderStatus` DB round-trip). Always invalidates the
 * order lists so the sidebar reflects the change. Callers must patch the
 * job cache *before* invoking this so the aggregation sees the new state.
 */
export async function reconcileOrderStatus(queryClient: QueryClient, orderId: string): Promise<void> {
  const order = queryClient.getQueryData<OrderDetailRow>(orderKeys.byId(orderId))
  const jobs = queryClient.getQueryData<JobRow[]>(jobKeys.byOrderId(orderId))
  if (order && jobs) {
    const next = calculateOrderStatus(order.status, jobs)
    if (next !== order.status) {
      const updated = await orderService.setOrderStatus(orderId, next)
      queryClient.setQueryData(orderKeys.byId(orderId), updated)
      patchOrderStatusInCache(queryClient, orderId, updated.status)
    }
  } else {
    void queryClient.invalidateQueries({ queryKey: orderKeys.byId(orderId) })
  }
  void queryClient.invalidateQueries({ queryKey: orderKeys.lists })
}

function patchJobInCache(queryClient: QueryClient, orderId: string, row: JobRow): void {
  queryClient.setQueryData<JobRow[]>(
    jobKeys.byOrderId(orderId),
    old => old?.map(r => (r.id === row.id ? row : r)) ?? old,
  )
}

/**
 * Persist a job status directly (no hook), patching the job cache and
 * reconciling the order. Used by the status helpers that run outside a component —
 * notably {@link bounceBackIfCommitted}.
 */
export async function persistJobStatus(
  queryClient: QueryClient,
  id: string,
  orderId: string,
  status: OrderStatus,
): Promise<void> {
  const row = await jobService.setJobStatus(id, status)
  patchJobInCache(queryClient, orderId, row)
  await reconcileOrderStatus(queryClient, orderId)
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
 * Bounce-back: if the job is committed (PRODUCTION_READY / DONE), drop it to
 * INCOMPLETE. Called from the content mutations' `onSuccess` *only when the change was
 * meaningful* (see `isMeaningfulChange`). No-op for non-committed jobs, so the
 * caller doesn't need to know the current status.
 */
export async function bounceBackIfCommitted(queryClient: QueryClient, jobId: string): Promise<void> {
  const job = findCachedJob(queryClient, jobId)
  if (!job) return
  if (job.status !== 'PRODUCTION_READY' && job.status !== 'DONE') return
  await persistJobStatus(queryClient, job.id, job.order_id, 'INCOMPLETE')
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
    mutationFn: payload => jobService.createJob(payload),
    onSuccess: async created => {
      const orderId = created.order_id
      const cachedSiblings = queryClient.getQueryData<JobRow[]>(jobKeys.byOrderId(orderId)) ?? []
      queryClient.setQueryData<JobRow[]>(jobKeys.byOrderId(orderId), [...cachedSiblings, created])
      await reconcileOrderStatus(queryClient, orderId)
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
    { id: string; orderId: string; patch: JobUpdate },
    { previous?: JobRow[] }
  >({
    mutationFn: ({ id, patch }) => jobService.updateJob(id, patch),
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
    { id: string; orderId: string; status: OrderStatus; history?: HistoryParams }
  >({
    mutationFn: async ({ id, orderId, status, history }) => {
      const row = await jobService.setJobStatus(id, status)
      if (history) await historyService.writeHistory({ order_id: orderId, job_id: id, ...history })
      return row
    },
    onSuccess: async (row, { orderId }) => {
      patchJobInCache(queryClient, orderId, row)
      await reconcileOrderStatus(queryClient, orderId)
    },
  })
}

/**
 * Release to production: book stock deductions (stamp/textile), set
 * PRODUCTION_READY, write the PRODUCTION_READY_SET history entry. The stock
 * deduction runs before the status write, matching the prior behaviour.
 */
export function useReleaseToProduction() {
  const queryClient = useQueryClient()
  return useMutation<JobRow, Error, { job: JobRow; orderId: string; orderNumber: string | null }>({
    mutationFn: async ({ job, orderId, orderNumber }) => {
      await deductProductionStock(job, orderNumber)
      const row = await jobService.setJobStatus(job.id, 'PRODUCTION_READY')
      try {
        await historyService.writeHistory({
          order_id: orderId,
          job_id: job.id,
          event_type: 'PRODUCTION_READY_SET',
        })
      } catch {
        console.error('History production-released failed')
      }
      return row
    },
    onSuccess: async (row, { orderId }) => {
      patchJobInCache(queryClient, orderId, row)
      await reconcileOrderStatus(queryClient, orderId)
    },
  })
}

/** Toggle the emergency flag + reason. Does not change status. */
export function useSetJobEmergency() {
  const queryClient = useQueryClient()
  return useMutation<
    JobRow,
    Error,
    {
      id: string
      orderId: string
      patch: Pick<JobUpdate, 'is_emergency' | 'emergency_reason'>
      history?: HistoryParams
    }
  >({
    mutationFn: async ({ id, orderId, patch, history }) => {
      const row = await jobService.setJobEmergency(id, patch)
      if (history) await historyService.writeHistory({ order_id: orderId, job_id: id, ...history })
      return row
    },
    onSuccess: (row, { orderId }) => {
      patchJobInCache(queryClient, orderId, row)
      void queryClient.invalidateQueries({ queryKey: orderKeys.lists })
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
      await historyService.writeHistory({
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
      if (history) await historyService.writeHistory({ order_id: orderId, job_id: id, ...history })
      return row
    },
    onSuccess: (row, { orderId }) => {
      patchJobInCache(queryClient, orderId, row)
    },
  })
}

/** Cancel a job (excluded from order aggregation). */
export function useCancelJob() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, { id: string; orderId: string }>({
    mutationFn: ({ id }) => jobService.cancelJob(id),
    onSuccess: async (_void, { id, orderId }) => {
      queryClient.setQueryData<JobRow[]>(
        jobKeys.byOrderId(orderId),
        old => old?.map(r => (r.id === id ? { ...r, is_cancelled: true } : r)) ?? old,
      )
      await reconcileOrderStatus(queryClient, orderId)
    },
  })
}

/** Permanently delete a job (only while INCOMPLETE). */
export function useDeleteJob() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, { id: string; orderId: string }>({
    mutationFn: ({ id }) => jobService.deleteJob(id),
    onSuccess: async (_void, { id, orderId }) => {
      queryClient.setQueryData<JobRow[]>(
        jobKeys.byOrderId(orderId),
        old => old?.filter(r => r.id !== id) ?? old,
      )
      await reconcileOrderStatus(queryClient, orderId)
    },
  })
}
