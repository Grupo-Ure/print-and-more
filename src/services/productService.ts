import { supabase } from '../supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Database, TablesInsert, TablesUpdate } from '../types/supabase'
import type {
  ChildTable,
  LoadedProduct,
  ProductWriteInput,
  TextileDesignInsert,
  TextileGarmentLineInsert,
} from '../types/product'
import { childTableForType, isProductType, isSingleChildProductType, TEXTILE_PRODUCT_TYPE } from '../types/product'
import type {
  DeliveryChoice,
  Department,
  OrderStatus,
  Priority,
  ProductRow,
  ProductStatus,
} from '../types/database'
import { resolveEffectiveProduct } from '../lib/productShared'

/**
 * The product service: a product is the unit of work, so this one service owns
 * both halves the old schema split between `jobs` and `department_products` —
 * the production workflow (status, assignee, approval, cancellation) and the
 * typed spec (the child row, its files, and for textile its garment lines and
 * designs).
 */

/** SELECT for `products` — the full row as the app consumes it (`ProductRow`). */
const PRODUCT_COLUMNS =
  'id, product_number, order_id, department, type, status, quantity, notes, sort_order, deadline, delivery, priority, assignee_id, is_cancelled, customer_approval_required, customer_approval_granted, customer_approval_file_id, created_at' as const

/** `product_number` is trigger-assigned; the client never sets it. */
export type ProductInsert = Omit<TablesInsert<'products'>, 'product_number'>
type ProductPatch = TablesUpdate<'products'>

/** Pause before replacing a realtime channel that was lost. */
const RESUBSCRIBE_DELAY_MS = 2000

/** The statuses the production feed lists: work that waits for, or is with, its assignee. */
export const PRODUCTION_FEED_STATUSES: readonly ProductStatus[] = ['PREPRESS', 'IN_PRODUCTION']

/**
 * One row of the production feed: the product with the order fields its
 * inherited values resolve against, and the customer's name.
 */
export type ProductionProduct = Pick<
  ProductRow,
  | 'id'
  | 'product_number'
  | 'order_id'
  | 'department'
  | 'type'
  | 'status'
  | 'deadline'
  | 'delivery'
  | 'priority'
  | 'assignee_id'
  | 'is_cancelled'
  | 'customer_approval_required'
  | 'customer_approval_granted'
> & {
  orders: {
    order_number: string
    status: OrderStatus
    deadline: string | null
    delivery: DeliveryChoice | null
    priority: Priority
    customers: { name: string } | null
  }
}

const PRODUCTION_PRODUCT_SELECT =
  'id, product_number, order_id, department, type, status, deadline, delivery, priority, assignee_id, is_cancelled, customer_approval_required, customer_approval_granted, orders!inner(order_number, status, deadline, delivery, priority, is_archived, customers(name))'

/**
 * Feed order: effective priority HIGH before NORMAL regardless of date, then
 * effective deadline ascending with undated products last, then product number
 * for a stable list.
 */
function compareProductionProducts(left: ProductionProduct, right: ProductionProduct): number {
  const leftEffective = resolveEffectiveProduct(left, left.orders)
  const rightEffective = resolveEffectiveProduct(right, right.orders)
  if (leftEffective.priority !== rightEffective.priority) {
    return leftEffective.priority === 'HIGH' ? -1 : 1
  }
  const leftDeadline = leftEffective.deadline ?? '9999-12-31'
  const rightDeadline = rightEffective.deadline ?? '9999-12-31'
  if (leftDeadline !== rightDeadline) return leftDeadline < rightDeadline ? -1 : 1
  return left.product_number.localeCompare(right.product_number)
}

/** Supabase may emit a to-one join as a one-element array; keep the published shape a single row. */
function flattenOrderCustomer(product: ProductionProduct): ProductionProduct {
  const customers: unknown = product.orders.customers
  if (Array.isArray(customers)) {
    return { ...product, orders: { ...product.orders, customers: customers[0] ?? null } }
  }
  return product
}

export type ProductSummary = {
  id: string
  department: Department
}

export type ProductFileAssignment = {
  id: string
  product_id: string
  file_id: string
}

/** One product's claim on a `stamp_models` row. */
export type StampModelUsage = { modelId: string; quantity: number }

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
  const { data, error } = await childTable(table).select('*').in('product_id', ids)
  if (error) throw error
  return (data ?? []) as Record<string, unknown>[]
}

async function insertChild(table: ChildTable, payload: Record<string, unknown>): Promise<void> {
  const { error } = await childTable(table).insert(payload)
  if (error) throw error
}

