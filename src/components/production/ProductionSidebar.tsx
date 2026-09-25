import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Sidebar, SidebarContent, SidebarHeader } from '@/components/ui/sidebar'
import { JOB_STATUS_META } from '../../const/orderStatus'
import { jobDepartmentLabel } from '../../const/departmentAbbreviation'
import { departmentIcon } from '../../const/departmentIcons'
import { useNavigation } from '../../context/navigation.context'
import { formatDateDe } from '../../lib/formatDate'
import { isMissingInfo, resolveEffectiveJob } from '../../lib/jobShared'
import { useProductionJobs } from '../../queries/jobQueries'
import { useIsAdmin, useUsers } from '../../queries/userQueries'
import type { ProductionJob } from '../../services/jobService'
import type { UserRow } from '../../services/userService'
import { StatusBadge } from '../StatusBadge'
import { HighPriorityFlag, MissingInfoFlag } from '../Flags'
import { UserAvatar } from '../UserAvatar'
import { EmployeeCombobox } from '../fields/EmployeeCombobox'
import { useToast } from '../Toast'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.production.sidebar

/**
 * The production feed: every job in pre-press or production across all
 * orders, high priority first, then soonest effective deadline, narrowed to one assignee through
 * the same combobox the job header uses. Employees start on their own jobs;
 * admins start on everyone's. Selecting a row shows the job beside the feed.
 */
export function ProductionSidebar({ currentUserId }: { currentUserId: string }) {
  const { activeJobId, selectJob } = useNavigation()
  const { isAdmin, isLoading: roleLoading } = useIsAdmin()
  const { data: users = [] } = useUsers()
  const jobsQuery = useProductionJobs()
  const { showError } = useToast()

  // The role decides the default; a pick overrides it for this visit.
  // `undefined` = not picked yet; `null` = everyone.
  const [pickedAssigneeId, setPickedAssigneeId] = useState<string | null | undefined>(undefined)
  const assigneeId = pickedAssigneeId === undefined ? (isAdmin ? null : currentUserId) : pickedAssigneeId
  const { newJobIds, clearNew } = useNewJobMarks(jobsQuery.data, assigneeId)

  useEffect(() => {
    if (jobsQuery.isError) showError('Production jobs could not be loaded')
  }, [jobsQuery.isError, showError])

  const usersById = useMemo(() => new Map(users.map(user => [user.id, user])), [users])
  const assignee = assigneeId ? usersById.get(assigneeId) ?? null : null

  const jobs = useMemo(() => {
    const all = jobsQuery.data ?? []
    return assigneeId ? all.filter(job => job.assignee_id === assigneeId) : all
  }, [jobsQuery.data, assigneeId])

  const isLoading = jobsQuery.isLoading || roleLoading
  const isEmpty = !isLoading && jobs.length === 0
  const hasHighPriority = jobs.some(isHighPriority)

  return (
    <Sidebar
      collapsible="none"
      side="left"
      data-testid={IDS.root}
      className="shrink-0 border-r! border-gray-200"
    >
      <SidebarHeader className="border-b border-neutral-200 bg-neutral-50 px-3.5 py-2.5">
        <div className="flex min-h-7 items-center justify-between gap-2">
          <h1 className="font-bold uppercase text-neutral-500">Production</h1>
          <EmployeeCombobox
            testId={IDS.assigneeFilter}
            emptyOptionTestId={IDS.assigneeFilterEveryone}
            userOptionTestId={IDS.assigneeFilterUser}
            value={assigneeId}
            emptyLabel="Everyone"
            disabled={roleLoading}
            onChange={user => setPickedAssigneeId(user?.id ?? null)}
          />
        </div>
        <p
          data-testid={IDS.assigneeFilterCaption}
          className="text-[11px] leading-snug text-neutral-500"
        >
          {assignee
            ? `Showing jobs assigned to ${assignee.name}.`
            : assigneeId
              ? 'Showing jobs assigned to a deleted user.'
              : 'Showing all jobs in pre-press and production.'}
        </p>
      </SidebarHeader>

      <SidebarContent className="p-0">
        <div
          data-testid={IDS.list}
          className={cn(
            'min-h-0 flex-1 overflow-y-auto transition-opacity duration-150',
            jobsQuery.isFetching && !jobsQuery.isLoading ? 'opacity-50' : 'opacity-100',
          )}
        >
          {isLoading && <div className="p-4 text-[13px] text-neutral-500">Loading...</div>}
          {isEmpty && (
            <div
              data-testid={IDS.empty}
              className="flex h-full items-center justify-center p-6 text-center text-sm text-neutral-500"
            >
              {assigneeId
                ? 'No jobs in pre-press or production for this user.'
                : 'No jobs in pre-press or production.'}
            </div>
          )}
          {!isLoading &&
            jobs.map((job, index) => {
              // The feed lists high priority first; label both groups, but
              // only when there is a high-priority group to set apart.
              const isHigh = isHighPriority(job)
              const startsGroup = hasHighPriority && (index === 0 || isHighPriority(jobs[index - 1]) !== isHigh)
              return (
                <Fragment key={job.id}>
                  {startsGroup && <PriorityGroupHeader high={isHigh} />}
                  <ProductionSidebarItem
                    job={job}
                    assignee={job.assignee_id ? usersById.get(job.assignee_id) ?? null : null}
                    isActive={job.id === activeJobId}
                    isNew={newJobIds.has(job.id)}
                    onSelect={() => {
                      clearNew(job.id)
                      selectJob(job.order_id, job.id)
                    }}
                  />
                </Fragment>
              )
            })}
        </div>
      </SidebarContent>
    </Sidebar>
  )
}

