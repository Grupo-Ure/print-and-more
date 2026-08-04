import { useState } from 'react'
import { Plus } from 'lucide-react'
import { jobDepartmentLabel } from '../const/departmentAbbreviation'
import { DEPARTMENTS, type Department } from '../types/database'
import { useOrderParams } from '../hooks/useOrderParams'
import { useCreateJob } from '../queries/jobQueries'
import { useOrderById } from '../queries/orderQueries'
import { useToast } from './Toast'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'

/**
 * "Add Job" button with its department-picker dialog, for the active order.
 * Renders nothing while the order is finished/billed — closed for new work.
 */
export function AddJobButton({ className }: { className?: string }) {
  const { activeOrderId } = useOrderParams()
  const orderQuery = useOrderById(activeOrderId)
  const [dialogOpen, setDialogOpen] = useState(false)

  const order = orderQuery.data
  const jobsLocked = order?.status === 'FINISHED' || order?.status === 'BILLED'
  if (jobsLocked) return null

  return (
    <>
      <Button type="button" variant="ghost" className={className} onClick={() => setDialogOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Add Job
      </Button>
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
