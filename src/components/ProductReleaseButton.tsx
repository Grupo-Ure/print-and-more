import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProductRelease } from '../hooks/useProductRelease'
import { PRODUCT_STATUS_META } from '../lib/statusLabels'
import type { LoadedProduct } from '../types/product'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { Textarea } from './ui/textarea'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.orders.productDetail.release

type Props = {
  product: LoadedProduct
}

/**
 * The product header's forward action: advances the product one workflow step,
 * in the colour of the target status. Admins additionally get a dropdown with
 * the force release while a stock or approval-round gate is failing. A product
 * in setup has no advance — it enters pre-press on its own once its order is
 * started — and neither has a product awaiting approval, so neither is offered
 * anything. Every rule lives in useProductRelease; this component is the
 * presentation.
 */
export function ProductReleaseButton({ product }: Props) {
  const release = useProductRelease(product)
  const [forceDialogOpen, setForceDialogOpen] = useState(false)

  const forceDialog = (
    <ForceReleaseDialog
      open={forceDialogOpen}
      onOpenChange={setForceDialogOpen}
      pending={release.pending}
      onSubmit={release.forceRelease}
    />
  )

  // No next status (setup, DONE) or the order is still a quote → nothing to advance.
  if (release.target == null || release.label == null) return null
  const target = release.target

  const mainClassName = cn(
    'h-10 px-6 text-lg',
    PRODUCT_STATUS_META[target].color,
    PRODUCT_STATUS_META[target].hoverColor,
    release.canForceRelease ? 'rounded-l-full rounded-r-none' : 'ml-auto rounded-full',
  )

  const mainButton = (
    <Button
      type="button"
      variant="default"
      data-testid={IDS.button}
      data-target={target}
      className={mainClassName}
      disabled={release.disabled}
      onClick={() => void release.advance()}
    >
      {release.pending ? '…' : release.label}
    </Button>
  )

  if (!release.canForceRelease) return mainButton

  return (
    <div className="ml-auto flex items-center">
      {mainButton}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="default"
            className={cn(
              'h-10 rounded-r-full rounded-l-none border-l border-white/30 px-2',
              PRODUCT_STATUS_META[target].color,
              PRODUCT_STATUS_META[target].hoverColor,
            )}
            disabled={release.pending}
            aria-label="More release options"
            data-testid={IDS.menuTrigger}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto min-w-64 p-0 overflow-hidden">
          <DropdownMenuItem
            data-testid={IDS.forceItem}
            disabled={release.pending}
            onSelect={() => setForceDialogOpen(true)}
            className={cn('rounded-none px-3 py-2.5', PRODUCT_STATUS_META[target].softHoverColor)}
          >
            Force release to Production…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {forceDialog}
    </div>
  )
}

type ForceReleaseDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  pending: boolean
  /** Resolves true once the product is released. */
  onSubmit: (reason: string) => Promise<boolean>
}

/** The force release's prompt: a reason is required, and recorded with the release. */
function ForceReleaseDialog({ open, onOpenChange, pending, onSubmit }: ForceReleaseDialogProps) {
  const [reason, setReason] = useState('')

  const close = (next: boolean) => {
    onOpenChange(next)
    if (!next) setReason('')
  }

  const handleSubmit = async () => {
    const released = await onSubmit(reason.trim())
    if (released) close(false)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md" data-testid={IDS.dialog.root}>
        <DialogHeader>
          <DialogTitle>Force release to production?</DialogTitle>
          <DialogDescription>
            The product moves to production even though its requirements are
            not fulfilled. The override is recorded in the order history with
            your name and reason.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          data-testid={IDS.dialog.reason}
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Reason for the emergency release"
          autoFocus
        />
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            data-testid={IDS.dialog.cancel}
            onClick={() => close(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            data-testid={IDS.dialog.submit}
            className={cn(
              'text-primary-foreground',
              PRODUCT_STATUS_META.IN_PRODUCTION.color,
              PRODUCT_STATUS_META.IN_PRODUCTION.hoverColor,
            )}
            onClick={() => void handleSubmit()}
            disabled={pending || reason.trim() === ''}
          >
            {pending ? '…' : 'Force Release to Production'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
