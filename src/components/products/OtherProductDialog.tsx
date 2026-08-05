/**
 * OTHER department product dialog. The OTHER department has a single product
 * type, so there is no type picker — the dialog opens straight to the form.
 * The modal chrome and view-mode handling live in `ProductDialogShell`;
 * submission stays in the form itself.
 */

import type { JobRow } from '../../types/database'
import type { FileRow } from '../../services/fileService'
import { OtherForm } from './forms/other'
import { ProductDialogShell } from './ProductDialogShell'
import type { useProductEditor } from './useProductEditor'

type ProductEditor = ReturnType<typeof useProductEditor>

export function OtherProductDialog({
  editor,
  job,
  orderFiles,
}: {
  editor: ProductEditor
  job: JobRow
  orderFiles: FileRow[]
}) {
  const { close, handleSaved, fileIdsFor } = editor

  return (
    <ProductDialogShell editor={editor} job={job}>
      {({ product, orderIsQuote, sortOrder }) => (
        <OtherForm
          key={product?.id ?? 'new'}
          job={job}
          orderIsQuote={orderIsQuote}
          product={product}
          orderFiles={orderFiles}
          initialFileIds={product ? fileIdsFor(product.id) : []}
          sortOrder={sortOrder}
          onSaved={handleSaved}
          onCancel={close}
        />
      )}
    </ProductDialogShell>
  )
}
