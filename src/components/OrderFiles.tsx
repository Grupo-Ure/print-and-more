import { useCallback, useState, type DragEvent, type KeyboardEvent } from 'react'
import { FileText, Pencil, Plus, X } from 'lucide-react'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.orders.productDetail.files

const ROLES: { value: FileRole; label: string }[] = [
  { value: 'PRODUCTION_FILE', label: 'Production file' },
  { value: 'PREVIEW', label: 'Preview / Mockup' },
  { value: 'CUSTOMER_APPROVAL', label: 'Customer approval' },
  { value: 'REFERENCE', label: 'Reference / Archive' },
]

// The blue edit accent the product's other tabs use, so the Files tab reads
// the same as the rest of the detail view.
const EDIT_ACTION_CLASS =
  'text-blue-700 hover:bg-transparent hover:text-blue-400 dark:text-blue-500 dark:hover:bg-transparent dark:hover:text-blue-600'

type Props = {
  orderId: string
  files: FileRow[]
  onFileChanged: (newFile?: FileRow) => void | Promise<void>
}

/**
 * Manages the order's file links (UNC-path linking, not upload). The files
 * belong to the order but are shown as a tab of every product, so the
 * production view has them too. File-first flow: drop files (or click the
 * drop area to browse) to link them immediately — display name and role are
 * then edited inline on each row.
 */
export function OrderFiles({ orderId, files, onFileChanged }: Props) {
  const { showError } = useToast()
  const [error, setError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  // The one row currently showing its name as an input instead of text.
  const [editingNameId, setEditingNameId] = useState<string | null>(null)

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

  const commitName = (file: FileRow, rawValue: string) => {
    const next = rawValue.trim()
    if (next && next !== file.display_name) void handleUpdate(file.id, { display_name: next })
    setEditingNameId(null)
  }

  const handleNameKeyDown = (e: KeyboardEvent<HTMLInputElement>, file: FileRow) => {
    if (e.key === 'Enter') commitName(file, e.currentTarget.value)
    if (e.key === 'Escape') setEditingNameId(null)
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
          {/* Name, path, role — in that order, matching the products and time
              logs tabs. The name is plain text with a pencil to edit it,
              rather than an always-open input. */}
          <div data-testid={IDS.list} className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-9 px-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Name
                  </TableHead>
                  <TableHead className="h-9 px-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Path
                  </TableHead>
                  <TableHead className="h-9 w-48 px-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Role
                  </TableHead>
                  <TableHead className="h-9 w-10 px-3" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map(file => {
                  const isEditingName = editingNameId === file.id
                  return (
                    <TableRow key={file.id} data-testid={IDS.item} data-file-id={file.id}>
                      <TableCell className="max-w-64 px-3 py-2 align-middle">
                        <div className="flex items-center gap-2">
                          <FileText className="size-4 shrink-0 text-primary" aria-hidden />
                          {isEditingName ? (
                            <Input
                              autoFocus
                              defaultValue={file.display_name}
                              aria-label="Display name"
                              data-testid={IDS.itemName}
                              maxLength={500}
                              className="h-9 min-w-0 flex-1 rounded-sm text-lg"
                              onKeyDown={e => handleNameKeyDown(e, file)}
                              onBlur={e => commitName(file, e.target.value)}
                            />
                          ) : (
                            <>
                              <span
                                data-testid={IDS.itemName}
                                title={file.display_name}
                                className="min-w-0 flex-1 truncate text-lg"
                              >
                                {file.display_name}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className={cn('shrink-0', EDIT_ACTION_CLASS)}
                                title="Edit name"
                                aria-label={`Edit name: ${file.display_name}`}
                                data-testid={IDS.itemEditName}
                                onClick={() => setEditingNameId(file.id)}
                              >
                                <Pencil />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-64 px-3 py-2 align-middle">
                        <button
                          type="button"
                          data-testid={IDS.itemPath}
                          onClick={() => void revealFile(file.path)}
                          title={`Open in file manager\n${file.path}`}
                          className="block max-w-full cursor-pointer truncate rounded-sm text-left text-base text-muted-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        >
                          {file.path}
                        </button>
                      </TableCell>
                      <TableCell className="px-3 py-2 align-middle">
                        <Select
                          value={file.role}
                          onValueChange={value => void handleUpdate(file.id, { role: value as FileRole })}
                        >
                          <SelectTrigger
                            className="w-44"
                            aria-label="Role"
                            data-testid={IDS.itemRole}
                            data-value={file.role}
                          >
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
                      </TableCell>
                      <TableCell className="px-1 py-2 align-middle">
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
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </section>
  )
}
