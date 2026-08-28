import { supabase } from '../supabase'
import type { ChildTable, LoadedProduct, ProductWriteInput } from '../types/product'
import { childTableForType, isProductType } from '../types/product'
import type { TextileMotifLinkRow } from '../types/textile'

export type ProductFileAssignment = {
  id: string
  department_product_id: string
  file_id: string
}

// --- generic child-table helpers --------------------------------------------
// `.from()` needs a literal table to infer the row type; the table here is a
// runtime union, so the builder is cast. Payloads are built type-safely upstream
// (ProductChildInsert), so this is the only place dynamic dispatch loses typing.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function childTable(table: ChildTable): any {
  return supabase.from(table as never)
}

async function fetchChildren(table: ChildTable, ids: string[]): Promise<Record<string, unknown>[]> {
  if (ids.length === 0) return []
  const { data, error } = await childTable(table).select('*').in('department_product_id', ids)
  if (error) throw error
  return (data ?? []) as Record<string, unknown>[]
}

async function insertChild(table: ChildTable, payload: Record<string, unknown>): Promise<void> {
  const { error } = await childTable(table).insert(payload)
  if (error) throw error
}

async function updateChild(table: ChildTable, id: string, payload: Record<string, unknown>): Promise<void> {
  const { error } = await childTable(table).update(payload).eq('department_product_id', id)
  if (error) throw error
}

async function deleteChild(table: ChildTable, id: string): Promise<void> {
  const { error } = await childTable(table).delete().eq('department_product_id', id)
  if (error) throw error
}

/** One product's claim on a `stamp_models` row. */
export type StampModelUsage = { modelId: string; quantity: number }

/**
 * One usage entry per row that actually references a model. A null model
 * reference yields nothing; a missing quantity counts as 1 — the same default
 * the production-release deduction applies.
 */
function toStampModelUsage(modelId: string | null, quantity: number | null): StampModelUsage[] {
  if (!modelId) return []
  const usableQuantity = quantity != null && Number.isFinite(quantity) && quantity >= 1 ? Math.floor(quantity) : 1
  return [{ modelId, quantity: usableQuantity }]
}

class DepartmentProductService {
  /** Parent rows + their typed child rows for a job, ordered by sort_order. */
  async getProductsByJobId(jobId: string): Promise<LoadedProduct[]> {
    const { data, error } = await supabase
      .from('department_products')
      .select('*')
      .eq('job_id', jobId)
      .order('sort_order')
    if (error) throw error
    const parents = data ?? []
    if (parents.length === 0) return []

    const idsByType = new Map<string, string[]>()
    for (const parent of parents) {
      if (!isProductType(parent.type)) throw new Error(`Unknown product type: ${parent.type}`)
      const list = idsByType.get(parent.type) ?? []
      list.push(parent.id)
      idsByType.set(parent.type, list)
    }
    const childById = new Map<string, Record<string, unknown>>()
    for (const [type, ids] of idsByType) {
      const rows = await fetchChildren(childTableForType(type), ids)
      for (const row of rows) childById.set(String(row.department_product_id), row)
    }
    return parents.map(parent => ({
      ...parent,
      child: childById.get(parent.id) ?? {},
    })) as LoadedProduct[]
  }

  /**
   * Product count per job for an order (job id → count). Feeds the derived
   * "in production, missing info" alert without loading full product rows.
   */
  async getProductCountsByOrderId(orderId: string): Promise<Record<string, number>> {
    const { data, error } = await supabase
      .from('jobs')
      .select('id, department_products(count)')
      .eq('order_id', orderId)
    if (error) throw error
    return Object.fromEntries(
      (data ?? []).map(row => [row.id, row.department_products?.[0]?.count ?? 0]),
    )
  }

  /**
   * Stamp-model usage across the given jobs: one row per product that
   * references a `stamp_models` row (Trodat Printy / Wooden Stamp via
   * `model_id`, Trodat Pad via `pad_variant_id`), with the product quantity.
   * Feeds the reorder list's open-demand figure.
   */
  async getStampModelUsageByJobs(jobIds: string[]): Promise<StampModelUsage[]> {
    if (jobIds.length === 0) return []

    // One query per referencing table. The table names and select strings must
    // stay literal — that is what lets supabase-js infer the row types.
    const [printyRows, woodenRows, padRows] = await Promise.all([
      supabase
        .from('trodat_printy_products')
        .select('model_id, department_products!inner(quantity, job_id)')
        .not('model_id', 'is', null)
        .in('department_products.job_id', jobIds),
      supabase
        .from('wooden_stamp_products')
        .select('model_id, department_products!inner(quantity, job_id)')
        .not('model_id', 'is', null)
        .in('department_products.job_id', jobIds),
      supabase
        .from('trodat_pad_products')
        .select('pad_variant_id, department_products!inner(quantity, job_id)')
        .not('pad_variant_id', 'is', null)
        .in('department_products.job_id', jobIds),
    ])
    if (printyRows.error) throw printyRows.error
    if (woodenRows.error) throw woodenRows.error
    if (padRows.error) throw padRows.error

    return [
      ...(printyRows.data ?? []).flatMap(row => toStampModelUsage(row.model_id, row.department_products.quantity)),
      ...(woodenRows.data ?? []).flatMap(row => toStampModelUsage(row.model_id, row.department_products.quantity)),
      ...(padRows.data ?? []).flatMap(row => toStampModelUsage(row.pad_variant_id, row.department_products.quantity)),
    ]
  }

