import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import { JobTimeLogs } from '../JobTimeLogs'
import { TEST_IDS } from '@e2e/support/testIds'

type Props = {
  orderId: string
  jobId: string
  /** True once the job is DONE — the log becomes read-only. */
  disabled: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Hosts the worked-time log in a dialog opened from the job header. The
 * content mounts only while open, so the per-job log query runs on demand;
 * the per-job totals in the job list come from the order-level minutes query.
 */
export function JobTimeLogsDialog({ orderId, jobId, disabled, open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[70vh] flex-col sm:max-w-lg"
        data-testid={TEST_IDS.orders.jobDetail.timeLogsDialog.root}
      >
        <DialogHeader>
          <DialogTitle>Time logs</DialogTitle>
          <DialogDescription className="text-xs">Worked time logged on this job.</DialogDescription>
        </DialogHeader>
        <JobTimeLogs orderId={orderId} jobId={jobId} disabled={disabled} />
      </DialogContent>
    </Dialog>
  )
}
