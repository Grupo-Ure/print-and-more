import { useQuery } from '@tanstack/react-query'
import { textileService } from '../services/textileService'
import { textileMasterDataService } from '../services/textileMasterDataService'

/**
 * The catalog lookups the textile batch editor walks through, one step at a
 * time: brand → model → colour → the sizes that colour is carried in. Each
 * step is its own query so the editor only ever loads the list the current
 * step needs, and a list already seen is served from the cache.
 */
export const textileCatalogKeys = {
  all: ['textile-catalog'] as const,
  brands: ['textile-catalog', 'brands'] as const,
  modelsByBrand: (brandId: string) => ['textile-catalog', 'models', brandId] as const,
  colorsByModel: (modelId: string) => ['textile-catalog', 'colors', modelId] as const,
  sizesByModelAndColor: (modelId: string, color: string) =>
    ['textile-catalog', 'sizes', modelId, color] as const,
  variantCascades: (variantKey: string) => ['textile-catalog', 'variant-cascades', variantKey] as const,
}

export function useTextileBrandNames() {
  return useQuery({
    queryKey: textileCatalogKeys.brands,
    queryFn: () => textileMasterDataService.getBrandNames(),
  })
}

export function useTextileModelNames(brandId: string) {
  return useQuery({
    queryKey: textileCatalogKeys.modelsByBrand(brandId || '__none__'),
    queryFn: () => textileService.getModelsByBrandId(brandId),
    enabled: !!brandId,
  })
}

export function useTextileColors(modelId: string) {
  return useQuery({
    queryKey: textileCatalogKeys.colorsByModel(modelId || '__none__'),
    queryFn: () => textileService.getVariantColorsByModel(modelId),
    enabled: !!modelId,
  })
}

export function useTextileSizes(modelId: string, color: string) {
  return useQuery({
    queryKey: textileCatalogKeys.sizesByModelAndColor(modelId || '__none__', color || '__none__'),
    queryFn: () => textileService.getVariantSizesByModelAndColor(modelId, color),
    enabled: !!modelId && !!color,
  })
}

/**
 * The same cascade walked back up, for the variants a stored batch is keyed by:
 * one query for every grid row that still has to find its model. The result
 * lives in the cache, so it survives the render that asked for it — a row can
 * never be left waiting for a walk that an abandoned effect started.
 */
export function useTextileVariantCascades(variantIds: readonly string[]) {
  // Sorted, so the same set of rows is the same cache entry whatever their order.
  const ids = [...variantIds].sort()
  return useQuery({
    queryKey: textileCatalogKeys.variantCascades(ids.join(',') || '__none__'),
    queryFn: () => textileService.getVariantCascades(ids),
    enabled: ids.length > 0,
  })
}
