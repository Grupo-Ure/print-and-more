/**
 * Textile department garment dialog. Textile has a single garment type, so
 * there is no type picker — the dialog opens straight to the garment form.
 * The reusable designs drawer stays on the page; this dialog only hosts the
 * garment form (which needs the motif list + the garment's existing design
 * links). The modal chrome and view-mode handling live in `ProductDialogShell`.
 */

import type { JobRow } from '../../types/database'
import type { FileRow } from '../../services/fileService'
import type { TextileMotifRow, TextileMotifLinkInput } from '../../types/textile'
import { TextileGarmentForm } from './forms/textile'
import { ProductDialogShell } from './ProductDialogShell'
import type { useProductEditor } from './useProductEditor'

type ProductEditor = ReturnType<typeof useProductEditor>

export function TextileProductDialog({
  editor,
  job,
  orderFiles,
  motifs,
  linksByProduct,
}: {
  editor: ProductEditor
  job: JobRow
  orderFiles: FileRow[]
  motifs: TextileMotifRow[]
  linksByProduct: Record<string, TextileMotifLinkInput[]>
}) {
  const { close, handleSaved } = editor

  return (
    <ProductDialogShell editor={editor} job={job} noun="garment">
      {({ product, orderIsQuote, sortOrder }) => (
        <TextileGarmentForm
          key={product?.id ?? 'new'}
          job={job}
          orderIsQuote={orderIsQuote}
          product={product}
          orderFiles={orderFiles}
          initialFileIds={[]}
          sortOrder={sortOrder}
          onSaved={handleSaved}
          onCancel={close}
          motifs={motifs}
          initialLinks={product ? (linksByProduct[product.id] ?? []) : []}
        />
      )}
    </ProductDialogShell>
  )
}
