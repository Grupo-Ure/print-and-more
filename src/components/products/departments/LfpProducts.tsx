/** LFP department detail — add-product button, two-step dialog, table. */

import type { ComponentType } from 'react'
import type { OrderStatus, SubOrderRow } from '../../../types/database'
import type { FileRow } from '../../../services/fileService'
import { LFP_TYPES, LFP_TYPE_LABELS } from '../../../types/lfp'
import { Button } from '../../ui/button'
import { useProductEditor } from '../useProductEditor'
import { ProductDialog, type ProductTypeOption } from '../ProductDialog'
import { LfpProductsTable } from '../ProductTable'
import {
  StickerForm,
  SignUvForm,
  SignFoilForm,
  FoilPlotterForm,
  BannerForm,
  RollupForm,
  VehicleLetteringForm,
  OtherLfpForm,
} from '../forms/lfp'
import type { ProductFormProps } from '../forms/shared'

type Props = {
  subOrder: SubOrderRow
  subOrderStatus: OrderStatus
  orderFiles?: FileRow[]
}

const FORM_BY_TYPE: Record<string, ComponentType<ProductFormProps>> = {
  STICKER: StickerForm,
  SIGN_UV: SignUvForm,
  SIGN_FOIL: SignFoilForm,
  FOIL_PLOTTER: FoilPlotterForm,
  BANNER: BannerForm,
  ROLLUP: RollupForm,
  VEHICLE_LETTERING: VehicleLetteringForm,
  OTHER_LFP: OtherLfpForm,
}

const TYPE_OPTIONS: ProductTypeOption[] = LFP_TYPES.map(t => ({ value: t, label: LFP_TYPE_LABELS[t] }))

export function LfpProducts({ subOrder, subOrderStatus, orderFiles = [] }: Props) {
  const productEditor = useProductEditor(subOrder, subOrderStatus)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Large-format print — Details</h3>
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
          <LfpProductsTable
            data={productEditor.products}
            meta={{ onEdit: productEditor.openEdit, onDelete: productEditor.handleDelete, orderFiles, filesByProduct: productEditor.filesByProduct }}
          />
        )}
      </div>
    </div>
  )
}
