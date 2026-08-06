import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useToast } from '../Toast'
import { useCreateTextileBrand, useUpdateTextileBrand } from '../../queries/textileStockQueries'
import { stockInputClass } from '../stock/stockShared'
import type { BrandRow } from '../../services/textileMasterDataService'

type TextileBrandBarProps = {
  brands: BrandRow[]
  isLoading: boolean
  selectedBrandId: string
  onSelectBrand: (brandId: string) => void
  onRefresh: () => void
}

/** Brand chips with inline create/edit — step 1 of the master-data drill-down. */
export function TextileBrandBar({
  brands,
  isLoading,
  selectedBrandId,
  onSelectBrand,
  onRefresh,
}: TextileBrandBarProps) {
  const { showError } = useToast()
  const createBrand = useCreateTextileBrand()
  const updateBrand = useUpdateTextileBrand()

  const [newFormOpen, setNewFormOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editActive, setEditActive] = useState(true)

  const saveBrand = (): void => {
    const trimmedName = newName.trim()
    if (!trimmedName) return
    createBrand.mutate(trimmedName, {
      onSuccess: () => {
        setNewName('')
        setNewFormOpen(false)
      },
      onError: () => showError('Brand could not be created'),
    })
  }

  const saveEditedBrand = (): void => {
    if (!editingBrandId) return
    const trimmedName = editName.trim()
    if (!trimmedName) return
    updateBrand.mutate(
      { brandId: editingBrandId, patch: { name: trimmedName, is_active: editActive } },
      {
        onSuccess: () => setEditingBrandId(null),
        onError: () => showError('Brand could not be saved'),
      },
    )
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5">
      {isLoading && <span className="text-sm opacity-75">Loading…</span>}
      {brands.map(brand => {
        if (editingBrandId === brand.id) {
          return (
            <div
              key={brand.id}
              className="inline-flex flex-wrap items-center gap-1.5 rounded-lg border border-primary bg-primary/5 px-2 py-1"
            >
              <input
                className={cn(stockInputClass, 'min-w-30 max-w-50')}
                value={editName}
                onChange={event => setEditName(event.target.value)}
                aria-label="Brand name"
              />
              <label className="inline-flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={editActive}
                  onChange={event => setEditActive(event.target.checked)}
                />
                active
              </label>
              <Button type="button" size="sm" onClick={saveEditedBrand}>
                Save
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingBrandId(null)}>
                Cancel
              </Button>
            </div>
          )
        }
        return (
          <div key={brand.id} className="inline-flex items-center gap-0.5">
            <Button
              type="button"
              variant={selectedBrandId === brand.id ? 'default' : 'outline'}
              className={selectedBrandId === brand.id ? 'font-semibold' : 'font-normal'}
              onClick={() => onSelectBrand(brand.id)}
              title={brand.is_active ? brand.name : `${brand.name} (inactive)`}
            >
              {brand.name}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => {
                setEditingBrandId(brand.id)
                setEditName(brand.name)
                setEditActive(brand.is_active)
              }}
              title="Edit brand"
              aria-label={`Edit brand ${brand.name}`}
            >
              ✎
            </Button>
          </div>
        )
      })}
      {!newFormOpen ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setNewFormOpen(true)
            setNewName('')
          }}
          title="New brand"
        >
          + New
        </Button>
      ) : (
        <div className="inline-flex flex-wrap items-center gap-1.5 rounded-lg border border-border px-2 py-1">
          <input
            className={cn(stockInputClass, 'min-w-30 max-w-50')}
            placeholder="Name"
            value={newName}
            onChange={event => setNewName(event.target.value)}
            aria-label="New brand name"
          />
          <Button type="button" size="sm" onClick={saveBrand}>
            Save
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setNewFormOpen(false)}>
            Cancel
          </Button>
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        className="ml-1"
        onClick={onRefresh}
        disabled={isLoading}
        title="Reload brands"
      >
        ↻
      </Button>
    </div>
  )
}
