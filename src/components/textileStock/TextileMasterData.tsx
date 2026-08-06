import { useTextileBrands, useTextileProductsByBrand } from '../../queries/textileStockQueries'
import { TextileBrandBar } from './TextileBrandBar'
import { TextileProductsPanel } from './TextileProductsPanel'
import { TextileVariantsPanel } from './TextileVariantsPanel'
import { useTextileStockUi } from './useTextileStockUi'

type TextileMasterDataProps = {
  /** Booked movements are attributed to this user. */
  userId: string
}

/** Products tab: brands → products → variants drill-down. */
export function TextileMasterData({ userId }: TextileMasterDataProps) {
  const {
    brandIdForProducts,
    setBrandIdForProducts,
    productIdForVariants,
    setProductIdForVariants,
  } = useTextileStockUi()

  const brandsQuery = useTextileBrands()
  // Also loaded by the products panel; here only for the breadcrumb name.
  const productsQuery = useTextileProductsByBrand(brandIdForProducts)

  const inVariantView = Boolean(productIdForVariants)
  const brands = brandsQuery.data ?? []
  const brandName = brands.find(brand => brand.id === brandIdForProducts)?.name ?? '—'
  const productName =
    (productsQuery.data ?? []).find(product => product.id === productIdForVariants)?.name ?? '—'

  return (
    <div>
      <TextileBrandBar
        brands={brands}
        isLoading={brandsQuery.isLoading}
        selectedBrandId={brandIdForProducts}
        onSelectBrand={brandId => {
          setBrandIdForProducts(brandId)
          setProductIdForVariants('')
        }}
        onRefresh={() => void brandsQuery.refetch()}
      />

      {brandIdForProducts && !inVariantView && (
        <TextileProductsPanel brandId={brandIdForProducts} onOpenVariants={setProductIdForVariants} />
      )}

      {inVariantView && brandIdForProducts && (
        <TextileVariantsPanel
          productId={productIdForVariants}
          breadcrumb={`${brandName} › ${productName} › Variants`}
          onBack={() => setProductIdForVariants('')}
          userId={userId}
        />
      )}

      {!brandIdForProducts && (
        <p className="mt-2 text-sm text-muted-foreground">Select a brand first.</p>
      )}
    </div>
  )
}
