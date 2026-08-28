import { useState, type DragEvent } from 'react'
import { Check, FileText, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FileRow } from '../../services/fileService'
import { useFileLinking } from '../../hooks/useFileLinking'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'

type Props = {
  orderId: string
  files: FileRow[]
  /** Reloads the order's files after linking from inside this dialog. */
  onFilesChanged: () => void | Promise<void>
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called with the chosen file id; the caller runs the mutation and closes on success. */
  onConfirm: (fileId: string) => void
  pending: boolean
}

/**
 * Grants customer approval for a job by picking which of the order's files the
 * customer approved. Files can also be linked right here (click or drop) —
 * a newly linked file becomes the selected one.
 */
export function GrantApprovalDialog({
  orderId,
  files,
  onFilesChanged,
  open,
  onOpenChange,
  onConfirm,
  pending,
}: Props) {
  const { pickAndLink, linkDropped } = useFileLinking(orderId)
  const [selected, setSelected] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const selectedId = selected ?? files[0]?.id ?? null

  const handleOpenChange = (next: boolean) => {
    if (!next) setSelected(null)
    onOpenChange(next)
  }

  const afterLinked = (added: FileRow[]) => {
    if (added.length === 0) return
    setSelected(added[added.length - 1].id)
    void onFilesChanged()
  }

  const handlePick = async () => {
    afterLinked(await pickAndLink())
  }

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    afterLinked(await linkDropped(e))
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[60vh] flex-col sm:max-w-lg',
          isDragging && 'ring-2 ring-primary',
        )}
        onDragEnter={e => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragOver={e => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
          setIsDragging(true)
        }}
        onDragLeave={e => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false)
        }}
        onDrop={e => void handleDrop(e)}
      >
        <DialogHeader>
          <DialogTitle>Grant customer approval</DialogTitle>
          <DialogDescription>Which file did the customer approve?</DialogDescription>
        </DialogHeader>

        <button
          type="button"
          onClick={() => void handlePick()}
          title="Click to browse, or drop files here"
          className={cn(
            'flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
            files.length === 0 ? 'min-h-28 flex-col' : 'min-h-10 shrink-0',
            isDragging && 'border-primary bg-primary/5 text-foreground',
          )}
        >
          <Plus className={cn(files.length === 0 ? 'size-6' : 'size-4')} aria-hidden />
          {files.length === 0 ? 'Click here or drop files to link them' : 'Add files'}
        </button>

        {files.length > 0 && (
          <div className="min-h-0 flex-1 overflow-y-auto" role="radiogroup" aria-label="Approved file">
            <ul className="flex flex-col gap-1">
              {files.map(file => {
                const isSelected = file.id === selectedId
                return (
                  <li key={file.id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setSelected(file.id)}
                      className={cn(
                        'flex w-full cursor-pointer items-center gap-2 rounded-lg border p-2 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                        isSelected ? 'border-primary bg-primary/5' : 'hover:bg-accent',
                      )}
                    >
                      <FileText className="size-4 shrink-0 text-primary" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{file.display_name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{file.path}</span>
                      </span>
                      {isSelected && <Check className="size-4 shrink-0 text-primary" aria-hidden />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={selectedId == null || pending}
            onClick={() => selectedId && onConfirm(selectedId)}
          >
            {pending ? 'Granting…' : 'Grant approval'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
