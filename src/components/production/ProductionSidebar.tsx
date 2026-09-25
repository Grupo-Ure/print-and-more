import { useEffect, useMemo, useState } from 'react'
import { CircleAlert, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Sidebar, SidebarContent, SidebarHeader } from '@/components/ui/sidebar'
import { JOB_STATUS_META } from '../../const/orderStatus'
import { jobDepartmentLabel } from '../../const/departmentAbbreviation'
import { departmentIcon } from '../../const/departmentIcons'
import { useNavigation } from '../../context/navigation.context'
import { formatDateDe } from '../../lib/formatDate'
import { resolveEffectiveJob } from '../../lib/jobShared'
import { useProductionJobs } from '../../queries/jobQueries'
import { useIsAdmin, useUsers } from '../../queries/userQueries'
import type { ProductionJob } from '../../services/jobService'
import type { UserRow } from '../../services/userService'
import { StatusBadge } from '../StatusBadge'
import { UserAvatar } from '../UserAvatar'
import { EmployeeCombobox } from '../fields/EmployeeCombobox'
import { useToast } from '../Toast'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.production.sidebar

/**
 * The production feed: every job in pre-press or production across all
 * orders, soonest effective deadline first, narrowed to one assignee through
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
            jobs.map(job => (
              <ProductionSidebarItem
                key={job.id}
                job={job}
                assignee={job.assignee_id ? usersById.get(job.assignee_id) ?? null : null}
                isActive={job.id === activeJobId}
                onSelect={() => selectJob(job.order_id, job.id)}
              />
            ))}
        </div>
      </SidebarContent>
    </Sidebar>
  )
}

type ProductionSidebarItemProps = {
  job: ProductionJob
  assignee: UserRow | null
  isActive: boolean
  onSelect: () => void
}

function ProductionSidebarItem({ job, assignee, isActive, onSelect }: ProductionSidebarItemProps) {
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
      aria-current={isActive ? 'true' : undefined}
      onClick={onSelect}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        'flex cursor-pointer border-l-6 border-neutral-200 bg-white p-3 text-left hover:bg-neutral-100',
        isActive && 'border-l-primary bg-primary/8',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <div className="flex items-center gap-1.5">
          <span title={departmentLabel} className="inline-flex shrink-0">
            <DepartmentIcon size={16} className={colorClassName} aria-label={departmentLabel} />
          </span>
          <h2 data-testid={IDS.rowCustomer} className="min-w-0 flex-1 truncate font-semibold" title={customerName}>
            {customerName}
          </h2>
          {effective.priority === 'HIGH' && (
            <span title="High priority">
              <CircleAlert size={16} className="shrink-0 text-red-600 animate-pulse" aria-label="High priority" />
            </span>
          )}
        </div>
        <span data-testid={IDS.rowJobNumber} className="truncate text-[13px] text-neutral-500">
          {job.job_number}
        </span>
        <div className="flex items-center justify-between gap-1.5">
          <span className="truncate text-[13px] text-neutral-500">
            {'deadline: '}
            {effective.deadline ? formatDateDe(effective.deadline) : 'no deadline'}
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
              {assignee ? (
                <UserAvatar name={assignee.name} avatarUrl={assignee.avatar_url} className="size-5 text-[10px]" />
              ) : (
                <UserRound className="size-5 text-neutral-400" aria-label="Unassigned" />
              )}
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}
