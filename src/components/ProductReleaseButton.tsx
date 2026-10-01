import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProductRelease } from '../hooks/useProductRelease'
import { PRODUCT_STATUS_META } from '../const/orderStatus'
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
  orderNumber: string | null
}

/**
 * The product header's forward action: advances the product one workflow step,
 * in the colour of the target status. Admins additionally get a dropdown with
 * the force release while a completeness/stock gate is failing. Every rule
 * lives in useProductRelease; this component is the presentation.
 */
export function ProductReleaseButton({ product, orderNumber }: Props) {
  const release = useProductRelease(product, orderNumber)
  const [forceDialogOpen, setForceDialogOpen] = useState(false)
  const [forceReason, setForceReason] = useState('')

  // No next status (DONE) or the order is still a quote → nothing to advance.
  if (release.target == null || release.label == null) return null
  const target = release.target

  const handleForceRelease = async () => {
    const released = await release.forceRelease(forceReason.trim())
    if (!released) return
    setForceDialogOpen(false)
    setForceReason('')
  }

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
          {/* Customer approval is the one gate a force release does not bypass. */}
          <DropdownMenuItem
            data-testid={IDS.forceItem}
            disabled={release.pending || release.approvalBlocked}
            onSelect={() => setForceDialogOpen(true)}
            className={cn('rounded-none px-3 py-2.5', PRODUCT_STATUS_META[target].softHoverColor)}
          >
            <div className="flex flex-col">
              <span>Force release to Production…</span>
              {release.approvalBlocked && (
                <span className="text-xs text-muted-foreground">
                  Requires the customer's approval
                </span>
              )}
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={forceDialogOpen}
        onOpenChange={open => {
          setForceDialogOpen(open)
          if (!open) setForceReason('')
        }}
      >
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
            value={forceReason}
            onChange={e => setForceReason(e.target.value)}
            placeholder="Reason for the emergency release"
            autoFocus
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              data-testid={IDS.dialog.cancel}
              onClick={() => setForceDialogOpen(false)}
              disabled={release.pending}
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
              onClick={() => void handleForceRelease()}
              disabled={release.pending || forceReason.trim() === ''}
            >
              {release.pending ? '…' : 'Force Release to Production'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
