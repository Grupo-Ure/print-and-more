/**
 * Textile department detail — a per-sub-order **designs drawer** (reusable
 * motifs) above the garment product list. Garments ride the generic product
 * editor; the drawer + design links are the textile-specific satellites.
 */

import { useMemo, useState } from 'react'
import type { OrderStatus, SubOrderRow } from '../../../types/database'
import type { FileRow } from '../../../services/fileService'
import type { TextileMotifRow, TextileMotifLinkInput } from '../../../types/textile'
import type { LoadedProduct } from '../../../types/product'
import {
  useTextileMotifs,
  useTextileMotifLinksBySubOrderId,
  useSaveTextileMotif,
  useDeleteTextileMotif,
} from '../../../queries/textileQueries'
import { useToast } from '../../Toast'
import { Button } from '../../ui/button'
import { Label } from '../../ui/label'
import { Badge } from '../../ui/badge'
import { Input } from '../../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { useProductEditor } from '../useProductEditor'
import { TextileProductDialog } from '../TextileProductDialog'
import { motifLabel } from '../forms/textileTypes'

type Props = {
  subOrder: SubOrderRow
  subOrderStatus: OrderStatus
  orderFiles?: FileRow[]
}

const FONT_CLASS_OPTS = [
  { value: 'SANS_SERIF', label: 'Sans-serif' },
  { value: 'SERIF', label: 'Serif' },
  { value: 'ELEGANT', label: 'Elegant' },
  { value: 'PLAYFUL', label: 'Playful' },
]

// --- Designs drawer ---------------------------------------------------------

type DesignDraft = {
  id?: string
  type: 'TEXT' | 'FILE'
  content: string
  color: string
  font_class: string
  font_name: string
  file_id: string
}

const EMPTY_DESIGN: DesignDraft = { type: 'TEXT', content: '', color: '', font_class: '', font_name: '', file_id: '' }

function designFromRow(m: TextileMotifRow): DesignDraft {
  return {
    id: m.id,
    type: m.type,
    content: m.content ?? '',
    color: m.color ?? '',
    font_class: m.font_class ?? '',
    font_name: m.font_name ?? '',
    file_id: m.file_id ?? '',
  }
}

function designValid(d: DesignDraft): boolean {
  if (d.type === 'TEXT') return d.content.trim() !== '' && d.color.trim() !== '' && d.font_class !== ''
  return d.file_id !== ''
}

