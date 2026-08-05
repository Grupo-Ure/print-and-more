/** Laser department detail — add-product button, two-step dialog, table. */

import type { ComponentType } from 'react'
import type { JobStatus, JobRow } from '../../../types/database'
import type { FileRow } from '../../../services/fileService'
import { LASER_TYPES, LASER_TYPE_LABELS } from '../../../types/laser'
import { AddProductButton } from '../AddProductButton'
import { SectionHeader } from '../../ui/section-title'
import { useProductEditor } from '../useProductEditor'
import { ProductDialog, type ProductTypeOption } from '../ProductDialog'
import { LaserProductsTable } from '../ProductTable'
import { SignForm, TrophyPlateForm, NameTagForm, GiftItemForm, OtherLaserForm } from '../forms/laser'
import type { ProductFormProps } from '../forms/shared'

type Props = {
  job: JobRow
  jobStatus: JobStatus
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

export function LaserProducts({ job, jobStatus, orderFiles = [] }: Props) {
  const productEditor = useProductEditor(job, jobStatus)

  return (
    <div className="flex flex-col gap-4">
      <ProductDialog
        editor={productEditor}
        job={job}
        orderFiles={orderFiles}
        types={TYPE_OPTIONS}
        formByType={FORM_BY_TYPE}
      />

      <div>
        <SectionHeader title="Products">
          {!productEditor.isReadOnly && <AddProductButton onClick={productEditor.openAdd} />}
        </SectionHeader>
        {productEditor.productsLoading ? (
          <p className="text-xs text-muted-foreground">Loading products…</p>
        ) : (
          <LaserProductsTable
            data={productEditor.products}
            meta={{ onEdit: productEditor.openEdit, onDelete: productEditor.handleDelete, onAdd: productEditor.openAdd, onView: productEditor.openView, orderFiles, filesByProduct: productEditor.filesByProduct, isReadOnly: productEditor.isReadOnly }}
          />
        )}
      </div>
    </div>
  )
}
