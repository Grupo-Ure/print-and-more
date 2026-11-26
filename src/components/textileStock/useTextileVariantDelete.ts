import { useConfirm } from '../ConfirmDialog'
import { useToast } from '../Toast'
import { textileMasterDataService, type VariantRow } from '../../services/textileMasterDataService'
import { useDeleteTextileVariant } from '../../queries/textileStockQueries'

/**
 * Confirmed variant deletion, shared by the variant table and the detail view.
 * Refuses to delete the last variant (every model keeps ≥ 1) and variants
 * referenced by products; a variant with stock history (a booking or a
 * deduction) is refused by the database, since its entries are a record.
 * Resolves true when the variant is gone.
 */
export function useTextileVariantDelete() {
  const confirm = useConfirm()
  const { showError } = useToast()
  const deleteVariant = useDeleteTextileVariant()

  return async (variant: VariantRow, siblingCount: number): Promise<boolean> => {
    if (siblingCount <= 1) {
      showError('Every model needs at least one variant — edit it instead')
      return false
    }
    const confirmed = await confirm({
      title: `Delete variant ${variant.color} / ${variant.size}?`,
      description: 'The variant is removed permanently. A variant that has stock history cannot be deleted.',
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!confirmed) return false
    const usedBy = await textileMasterDataService.getProductsUsingVariant(variant.id)
    if (usedBy.length > 0) {
      showError('Variant is used by products and cannot be deleted — deactivate it instead')
      return false
    }
    try {
      await deleteVariant.mutateAsync(variant.id)
      return true
    } catch {
      showError('Variant could not be deleted (it may have stock history) — deactivate it instead')
      return false
    }
  }
}
