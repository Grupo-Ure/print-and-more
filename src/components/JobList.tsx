import { useState } from 'react'
import { Plus } from 'lucide-react'
import { jobDepartmentLabel } from '../const/departmentAbbreviation'
import { DEPARTMENTS, type Department, type OrderStatus } from '../types/database'
import { useOrderParams } from '../hooks/useOrderParams'
import { useJobsByOrderId, useCreateJob } from '../queries/jobQueries'
import { useToast } from './Toast'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { cn } from '@/lib/utils'
import { STATUS_META, WORKFLOW_STATUSES } from '../const/orderStatus'

function JobStatusTrack({ status }: { status: OrderStatus }) {
  return (
    <div className="flex items-center gap-0.5 rounded px-1 py-0.5 hover:bg-gray-100">
      {WORKFLOW_STATUSES.map(s => (
        <div
          key={s}
          title={STATUS_META[s].label}
          className={cn('w-2.5 h-2.5', s === status ? STATUS_META[s].color : 'bg-gray-200')}
        />
      ))}
    </div>
  )
}

export function JobList() {
  const { activeOrderId, activeJobId, setActiveJob } = useOrderParams()
  const jobsQuery = useJobsByOrderId(activeOrderId)
  const [dialogOpen, setDialogOpen] = useState(false)

  const visibleJobs = (jobsQuery.data ?? []).filter(job => !job.is_cancelled)

  return (
    <>
      <nav className="flex flex-col justify-between w-60">
        <h1>Jobs</h1>
        <AddJobButton onClick={() => setDialogOpen(true)} />
        <ul className="flex flex-col flex-wrap flex-1 min-w-0" aria-label="Jobs">
          {visibleJobs.map(job => (
            <li
              key={job.id}
              className={cn(
                'flex items-center justify-between w-full cursor-pointer p-2',
                job.id === activeJobId && 'bg-primary/10',
              )}
              onClick={() => setActiveJob(job.id)}
            >
              <span>{jobDepartmentLabel(job.department)}</span>
              <JobStatusTrack status={job.status} />
            </li>
          ))}
        </ul>
      </nav>
      <AddJobDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}

type AddJobDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function AddJobDialog({ open, onOpenChange }: AddJobDialogProps) {
  const { activeOrderId, setActiveJob } = useOrderParams()
  const { showError } = useToast()
  const createJob = useCreateJob()

  const handleDepartmentSelected = (department: Department) => {
    if (!activeOrderId || createJob.isPending) return

    createJob.mutate(
      {
        order_id: activeOrderId,
        department,
        status: 'INCOMPLETE',
        priority: null,
        detail: {},
        deadline: null,
        delivery: null,
        assignee_id: null,
        is_emergency: false,
        emergency_reason: null,
        is_cancelled: false,
        customer_approval_required: false,
        customer_approval_granted: false,
        customer_approval_file_id: null,
      },
      {
        onSuccess: created => {
          setActiveJob(created.id)
          onOpenChange(false)
        },
        onError: () => showError('Error creating job'),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={next => !createJob.isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Job</DialogTitle>
          <DialogDescription>Select a department:</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {DEPARTMENTS.map(department => (
            <Button
              key={department}
              type="button"
              variant="outline"
              disabled={createJob.isPending}
              onClick={() => handleDepartmentSelected(department)}
            >
              {jobDepartmentLabel(department)}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

const AddJobButton = ({ onClick }: { onClick: () => void }) => (
  <Button type="button" variant="ghost" onClick={onClick}>
    <Plus className="mr-2 h-4 w-4" />
    Add Job
  </Button>
)
