import { useCancelJob, useDeleteJob, useEffectiveJob, useSetJobAssignee, useJobById } from '../queries/jobQueries'
import { useIsAdmin, useUsers } from '../queries/userQueries'
import { generateAndDownloadPdf } from '../lib/pdf/orderPdf'
import { useOrderById } from '../queries/orderQueries'
import { useStatusManager } from '../queries/useStatusManager'
import { useOrderParams } from '../hooks/useOrderParams'
import { jobDepartmentLabel } from '../const/departmentAbbreviation'
import { customerMeetsPrepressContact } from '../lib/customer'
import { type JobRow } from '../types/database'
import { EmployeeCombobox } from './fields/EmployeeCombobox'
import { JobSections } from './jobDetail/JobSections'
import { JobSettingsSection } from './jobDetail/JobSettingsSection'
import { JobTimeLogs } from './JobTimeLogs'
import { useToast } from './Toast'
import { useConfirm } from './ConfirmDialog'
import { CopyShopProducts } from './products/departments/CopyShopProducts'
import { LfpProducts } from './products/departments/LfpProducts'
import { StampProducts } from './products/departments/StampProducts'
import { OtherProducts } from './products/departments/OtherProducts'
import { LaserProducts } from './products/departments/LaserProducts'
import { TextileProducts } from './products/departments/TextileProducts'
import type { FileRow } from '../services/fileService'
import { StatusBadge } from './StatusBadge'
import { JOB_STATUS_META } from '../const/orderStatus'
import { JobReleaseButton } from './JobReleaseButton'
import { JobProductionBanner } from './JobProductionBanner'
import { Button } from './ui/button'
import { Ban, FileDown, Trash2 } from 'lucide-react'
import './WorkArea.css'
import { Separator } from './ui/separator'

