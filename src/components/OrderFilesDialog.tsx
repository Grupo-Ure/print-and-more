import { useCallback, useState, type DragEvent, type KeyboardEvent } from 'react'
import { FileText, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fileService } from '../services/fileService'
import { historyService } from '../services/historyService'
import type { FileRow, FileRole } from '../services/fileService'
import { useToast } from './Toast'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Separator } from './ui/separator'

const ROLES: { value: FileRole; label: string }[] = [
  { value: 'PRODUCTION_FILE', label: 'Production file' },
  { value: 'PREVIEW', label: 'Preview / Mockup' },
  { value: 'CUSTOMER_APPROVAL', label: 'Customer approval' },
  { value: 'REFERENCE', label: 'Reference / Archive' },
]

const DEFAULT_ROLE: FileRole = 'PRODUCTION_FILE'

type Props = {
  orderId: string
  files: FileRow[]
  onFileChanged: (newFile?: FileRow) => void | Promise<void>
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Manages the order's file links (UNC-path linking, not upload) in a dialog.
 * File-first flow: drop files (or click the drop area to browse) to link them
 * immediately — display name and role are then edited inline on each row.
 */
export function OrderFilesDialog({ orderId, files, onFileChanged, open, onOpenChange }: Props) {
  const { showError, showSuccess } = useToast()
  const [error, setError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const revealFile = useCallback(
    async (rawPath: string) => {
      if (!window.auftrag) {
        showError('Opening files requires the desktop app.')
        return
      }
      const result = await window.auftrag.revealPath(rawPath)
      if (!result.ok) showError(result.error)
    },
    [showError],
  )

  const linkFile = async (name: string, filePath: string): Promise<boolean> => {
    try {
      const data = await fileService.createFile({
        order_id: orderId,
        display_name: name,
        path: filePath,
        role: DEFAULT_ROLE,
      })
      void historyService.tryWriteHistory({
        order_id: orderId,
        event_type: 'FILE_ADDED',
        meta: { display_name: data.display_name, role: data.role },
      })
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saving')
      return false
    }
  }

  const linkPaths = async (paths: { name: string; path: string }[]) => {
    setError(null)
    let added = 0
    for (const item of paths) {
      if (!(await linkFile(item.name, item.path))) break
      added++
    }
    if (added > 0) {
      showSuccess(added === 1 ? '1 file linked' : `${added} files linked`)
      void onFileChanged()
    }
  }

  const handlePickAndLink = async () => {
    if (!window.auftrag) {
      showError('Linking files requires the desktop app.')
      return
    }
    const picked = await window.auftrag.pickFiles()
    await linkPaths(
      picked.map(filePath => ({
        name: filePath.replace(/\\/g, '/').split('/').pop() ?? filePath,
        path: filePath,
      })),
    )
  }

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (!window.auftrag) {
      showError('Linking dropped files requires the desktop app.')
      return
    }
    const native = window.auftrag
    await linkPaths(
      Array.from(e.dataTransfer.files)
        .map(item => ({ name: item.name, path: native.getPathForFile(item) }))
        .filter(item => item.path),
    )
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex h-[70vh] flex-col sm:max-w-3xl',
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
          <DialogTitle>Order files</DialogTitle>
          <DialogDescription>
            Links to files on the network share — the files themselves stay where they are.
          </DialogDescription>
        </DialogHeader>

        <button
          type="button"
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
        {error && <p className="text-sm text-destructive">{error}</p>}

        {files.length > 0 && (
          <>
            <Separator />
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ul className="divide-y divide-border">
                {files.map(file => (
                  <li key={file.id} className="py-1.5">
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 shrink-0 text-primary" aria-hidden />
                      <Input
                        defaultValue={file.display_name}
                        aria-label="Display name"
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
                      <SelectTrigger className="w-44" aria-label="Role">
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
                      >
                        <X />
                      </Button>
                    </div>
                    <button
                      type="button"
                      onClick={() => void revealFile(file.path)}
                      title={`Open in file manager\n${file.path}`}
                      className="mt-0.5 ml-6 block max-w-full cursor-pointer truncate rounded-sm text-xs text-muted-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      {file.path}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
