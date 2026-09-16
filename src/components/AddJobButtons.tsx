import { useId } from 'react'
import { cn } from '@/lib/utils'
import { jobDepartmentLabel } from '../const/departmentAbbreviation'
import { DEPARTMENTS, type Department } from '../types/database'
import { useOrderSelection } from '../hooks/useOrderSelection'
import { useCreateJob } from '../queries/jobQueries'
import { useOrderById } from '../queries/orderQueries'
import { useToast } from './Toast'
import { Button } from './ui/button'
import { TEST_IDS } from '@e2e/support/testIds'

/**
 * "Add Job" group for the active order: one button per department, each
 * creating a job for that department straight away — no picker dialog.
 * Renders nothing while the order is finished/billed — closed for new work.
 */
export function AddJobButtons({ className }: { className?: string }) {
  const { activeOrderId, setActiveJob } = useOrderSelection()
  const orderQuery = useOrderById(activeOrderId)
  const createJob = useCreateJob()
  const { showError } = useToast()
  const labelId = useId()

  const order = orderQuery.data
  const jobsLocked = order?.status === 'FINISHED' || order?.status === 'BILLED'
  if (jobsLocked) return null

  // The in-flight mutation's variables tell which button was pressed, so only
  // that one shows the pending marker while all six stay disabled.
  const pendingDepartment = createJob.isPending ? createJob.variables?.department : null

  const handleAddJob = (department: Department) => {
    if (!activeOrderId || createJob.isPending) return

    createJob.mutate(
      {
        order_id: activeOrderId,
        department,
        status: 'IN_SETUP',
        priority: null,
        deadline: null,
        delivery: null,
        assignee_id: null,
        is_cancelled: false,
        customer_approval_required: false,
        customer_approval_granted: false,
        customer_approval_file_id: null,
      },
      {
        onSuccess: created => setActiveJob(created.id),
        onError: () => showError('Error creating job'),
      },
    )
  }

  return (
    <div role="group" aria-labelledby={labelId} className={cn('flex flex-col gap-1', className)}>
      <span id={labelId} className="text-[11px] font-medium text-muted-foreground">
        Add Job
      </span>
      <div className="grid grid-cols-2 gap-1">
        {DEPARTMENTS.map(department => (
          <Button
            key={department}
            type="button"
            variant="outline"
            size="xs"
            data-testid={TEST_IDS.orders.jobList.addJob}
            data-department={department}
            // Long labels ("Laser Engraving") wrap onto two lines in the
            // compact list width instead of overflowing the button.
            className="h-auto min-h-6 whitespace-normal py-0.5 leading-tight"
            disabled={createJob.isPending}
            onClick={() => handleAddJob(department)}
          >
            {pendingDepartment === department ? '…' : jobDepartmentLabel(department)}
          </Button>
        ))}
      </div>
    </div>
  )
}
