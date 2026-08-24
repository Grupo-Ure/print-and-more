import { useState } from 'react'
import { Pencil, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useConfirm } from '../ConfirmDialog'
import { useToast } from '../Toast'
import { textileMasterDataService } from '../../services/textileMasterDataService'
import {
  useDeleteTextileProduct,
  useTextileProductsByBrand,
} from '../../queries/textileStockQueries'
import { TextileCreatorDialog } from './TextileCreatorDialog'
import type { ProductRow } from '../../services/textileMasterDataService'

type TextileProductsPanelProps = {
  brandId: string
  onOpenProduct: (productId: string) => void
}

/** Product list of the selected brand — master data only; a product's detail lives in the product view. */
export function TextileProductsPanel({ brandId, onOpenProduct }: TextileProductsPanelProps) {
  const confirm = useConfirm()
  const { showError } = useToast()
  const productsQuery = useTextileProductsByBrand(brandId)
  const deleteProduct = useDeleteTextileProduct()

  const [creatorOpen, setCreatorOpen] = useState(false)

  const removeProduct = async (product: ProductRow): Promise<void> => {
    const confirmed = await confirm({
      title: `Delete product "${product.name}"?`,
      description: 'The product and all its variants are removed permanently.',
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!confirmed) return
    const variants = await textileMasterDataService.getVariantsByProduct(product.id)
    const jobIds = await textileMasterDataService.getJobsUsingVariants(variants.map(variant => variant.id))
    if (jobIds.length > 0) {
      showError('Product variants are used by jobs — deactivate the product instead')
      return
    }
    deleteProduct.mutate(product.id, {
      onError: () =>
        showError('Product could not be deleted (variants may have stock movements) — deactivate it instead'),
    })
  }

  return (
    <div className="mb-2">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => setCreatorOpen(true)}>
          + Add product
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => void productsQuery.refetch()}
          disabled={productsQuery.isFetching}
          title="Reload"
          aria-label="Reload products"
        >
          <RefreshCw className={cn(productsQuery.isFetching && 'animate-spin')} />
        </Button>
      </div>
      <TextileCreatorDialog
        level="PRODUCT"
        brandId={brandId}
        open={creatorOpen}
        onOpenChange={setCreatorOpen}
        onCreated={result => {
          if (result.productId) onOpenProduct(result.productId)
        }}
      />
      {productsQuery.isLoading && <p className="mb-2 text-sm text-muted-foreground">Loading…</p>}
      {!productsQuery.isLoading && (
        <div className="overflow-hidden rounded-lg border">
          <Table className="text-sm">
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-9 px-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Name</TableHead>
                <TableHead className="h-9 px-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Article number</TableHead>
                <TableHead className="h-9 px-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(productsQuery.data ?? []).map(product => (
                // Whole row opens the product (like the orders product tables);
                // the action icons stop propagation and take priority.
                <TableRow
                  key={product.id}
                  className="cursor-pointer"
                  onClick={() => onOpenProduct(product.id)}
                >
                  <TableCell className="px-3 py-2 font-semibold">
                    <button
                      type="button"
                      className="cursor-pointer hover:underline"
                      onClick={() => onOpenProduct(product.id)}
                    >
                      {product.name}
                    </button>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-muted-foreground">
                    {product.article_number ?? '—'}
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-blue-600 hover:bg-transparent hover:text-blue-800"
                        title="Edit"
                        aria-label={`Edit ${product.name}`}
                        onClick={event => {
                          event.stopPropagation()
                          onOpenProduct(product.id)
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-red-600 hover:bg-transparent hover:text-red-800"
                        title="Delete"
                        aria-label={`Delete ${product.name}`}
                        onClick={event => {
                          event.stopPropagation()
                          void removeProduct(product)
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
