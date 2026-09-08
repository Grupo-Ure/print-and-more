import type { JobRow, OrderDetailRow } from '../../types/database'
import type { FileRow } from '../../services/fileService'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import { JobSettingsSection } from './JobSettingsSection'

type Props = {
  order: OrderDetailRow
  job: JobRow
  effectiveJob: JobRow
  orderFiles: FileRow[]
  onOrderFilesChanged: () => void | Promise<void>
  onUpdated: (updatedJob: JobRow) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Hosts the job-settings form in a dialog opened from the job header, so the
 * per-job overrides don't take up space in the detail view. Every switch and
 * field saves on change — there is no confirm step; closing just dismisses.
 */
export function JobSettingsDialog({ open, onOpenChange, ...sectionProps }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Job settings</DialogTitle>
          <DialogDescription className="text-xs">
            These settings override the order's settings for this job only.
          </DialogDescription>
        </DialogHeader>
        <JobSettingsSection {...sectionProps} />
      </DialogContent>
    </Dialog>
  )
}
