import {
  useTextileBrands,
  useTextileProductsByBrand,
  useTextileVariantsByProduct,
} from '../../queries/textileStockQueries'
import { TextileTreeSidebar } from './TextileTreeSidebar'
import { TextileProductsPanel } from './TextileProductsPanel'
import { TextileProductView } from './TextileProductView'
import { TextileVariantDetail } from './TextileVariantDetail'
import { useTextileStockUi } from './useTextileStockUi'

/**
 * Products tab: brands ▸ products ▸ variants tree on the left; the right pane
 * follows the selection like a file manager — brand → product table,
 * product → product view (info + variants), variant → variant detail.
 */
export function TextileMasterData() {
  const {
    brandIdForProducts,
    productIdForVariants,
    setProductIdForVariants,
    variantIdForDetail,
    setVariantIdForDetail,
  } = useTextileStockUi()

  const brandsQuery = useTextileBrands()
  // Also loaded by the tree — reused here for names and the selected rows.
  const productsQuery = useTextileProductsByBrand(brandIdForProducts)
  const variantsQuery = useTextileVariantsByProduct(productIdForVariants)

  const brandName = (brandsQuery.data ?? []).find(brand => brand.id === brandIdForProducts)?.name ?? '—'
  const selectedProduct =
    (productsQuery.data ?? []).find(product => product.id === productIdForVariants) ?? null
  const variants = variantsQuery.data ?? []
  const selectedVariant = variants.find(variant => variant.id === variantIdForDetail) ?? null

  const isLoadingSelection =
    (productIdForVariants && productsQuery.isLoading) || (variantIdForDetail && variantsQuery.isLoading)

  /** Up to the brand's product list — the brand crumb and the product view's back button. */
  const backToProductList = (): void => {
    setProductIdForVariants('')
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
        ) : selectedVariant && selectedProduct ? (
          <TextileVariantDetail
            variant={selectedVariant}
            siblingCount={variants.length}
            breadcrumb={[
              { label: brandName, onClick: backToProductList },
              { label: selectedProduct.name, onClick: () => setVariantIdForDetail('') },
              { label: `${selectedVariant.color} / ${selectedVariant.size}` },
            ]}
            onBack={() => setVariantIdForDetail('')}
          />
        ) : selectedProduct ? (
          <TextileProductView
            product={selectedProduct}
            breadcrumb={[
              { label: brandName, onClick: backToProductList },
              { label: selectedProduct.name },
            ]}
            onBack={backToProductList}
          />
        ) : brandIdForProducts ? (
          <TextileProductsPanel
            brandId={brandIdForProducts}
            onOpenProduct={productId => {
              setProductIdForVariants(productId)
              setVariantIdForDetail('')
            }}
          />
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Select a brand or product in the tree.</p>
        )}
      </section>
    </div>
  )
}
