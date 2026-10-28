import { useState, type DragEvent, type KeyboardEvent } from 'react'
import { FileText, Pencil, Plus, Send, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fileService } from '../services/fileService'
import { historyService } from '../services/historyService'
import type { FileRow, FileRole } from '../services/fileService'
import type { StockShortage } from '../services/productionReleaseService'
import type { LoadedProduct } from '../types/product'
import { useApprovalRequests } from '../queries/approvalQueries'
import { useFileLinking } from '../hooks/useFileLinking'
import { useRevealFile } from '../hooks/useRevealFile'
import { ApprovalRequestDialog } from './productDetail/ApprovalRequestDialog'
import { ApprovalRequestsTable } from './productDetail/ApprovalRequestsTable'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Separator } from './ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.orders.productDetail.files

type FilesScope = 'product' | 'order'

// The whole order's scope is hidden for now (the tab shows the product's own
// files only); with a single scope the switch is not rendered. Adding
// `{ value: 'order', label: 'Whole order' }` back brings it back.
const SCOPES: { value: FilesScope; label: string }[] = [{ value: 'product', label: 'This product' }]

// A file shown to the customer in a round has no cascade from the round's
// file rows, so the database refuses to remove it from the order.
const FOREIGN_KEY_VIOLATION = '23503'

function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === FOREIGN_KEY_VIOLATION
}

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
  product: LoadedProduct
  /** The order's files. */
  files: FileRow[]
  /** The ids of the product's own files: its attachments, or a textile batch's design files. */
  productFileIds: string[]
  /** What the product is short of, for the request dialog's warning. */
  shortages: StockShortage[]
  /** The order's customer's address, which the request mail goes to. */
  customerEmail: string | null
  onFileChanged: (newFile?: FileRow) => void | Promise<void>
}

/**
 * The product's Files tab (UNC-path linking, not upload). The files belong to
 * the order; the tab shows the product's own (the whole order's scope is
 * hidden for now, see `SCOPES`), and sits on the product so the production
 * view has it too.
 * File-first flow: drop files (or click the drop area to browse) to link them
 * immediately — to the order and to this product — and edit display name and
 * role inline on each row.
 *
 * The product scope is where a customer approval is asked for: tick the
 * proofs, *Request approval*, and every round of the product is listed below
 * with what came of it. The order scope is for browsing and offers no request.
 * Mount it per product (`key`), so the ticks never carry over to another one.
 */