export function JobDetail({
  orderFiles,
  onUpdated,
}: {
  orderFiles: FileRow[]
  onUpdated: (updatedJob: JobRow) => void
}) {
  const { activeOrderId, activeJobId } = useOrderParams()
  const { data: order } = useOrderById(activeOrderId)
  const job = useJobById(activeOrderId, activeJobId) // raw row (override/inherit state)
  const effectiveJob = useEffectiveJob(activeOrderId, activeJobId) // inherited fields resolved
  const setJobAssignee = useSetJobAssignee()
  const cancelJob = useCancelJob()
  const deleteJob = useDeleteJob()
  const { isAdmin } = useIsAdmin()
  const { data: users = [] } = useUsers()
  const { showError } = useToast()
  const confirm = useConfirm()

  // Status manager: auto-derives and persists the IN_SETUP ↔ PREPRESS
  // transition for the active job. Single owner (one JobDetail is mounted
  // at a time). Called unconditionally (before the early return) per the rules of hooks.
  useStatusManager(activeOrderId, activeJobId)

  if (!order || !job || !effectiveJob) return null

  const handleDownloadPdf = async () => {
    const ok = await generateAndDownloadPdf(job.id, order.id)
    if (!ok) showError('PDF could not be generated')
  }

  const handleCancel = async () => {
    const confirmed = await confirm({
      title: 'Cancel this job?',
      confirmLabel: 'Cancel job',
      destructive: true,
    })
    if (!confirmed) return
    try {
      await cancelJob.mutateAsync({ id: job.id, orderId: job.order_id })
    } catch {
      showError('Job could not be cancelled')
    }
  }

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Permanently delete this job?',
      confirmLabel: 'Delete job',
      destructive: true,
    })
    if (!confirmed) return
    try {
      await deleteJob.mutateAsync({ id: job.id, orderId: job.order_id })
    } catch {
      showError('Job could not be deleted')
    }
  }

  // Admin-only (also enforced by a DB trigger). Writes the ASSIGNEE_CHANGED
  // history entry alongside the job update.
  const handleAssigneeChange = (assignee: { id: string; name: string } | null) => {
    if ((assignee?.id ?? null) === (job.assignee_id ?? null)) return
    const previousUser = job.assignee_id ? users.find(u => u.id === job.assignee_id) : null
    setJobAssignee.mutate(
      {
        id: job.id,
        orderId: job.order_id,
        assignee,
        previousAssignee: previousUser ? { id: previousUser.id, name: previousUser.name } : null,
      },
      { onSuccess: row => onUpdated(row), onError: () => showError('Assignee could not be changed') },
    )
  }

  const customerMeetsPrepressRequirements = customerMeetsPrepressContact(order.customers)
  // Nothing is required while the parent order is still a quote (order-level rule).
  const orderIsQuote = order.status === 'QUOTE'
  const shouldValidate = !orderIsQuote

  // Once DONE the job is read-only.
  const isDone = job.status === 'DONE'

  return (
    <div className="flex flex-col gap-4">
      <JobProductionBanner job={job} />
      <div aria-label="Job" className="flex flex-col gap-2">
        <div className="flex items-center gap-6">
          <h1 className="flex items-baseline gap-2">
            {jobDepartmentLabel(job.department)}
            <span>-</span>
            {job.job_number}
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-muted-foreground">Assigned to</span>
            <EmployeeCombobox
              value={job.assignee_id}
              onChange={handleAssigneeChange}
              disabled={!isAdmin || isDone || setJobAssignee.isPending}
            />
          </div>
        </div>
        <div className="flex items-center">
          <StatusBadge meta={JOB_STATUS_META[job.status]} />
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void handleDownloadPdf()}
            >
              <FileDown />
              Download PDF
            </Button>

            {job.status === 'IN_SETUP' ? (
              <Button
                type="button"
                variant="ghost"
                disabled={deleteJob.isPending}
                onClick={() => void handleDelete()}
                size="sm"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 />
                Delete job
              </Button>
            ):(
              <Button
                type="button"
                variant="ghost"
                disabled={job.is_cancelled || job.status === 'IN_PRODUCTION' || job.status === 'DONE' || cancelJob.isPending}
                onClick={() => void handleCancel()}
                size="sm"
                className="text-destructive hover:text-destructive"
              >
                <Ban />
                Cancel job
              </Button>
            )}
          </div>

          <JobReleaseButton job={job} orderNumber={order.order_number ?? null} />
        </div>
      </div>
      
      <Separator />
      
      {shouldValidate &&
        job.department !== 'OTHER' &&
        !customerMeetsPrepressRequirements &&
        (job.department === 'LFP' ||
          job.department === 'COPYSHOP' ||
          (job.department === 'STAMP' && job.type !== 'OTHER_STAMP') ||
          (job.department === 'LASER_ENGRAVING' && job.type !== 'OTHER_LASER')) && (
          <p className="text-xs italic text-muted-foreground">For auto-PREPRESS: Customer needs name and email or phone.</p>
        )}
      <JobSections
        sections={[
          {
            key: 'settings',
            title: 'Job Settings',
            content: (
              <JobSettingsSection
                key={job.id}
                order={order}
                job={job}
                effectiveJob={effectiveJob}
                onUpdated={onUpdated}
              />
            ),
          },
          {
            key: 'time-logs',
            title: 'Time Logs',
            content: <JobTimeLogs key={job.id} orderId={order.id} jobId={job.id} disabled={isDone} />,
          },
        ]}
      />

      <Separator/>

      <section>
        {job.department === 'LFP' && (
          <LfpProducts key={job.id} job={job} jobStatus={job.status} orderFiles={orderFiles} />
        )}

        {job.department === 'COPYSHOP' && (
          <CopyShopProducts key={job.id} job={job} jobStatus={job.status} orderFiles={orderFiles} />
        )}

        {job.department === 'STAMP' && (
          <StampProducts key={job.id} job={job} jobStatus={job.status} orderFiles={orderFiles} />
        )}

        {job.department === 'OTHER' && (
          <OtherProducts key={job.id} job={job} jobStatus={job.status} orderFiles={orderFiles} />
        )}

        {job.department === 'LASER_ENGRAVING' && (
          <LaserProducts key={job.id} job={job} jobStatus={job.status} orderFiles={orderFiles} />
        )}

        {job.department === 'TEXTILE' && (
          <TextileProducts key={job.id} job={job} jobStatus={job.status} orderFiles={orderFiles} />
        )}
      </section>
    </div>
  )
}
