import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  textileMasterDataService,
  type BrandRow,
  type ProductRow,
  type VariantRow,
  type VariantWithDetails,
} from '../services/textileMasterDataService'
import { jobService } from '../services/jobService'
import { reorderQuantity } from '../components/stock/stockShared'
import type { Database } from '../types/supabase'

type BrandUpdate = Database['public']['Tables']['textile_brands']['Update']
type ProductInsert = Database['public']['Tables']['textile_products']['Insert']
type ProductUpdate = Database['public']['Tables']['textile_products']['Update']
type VariantInsert = Database['public']['Tables']['textile_variants']['Insert']
type VariantUpdate = Database['public']['Tables']['textile_variants']['Update']

export type TextileReorderRow = VariantWithDetails & {
  openQuantity: number
  orderQuantity: number
}

export const textileStockKeys = {
  all: ['textile-stock'] as const,
  brands: ['textile-stock', 'brands'] as const,
  productsByBrand: (brandId: string) => ['textile-stock', 'products', brandId] as const,
  variantsByProduct: (productId: string) => ['textile-stock', 'variants', productId] as const,
  allVariants: ['textile-stock', 'all-variants'] as const,
  reorderList: ['textile-stock', 'reorder-list'] as const,
  movements: ['textile-stock', 'movements'] as const,
}

export function useTextileBrands() {
  return useQuery({
    queryKey: textileStockKeys.brands,
    queryFn: () => textileMasterDataService.getBrands(),
  })
}

export function useTextileProductsByBrand(brandId: string) {
  return useQuery({
    queryKey: textileStockKeys.productsByBrand(brandId || '__none__'),
    queryFn: () => textileMasterDataService.getProductsByBrand(brandId),
    enabled: !!brandId,
  })
}

export function useTextileVariantsByProduct(productId: string) {
  return useQuery({
    queryKey: textileStockKeys.variantsByProduct(productId || '__none__'),
    queryFn: () => textileMasterDataService.getVariantsByProduct(productId),
    enabled: !!productId,
  })
}

export function useAllTextileVariants() {
  return useQuery({
    queryKey: textileStockKeys.allVariants,
    queryFn: () => textileMasterDataService.getVariantsWithDetails(),
  })
}

export function useTextileMovements() {
  return useQuery({
    queryKey: textileStockKeys.movements,
    queryFn: () => textileMasterDataService.getStockMovements(),
  })
}

/** Open demand per variant from active TEXTILE jobs, joined onto the variants. */
async function fetchTextileReorderList(): Promise<TextileReorderRow[]> {
  const activeVariants = await textileMasterDataService.getVariantsWithDetails()
  const variantIdSet = new Set(activeVariants.map(variant => variant.id))

  const activeJobs = await jobService.getActiveJobsByBereich('TEXTILE')
  const jobIds = activeJobs.filter(job => !job.is_cancelled && job.status !== 'DONE').map(job => job.id)

  const demandByVariantId = new Map<string, number>()
  const chunkSize = 200
  for (let index = 0; index < jobIds.length; index += chunkSize) {
    const jobSlice = jobIds.slice(index, index + chunkSize)
    const positions = await textileMasterDataService.getEigenwarePositionsByJobs(jobSlice)
    for (const position of positions) {
      if (!position.variant_id || !variantIdSet.has(position.variant_id)) continue
      const demand = Number(position.quantity ?? 0)
      demandByVariantId.set(position.variant_id, (demandByVariantId.get(position.variant_id) ?? 0) + demand)
    }
  }

  const reorderRows: TextileReorderRow[] = []
  for (const variant of activeVariants) {
    const openQuantity = demandByVariantId.get(variant.id) ?? 0
    const orderQuantity = reorderQuantity(variant.min_stock, openQuantity, variant.stock)
    if (orderQuantity <= 0) continue
    reorderRows.push({ ...variant, openQuantity, orderQuantity })
  }
  reorderRows.sort((firstRow, secondRow) => secondRow.orderQuantity - firstRow.orderQuantity)
  return reorderRows
}

export function useTextileReorderList() {
  return useQuery({
    queryKey: textileStockKeys.reorderList,
    queryFn: fetchTextileReorderList,
  })
}

function useInvalidateTextileStock() {
  const queryClient = useQueryClient()
  return () => void queryClient.invalidateQueries({ queryKey: textileStockKeys.all })
}

export function useCreateTextileBrand() {
  const invalidate = useInvalidateTextileStock()
  return useMutation<BrandRow, Error, string>({
    mutationFn: name => textileMasterDataService.createBrand(name),
    onSettled: invalidate,
  })
}

export function useUpdateTextileBrand() {
  const invalidate = useInvalidateTextileStock()
  return useMutation<BrandRow, Error, { brandId: string; patch: BrandUpdate }>({
    mutationFn: ({ brandId, patch }) => textileMasterDataService.updateBrand(brandId, patch),
    onSettled: invalidate,
  })
}

export function useCreateTextileProduct() {
  const invalidate = useInvalidateTextileStock()
  return useMutation<ProductRow, Error, ProductInsert>({
    mutationFn: payload => textileMasterDataService.createProduct(payload),
    onSettled: invalidate,
  })
}

export function useUpdateTextileProduct() {
  const invalidate = useInvalidateTextileStock()
  return useMutation<ProductRow, Error, { productId: string; patch: ProductUpdate }>({
    mutationFn: ({ productId, patch }) => textileMasterDataService.updateProduct(productId, patch),
    onSettled: invalidate,
  })
}

export function useCreateTextileVariant() {
  const invalidate = useInvalidateTextileStock()
  return useMutation<VariantRow, Error, VariantInsert>({
    mutationFn: payload => textileMasterDataService.createVariant(payload),
    onSettled: invalidate,
  })
}

export function useCreateTextileVariantsBatch() {
  const invalidate = useInvalidateTextileStock()
  return useMutation<VariantRow[], Error, VariantInsert[]>({
    mutationFn: payloads => textileMasterDataService.createVariantsBatch(payloads),
    onSettled: invalidate,
  })
}

export function useUpdateTextileVariant() {
  const invalidate = useInvalidateTextileStock()
  return useMutation<VariantRow, Error, { variantId: string; patch: VariantUpdate }>({
    mutationFn: ({ variantId, patch }) => textileMasterDataService.updateVariant(variantId, patch),
    onSettled: invalidate,
  })
}

export type BookTextileMovementPayload = {
  variantId: string
  quantity: number
  nextStock: number
  type: 'INBOUND' | 'OUTBOUND'
  userId: string
}

export function useBookTextileMovement() {
  const invalidate = useInvalidateTextileStock()
  return useMutation<void, Error, BookTextileMovementPayload>({
    mutationFn: async ({ variantId, quantity, nextStock, type, userId }) => {
      await textileMasterDataService.updateVariantStock(variantId, nextStock)
      await textileMasterDataService.createTextileStockMovement({
        variant_id: variantId,
        quantity,
        type,
        user_id: userId,
      })
    },
    onSettled: invalidate,
  })
}

export function useSaveTextileMinimumStock() {
  const invalidate = useInvalidateTextileStock()
  return useMutation<void, Error, { variantId: string; minimumStock: number }>({
    mutationFn: ({ variantId, minimumStock }) =>
      textileMasterDataService.updateVariantMinimumStock(variantId, minimumStock),
    onSettled: invalidate,
  })
}
