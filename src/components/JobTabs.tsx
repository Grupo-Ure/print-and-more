import { useState } from 'react'
import { Plus } from 'lucide-react'
import { jobDepartmentLabel } from '../const/departmentAbbreviation'
import { DEPARTMENTS, type Department } from '../types/database'
import { useOrderSelection } from '../hooks/useOrderSelection'
import { useJobsByOrderId, useCreateJob } from '../queries/jobQueries'
import { useToast } from './Toast'
import { Button } from './ui/button'
import { Tabs, TabsList, TabsTrigger } from './ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'

export function JobTabs() {
  const { activeOrderId, activeJobId, setActiveJob } = useOrderSelection()
  const jobsQuery = useJobsByOrderId(activeOrderId)
  const [dialogOpen, setDialogOpen] = useState(false)

  const visibleJobs = (jobsQuery.data ?? []).filter(job => !job.is_cancelled)

  return (
    <>
      {visibleJobs.length === 0 ? (
        <div className="flex items-center justify-center">
          <Button
            type="button"
            size="lg"
            variant="ghost"
            onClick={() => setDialogOpen(true)}
            aria-label="Add job"
          >
            <p>Add a job</p>
            <Plus />
          </Button>
        </div>
      ) : (
        <nav className="flex items-center justify-between mgb-4">
          <Tabs
            value={activeJobId ?? undefined}
            onValueChange={setActiveJob}
            className="flex-row items-start gap-2 flex-1 min-w-0"
          >
            <TabsList
              aria-label="Jobs"
              variant="line"
              className="grid w-full grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-x-1 gap-y-3 group-data-horizontal/tabs:h-auto"
            >
              {visibleJobs.map(job => (
                <TabsTrigger key={job.id} value={job.id}>
                  {jobDepartmentLabel(job.department)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Button
            title="Add job"
            type="button"
            size="icon-lg"
            variant="ghost"
            onClick={() => setDialogOpen(true)}
            aria-label="Add job"
          >
            <Plus />
          </Button>
        </nav>
      )}

      <AddJobDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}

type AddJobDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function AddJobDialog({ open, onOpenChange }: AddJobDialogProps) {
  const { activeOrderId, setActiveJob } = useOrderSelection()
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