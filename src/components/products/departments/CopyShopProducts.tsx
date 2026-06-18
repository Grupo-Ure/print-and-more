/** CopyShop department detail — type dropdown + per-type form + table. */

import type { ComponentType } from 'react'
import type { OrderStatus, SubOrderRow } from '../../../types/database'
import type { FileRow } from '../../../services/fileService'
import { COPY_SHOP_TYPES, COPY_SHOP_TYPE_LABELS } from '../../../types/copyshop'
import { Button } from '../../ui/button'
import { Label } from '../../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { useProductEditor } from '../useProductEditor'
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

export function CopyShopProducts({ subOrder, subOrderStatus, orderFiles = [] }: Props) {
  const productEditor = useProductEditor(subOrder, subOrderStatus)
  const active =
    productEditor.mode.kind === 'edit'
      ? { type: productEditor.mode.product.type, product: productEditor.mode.product }
      : productEditor.mode.kind === 'add'
        ? { type: productEditor.mode.type, product: null }
        : null
  const ActiveForm = active ? FORM_BY_TYPE[active.type] : null

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold">CopyShop — Details</h3>

      {productEditor.requiresUnlock ? (
        <Button type="button" variant="outline" onClick={productEditor.requestUnlock}>
          Unlock editing
        </Button>
      ) : (
        <>
          {productEditor.mode.kind !== 'edit' && (
            <div className="flex flex-col gap-1">
              <Label>Type</Label>
              <Select value={productEditor.mode.kind === 'add' ? productEditor.mode.type : undefined} onValueChange={productEditor.openAdd}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Add a product…" />
                </SelectTrigger>
                <SelectContent>
                  {COPY_SHOP_TYPES.map(t => (
                    <SelectItem key={t} value={t}>
                      {COPY_SHOP_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {ActiveForm && active && (
            <ActiveForm
              key={active.product?.id ?? active.type}
              subOrder={subOrder}
              subOrderStatus={subOrderStatus}
              product={active.product}
              orderFiles={orderFiles}
              initialFileIds={active.product ? productEditor.fileIdsFor(active.product.id) : []}
              sortOrder={active.product ? active.product.sort_order : productEditor.products.length}
              onSaved={productEditor.handleSaved}
              onCancel={productEditor.close}
            />
          )}
        </>
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