/**
 * Jobs that a data update adds to the visible list while the page is open
 * stay marked as new until clicked or the page unmounts: a job entering the
 * feed, or one reassigned to the filtered user. The first load and filter
 * changes never mark anything. A job that leaves and comes back counts as
 * new again.
 */
function useNewJobMarks(jobs: ProductionJob[] | undefined, assigneeId: string | null) {
  const [previousJobs, setPreviousJobs] = useState(jobs)
  const [newJobIds, setNewJobIds] = useState<ReadonlySet<string>>(() => new Set())

  // Compare against the previous fetch during render (React's "adjust state
  // on prop change" pattern), so a new row is marked in its first paint.
  // Both fetches go through the current filter, so only the data can differ.
  if (jobs !== previousJobs) {
    setPreviousJobs(jobs)
    if (previousJobs && jobs) {
      const isVisible = (job: ProductionJob) => !assigneeId || job.assignee_id === assigneeId
      const before = new Set(previousJobs.filter(isVisible).map(job => job.id))
      const arrived = jobs.filter(job => isVisible(job) && !before.has(job.id)).map(job => job.id)
      if (arrived.length > 0) setNewJobIds(marked => new Set([...marked, ...arrived]))
    }
  }

  const clearNew = useCallback((jobId: string) => {
    setNewJobIds(marked => {
      if (!marked.has(jobId)) return marked
      const next = new Set(marked)
      next.delete(jobId)
      return next
    })
  }, [])

  return { newJobIds, clearNew }
}

function isHighPriority(job: ProductionJob): boolean {
  return resolveEffectiveJob(job, job.orders).priority === 'HIGH'
}

/** Labelled divider above each priority group of the feed. */
function PriorityGroupHeader({ high }: { high: boolean }) {
  return (
    <div
      data-testid={IDS.priorityGroup}
      data-priority={high ? 'HIGH' : 'NORMAL'}
      className={cn(
        'flex items-center gap-1 border-y px-3 py-1 text-base font-semibold tracking-wide justify-between',
        high ? 'border-red-200 bg-red-50 text-red-400' : 'border-neutral-200 bg-neutral-100 text-neutral-500',
      )}
    >
      {high ? 'High Priority' : 'Jobs'}
      {high && <ArrowUp size={18} aria-hidden />}
    </div>
  )
}

type ProductionSidebarItemProps = {
  job: ProductionJob
  assignee: UserRow | null
  isActive: boolean
  isNew: boolean
  onSelect: () => void
}

function ProductionSidebarItem({ job, assignee, isActive, isNew, onSelect }: ProductionSidebarItemProps) {
  const effective = resolveEffectiveJob(job, job.orders)
  const { icon: DepartmentIcon, colorClassName } = departmentIcon(job.department)
  const departmentLabel = jobDepartmentLabel(job.department)
  const customerName = job.orders.customers?.name ?? '-'

  return (
    <div
      role="button"
      tabIndex={0}
      data-testid={IDS.row}
      data-job-id={job.id}
      data-order-id={job.order_id}
      data-status={job.status}
      data-department={job.department}
      data-new={isNew ? 'true' : undefined}
      aria-current={isActive ? 'true' : undefined}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        'flex cursor-pointer border-l-6 border-neutral-200 bg-white p-3 text-left hover:bg-neutral-100',
        isNew && !isActive && 'bg-blue-100',
        isActive && 'border-l-primary bg-primary/10 hover:bg-primary/10',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <div className="flex items-center gap-1.5">
          <span title={departmentLabel} className="inline-flex shrink-0">
            <DepartmentIcon
              size={16}
              className={colorClassName}
              aria-label={departmentLabel}
            />
          </span>
          <h2
            data-testid={IDS.rowCustomer}
            className="min-w-0 flex-1 truncate font-semibold"
            title={customerName}
          >
            {customerName}
          </h2>
          {isNew && (
            <span
              data-testid={IDS.rowNew}
              title="New — not opened yet"
              className="shrink-0 rounded-full bg-blue-600 px-2 text-[12px] leading-4 text-white"
            >
              New
            </span>
          )}
          {isMissingInfo(job, job.orders, (job.department_products[0]?.count ?? 0) > 0) && (
            <MissingInfoFlag size={20} testId={IDS.rowMissingInfo} />
          )}
          {effective.priority === 'HIGH' && <HighPriorityFlag size={20} />}
        </div>
        <span
          data-testid={IDS.rowJobNumber}
          className="truncate text-[13px] text-neutral-500"
        >
          {job.job_number}
        </span>
        <div className="flex items-center justify-between gap-1.5">
          <span className="truncate text-[13px] text-neutral-500">
            {'deadline: '}
            {effective.deadline
              ? formatDateDe(effective.deadline)
              : 'no deadline'}
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            <span data-testid={IDS.rowStatus} data-status={job.status}>
              <StatusBadge meta={JOB_STATUS_META[job.status]} />
            </span>
            <span
              data-testid={IDS.rowAssignee}
              data-user-id={assignee?.id}
              title={assignee ? `Assigned to ${assignee.name}` : 'Unassigned'}
              className="inline-flex"
            >
              {assignee && 
                <UserAvatar
                  name={assignee.name}
                  avatarUrl={assignee.avatar_url}
                  className="size-8 text-base"
                />
              }
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