async function updateChild(table: ChildTable, id: string, payload: Record<string, unknown>): Promise<void> {
  const { error } = await childTable(table).update(payload).eq('product_id', id)
  if (error) throw error
}

async function deleteChild(table: ChildTable, id: string): Promise<void> {
  const { error } = await childTable(table).delete().eq('product_id', id)
  if (error) throw error
}

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

/** Write a textile batch's 1:n children. Replaces whatever was there. */
async function writeTextileChildren(
  productId: string,
  garments: TextileGarmentLineInsert[],
  designs: TextileDesignInsert[],
): Promise<void> {
  const { error: clearGarments } = await supabase.from('textile_garments').delete().eq('product_id', productId)
  if (clearGarments) throw clearGarments
  const { error: clearDesigns } = await supabase.from('textile_designs').delete().eq('product_id', productId)
  if (clearDesigns) throw clearDesigns

  if (garments.length > 0) {
    const { error } = await supabase
      .from('textile_garments')
      .insert(garments.map(line => ({ ...line, product_id: productId })))
    if (error) throw error
  }
  if (designs.length > 0) {
    const { error } = await supabase
      .from('textile_designs')
      .insert(designs.map(design => ({ ...design, product_id: productId })))
    if (error) throw error
  }
}

class ProductService {
  // --- workflow rows --------------------------------------------------------

