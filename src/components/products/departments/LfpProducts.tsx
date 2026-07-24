/** LFP department detail — add-product button, two-step dialog, table. */

import type { ComponentType } from 'react'
import type { JobStatus, JobRow } from '../../../types/database'
import type { FileRow } from '../../../services/fileService'
import { LFP_TYPES, LFP_TYPE_LABELS } from '../../../types/lfp'
import { AddProductButton } from '../AddProductButton'
import { SectionHeader } from '../../ui/section-title'
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
  job: JobRow
  jobStatus: JobStatus
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

export function LfpProducts({ job, jobStatus, orderFiles = [] }: Props) {
  const productEditor = useProductEditor(job, jobStatus)

  return (
    <div className="flex flex-col gap-4">
      {!productEditor.isReadOnly && (
        <ProductDialog
          editor={productEditor}
          job={job}
          orderFiles={orderFiles}
          types={TYPE_OPTIONS}
          formByType={FORM_BY_TYPE}
        />
      )}

      <div>
        <SectionHeader title="Products">
          {!productEditor.isReadOnly && <AddProductButton onClick={productEditor.openAdd} />}
        </SectionHeader>
        {productEditor.productsLoading ? (
          <p className="text-xs text-muted-foreground">Loading products…</p>
        ) : (
          <LfpProductsTable
            data={productEditor.products}
            meta={{ onEdit: productEditor.openEdit, onDelete: productEditor.handleDelete, onAdd: productEditor.openAdd, orderFiles, filesByProduct: productEditor.filesByProduct, isReadOnly: productEditor.isReadOnly }}
          />
        )}
      </div>
    </div>
  )
}
