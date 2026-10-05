/**
 * Where a file comes from, as tabs over one bordered box.
 *
 * Two tabs are always there: *Add artwork* is a drop zone — drop files on it,
 * or click it to browse — and every file is linked to the order (the files
 * belong to the order, as on the Files tab) before it is handed back as a pick;
 * *Order files* lists the files the order already has, each a click away from
 * being picked. A host may add tabs of its own (`extraTabs`) for sources that
 * are not a file at all — the textile editor's typed-out text design.
 *
 * Open while the host holds nothing (`hasPicks`), so the first file can be
 * added straight away; once it holds one, the box folds into a full-width
 * button and opens again on click, folding back after each pick. Hosts render
 * it only where something can be added — in a read-only form, not at all.
 */

import { useState, type DragEvent, type ReactNode } from 'react'
import { FileText, Plus, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FileRow } from '../services/fileService'
import { useFileLinking } from '../hooks/useFileLinking'
import { Button } from './ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.filePicker

/** A source of the host's own, rendered as one more tab beside the two shared ones. */
export type FilePickerTab = {
  /** Tab key; unique within the picker. */
  value: string
  label: string
  triggerTestId?: string
  /** `fold` collapses the picker, as making a pick does. */
  render: (fold: () => void) => ReactNode
}

export function FilePicker({
  orderId,
  orderFiles,
  hasPicks,
  collapsedLabel,
  fileBadge,
  isFilePicked,
  extraTabs = [],
  onPick,
}: {
  orderId: string
  orderFiles: FileRow[]
  /** True once the host holds at least one file: the picker folds into `collapsedLabel`. */
  hasPicks: boolean
  /** Label of the button the folded picker shows, e.g. *Add another design*. */
  collapsedLabel: string
  /** Trailing badge for an order file — how often the host has taken it. */
  fileBadge?: (file: FileRow) => ReactNode
  /** Order files the host cannot take again; listed, but not clickable. */
  isFilePicked?: (file: FileRow) => boolean
  extraTabs?: FilePickerTab[]
  /** Files picked: linked artwork (one call per drop or browse) or one order file. */
  onPick: (fileIds: string[]) => void
}) {
  const { pickAndLink, linkDropped } = useFileLinking(orderId)
  const [expanded, setExpanded] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const fold = () => setExpanded(false)

  if (hasPicks && !expanded) {
    return (
      <Button
        type="button"
        variant="outline"
        className="w-full"
        data-testid={IDS.expand}
        onClick={() => setExpanded(true)}
      >
        <Plus /> {collapsedLabel}
      </Button>
    )
  }

  const pickLinked = (added: FileRow[]) => {
    if (added.length === 0) return
    onPick(added.map(file => file.id))
    fold()
  }
  const handleDrop = async (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    setIsDragging(false)
    pickLinked(await linkDropped(event))
  }

  return (
    <Tabs defaultValue="drop" data-testid={IDS.root} className="gap-0 overflow-hidden rounded-md border">
      <TabsList className="w-full rounded-none border-b">
        <TabsTrigger value="drop" data-testid={IDS.dropTab} className="text-sm">
          Add artwork
        </TabsTrigger>
        <TabsTrigger value="files" data-testid={IDS.filesTab} className="text-sm">
          Order files{orderFiles.length > 0 ? ` (${orderFiles.length})` : ''}
        </TabsTrigger>
        {extraTabs.map(tab => (
          <TabsTrigger key={tab.value} value={tab.value} data-testid={tab.triggerTestId} className="text-sm">
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="drop">
        <button
          type="button"
          data-testid={IDS.dropZone}
          title="Click to browse, or drop files here"
          onClick={() => void pickAndLink().then(pickLinked)}
          onDragEnter={event => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragOver={event => {
            event.preventDefault()
            event.dataTransfer.dropEffect = 'copy'
            setIsDragging(true)
          }}
          onDragLeave={event => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsDragging(false)
          }}
          onDrop={event => void handleDrop(event)}
          className={cn(
            'flex min-h-28 w-full cursor-pointer flex-col items-center justify-center gap-1 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset focus-visible:outline-none',
            isDragging && 'bg-primary/5 text-foreground',
          )}
        >
          <Upload className="size-5" aria-hidden />
          Drop artwork here or click to browse
        </button>
      </TabsContent>
      <TabsContent value="files">
        {orderFiles.length === 0 ? (
          <div className="flex min-h-28 flex-col items-center justify-center gap-1 px-4 text-center text-sm text-muted-foreground">
            <FileText className="size-5" aria-hidden />
            <p>No files are linked to this order yet.</p>
            <p className="text-xs">Drop the artwork on the first tab to link it.</p>
          </div>
        ) : (
          <ul className="min-h-28 divide-y">
            {orderFiles.map(file => {
              const picked = isFilePicked?.(file) ?? false
              return (
                <li key={file.id}>
                  <button
                    type="button"
                    data-testid={IDS.file}
                    data-file-id={file.id}
                    disabled={picked}
                    title={picked ? file.display_name : `Apply ${file.display_name}`}
                    onClick={() => {
                      onPick([file.id])
                      fold()
                    }}
                    className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset focus-visible:outline-none disabled:cursor-default disabled:text-muted-foreground disabled:hover:bg-transparent"
                  >
                    <FileText className={cn('size-4 shrink-0', picked ? 'text-muted-foreground' : 'text-primary')} aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{file.display_name}</span>
                    {fileBadge?.(file)}
                    {!picked && <Plus className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </TabsContent>
      {extraTabs.map(tab => (
        <TabsContent key={tab.value} value={tab.value}>
          {tab.render(fold)}
        </TabsContent>
      ))}
    </Tabs>
  )
}
