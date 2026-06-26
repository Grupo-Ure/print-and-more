/** Laser department detail — type dropdown + per-type form + table. */

import type { ComponentType } from 'react'
import type { OrderStatus, SubOrderRow } from '../../../types/database'
import type { FileRow } from '../../../services/fileService'
import { LASER_TYPES, LASER_TYPE_LABELS } from '../../../types/laser'
import { Button } from '../../ui/button'
import { Label } from '../../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { useProductEditor } from '../useProductEditor'
import { LaserProductsTable } from '../ProductTable'
import { SignForm, TrophyPlateForm, NameTagForm, GiftItemForm, OtherLaserForm } from '../forms/laser'
import type { ProductFormProps } from '../forms/shared'

type Props = {
  subOrder: SubOrderRow
  subOrderStatus: OrderStatus
  orderFiles?: FileRow[]
}

const FORM_BY_TYPE: Record<string, ComponentType<ProductFormProps>> = {
  SIGN: SignForm,
  TROPHY_PLATE: TrophyPlateForm,
  NAME_TAG: NameTagForm,
  GIFT_ITEM: GiftItemForm,
  OTHER_LASER: OtherLaserForm,
}

export function LaserProducts({ subOrder, subOrderStatus, orderFiles = [] }: Props) {
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
      <h3 className="text-sm font-semibold">Laser engraving — Details</h3>

      {!productEditor.requiresUnlock && (
        <>
          {productEditor.mode.kind !== 'edit' && (
            <div className="flex flex-col gap-1">
              <Label>Type</Label>
              <Select value={productEditor.mode.kind === 'add' ? productEditor.mode.type : undefined} onValueChange={productEditor.openAdd}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Add a product…" />
                </SelectTrigger>
                <SelectContent>
                  {LASER_TYPES.map(t => (
                    <SelectItem key={t} value={t}>
                      {LASER_TYPE_LABELS[t]}
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
          <LaserProductsTable
            data={productEditor.products}
            meta={{ onEdit: productEditor.openEdit, onDelete: productEditor.handleDelete, orderFiles, filesByProduct: productEditor.filesByProduct }}
          />
        )}
      </div>
    </div>
  )
}
