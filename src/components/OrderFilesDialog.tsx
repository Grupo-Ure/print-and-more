import { useCallback, useState, type DragEvent, type FormEvent } from 'react'
import { FileText, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fileService } from '../services/fileService'
import { historyService } from '../services/historyService'
import type { FileRow, FileRole } from '../services/fileService'
import { useToast } from './Toast'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Separator } from './ui/separator'

const ROLES: { value: FileRole; label: string }[] = [
  { value: 'PRODUCTION_FILE', label: 'Production file' },
  { value: 'PREVIEW', label: 'Preview / Mockup' },
  { value: 'CUSTOMER_APPROVAL', label: 'Customer approval' },
  { value: 'REFERENCE', label: 'Reference / Archive' },
]

const ROLE_SHORT_LABELS: Record<FileRole, string> = {
  PRODUCTION_FILE: 'Prod.',
  PREVIEW: 'Preview',
  CUSTOMER_APPROVAL: 'Approval',
  REFERENCE: 'Reference',
}

type Props = {
  orderId: string
  files: FileRow[]
  onFileChanged: (newFile?: FileRow) => void | Promise<void>
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Manages the order's file links (UNC-path linking, not upload) in a dialog:
 * add form always on top, linked files listed below. Opening a file reveals it
 * in the OS file manager via the Electron bridge.
 */
export function OrderFilesDialog({ orderId, files, onFileChanged, open, onOpenChange }: Props) {
  const { showError, showSuccess } = useToast()
  const [displayName, setDisplayName] = useState('')
  const [path, setPath] = useState('')
  const [role, setRole] = useState<FileRole>('PRODUCTION_FILE')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
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
        role: role,
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

  const handlePickAndLink = async () => {
    if (!window.auftrag) {
      showError('Linking files requires the desktop app.')
      return
    }
    const picked = await window.auftrag.pickFile()
    if (!picked) return
    setError(null)
    const fileName = picked.replace(/\\/g, '/').split('/').pop() ?? picked
    if (await linkFile(fileName, picked)) {
      showSuccess('1 file linked')
      void onFileChanged()
    }
  }

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const trimmedName = displayName.trim()
    const trimmedPath = path.trim()
    if (!trimmedName || !trimmedPath) {
      setError('Display name and path are required.')
      return
    }
    setSaving(true)
    let data: FileRow | null
    try {
      data = await fileService.createFile({
        order_id: orderId,
        display_name: trimmedName,
        path: trimmedPath,
        role: role,
      })
    } catch (err) {
      setSaving(false)
      setError(err instanceof Error ? err.message : 'Error saving')
      return
    }
    setSaving(false)
    if (data) {
      void historyService.tryWriteHistory({
        order_id: orderId,
        event_type: 'FILE_ADDED',
        meta: { display_name: data.display_name, role: data.role },
      })
      setDisplayName('')
      setPath('')
      setRole('PRODUCTION_FILE')
      void onFileChanged(data)
    }
  }

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (!window.auftrag) {
      showError('Linking dropped files requires the desktop app.')
      return
    }
    const dropped = Array.from(e.dataTransfer.files)
    if (dropped.length === 0) return
    setError(null)
    let added = 0
    for (const item of dropped) {
      const itemPath = window.auftrag.getPathForFile(item)
      if (!itemPath) continue
      if (!(await linkFile(item.name, itemPath))) break
      added++
    }
    if (added > 0) {
      showSuccess(added === 1 ? '1 file linked' : `${added} files linked`)
      void onFileChanged()
    }
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[70vh] flex-col sm:max-w-2xl',
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

        <form onSubmit={e => void handleAdd(e)} className="flex flex-wrap items-end gap-2">
          <div className="grid min-w-40 flex-1 gap-1">
            <Label htmlFor="order-file-name">Display name</Label>
            <Input
              id="order-file-name"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="e.g. Flyer A6 final.pdf"
              maxLength={500}
              required
            />
          </div>
          <div className="grid min-w-56 flex-2 gap-1">
            <Label htmlFor="order-file-path">Path</Label>
            <Input
              id="order-file-path"
              value={path}
              onChange={e => setPath(e.target.value)}
              placeholder="\\server\share\…"
              maxLength={2000}
              title={path}
              required
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="order-file-role">Role</Label>
            <Select value={role} onValueChange={value => setRole(value as FileRole)}>
              <SelectTrigger id="order-file-role" className="w-40">
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
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? 'Adding…' : 'Add'}
          </Button>
        </form>
        {error && <p className="text-sm text-destructive">{error}</p>}

        {window.auftrag && (
          <button
            type="button"
            onClick={() => void handlePickAndLink()}
            title="Click to browse, or drop files here"
            className={cn(
              'flex min-h-16 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
              isDragging && 'border-primary bg-primary/5 text-foreground',
            )}
          >
            <Plus className="size-4" aria-hidden />
            Add files
          </button>
        )}

        <Separator />

        <div className="min-h-0 flex-1 overflow-y-auto">
          {files.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No files linked yet</p>
          ) : (
            <ul className="divide-y divide-border">
              {files.map(file => (
                <li key={file.id} className="flex items-center gap-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => void revealFile(file.path)}
                    title={`Open in file manager\n${file.path}`}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-sm text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate text-sm font-medium hover:underline">
                      {file.display_name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">{file.path}</span>
                  </button>
                  <Badge
                    variant="secondary"
                    title={ROLES.find(roleOption => roleOption.value === file.role)?.label ?? file.role}
                  >
                    {ROLE_SHORT_LABELS[file.role]}
                  </Badge>
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
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
