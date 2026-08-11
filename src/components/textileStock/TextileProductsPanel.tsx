import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useConfirm } from '../ConfirmDialog'
import { useToast } from '../Toast'
import { textileMasterDataService } from '../../services/textileMasterDataService'
import {
  useCreateTextileProduct,
  useDeleteTextileProduct,
  useTextileProductsByBrand,
} from '../../queries/textileStockQueries'
import { stockInputClass } from '../stock/stockShared'
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
  const createProduct = useCreateTextileProduct()
  const deleteProduct = useDeleteTextileProduct()

  const [formOpen, setFormOpen] = useState(false)
  const [newProduct, setNewProduct] = useState({ name: '', article_number: '', description: '' })

  const saveProduct = (): void => {
    const trimmedName = newProduct.name.trim()
    if (!trimmedName) {
      showError('Name is required')
      return
    }
    createProduct.mutate(
      {
        brand_id: brandId,
        name: trimmedName,
        article_number: newProduct.article_number.trim() || null,
        description: newProduct.description.trim() || null,
        is_active: true,
      },
      {
        onSuccess: created => {
          setNewProduct({ name: '', article_number: '', description: '' })
          setFormOpen(false)
          onOpenProduct(created.id)
        },
        onError: () => showError('Product could not be created'),
      },
    )
  }

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
        <Button type="button" variant="outline" onClick={() => setFormOpen(open => !open)}>
          + Add product
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void productsQuery.refetch()}
          disabled={productsQuery.isFetching}
        >
          Reload
        </Button>
      </div>
      {formOpen && (
        <div className="mb-3 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2 rounded-lg border border-border p-2.5">
          <input
            className={stockInputClass}
            placeholder="Name (required)"
            value={newProduct.name}
            onChange={event => setNewProduct(state => ({ ...state, name: event.target.value }))}
          />
          <input
            className={stockInputClass}
            placeholder="Article number"
            value={newProduct.article_number}
            onChange={event => setNewProduct(state => ({ ...state, article_number: event.target.value }))}
          />
          <input
            className={cn(stockInputClass, 'col-span-full')}
            placeholder="Description"
            value={newProduct.description}
            onChange={event => setNewProduct(state => ({ ...state, description: event.target.value }))}
          />
          <Button type="button" onClick={saveProduct}>
            Save
          </Button>
        </div>
      )}
      {productsQuery.isLoading && <p className="mb-2 opacity-80">Loading…</p>}
      {!productsQuery.isLoading && (
        <Table className="text-sm">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Article number</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(productsQuery.data ?? []).map(product => (
              <TableRow key={product.id}>
                <TableCell className="font-semibold">
                  <button
                    type="button"
                    className="cursor-pointer hover:underline"
                    onClick={() => onOpenProduct(product.id)}
                  >
                    {product.name}
                  </button>
                </TableCell>
                <TableCell>{product.article_number ?? '—'}</TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenProduct(product.id)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="ml-2 text-destructive"
                    onClick={() => void removeProduct(product)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