function DesignsDrawer({
  subOrder,
  motifs,
  orderFiles,
}: {
  subOrder: SubOrderRow
  motifs: TextileMotifRow[]
  orderFiles: FileRow[]
}) {
  const save = useSaveTextileMotif(subOrder.id)
  const del = useDeleteTextileMotif(subOrder.id)
  const { showError } = useToast()
  const [draft, setDraft] = useState<DesignDraft | null>(null)

  const submit = () => {
    if (!draft || !designValid(draft)) return
    const isText = draft.type === 'TEXT'
    save.mutate(
      {
        id: draft.id,
        payload: {
          department_order_id: subOrder.id,
          type: draft.type,
          content: isText ? draft.content.trim() : null,
          color: isText ? draft.color.trim() : null,
          font_class: isText ? (draft.font_class as 'SANS_SERIF' | 'SERIF' | 'ELEGANT' | 'PLAYFUL') : null,
          font_name: isText ? (draft.font_name.trim() || null) : null,
          file_id: isText ? null : draft.file_id,
        },
      },
      { onSuccess: () => setDraft(null), onError: () => showError('Design could not be saved') },
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Designs</h3>
        {!draft && <Button type="button" size="sm" variant="outline" onClick={() => setDraft({ ...EMPTY_DESIGN })}>+ New design</Button>}
      </div>

      {motifs.length === 0 && !draft && <p className="text-xs text-muted-foreground">No designs yet. Add one to apply it to garments.</p>}

      <div className="flex flex-wrap gap-2">
        {motifs.map(m => (
          <Badge key={m.id} variant="secondary" className="gap-1">
            <button type="button" className="cursor-pointer" title="Edit" onClick={() => setDraft(designFromRow(m))}>{motifLabel(m)}</button>
            <button type="button" className="cursor-pointer hover:text-destructive" title="Delete" onClick={() => del.mutate({ id: m.id }, { onError: () => showError('Design could not be deleted (still applied?)') })}>×</button>
          </Badge>
        ))}
      </div>

      {draft && (
        <div className="flex flex-col gap-2 rounded-md border p-2">
          <div className="flex flex-col gap-1">
            <Label>Kind</Label>
            <Select value={draft.type} onValueChange={v => setDraft({ ...draft, type: v as 'TEXT' | 'FILE' })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TEXT">Text</SelectItem>
                <SelectItem value="FILE">Graphic (file)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {draft.type === 'TEXT' ? (
            <>
              <div className="flex flex-col gap-1">
                <Label>Text</Label>
                <Input value={draft.content} onChange={e => setDraft({ ...draft, content: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <div className="flex flex-1 flex-col gap-1">
                  <Label>Colour</Label>
                  <Input value={draft.color} onChange={e => setDraft({ ...draft, color: e.target.value })} placeholder="#FFFFFF" />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <Label>Font</Label>
                  <Select value={draft.font_class || undefined} onValueChange={v => setDraft({ ...draft, font_class: v })}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Font…" /></SelectTrigger>
                    <SelectContent>{FONT_CLASS_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Label>Font name (optional)</Label>
                <Input value={draft.font_name} onChange={e => setDraft({ ...draft, font_name: e.target.value })} />
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1">
              <Label>File</Label>
              <Select value={draft.file_id || undefined} onValueChange={v => setDraft({ ...draft, file_id: v })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select a file…" /></SelectTrigger>
                <SelectContent>{orderFiles.map(f => <SelectItem key={f.id} value={f.id}>{f.display_name}</SelectItem>)}</SelectContent>
              </Select>
              {orderFiles.length === 0 && <p className="text-xs text-muted-foreground">Link a file to the order first.</p>}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="button" size="sm" disabled={!designValid(draft) || save.isPending} onClick={submit}>{save.isPending ? 'Saving…' : draft.id ? 'Save' : 'Add design'}</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Garment line summary ---------------------------------------------------

function garmentSummary(product: LoadedProduct): string {
  const c = product.child as { origin?: string | null; garment_type?: string | null; brand?: string | null; model?: string | null; color?: string | null; size?: string | null }
  if (c.origin === 'CUSTOMER_STOCK') {
    return [c.garment_type, c.color].filter(Boolean).join(' · ') || 'Customer garment'
  }
  return [c.brand, c.model, c.color, c.size].filter(Boolean).join(' · ') || 'In-house garment'
}

// --- Host -------------------------------------------------------------------

export function TextileProducts({ subOrder, subOrderStatus, orderFiles = [] }: Props) {
  const productEditor = useProductEditor(subOrder, subOrderStatus)
  const motifsQuery = useTextileMotifs(subOrder.id)
  const motifs = useMemo(() => motifsQuery.data ?? [], [motifsQuery.data])
  const linksQuery = useTextileMotifLinksBySubOrderId(subOrder.id)
  const linksByProduct = useMemo(() => {
    const map: Record<string, TextileMotifLinkInput[]> = {}
    for (const l of linksQuery.data ?? []) {
      (map[l.department_product_id] ??= []).push({ id: l.id, motif_id: l.motif_id, placement: l.placement, size: l.size, print_method: l.print_method })
    }
    return map
  }, [linksQuery.data])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Textile — Details</h3>
        {!productEditor.isReadOnly && (
          <Button type="button" variant="outline" size="sm" onClick={productEditor.openAdd}>+ Add garment</Button>
        )}
      </div>

      <DesignsDrawer subOrder={subOrder} motifs={motifs} orderFiles={orderFiles} />

      {!productEditor.isReadOnly && (
        <TextileProductDialog
          editor={productEditor}
          subOrder={subOrder}
          orderFiles={orderFiles}
          motifs={motifs}
          linksByProduct={linksByProduct}
        />
      )}

      <div className="border-t pt-3">
        <h3 className="text-sm font-semibold">Garments</h3>
        {productEditor.productsLoading ? (
          <p className="text-xs text-muted-foreground">Loading garments…</p>
        ) : productEditor.products.length === 0 ? (
          <p className="text-xs text-muted-foreground">No garments yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1 font-medium">Garment</th>
                <th className="py-1 font-medium">Qty</th>
                <th className="py-1 font-medium">Designs</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {productEditor.products.map(prod => (
                <tr key={prod.id} className="border-t">
                  <td className="py-1">{garmentSummary(prod)}</td>
                  <td className="py-1">{prod.quantity ?? '—'}</td>
                  <td className="py-1">{(linksByProduct[prod.id] ?? []).length}</td>
                  <td className="py-1 text-right">
                    <button type="button" className="cursor-pointer text-muted-foreground hover:text-foreground" title="Edit" onClick={() => productEditor.openEdit(prod)}>Edit</button>
                    <button type="button" className="ml-3 cursor-pointer text-muted-foreground hover:text-destructive" title="Delete" onClick={() => productEditor.handleDelete(prod.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
