import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useToast } from '../Toast'
import {
  useCreateTextileProduct,
  useTextileProductsByBrand,
  useUpdateTextileProduct,
} from '../../queries/textileStockQueries'
import { stockInputClass } from '../stock/stockShared'
import type { ProductRow } from '../../services/textileMasterDataService'

type TextileProductsPanelProps = {
  brandId: string
  onOpenVariants: (productId: string) => void
}

/** Product list of the selected brand — step 2 of the master-data drill-down. */
export function TextileProductsPanel({ brandId, onOpenVariants }: TextileProductsPanelProps) {
  const { showError } = useToast()
  const productsQuery = useTextileProductsByBrand(brandId)
  const createProduct = useCreateTextileProduct()
  const updateProduct = useUpdateTextileProduct()

  const [formOpen, setFormOpen] = useState(false)
  const [newProduct, setNewProduct] = useState({ name: '', article_number: '', description: '' })
  const [editProduct, setEditProduct] = useState<ProductRow | null>(null)
  const [editName, setEditName] = useState('')
  const [editArticleNumber, setEditArticleNumber] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editActive, setEditActive] = useState(true)

  const saveProduct = (): void => {
    const trimmedName = newProduct.name.trim()
    if (!brandId || !trimmedName) {
      showError('Brand and name are required')
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
        onSuccess: () => {
          setNewProduct({ name: '', article_number: '', description: '' })
          setFormOpen(false)
        },
        onError: () => showError('Product could not be created'),
      },
    )
  }

  const saveEditedProduct = (): void => {
    if (!editProduct) return
    const trimmedName = editName.trim()
    if (!trimmedName) return
    updateProduct.mutate(
      {
        productId: editProduct.id,
        patch: {
          name: trimmedName,
          article_number: editArticleNumber.trim() || null,
          description: editDescription.trim() || null,
          is_active: editActive,
        },
      },
      {
        onSuccess: () => setEditProduct(null),
        onError: () => showError('Product could not be saved'),
      },
    )
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
                <TableCell className="font-semibold">{product.name}</TableCell>
                <TableCell>{product.article_number ?? '—'}</TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditProduct(product)
                      setEditName(product.name)
                      setEditArticleNumber(product.article_number ?? '')
                      setEditDescription(product.description ?? '')
                      setEditActive(product.is_active)
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="ml-2"
                    onClick={() => onOpenVariants(product.id)}
                  >
                    Variants
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {editProduct && (
        <div className="mt-3 max-w-xl rounded-lg border border-border p-3">
          <h3 className="mt-0 text-sm font-semibold">Edit product</h3>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
            <input
              className={stockInputClass}
              value={editName}
              onChange={event => setEditName(event.target.value)}
              aria-label="Product name"
            />
            <input
              className={stockInputClass}
              value={editArticleNumber}
              onChange={event => setEditArticleNumber(event.target.value)}
              placeholder="Article number"
            />
            <input
              className={cn(stockInputClass, 'col-span-full')}
              value={editDescription}
              onChange={event => setEditDescription(event.target.value)}
              placeholder="Description"
            />
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={editActive}
                onChange={event => setEditActive(event.target.checked)}
              />
              Active
            </label>
            <div className="flex gap-2">
              <Button type="button" onClick={saveEditedProduct}>
                Save
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditProduct(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
