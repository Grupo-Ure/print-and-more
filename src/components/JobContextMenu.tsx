import type { ReactElement } from 'react'
import { ArrowRight, Ban, Trash2 } from 'lucide-react'
import { useJobRelease } from '../hooks/useJobRelease'
import { useJobRemoval } from '../hooks/useJobRemoval'
import type { JobRow } from '../types/database'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from './ui/context-menu'

type Props = {
  job: JobRow
  orderNumber: string | null
  /** The row that opens the menu on right-click. */
  children: ReactElement
}

/**
 * Right-click menu for a row of the job list: advance the job to its next
 * workflow stage, or delete/cancel it. The items mount only while the menu
 * is open, so their queries (products, stock) run on demand for that job.
 */
export function JobContextMenu({ job, orderNumber, children }: Props) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <JobContextMenuItems job={job} orderNumber={orderNumber} />
      </ContextMenuContent>
    </ContextMenu>
  )
}

function JobContextMenuItems({ job, orderNumber }: Omit<Props, 'children'>) {
  const release = useJobRelease(job, orderNumber)
  const removal = useJobRemoval(job)

  return (
    <>
      {release.label != null && (
        <>
          <ContextMenuItem disabled={release.disabled} onSelect={() => void release.advance()}>
            <ArrowRight />
            {release.label}
          </ContextMenuItem>
          <ContextMenuSeparator />
        </>
      )}
      {removal.canDelete ? (
        <ContextMenuItem
          variant="destructive"
          disabled={removal.pending}
          onSelect={() => void removal.requestDelete()}
        >
          <Trash2 />
          Delete job
        </ContextMenuItem>
      ) : (
        <ContextMenuItem
          variant="destructive"
          disabled={!removal.canCancel || removal.pending}
          onSelect={() => void removal.requestCancel()}
        >
          <Ban />
          Cancel job
        </ContextMenuItem>
      )}
    </>
  )
}
