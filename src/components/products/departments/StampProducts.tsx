/** Stamp department detail — add-product button, two-step dialog, table. */

import type { ComponentType } from 'react'
import type { JobStatus, JobRow } from '../../../types/database'
import type { FileRow } from '../../../services/fileService'
import { AddProductButton } from '../AddProductButton'
import { SectionHeader } from '../../ui/section-title'
import { useProductEditor } from '../useProductEditor'
import { ProductDialog, type ProductTypeOption } from '../ProductDialog'
import { StampProductsTable } from '../ProductTable'
import { STAMP_ALL_TYPES, STAMP_ALL_LABELS } from '../forms/stampTypes'
import {
  TrodatPrintyForm,
  WoodenStampForm,
  StandStampForm,
  DateStampForm,
  OtherStampForm,
  StampPlateForm,
  RefillInkForm,
  InkPadForm,
  TrodatPadForm,
} from '../forms/stamp'
import type { ProductFormProps } from '../forms/shared'

type Props = {
  job: JobRow
  jobStatus: JobStatus
  orderFiles?: FileRow[]
}

const FORM_BY_TYPE: Record<string, ComponentType<ProductFormProps>> = {
  TRODAT_PRINTY: TrodatPrintyForm,
  WOODEN_STAMP: WoodenStampForm,
  STAND_STAMP: StandStampForm,
  DATE_STAMP: DateStampForm,
  OTHER_STAMP: OtherStampForm,
  STAMP_PLATE: StampPlateForm,
  REFILL_INK: RefillInkForm,
  INK_PAD: InkPadForm,
  TRODAT_PAD: TrodatPadForm,
}

const TYPE_OPTIONS: ProductTypeOption[] = STAMP_ALL_TYPES.map(t => ({ value: t, label: STAMP_ALL_LABELS[t] }))

export function StampProducts({ job, jobStatus, orderFiles = [] }: Props) {
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
          <StampProductsTable
            data={productEditor.products}
            meta={{ onEdit: productEditor.openEdit, onDelete: productEditor.handleDelete, onAdd: productEditor.openAdd, orderFiles, filesByProduct: productEditor.filesByProduct, isReadOnly: productEditor.isReadOnly }}
          />
        )}
      </div>
    </div>
  )
}
