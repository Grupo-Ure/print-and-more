/** OTHER department detail — single product type, add-product dialog, table. */

import type { JobStatus, JobRow } from '../../../types/database'
import type { FileRow } from '../../../services/fileService'
import { AddProductButton } from '../AddProductButton'
import { SectionHeader } from '../../ui/section-title'
import { useProductEditor } from '../useProductEditor'
import { OtherProductDialog } from '../OtherProductDialog'
import { OtherProductsTable } from '../ProductTable'

type Props = {
  job: JobRow
  jobStatus: JobStatus
  orderFiles?: FileRow[]
}

export function OtherProducts({ job, jobStatus, orderFiles = [] }: Props) {
  const productEditor = useProductEditor(job, jobStatus)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">For ‘Other’, Prepress is set manually only.</p>

      {!productEditor.isReadOnly && (
        <OtherProductDialog
          editor={productEditor}
          job={job}
          orderFiles={orderFiles}
        />
      )}

      <div className="flex flex-col gap-6">
        <SectionHeader title="Products">
          {!productEditor.isReadOnly && <AddProductButton onClick={productEditor.openAdd} />}
        </SectionHeader>
        {productEditor.productsLoading ? (
          <p className="text-xs text-muted-foreground">Loading products…</p>
        ) : (
          <OtherProductsTable
            data={productEditor.products}
            meta={{ onEdit: productEditor.openEdit, onDelete: productEditor.handleDelete, onAdd: productEditor.openAdd, orderFiles, filesByProduct: productEditor.filesByProduct, isReadOnly: productEditor.isReadOnly }}
          />
        )}
      </div>
    </div>
  )
}
