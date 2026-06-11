/** LFP department detail — type dropdown + per-type form + table. */

import type { ComponentType } from 'react'
import type { OrderStatus, SubOrderRow } from '../../../types/database'
import type { FileRow } from '../../../services/fileService'
import { LFP_TYPES, LFP_TYPE_LABELS } from '../../../types/lfp'
import { Button } from '../../ui/button'
import { Label } from '../../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { useProductEditor } from '../useProductEditor'
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
  onProductsChanged?: (hasProducts: boolean) => void
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

export function LfpProducts({ subOrder, subOrderStatus, orderFiles = [], onProductsChanged }: Props) {
  const ed = useProductEditor(subOrder, subOrderStatus, onProductsChanged)
  const active =
    ed.mode.kind === 'edit'
      ? { type: ed.mode.product.type, product: ed.mode.product }
      : ed.mode.kind === 'add'
        ? { type: ed.mode.type, product: null }
        : null
  const ActiveForm = active ? FORM_BY_TYPE[active.type] : null

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold">Large-format print — Details</h3>

      {ed.requiresUnlock ? (
        <Button type="button" variant="outline" onClick={ed.requestUnlock}>
          Unlock editing
        </Button>
      ) : (
        <>
          {ed.mode.kind !== 'edit' && (
            <div className="flex flex-col gap-1">
              <Label>Type</Label>
              <Select value={ed.mode.kind === 'add' ? ed.mode.type : undefined} onValueChange={ed.openAdd}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Add a product…" />
                </SelectTrigger>
                <SelectContent>
                  {LFP_TYPES.map(t => (
                    <SelectItem key={t} value={t}>
                      {LFP_TYPE_LABELS[t]}
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
              initialFileIds={active.product ? ed.fileIdsFor(active.product.id) : []}
              sortOrder={active.product ? active.product.sort_order : ed.products.length}
              onSaved={ed.handleSaved}
              onCancel={ed.close}
            />
          )}
        </>
      )}

      <div className="border-t pt-3">
        <h3 className="text-sm font-semibold">Products</h3>
        {ed.productsLoading ? (
          <p className="text-xs text-muted-foreground">Loading products…</p>
        ) : (
          <LfpProductsTable
            data={ed.products}
            meta={{ onEdit: ed.openEdit, onDelete: ed.handleDelete, orderFiles, filesByProduct: ed.filesByProduct }}
          />
        )}
      </div>
    </div>
  )
}