  /** Insert parent then child (TS two-step). Returns the new product id. */
  async createProduct(input: ProductWriteInput): Promise<string> {
    const { data: parent, error } = await supabase
      .from('department_products')
      .insert({
        job_id: input.job_id,
        department: input.department,
        type: input.type,
        quantity: input.quantity,
        notes: input.notes,
        sort_order: input.sort_order,
      })
      .select('id')
      .single()
    if (error) throw error
    const id = parent.id
    try {
      await insertChild(childTableForType(input.type), {
        ...input.child,
        department_product_id: id,
      })
    } catch (childError) {
      await supabase.from('department_products').delete().eq('id', id)
      throw childError
    }
    return id
  }

  /** Update parent + child. If `type` changed, the child moves to a new table. */
  async updateProduct(id: string, input: ProductWriteInput): Promise<void> {
    const { data: old, error: readError } = await supabase
      .from('department_products')
      .select('type')
      .eq('id', id)
      .single()
    if (readError) throw readError

    const { error: parentError } = await supabase
      .from('department_products')
      .update({
        type: input.type,
        quantity: input.quantity,
        notes: input.notes,
        sort_order: input.sort_order,
      })
      .eq('id', id)
    if (parentError) throw parentError

    const newTable = childTableForType(input.type)
    if (old.type !== input.type) {
      await deleteChild(childTableForType(old.type), id)
      await insertChild(newTable, { ...input.child, department_product_id: id })
    } else {
      await updateChild(newTable, id, input.child as Record<string, unknown>)
    }
  }

  async deleteProduct(id: string): Promise<void> {
    const { error } = await supabase.from('department_products').delete().eq('id', id)
    if (error) throw error
  }

  // --- file assignments (product_files) ---
  async getFilesByProductIds(ids: string[]): Promise<ProductFileAssignment[]> {
    if (ids.length === 0) return []
    const { data, error } = await supabase
      .from('product_files')
      .select('id, department_product_id, file_id')
      .in('department_product_id', ids)
    if (error) throw error
    return (data ?? []) as ProductFileAssignment[]
  }

  async assignFileToProduct(departmentProductId: string, fileId: string): Promise<void> {
    const { error } = await supabase
      .from('product_files')
      .insert({ department_product_id: departmentProductId, file_id: fileId })
    if (error) throw error
  }

  async removeFileFromProduct(id: string): Promise<void> {
    const { error } = await supabase.from('product_files').delete().eq('id', id)
    if (error) throw error
  }

  // --- textile design links (textile_motif_links) ---
  // Attributed M:N on a TEXTILE_GARMENT product — like product_files, but each
  // link also carries placement/size/method, so it supports update (not just
  // add/remove). The save layer reconciles these the way it reconciles files.
  async getMotifLinksByProductIds(ids: string[]): Promise<TextileMotifLinkRow[]> {
    if (ids.length === 0) return []
    const { data, error } = await supabase
      .from('textile_motif_links')
      .select('id, department_product_id, motif_id, placement, size, print_method')
      .in('department_product_id', ids)
    if (error) throw error
    return (data ?? []) as TextileMotifLinkRow[]
  }

  async createMotifLink(payload: Omit<TextileMotifLinkRow, 'id'>): Promise<void> {
    const { error } = await supabase.from('textile_motif_links').insert(payload)
    if (error) throw error
  }

  async updateMotifLink(
    id: string,
    patch: Partial<Omit<TextileMotifLinkRow, 'id' | 'department_product_id'>>,
  ): Promise<void> {
    const { error } = await supabase.from('textile_motif_links').update(patch).eq('id', id)
    if (error) throw error
  }

  async removeMotifLink(id: string): Promise<void> {
    const { error } = await supabase.from('textile_motif_links').delete().eq('id', id)
    if (error) throw error
  }
}

export const departmentProductService = new DepartmentProductService()
