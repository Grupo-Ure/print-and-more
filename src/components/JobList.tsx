import { useState } from 'react'
import { Plus } from 'lucide-react'
import { subOrderDepartmentLabel } from '../const/departmentAbbreviation'
import { SUB_ORDER_DEPARTMENTS, type Department, type OrderStatus } from '../types/database'
import { authService } from '../services/authService'
import { useOrderParams } from '../hooks/useOrderParams'
import { useSubOrdersByOrderId, useCreateSubOrder } from '../queries/subOrderQueries'
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

const JOB_STATUSES: { status: OrderStatus; color: string }[] = [
  { status: 'INCOMPLETE',       color: 'bg-orange-500' },
  { status: 'PREPRESS_READY',   color: 'bg-pink-500' },
  { status: 'PRODUCTION_READY', color: 'bg-blue-500' },
  { status: 'DONE',             color: 'bg-emerald-500' },
]

function JobStatusTrack({ status }: { status: OrderStatus }) {
  return (
    <div className="flex items-center" aria-hidden>
      {JOB_STATUSES.map(({ status: s, color }) => (
        <div
          key={s}
          className={cn('w-2.5 h-2.5', s === status ? color : 'bg-gray-200')}
        />
      ))}
    </div>
  )
}

export function JobList() {
  const { activeOrderId, activeSubOrderId, setActiveSubOrder } = useOrderParams()
  const jobsQuery = useSubOrdersByOrderId(activeOrderId)
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
                'flex items-center justify-between w-full cursor-pointer p-2 hover:bg-gray-100',
                job.id === activeSubOrderId && 'bg-primary/10 hover:bg-primary/10',
              )}
              onClick={() => setActiveSubOrder(job.id)}
            >
              <span>{subOrderDepartmentLabel(job.department)}</span>
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
  const { activeOrderId, setActiveSubOrder } = useOrderParams()
  const { showError } = useToast()
  const createSubOrder = useCreateSubOrder()

  const handleDepartmentSelected = (department: Department) => {
    if (!activeOrderId || createSubOrder.isPending) return

    void (async () => {
      const user = await authService.getUser()
      if (!user?.id) {
        showError('Not logged in')
        return
      }
      createSubOrder.mutate(
        {
          order_id: activeOrderId,
          department,
          status: 'INCOMPLETE',
          priority: null,
          detail: {},
          deadline: null,
          delivery: null,
          assignee_id: user.id,
          is_emergency: false,
          emergency_reason: null,
          is_cancelled: false,
          customer_approval_required: false,
          customer_approval_granted: false,
          customer_approval_file_id: null,
        },
        {
          onSuccess: created => {
            setActiveSubOrder(created.id)
            onOpenChange(false)
          },
          onError: () => showError('Error creating job'),
        },
      )
    })()
  }

  return (
    <Dialog open={open} onOpenChange={next => !createSubOrder.isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Job</DialogTitle>
          <DialogDescription>Select a department:</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {SUB_ORDER_DEPARTMENTS.map(department => (
            <Button
              key={department}
              type="button"
              variant="outline"
              disabled={createSubOrder.isPending}
              onClick={() => handleDepartmentSelected(department)}
            >
              {subOrderDepartmentLabel(department)}
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
