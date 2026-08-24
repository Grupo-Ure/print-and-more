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
import { availableStock } from '../components/textileStock/textileStockShared'
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
    const orderQuantity = reorderQuantity(variant.min_stock, openQuantity, availableStock(variant))
    if (orderQuantity <= 0) continue
    reorderRows.push({ ...variant, openQuantity, orderQuantity })
  }
  reorderRows.sort((firstRow, secondRow) => secondRow.orderQuantity - firstRow.orderQuantity)
  return reorderRows
}

export function useTextileReorderList(enabled = true) {
  return useQuery({
    queryKey: textileStockKeys.reorderList,
    queryFn: fetchTextileReorderList,
    enabled,
  })
}

function useInvalidateTextileStock() {
  const queryClient = useQueryClient()
  return () => void queryClient.invalidateQueries({ queryKey: textileStockKeys.all })
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

/** Either an entity that already exists, or the fields to create it with. */
export type BrandTarget = { id: string } | { name: string }
export type ProductTarget =
  | { id: string }
  | { name: string; article_number: string | null; description: string | null }

export type CreateTextileEntitiesInput = {
  brand: BrandTarget
  /** Omitted when only a brand is created. */
  product?: ProductTarget
  /** Empty when no variant is created. */
  variants: Omit<VariantInsert, 'product_id'>[]
}

export type CreateTextileEntitiesResult = {
  brandId: string
  productId: string | null
  /** Rows actually inserted — lower than requested when duplicates were skipped. */
  variantCount: number
}

/**
 * Creates brand ▸ product ▸ variants in one go, starting at whichever level
 * the caller doesn't already have. Supabase has no cross-table transaction
 * here, so a failure unwinds what this call created (newest first) — a
 * half-built branch of the catalog is worse than none.
 */
export function useCreateTextileEntities() {
  const invalidate = useInvalidateTextileStock()
  return useMutation<CreateTextileEntitiesResult, Error, CreateTextileEntitiesInput>({
    mutationFn: async ({ brand, product, variants }) => {
      const undo: (() => Promise<void>)[] = []
      try {
        let brandId: string
        if ('id' in brand) {
          brandId = brand.id
        } else {
          const createdBrand = await textileMasterDataService.createBrand(brand.name)
          brandId = createdBrand.id
          undo.push(() => textileMasterDataService.deleteBrand(createdBrand.id))
        }

        let productId: string | null = null
        let productExisted = false
        if (product) {
          if ('id' in product) {
            productId = product.id
            productExisted = true
          } else {
            const createdProduct = await textileMasterDataService.createProduct({
              brand_id: brandId,
              name: product.name,
              article_number: product.article_number,
              description: product.description,
              is_active: true,
            })
            productId = createdProduct.id
            undo.push(() => textileMasterDataService.deleteProduct(createdProduct.id))
          }
        }

        let variantCount = 0
        if (productId && variants.length > 0) {
          let rows = variants
          // Only an existing product can already hold colliding rows.
          if (productExisted) {
            const existing = await textileMasterDataService.getExistingVariantCombinations(
              productId,
              [...new Set(variants.map(row => row.color))],
              [...new Set(variants.map(row => row.size))],
            )
            const taken = new Set(existing.map(row => `${row.color}|||${row.size}`))
            rows = variants.filter(row => !taken.has(`${row.color}|||${row.size}`))
          }
          if (rows.length > 0) {
            const productIdForRows = productId
            await textileMasterDataService.createVariantsBatch(
              rows.map(row => ({ ...row, product_id: productIdForRows })),
            )
            variantCount = rows.length
          }
        }

        return { brandId, productId, variantCount }
      } catch (error) {
        for (const step of undo.reverse()) await step().catch(() => {})
        throw error
      }
    },
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

export function useDeleteTextileProduct() {
  const invalidate = useInvalidateTextileStock()
  return useMutation<void, Error, string>({
    mutationFn: productId => textileMasterDataService.deleteProduct(productId),
    onSettled: invalidate,
  })
}

export function useDeleteTextileVariant() {
  const invalidate = useInvalidateTextileStock()
  return useMutation<void, Error, string>({
    mutationFn: variantId => textileMasterDataService.deleteVariant(variantId),
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

/** Silent counter edit like min-stock — deliberately no movement row. */
export function useSaveTextileSampleStock() {
  const invalidate = useInvalidateTextileStock()
  return useMutation<VariantRow, Error, { variantId: string; sampleStock: number }>({
    mutationFn: ({ variantId, sampleStock }) =>
      textileMasterDataService.updateVariant(variantId, { sample_stock: sampleStock }),
    onSettled: invalidate,
  })
}