  /** Every product of an order, in display order. */
  async listByOrderId(orderId: string): Promise<ProductRow[]> {
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_COLUMNS)
      .eq('order_id', orderId)
      .order('sort_order', { ascending: true })
    if (error) throw error
    return (data ?? []) as unknown as ProductRow[]
  }

  async getById(id: string): Promise<ProductRow | null> {
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_COLUMNS)
      .eq('id', id)
      .single()
    if (error) throw error
    return data as unknown as ProductRow | null
  }

  async update(id: string, patch: ProductPatch): Promise<ProductRow> {
    const { data, error } = await supabase
      .from('products')
      .update(patch)
      .eq('id', id)
      .select(PRODUCT_COLUMNS)
      .single()
    if (error) throw error
    return data as unknown as ProductRow
  }

  async setStatus(id: string, status: ProductStatus): Promise<ProductRow> {
    return this.update(id, { status })
  }

  async setCustomerApproval(
    id: string,
    patch: Pick<
      ProductPatch,
      'customer_approval_required' | 'customer_approval_granted' | 'customer_approval_file_id'
    >,
  ): Promise<ProductRow> {
    return this.update(id, patch)
  }

  async cancel(id: string): Promise<void> {
    const { error } = await supabase.from('products').update({ is_cancelled: true }).eq('id', id)
    if (error) throw error
  }

  async cancelAllForOrder(orderId: string): Promise<void> {
    const { error } = await supabase.from('products').update({ is_cancelled: true }).eq('order_id', orderId)
    if (error) throw error
  }

  async getSummariesForOrder(orderId: string): Promise<ProductSummary[]> {
    const { data, error } = await supabase
      .from('products')
      .select('id, department')
      .eq('order_id', orderId)
    if (error) throw error
    return (data ?? []) as unknown as ProductSummary[]
  }

  /**
   * Every product the Production page lists: in pre-press or production, not
   * cancelled, on a non-archived order — across all orders, sorted for the feed.
   */
  async listProductionProducts(): Promise<ProductionProduct[]> {
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCTION_PRODUCT_SELECT)
      .in('status', [...PRODUCTION_FEED_STATUSES])
      .eq('is_cancelled', false)
      .eq('orders.is_archived', false)
    if (error) throw error
    // Cast: the nested `orders` / `customers` joins come back untyped from the select string.
    const rows = (data ?? []) as unknown as ProductionProduct[]
    return rows.map(flattenOrderCustomer).sort(compareProductionProducts)
  }

  // --- loaded products (parent + typed child) -------------------------------

  /** Parent rows + their typed children for an order, ordered by sort_order. */
  async getLoadedByOrderId(orderId: string): Promise<LoadedProduct[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('order_id', orderId)
      .order('sort_order')
    if (error) throw error
    return this.attachChildren(data ?? [])
  }

  /** One product with its typed child. */
  async getLoadedById(id: string): Promise<LoadedProduct | null> {
    const { data, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    if (!data) return null
    const [loaded] = await this.attachChildren([data])
    return loaded ?? null
  }

  /**
   * Join each parent to its typed child: one row per 1:1 type, and for a
   * TEXTILE batch its garment lines and designs.
   */
  private async attachChildren(parents: Database['public']['Tables']['products']['Row'][]): Promise<LoadedProduct[]> {
    if (parents.length === 0) return []

    const idsByType = new Map<string, string[]>()
    for (const parent of parents) {
      if (!isProductType(parent.type)) throw new Error(`Unknown product type: ${parent.type}`)
      const list = idsByType.get(parent.type) ?? []
      list.push(parent.id)
      idsByType.set(parent.type, list)
    }

    const childById = new Map<string, Record<string, unknown>>()
    const garmentsById = new Map<string, Record<string, unknown>[]>()
    const designsById = new Map<string, Record<string, unknown>[]>()

    for (const [type, ids] of idsByType) {
      if (isSingleChildProductType(type)) {
        const rows = await fetchChildren(childTableForType(type), ids)
        for (const row of rows) childById.set(String(row.product_id), row)
        continue
      }
      // TEXTILE: the batch's lines and designs, both 1:n.
      const [garments, designs] = await Promise.all([
        supabase.from('textile_garments').select('*').in('product_id', ids).order('sort_order'),
        supabase.from('textile_designs').select('*').in('product_id', ids).order('created_at'),
      ])
      if (garments.error) throw garments.error
      if (designs.error) throw designs.error
      for (const row of garments.data ?? []) {
        const list = garmentsById.get(row.product_id) ?? []
        list.push(row)
        garmentsById.set(row.product_id, list)
      }
      for (const row of designs.data ?? []) {
        const list = designsById.get(row.product_id) ?? []
        list.push(row)
        designsById.set(row.product_id, list)
      }
    }

    return parents.map(parent =>
      parent.type === TEXTILE_PRODUCT_TYPE
        ? { ...parent, garments: garmentsById.get(parent.id) ?? [], designs: designsById.get(parent.id) ?? [] }
        : { ...parent, child: childById.get(parent.id) ?? {} },
    ) as LoadedProduct[]
  }

  /** Insert parent then children (TS two-step). Returns the new product id. */
  async createProduct(input: ProductWriteInput): Promise<string> {
    const { data: parent, error } = await supabase
      .from('products')
      // Cast: `product_number` is NOT NULL with no default, so the generated
      // Insert type demands it — but trg_product_number assigns it and the
      // client must never set it.
      .insert({
        order_id: input.order_id,
        department: input.department as Department,
        type: input.type,
        quantity: input.quantity,
        notes: input.notes,
        sort_order: input.sort_order,
      } as TablesInsert<'products'>)
      .select('id')
      .single()
    if (error) throw error
    const id = parent.id
    try {
      await this.writeChildren(id, input)
    } catch (childError) {
      await supabase.from('products').delete().eq('id', id)
      throw childError
    }
    return id
  }

  /** Update parent + children. If `type` changed, the child moves to a new table. */
  async updateProduct(id: string, input: ProductWriteInput): Promise<void> {
    const { data: old, error: readError } = await supabase
      .from('products')
      .select('type')
      .eq('id', id)
      .single()
    if (readError) throw readError

    const { error: parentError } = await supabase
      .from('products')
      .update({
        type: input.type,
        quantity: input.quantity,
        notes: input.notes,
        sort_order: input.sort_order,
      })
      .eq('id', id)
    if (parentError) throw parentError

    if (old.type !== input.type) {
      // The old child no longer belongs to this type: drop it, then write the new one.
      if (isSingleChildProductType(old.type)) {
        await deleteChild(childTableForType(old.type), id)
      } else {
        await writeTextileChildren(id, [], [])
      }
      await this.writeChildren(id, input)
      return
    }
    await this.writeChildren(id, input, { replaceExisting: true })
  }

  /** Dispatch a write to the 1:1 child table or to textile's 1:n children. */
  private async writeChildren(
    id: string,
    input: ProductWriteInput,
    opts: { replaceExisting?: boolean } = {},
  ): Promise<void> {
    if ('child' in input) {
      const table = childTableForType(input.type)
      if (opts.replaceExisting) {
        await updateChild(table, id, input.child as Record<string, unknown>)
      } else {
        await insertChild(table, { ...input.child, product_id: id })
      }
      return
    }
    // Textile lines and designs are always written wholesale — the grid edits
    // them as one set, so reconciling row by row would buy nothing.
    await writeTextileChildren(id, input.garments, input.designs)
  }

  /** Delete the product; its children and file links cascade. */
  async deleteProduct(id: string): Promise<void> {
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) throw error
  }

  // --- file assignments (product_files) -------------------------------------

  async getFilesByProductIds(ids: string[]): Promise<ProductFileAssignment[]> {
    if (ids.length === 0) return []
    const { data, error } = await supabase
      .from('product_files')
      .select('id, product_id, file_id')
      .in('product_id', ids)
    if (error) throw error
    return (data ?? []) as ProductFileAssignment[]
  }

  async assignFileToProduct(productId: string, fileId: string): Promise<void> {
    const { error } = await supabase.from('product_files').insert({ product_id: productId, file_id: fileId })
    if (error) throw error
  }

  async removeFileFromProduct(id: string): Promise<void> {
    const { error } = await supabase.from('product_files').delete().eq('id', id)
    if (error) throw error
  }

  // --- stamp demand (reorder list) ------------------------------------------

  /**
   * Stamp-model usage across all open STAMP products: one entry per product
   * that references a `stamp_models` row (Trodat Printy / Wooden Stamp via
   * `model_id`, Trodat Pad via `pad_variant_id`), with the product quantity.
   * Feeds the reorder list's open-demand figure.
   *
   * The status filter now rides on the product itself, so this is one round
   * trip where the job model needed two (active jobs, then their products).
   */
  async getStampModelDemand(): Promise<StampModelUsage[]> {
    // One query per referencing table. The table names and select strings must
    // stay literal — that is what lets supabase-js infer the row types.
    const [printyRows, woodenRows, padRows] = await Promise.all([
      supabase
        .from('trodat_printy_products')
        .select('model_id, products!inner(quantity, department, status, is_cancelled)')
        .not('model_id', 'is', null)
        .eq('products.department', 'STAMP')
        .eq('products.is_cancelled', false)
        .neq('products.status', 'DONE'),
      supabase
        .from('wooden_stamp_products')
        .select('model_id, products!inner(quantity, department, status, is_cancelled)')
        .not('model_id', 'is', null)
        .eq('products.department', 'STAMP')
        .eq('products.is_cancelled', false)
        .neq('products.status', 'DONE'),
      supabase
        .from('trodat_pad_products')
        .select('pad_variant_id, products!inner(quantity, department, status, is_cancelled)')
        .not('pad_variant_id', 'is', null)
        .eq('products.department', 'STAMP')
        .eq('products.is_cancelled', false)
        .neq('products.status', 'DONE'),
    ])
    if (printyRows.error) throw printyRows.error
    if (woodenRows.error) throw woodenRows.error
    if (padRows.error) throw padRows.error

    return [
      ...(printyRows.data ?? []).flatMap(row => toStampModelUsage(row.model_id, row.products.quantity)),
      ...(woodenRows.data ?? []).flatMap(row => toStampModelUsage(row.model_id, row.products.quantity)),
      ...(padRows.data ?? []).flatMap(row => toStampModelUsage(row.pad_variant_id, row.products.quantity)),
    ]
  }

  // --- realtime -------------------------------------------------------------

  /**
   * Realtime subscription: fires `onChanged` on any INSERT/UPDATE/DELETE of
   * `products` or `orders` (the order carries the inherited deadline, priority,
   * delivery and the archive flag), so the production feed can refetch.
   *
   * Self-healing: a channel that errors, times out or closes without being
   * asked to (dropped network, laptop sleep, a hot reload in development) is
   * replaced after a short pause, and `onChanged` fires once the replacement
   * is subscribed so changes missed in the gap are picked up.
   * Returns an unsubscribe function.
   */
  subscribeToProductChanges(onChanged: () => void): () => void {
    let channel: RealtimeChannel | null = null
    let stopped = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let reconnecting = false

    const open = () => {
      // A unique topic per channel: supabase.channel() hands back an existing
      // channel of the same name, so a remount (StrictMode, page switch) would
      // reuse the one still being removed and die with it.
      const current: RealtimeChannel = supabase
        .channel(`production-feed-refresh:${crypto.randomUUID()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => onChanged())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => onChanged())
        .subscribe(status => {
          // Ignore channels already replaced or unsubscribed on purpose.
          if (stopped || current !== channel) return
          if (status === 'SUBSCRIBED') {
            if (reconnecting) onChanged()
            reconnecting = false
            return
          }
          // CHANNEL_ERROR, TIMED_OUT, or CLOSED that we did not ask for.
          channel = null
          reconnecting = true
          void supabase.removeChannel(current)
          retryTimer = setTimeout(open, RESUBSCRIBE_DELAY_MS)
        })
      channel = current
    }

    open()
    return () => {
      stopped = true
      clearTimeout(retryTimer)
      if (channel) void supabase.removeChannel(channel)
    }
  }
}

export const productService = new ProductService()
