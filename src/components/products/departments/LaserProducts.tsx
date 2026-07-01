/** Laser department detail — add-product button, two-step dialog, table. */

import type { ComponentType } from 'react'
import type { OrderStatus, SubOrderRow } from '../../../types/database'
import type { FileRow } from '../../../services/fileService'
import { LASER_TYPES, LASER_TYPE_LABELS } from '../../../types/laser'
import { Button } from '../../ui/button'
import { useProductEditor } from '../useProductEditor'
import { ProductDialog, type ProductTypeOption } from '../ProductDialog'
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

const TYPE_OPTIONS: ProductTypeOption[] = LASER_TYPES.map(t => ({ value: t, label: LASER_TYPE_LABELS[t] }))

export function LaserProducts({ subOrder, subOrderStatus, orderFiles = [] }: Props) {
  const productEditor = useProductEditor(subOrder, subOrderStatus)

  return (
    <div className="flex flex-col gap-4">
      {!productEditor.isReadOnly && (
        <ProductDialog
          editor={productEditor}
          subOrder={subOrder}
          orderFiles={orderFiles}
          types={TYPE_OPTIONS}
          formByType={FORM_BY_TYPE}
        />
      )}

      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Products</h3>
          {!productEditor.isReadOnly && (
            <Button type="button" variant="outline" size="sm" onClick={productEditor.openAdd}>
              + Add product
            </Button>
          )}
        </div>
        {productEditor.productsLoading ? (
          <p className="text-xs text-muted-foreground">Loading products…</p>
        ) : (
          <LaserProductsTable
            data={productEditor.products}
            meta={{ onEdit: productEditor.openEdit, onDelete: productEditor.handleDelete, orderFiles, filesByProduct: productEditor.filesByProduct, isReadOnly: productEditor.isReadOnly }}
          />
        )}
      </div>
    </div>
  )
}
