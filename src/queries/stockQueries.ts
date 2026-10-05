import { useQuery } from '@tanstack/react-query'
import { productionReleaseService } from '../services/productionReleaseService'
import type { LoadedProduct } from '../types/product'

export const stockAvailabilityKeys = {
  root: ['stock-availability'] as const,
  byProductId: (id: string) => ['stock-availability', 'by-product-id', id] as const,
}

/**
 * Shortages that would block releasing the product to production (empty array =
 * releasable). Only meaningful — and only fetched — for STAMP/TEXTILE products
 * in pre-press; every other product resolves to no shortages. Spec edits and
 * releases invalidate the root key.
 */
export function useStockAvailability(product: LoadedProduct | null) {
  const enabled =
    !!product &&
    product.status === 'PREPRESS' &&
    (product.department === 'STAMP' || product.department === 'TEXTILE')
  return useQuery({
    queryKey: product
      ? stockAvailabilityKeys.byProductId(product.id)
      : stockAvailabilityKeys.byProductId('__none__'),
    queryFn: () => productionReleaseService.checkStockAvailability(product as LoadedProduct),
    enabled,
  })
}