export function OrderFiles({ orderId, product, files, productFileIds, shortages, customerEmail, onFileChanged }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  // The one row currently showing its name as an input instead of text.
  const [editingNameId, setEditingNameId] = useState<string | null>(null)
  const [scope, setScope] = useState<FilesScope>('product')
  // null until the user ticks or unticks a file: the ticks then start from the
  // previous round's files, so the next round preselects them.
  const [ticked, setTicked] = useState<Set<string> | null>(null)
  const [requestDialogOpen, setRequestDialogOpen] = useState(false)

  const revealFile = useRevealFile()
  const { data: requests = [] } = useApprovalRequests(product.id)

  const { pickAndLink, linkDropped } = useFileLinking(orderId, product.id)

  const productFiles = files.filter(file => productFileIds.includes(file.id))
  const shownFiles = scope === 'product' ? productFiles : files
  const newestRequest = requests[0] ?? null
  const previousRoundFileIds =
    newestRequest && newestRequest.status !== 'PENDING'
      ? newestRequest.files.map(file => file.file_id).filter(fileId => productFileIds.includes(fileId))
      : []
  const tickedIds = ticked ?? new Set(previousRoundFileIds)
  const tickedFiles = productFiles.filter(file => tickedIds.has(file.id))
  // A request needs the product in pre-press (the RPC refuses anything else) and a file to show.
  const canRequest = product.status === 'PREPRESS' && !product.is_cancelled && productFiles.length > 0

  const toggleTicked = (fileId: string, checked: boolean) => {
    const next = new Set(tickedIds)
    if (checked) next.add(fileId)
    else next.delete(fileId)
    setTicked(next)
  }

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
      if (isForeignKeyViolation(err)) {
        setError('This file was shown to the customer in an approval round and stays with the order as its record.')
        return
      }
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
      data-scope={scope}
      aria-label={scope === 'product' ? 'Product files' : 'Order files'}
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
      <div className="flex items-center gap-3">
        {SCOPES.length > 1 && (
          <div role="group" aria-label="Show files of" className="inline-flex rounded-md border p-0.5">
            {SCOPES.map(option => (
              <Button
                key={option.value}
                type="button"
                size="xs"
                variant={scope === option.value ? 'secondary' : 'ghost'}
                aria-pressed={scope === option.value}
                data-testid={IDS.scope}
                data-scope={option.value}
                data-active={scope === option.value || undefined}
                onClick={() => setScope(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        )}
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">
          {scope === 'product' ? 'Files of this product' : 'Files of the whole order'}
        </p>
      </div>

      <button
        type="button"
        data-testid={IDS.addFiles}
        onClick={() => void handlePickAndLink()}
        title="Click to browse, or drop files here"
        className={cn(
          'flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
          shownFiles.length === 0 ? 'min-h-40 flex-col' : 'min-h-12 shrink-0',
          isDragging && 'border-primary bg-primary/5 text-foreground',
        )}
      >
        <Plus className={cn(shownFiles.length === 0 ? 'size-6' : 'size-4')} aria-hidden />
        {shownFiles.length === 0 ? 'Click here or drop files to link them' : 'Add files'}
      </button>
      {error && <p data-testid={IDS.error} className="text-sm text-destructive">{error}</p>}

      {shownFiles.length > 0 && (
        <>
          <Separator />
          {/* Name, path, role — in that order, matching the products and time
              logs tabs. The name is plain text with a pencil to edit it,
              rather than an always-open input. */}
          <div data-testid={IDS.list} className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  {scope === 'product' && <TableHead className="h-9 w-10 px-3" aria-label="Selected" />}
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
                {shownFiles.map(file => {
                  const isEditingName = editingNameId === file.id
                  const isTicked = tickedIds.has(file.id)
                  return (
                    <TableRow key={file.id} data-testid={IDS.item} data-file-id={file.id}>
                      {scope === 'product' && (
                        <TableCell className="px-3 py-2 align-middle">
                          <Checkbox
                            data-testid={IDS.itemSelect}
                            aria-label={`Select ${file.display_name}`}
                            checked={isTicked}
                            onCheckedChange={checked => toggleTicked(file.id, checked === true)}
                          />
                        </TableCell>
                      )}
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

      {scope === 'product' && (
        <ApprovalRequestsTable
          orderId={orderId}
          productId={product.id}
          requests={requests}
          action={
            <Button
              type="button"
              size="sm"
              data-testid={IDS.requestApproval}
              disabled={!canRequest}
              title={
                canRequest
                  ? undefined
                  : productFiles.length === 0
                    ? 'Link the proof to this product first'
                    : 'An approval can be requested while the product is in pre-press'
              }
              onClick={() => setRequestDialogOpen(true)}
            >
              <Send />
              Request approval
            </Button>
          }
        />
      )}

      {requestDialogOpen && (
        <ApprovalRequestDialog
          orderId={orderId}
          productId={product.id}
          // The ticked files, refined in the dialog; with none ticked, every file of the product.
          files={tickedFiles.length > 0 ? tickedFiles : productFiles}
          preselectedFileIds={(tickedFiles.length > 0 ? tickedFiles : productFiles).map(file => file.id)}
          shortages={shortages}
          customerEmail={customerEmail}
          onClose={() => setRequestDialogOpen(false)}
        />
      )}
    </section>
  )
}
