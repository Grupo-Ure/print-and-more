import {
  useTextileBrands,
  useTextileModelsByBrand,
  useTextileVariantsByModel,
} from '../../queries/textileStockQueries'
import { TextileTreeSidebar } from './TextileTreeSidebar'
import { TextileModelsPanel } from './TextileModelsPanel'
import { TextileModelView } from './TextileModelView'
import { TextileVariantDetail } from './TextileVariantDetail'
import { useTextileStockUi } from './useTextileStockUi'

/**
 * Models tab: brands ▸ models ▸ variants tree on the left; the right pane
 * follows the selection like a file manager — brand → model table,
 * model → model view (info + variants), variant → variant detail.
 */
export function TextileMasterData() {
  const {
    brandIdForModels,
    modelIdForVariants,
    setModelIdForVariants,
    variantIdForDetail,
    setVariantIdForDetail,
  } = useTextileStockUi()

  const brandsQuery = useTextileBrands()
  // Also loaded by the tree — reused here for names and the selected rows.
  const modelsQuery = useTextileModelsByBrand(brandIdForModels)
  const variantsQuery = useTextileVariantsByModel(modelIdForVariants)

  const brandName = (brandsQuery.data ?? []).find(brand => brand.id === brandIdForModels)?.name ?? '—'
  const selectedModel =
    (modelsQuery.data ?? []).find(model => model.id === modelIdForVariants) ?? null
  const variants = variantsQuery.data ?? []
  const selectedVariant = variants.find(variant => variant.id === variantIdForDetail) ?? null

  const isLoadingSelection =
    (modelIdForVariants && modelsQuery.isLoading) || (variantIdForDetail && variantsQuery.isLoading)

  /** Up to the brand's model list — the brand crumb and the model view's back button. */
  const backToModelList = (): void => {
    setModelIdForVariants('')
    setVariantIdForDetail('')
  }

  return (
    <div className="flex gap-4">
      <aside className="w-56 shrink-0 border-r border-border pr-3 desktop:w-72">
        <TextileTreeSidebar />
      </aside>

      <section className="min-w-0 flex-1">
        {isLoadingSelection ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : selectedVariant && selectedModel ? (
          <TextileVariantDetail
            variant={selectedVariant}
            siblingCount={variants.length}
            breadcrumb={[
              { label: brandName, onClick: backToModelList },
              { label: selectedModel.name, onClick: () => setVariantIdForDetail('') },
              { label: `${selectedVariant.color} / ${selectedVariant.size}` },
            ]}
            onBack={() => setVariantIdForDetail('')}
          />
        ) : selectedModel ? (
          <TextileModelView
            model={selectedModel}
            breadcrumb={[
              { label: brandName, onClick: backToModelList },
              { label: selectedModel.name },
            ]}
            onBack={backToModelList}
          />
        ) : brandIdForModels ? (
          <TextileModelsPanel
            brandId={brandIdForModels}
            onOpenModel={modelId => {
              setModelIdForVariants(modelId)
              setVariantIdForDetail('')
            }}
          />
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Select a brand or model in the tree.</p>
        )}
      </section>
    </div>
  )
}
