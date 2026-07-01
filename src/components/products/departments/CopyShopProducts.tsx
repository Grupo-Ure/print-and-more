/** CopyShop department detail — add-product button, two-step dialog, table. */

import type { ComponentType } from 'react'
import type { OrderStatus, SubOrderRow } from '../../../types/database'
import type { FileRow } from '../../../services/fileService'
import { COPY_SHOP_TYPES, COPY_SHOP_TYPE_LABELS } from '../../../types/copyshop'
import { Button } from '../../ui/button'
import { useProductEditor } from '../useProductEditor'
import { ProductDialog, type ProductTypeOption } from '../ProductDialog'
import { CopyShopProductsTable } from '../ProductTable'
import {
  PosterForm,
  CardFlyerForm,
  FoldedFlyerForm,
  BrochureForm,
  BusinessCardForm,
  BindingForm,
  PrintoutForm,
} from '../forms/copyshop'
import type { ProductFormProps } from '../forms/shared'

type Props = {
  subOrder: SubOrderRow
  subOrderStatus: OrderStatus
  orderFiles?: FileRow[]
}

const FORM_BY_TYPE: Record<string, ComponentType<ProductFormProps>> = {
  POSTER: PosterForm,
  CARD_FLYER: CardFlyerForm,
  FOLDED_FLYER: FoldedFlyerForm,
  BROCHURE: BrochureForm,
  BUSINESS_CARD: BusinessCardForm,
  BINDING: BindingForm,
  PRINTOUT: PrintoutForm,
}

const TYPE_OPTIONS: ProductTypeOption[] = COPY_SHOP_TYPES.map(t => ({ value: t, label: COPY_SHOP_TYPE_LABELS[t] }))

export function CopyShopProducts({ subOrder, subOrderStatus, orderFiles = [] }: Props) {
  const productEditor = useProductEditor(subOrder, subOrderStatus)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">CopyShop — Details</h3>
        {!productEditor.isReadOnly && (
          <Button type="button" variant="outline" size="sm" onClick={productEditor.openAdd}>
            + Add product
          </Button>
        )}
      </div>

      {!productEditor.isReadOnly && (
        <ProductDialog
          editor={productEditor}
          subOrder={subOrder}
          orderFiles={orderFiles}
          types={TYPE_OPTIONS}
          formByType={FORM_BY_TYPE}
        />
      )}

      <div className="border-t pt-3">
        <h3 className="text-sm font-semibold">Products</h3>
        {productEditor.productsLoading ? (
          <p className="text-xs text-muted-foreground">Loading products…</p>
        ) : (
          <CopyShopProductsTable
            data={productEditor.products}
            meta={{ onEdit: productEditor.openEdit, onDelete: productEditor.handleDelete, orderFiles, filesByProduct: productEditor.filesByProduct }}
          />
        )}
      </div>
    </div>
  )
}
