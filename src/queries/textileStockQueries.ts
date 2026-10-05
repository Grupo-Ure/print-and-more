import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  textileMasterDataService,
  type BrandRow,
  type TextileModelRow,
  type VariantRow,
  type VariantWithDetails,
} from '../services/textileMasterDataService'
import { reorderQuantity } from '../components/stock/stockShared'
import { availableStock } from '../components/textileStock/textileStockShared'
import type { Database } from '../types/supabase'
import { textileCatalogKeys } from './textileCatalogQueries'

type BrandUpdate = Database['public']['Tables']['textile_brands']['Update']
type ModelInsert = Database['public']['Tables']['textile_models']['Insert']
type ModelUpdate = Database['public']['Tables']['textile_models']['Update']
type VariantInsert = Database['public']['Tables']['textile_variants']['Insert']
type VariantUpdate = Database['public']['Tables']['textile_variants']['Update']

export type TextileReorderRow = VariantWithDetails & {
  openQuantity: number
  orderQuantity: number
}

export const textileStockKeys = {
  all: ['textile-stock'] as const,
  brands: ['textile-stock', 'brands'] as const,
  modelsByBrand: (brandId: string) => ['textile-stock', 'models', brandId] as const,
  variantsByModel: (modelId: string) => ['textile-stock', 'variants', modelId] as const,
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

export function useTextileModelsByBrand(brandId: string) {
  return useQuery({
    queryKey: textileStockKeys.modelsByBrand(brandId || '__none__'),
    queryFn: () => textileMasterDataService.getModelsByBrand(brandId),
    enabled: !!brandId,
  })
}

export function useTextileVariantsByModel(modelId: string) {
  return useQuery({
    queryKey: textileStockKeys.variantsByModel(modelId || '__none__'),
    queryFn: () => textileMasterDataService.getVariantsByModel(modelId),
    enabled: !!modelId,
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

/** Open demand per variant from open TEXTILE batches, joined onto the variants. */
async function fetchTextileReorderList(): Promise<TextileReorderRow[]> {
  const activeVariants = await textileMasterDataService.getVariantsWithDetails()
  const variantIdSet = new Set(activeVariants.map(variant => variant.id))

  // One round trip: the status filter rides on the product, the quantity on the
  // garment line — the job model had to walk active jobs first.
  const demandByVariantId = new Map<string, number>()
  for (const line of await textileMasterDataService.getShopSuppliedDemand()) {
    if (!line.variant_id || !variantIdSet.has(line.variant_id)) continue
    const demand = Number(line.quantity ?? 0)
    demandByVariantId.set(line.variant_id, (demandByVariantId.get(line.variant_id) ?? 0) + demand)
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
  // The batch editor reads the same brands, models and variants through its
  // own catalog queries, so a master-data edit refreshes those lists too.
  return () => {
    void queryClient.invalidateQueries({ queryKey: textileStockKeys.all })
    void queryClient.invalidateQueries({ queryKey: textileCatalogKeys.all })
  }
}

export function useUpdateTextileBrand() {
  const invalidate = useInvalidateTextileStock()
  return useMutation<BrandRow, Error, { brandId: string; patch: BrandUpdate }>({
    mutationFn: ({ brandId, patch }) => textileMasterDataService.updateBrand(brandId, patch),
    onSettled: invalidate,
  })
}

export function useCreateTextileModel() {
  const invalidate = useInvalidateTextileStock()
  return useMutation<TextileModelRow, Error, ModelInsert>({
    mutationFn: payload => textileMasterDataService.createModel(payload),
    onSettled: invalidate,
  })
}

/** Either an entity that already exists, or the fields to create it with. */
export type BrandTarget = { id: string } | { name: string }
export type ModelTarget =
  | { id: string }
  | { name: string; article_number: string | null; description: string | null }

export type CreateTextileEntitiesInput = {
  brand: BrandTarget
  /** Omitted when only a brand is created. */
  model?: ModelTarget
  /** Empty when no variant is created. */
  variants: Omit<VariantInsert, 'model_id'>[]
}

export type CreateTextileEntitiesResult = {
  brandId: string
  modelId: string | null
  /** Rows actually inserted — lower than requested when duplicates were skipped. */
  variantCount: number
}

/**
 * Creates brand ▸ model ▸ variants in one go, starting at whichever level
 * the caller doesn't already have. Supabase has no cross-table transaction
 * here, so a failure unwinds what this call created (newest first) — a
 * half-built branch of the catalog is worse than none.
 */
export function useCreateTextileEntities() {
  const invalidate = useInvalidateTextileStock()
  return useMutation<CreateTextileEntitiesResult, Error, CreateTextileEntitiesInput>({
    mutationFn: async ({ brand, model, variants }) => {
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

        let modelId: string | null = null
        let modelExisted = false
        if (model) {
          if ('id' in model) {
            modelId = model.id
            modelExisted = true
          } else {
            const createdModel = await textileMasterDataService.createModel({
              brand_id: brandId,
              name: model.name,
              article_number: model.article_number,
              description: model.description,
              is_active: true,
            })
            modelId = createdModel.id
            undo.push(() => textileMasterDataService.deleteModel(createdModel.id))
          }
        }

        let variantCount = 0
        if (modelId && variants.length > 0) {
          let rows = variants
          // Only an existing model can already hold colliding rows.
          if (modelExisted) {
            const existing = await textileMasterDataService.getExistingVariantCombinations(
              modelId,
              [...new Set(variants.map(row => row.color))],
              [...new Set(variants.map(row => row.size))],
            )
            const taken = new Set(existing.map(row => `${row.color}|||${row.size}`))
            rows = variants.filter(row => !taken.has(`${row.color}|||${row.size}`))
          }
          if (rows.length > 0) {
            const modelIdForRows = modelId
            await textileMasterDataService.createVariantsBatch(
              rows.map(row => ({ ...row, model_id: modelIdForRows })),
            )
            variantCount = rows.length
          }
        }

        return { brandId, modelId, variantCount }
      } catch (error) {
        for (const step of undo.reverse()) await step().catch(() => {})
        throw error
      }
    },
    onSettled: invalidate,
  })
}

export function useUpdateTextileModel() {
  const invalidate = useInvalidateTextileStock()
  return useMutation<TextileModelRow, Error, { modelId: string; patch: ModelUpdate }>({
    mutationFn: ({ modelId, patch }) => textileMasterDataService.updateModel(modelId, patch),
    onSettled: invalidate,
  })
}

export function useDeleteTextileModel() {
  const invalidate = useInvalidateTextileStock()
  return useMutation<void, Error, string>({
    mutationFn: modelId => textileMasterDataService.deleteModel(modelId),
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
