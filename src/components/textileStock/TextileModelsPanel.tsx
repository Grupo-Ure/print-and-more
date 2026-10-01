import { useState } from 'react'
import { Pencil, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useConfirm } from '../ConfirmDialog'
import { useToast } from '../Toast'
import { textileMasterDataService } from '../../services/textileMasterDataService'
import {
  useDeleteTextileModel,
  useTextileModelsByBrand,
} from '../../queries/textileStockQueries'
import { TextileCreatorDialog } from './TextileCreatorDialog'
import type { TextileModelRow } from '../../services/textileMasterDataService'

type TextileModelsPanelProps = {
  brandId: string
  onOpenModel: (modelId: string) => void
}

/** Model list of the selected brand — master data only; a model's detail lives in the model view. */
export function TextileModelsPanel({ brandId, onOpenModel }: TextileModelsPanelProps) {
  const confirm = useConfirm()
  const { showError } = useToast()
  const modelsQuery = useTextileModelsByBrand(brandId)
  const deleteModel = useDeleteTextileModel()

  const [creatorOpen, setCreatorOpen] = useState(false)

  const removeModel = async (model: TextileModelRow): Promise<void> => {
    const confirmed = await confirm({
      title: `Delete model "${model.name}"?`,
      description: 'The model and all its variants are removed permanently.',
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!confirmed) return
    const variants = await textileMasterDataService.getVariantsByModel(model.id)
    const usedBy = await textileMasterDataService.getProductsUsingVariants(variants.map(variant => variant.id))
    if (usedBy.length > 0) {
      showError('Model variants are used by products — deactivate the model instead')
      return
    }
    deleteModel.mutate(model.id, {
      onError: () =>
        showError('Model could not be deleted (variants may have stock movements) — deactivate it instead'),
    })
  }

  return (
    <div className="mb-2">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => setCreatorOpen(true)}>
          + Add model
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => void modelsQuery.refetch()}
          disabled={modelsQuery.isFetching}
          title="Reload"
          aria-label="Reload models"
        >
          <RefreshCw className={cn(modelsQuery.isFetching && 'animate-spin')} />
        </Button>
      </div>
      <TextileCreatorDialog
        level="PRODUCT"
        brandId={brandId}
        open={creatorOpen}
        onOpenChange={setCreatorOpen}
        onCreated={result => {
          if (result.modelId) onOpenModel(result.modelId)
        }}
      />
      {modelsQuery.isLoading && <p className="mb-2 text-sm text-muted-foreground">Loading…</p>}
      {!modelsQuery.isLoading && (
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
              {(modelsQuery.data ?? []).map(model => (
                // Whole row opens the model (like the orders model tables);
                // the action icons stop propagation and take priority.
                <TableRow
                  key={model.id}
                  className="cursor-pointer"
                  onClick={() => onOpenModel(model.id)}
                >
                  <TableCell className="px-3 py-2 font-semibold">
                    <button
                      type="button"
                      className="cursor-pointer hover:underline"
                      onClick={() => onOpenModel(model.id)}
                    >
                      {model.name}
                    </button>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-muted-foreground">
                    {model.article_number ?? '—'}
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-blue-600 hover:bg-transparent hover:text-blue-800"
                        title="Edit"
                        aria-label={`Edit ${model.name}`}
                        onClick={event => {
                          event.stopPropagation()
                          onOpenModel(model.id)
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
                        aria-label={`Delete ${model.name}`}
                        onClick={event => {
                          event.stopPropagation()
                          void removeModel(model)
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
