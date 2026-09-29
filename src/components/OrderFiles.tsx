import { useCallback, useState, type DragEvent, type KeyboardEvent } from 'react'
import { FileText, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fileService } from '../services/fileService'
import { historyService } from '../services/historyService'
import type { FileRow, FileRole } from '../services/fileService'
import { useFileLinking } from '../hooks/useFileLinking'
import { useToast } from './Toast'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Separator } from './ui/separator'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.orders.jobDetail.files

const ROLES: { value: FileRole; label: string }[] = [
  { value: 'PRODUCTION_FILE', label: 'Production file' },
  { value: 'PREVIEW', label: 'Preview / Mockup' },
  { value: 'CUSTOMER_APPROVAL', label: 'Customer approval' },
  { value: 'REFERENCE', label: 'Reference / Archive' },
]

type Props = {
  orderId: string
  files: FileRow[]
  onFileChanged: (newFile?: FileRow) => void | Promise<void>
}

/**
 * Manages the order's file links (UNC-path linking, not upload). The files
 * belong to the order but are shown as a tab of every job, so the production
 * view has them too. File-first flow: drop files (or click the drop area to
 * browse) to link them immediately — display name and role are then edited
 * inline on each row.
 */
export function OrderFiles({ orderId, files, onFileChanged }: Props) {
  const { showError } = useToast()
  const [error, setError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const revealFile = useCallback(
    async (rawPath: string) => {
      if (!window.pam) {
        showError('Opening files requires the desktop app.')
        return
      }
      const result = await window.pam.revealPath(rawPath)
      if (!result.ok) showError(result.error)
    },
    [showError],
  )

  const { pickAndLink, linkDropped } = useFileLinking(orderId)

  const handlePickAndLink = async () => {
    const added = await pickAndLink()
    if (added.length > 0) void onFileChanged()
  }

  const handleDrop = async (e: DragEvent<HTMLElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const added = await linkDropped(e)
    if (added.length > 0) void onFileChanged()
  }

  const handleUpdate = async (id: string, patch: { display_name?: string; role?: FileRole }) => {
    setError(null)
    try {
      await fileService.updateFile(id, patch)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saving')
      return
    }
    void onFileChanged()
  }

  const handleRemove = async (id: string) => {
    setError(null)
    setRemovingId(id)
    try {
      await fileService.deleteFile(id)
    } catch (err) {
      setRemovingId(null)
      setError(err instanceof Error ? err.message : 'Error deleting')
      return
    }
    const removed = files.find(file => file.id === id)
    void historyService.tryWriteHistory({
      order_id: orderId,
      event_type: 'FILE_REMOVED',
      meta: { display_name: removed?.display_name ?? null, role: removed?.role ?? null },
    })
    setRemovingId(null)
    void onFileChanged()
  }

  const commitNameOnEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur()
  }

  return (
    <section
      data-testid={IDS.root}
      aria-label="Order files"
      className={cn(
        'flex min-h-64 flex-col gap-3 rounded-lg',
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
      <p className="text-xs text-muted-foreground">
        Files of the whole order — links to the network share; the files themselves stay where they are.
      </p>

      <button
        type="button"
        data-testid={IDS.addFiles}
        onClick={() => void handlePickAndLink()}
        title="Click to browse, or drop files here"
        className={cn(
          'flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
          files.length === 0 ? 'flex-1 flex-col' : 'min-h-12 shrink-0',
          isDragging && 'border-primary bg-primary/5 text-foreground',
        )}
      >
        <Plus className={cn(files.length === 0 ? 'size-6' : 'size-4')} aria-hidden />
        {files.length === 0 ? 'Click here or drop files to link them' : 'Add files'}
      </button>
      {error && <p data-testid={IDS.error} className="text-sm text-destructive">{error}</p>}

      {files.length > 0 && (
        <>
          <Separator />
          <ul data-testid={IDS.list} className="divide-y divide-border">
            {files.map(file => (
              <li key={file.id} data-testid={IDS.item} data-file-id={file.id} className="py-1.5">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 shrink-0 text-primary" aria-hidden />
                  <Input
                    defaultValue={file.display_name}
                    aria-label="Display name"
                    data-testid={IDS.itemName}
                    maxLength={500}
                    className="h-7 min-w-0 flex-1"
                    onKeyDown={commitNameOnEnter}
                    onBlur={e => {
                      const next = e.target.value.trim()
                      if (next && next !== file.display_name) {
                        void handleUpdate(file.id, { display_name: next })
                      } else {
                        e.target.value = file.display_name
                      }
                    }}
                  />
                  <Select
                  value={file.role}
                  onValueChange={value => void handleUpdate(file.id, { role: value as FileRole })}
                >
                  <SelectTrigger className="w-44" aria-label="Role" data-testid={IDS.itemRole} data-value={file.role}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map(roleOption => (
                      <SelectItem key={roleOption.value} value={roleOption.value}>
                        {roleOption.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => void handleRemove(file.id)}
                    disabled={removingId === file.id}
                    title="Remove link"
                    aria-label={`Remove: ${file.display_name}`}
                    data-testid={IDS.itemRemove}
                  >
                    <X />
                  </Button>
                </div>
                <button
                  type="button"
                  data-testid={IDS.itemPath}
                  onClick={() => void revealFile(file.path)}
                  title={`Open in file manager\n${file.path}`}
                  className="mt-0.5 ml-6 block max-w-full cursor-pointer truncate rounded-sm text-xs text-muted-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {file.path}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
