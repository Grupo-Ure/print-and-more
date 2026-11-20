import { supabase } from '../supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Database, Json, TablesInsert, TablesUpdate } from '../types/supabase'
import type { ChildTable, LoadedProduct, ProductWriteInput } from '../types/product'
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
  'id, product_number, order_id, department, type, status, quantity, notes, sort_order, deadline, delivery, priority, assignee_id, is_cancelled, approved_request_id, created_at' as const

/** `product_number` is trigger-assigned; the client never sets it. */
export type ProductInsert = Omit<TablesInsert<'products'>, 'product_number'>
type ProductPatch = TablesUpdate<'products'>

/** Pause before replacing a realtime channel that was lost. */
const RESUBSCRIBE_DELAY_MS = 2000

/**
 * The statuses the production feed lists: work that waits for, or is with, its
 * assignee — a product waiting for the customer's approval included, since it
 * is the assignee's and comes back to them.
 */
export const PRODUCTION_FEED_STATUSES: readonly ProductStatus[] = ['PREPRESS', 'AWAITING_APPROVAL', 'IN_PRODUCTION']

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
  'id, product_number, order_id, department, type, status, deadline, delivery, priority, assignee_id, is_cancelled, orders!inner(order_number, status, deadline, delivery, priority, is_archived, customers(name))'

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
// runtime union, so the builder is cast. The child tables are only read here:
// they are written by `save_product`, and the database refuses a direct write.
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

  /**
   * Create a product or change its specification through `save_product`: the
   * parent row, its children and the history entry in one transaction. An
   * `id` on the input means a change. The rows are the ones the type's schema
   * mapped from the form; the database replaces the children with them and
   * records the save (PRODUCT_CREATED / PRODUCT_UPDATED). Returns the
   * product's id.
   */
  async saveProduct(input: ProductWriteInput): Promise<string> {
    const product = {
      ...(input.id ? { id: input.id } : {}),
      order_id: input.order_id,
      department: input.department,
      type: input.type,
      quantity: input.quantity,
      notes: input.notes,
      sort_order: input.sort_order,
    }
    // Cast: the rows are typed upstream (ProductChildInsert, the textile
    // inserts); the function takes them as JSON.
    const { data, error } = await supabase.rpc(
      'save_product',
      'child' in input
        ? { p_product: product, p_child: input.child as Json }
        : { p_product: product, p_garments: input.garments as Json, p_designs: input.designs as Json },
    )
    if (error) throw error
    return data
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
