import { useConfirm } from '../ConfirmDialog'
import { useToast } from '../Toast'
import { textileMasterDataService } from '../../services/textileMasterDataService'
import { useDeleteTextileVariant } from '../../queries/textileStockQueries'
import type { VariantRow } from './textileStockShared'

/**
 * Confirmed variant deletion, shared by the variant table and the detail view.
 * Refuses to delete the last variant (every product keeps ≥ 1) and variants
 * referenced by jobs; stock movements block deletion at the FK level.
 * Resolves true when the variant is gone.
 */
export function useTextileVariantDelete() {
  const confirm = useConfirm()
  const { showError } = useToast()
  const deleteVariant = useDeleteTextileVariant()

  return async (variant: VariantRow, siblingCount: number): Promise<boolean> => {
    if (siblingCount <= 1) {
      showError('Every product needs at least one variant — edit it instead')
      return false
    }
    const confirmed = await confirm({
      title: `Delete variant ${variant.color} / ${variant.size}?`,
      description: 'The variant is removed permanently. Stock history is kept only for other variants.',
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!confirmed) return false
    const jobIds = await textileMasterDataService.getJobsUsingVariant(variant.id)
    if (jobIds.length > 0) {
      showError('Variant is used by jobs and cannot be deleted — deactivate it instead')
      return false
    }
    try {
      await deleteVariant.mutateAsync(variant.id)
      return true
    } catch {
      showError('Variant could not be deleted (it may have stock movements) — deactivate it instead')
      return false
    }
  }
}
