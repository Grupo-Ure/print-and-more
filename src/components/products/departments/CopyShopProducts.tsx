/** CopyShop department detail — add-product button, two-step dialog, table. */

import type { ComponentType } from 'react'
import type { JobStatus, JobRow } from '../../../types/database'
import type { FileRow } from '../../../services/fileService'
import { COPY_SHOP_TYPES, COPY_SHOP_TYPE_LABELS } from '../../../types/copyshop'
import { AddProductButton } from '../AddProductButton'
import { SectionTitle } from '../../ui/section-title'
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
  job: JobRow
  jobStatus: JobStatus
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

export function CopyShopProducts({ job, jobStatus, orderFiles = [] }: Props) {
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
        <div className="flex items-center justify-between">
          <SectionTitle>Products</SectionTitle>
          {!productEditor.isReadOnly && <AddProductButton onClick={productEditor.openAdd} />}
        </div>
        {productEditor.productsLoading ? (
          <p className="text-xs text-muted-foreground">Loading products…</p>
        ) : (
          <CopyShopProductsTable
            data={productEditor.products}
            meta={{ onEdit: productEditor.openEdit, onDelete: productEditor.handleDelete, onAdd: productEditor.openAdd, orderFiles, filesByProduct: productEditor.filesByProduct, isReadOnly: productEditor.isReadOnly }}
          />
        )}
      </div>
    </div>
  )
}
