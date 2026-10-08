import { useCallback, useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { productService, type ProductFileAssignment } from '../services/productService'
import { historyService, type HistoryEvent } from '../services/historyService'
import { productionReleaseService } from '../services/productionReleaseService'
import { resolveEffectiveProduct } from '../lib/productShared'
import { deriveAutomaticOrderStatus } from '../lib/status/automaticStatus'
import type { LoadedProduct, ProductWriteInput } from '../types/product'
import type { OrderDetailRow, ProductRow, ProductStatus, ProductUpdate } from '../types/database'
import { orderKeys, useOrderById, useSetOrderStatus } from './orderQueries'
import { historyKeys } from './historyQueries'
import { stockAvailabilityKeys } from './stockQueries'

/**
 * The product query layer. A product is the unit of work, so this module owns
 * what the job model split between two: the workflow (status, assignee,
 * approval, release, cancellation) and the spec (the typed child row and its
 * file links). Both halves live on one row, so they share one cache — the
 * order's `LoadedProduct[]`, keyed by {@link productKeys.byOrderId}.
 */

type HistoryParams = { event_type: HistoryEvent; reason?: string; meta?: Record<string, unknown> }

export const productKeys = {
  all: ['products'] as const,
  /** Prefix of every per-order list — matches them all, and nothing else. */
  byOrderIdRoot: ['products', 'by-order-id'] as const,
  byOrderId: (orderId: string) => ['products', 'by-order-id', orderId] as const,
  filesByOrderId: (orderId: string) => ['products', 'files', 'by-order-id', orderId] as const,
  /** The Production page's cross-order feed (pre-press + production). */
  production: ['products', 'production'] as const,
}

/** Parent + typed children for every product of an order, in display order. */
export function useProductsByOrderId(orderId: string | null) {
  return useQuery({
    queryKey: orderId ? productKeys.byOrderId(orderId) : productKeys.byOrderId('__none__'),
    queryFn: () => productService.getLoadedByOrderId(orderId as string),
    enabled: !!orderId,
  })
}

/**
 * The production feed. Refetched whenever a product changes — the viewer's own
 * (see {@link invalidateOrderLists}) and anyone else's, through a realtime
 * subscription on `products` and `orders` held while the feed is mounted.
 */
export function useProductionProducts() {
  const queryClient = useQueryClient()

  useEffect(() => {
    return productService.subscribeToProductChanges(() => {
      void queryClient.invalidateQueries({ queryKey: productKeys.production })
    })
  }, [queryClient])

  return useQuery({
    queryKey: productKeys.production,
    queryFn: () => productService.listProductionProducts(),
  })
}

/** Imperative on-demand fetch through the cache (e.g. opening the duplicate dialog). */
export function fetchProductsByOrderId(queryClient: QueryClient, orderId: string) {
  return queryClient.fetchQuery({
    queryKey: productKeys.byOrderId(orderId),
    queryFn: () => productService.getLoadedByOrderId(orderId),
  })
}

/** File assignments for every product of an order; the save/delete mutations keep it authoritative. */
export function useProductFilesByOrderId(orderId: string | null) {
  const productsQuery = useProductsByOrderId(orderId)
  const productIds = (productsQuery.data ?? []).map(product => product.id)

  const filesQuery = useQuery({
    queryKey: orderId ? productKeys.filesByOrderId(orderId) : productKeys.filesByOrderId('__none__'),
    queryFn: () => productService.getFilesByProductIds(productIds),
    enabled: !!orderId && productsQuery.isSuccess,
  })

  return {
    ...filesQuery,
    isError: filesQuery.isError || productsQuery.isError,
  }
}

/**
 * Refresh the order lists after a product change. Order status is an
 * independent lifecycle (the one product-driven step, the automatic finish, is
 * a separate write — see {@link useFinishOrderWhenAllProductsDone}), but the
 * sidebar still shows product-derived data (e.g. the in-production-missing-info
 * warning), so the lists are invalidated whenever a product changes. The
 * production feed lists products across orders and follows the same events.
 */
function invalidateOrderLists(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: orderKeys.lists })
  void queryClient.invalidateQueries({ queryKey: productKeys.production })
}

/**
 * Merge a freshly written parent row into its cached product, keeping the
 * children the write did not touch. The cast is unavoidable: `type` is the
 * discriminator of the `LoadedProduct` union and comes back as plain `string`,
 * so TypeScript cannot correlate the parent row with the child it belongs to.
 */
function mergeParent(loaded: LoadedProduct, row: Partial<ProductRow>): LoadedProduct {
  return { ...loaded, ...row, type: loaded.type } as LoadedProduct
}

function patchProductInCache(queryClient: QueryClient, orderId: string, row: ProductRow): void {
  queryClient.setQueryData<LoadedProduct[]>(
    productKeys.byOrderId(orderId),
    old => old?.map(product => (product.id === row.id ? mergeParent(product, row) : product)) ?? old,
  )
}

/**
 * The automatic order finish: once every non-cancelled product of an invoice
 * order is DONE, the order moves to FINISHED on its own (ORDER_FINISHED with
 * `meta.automatic`). The returned function is called right after a mutation
 * that can complete the order's work (mark done, cancel product, delete
 * product) — their `onSuccess` has patched the product cache by then, so the
 * cached rows are current. It reads the order and products from the cache
 * only; when either is missing it does nothing, which leaves the manual "Mark
 * finished" as the fallback. The rule itself is `deriveAutomaticOrderStatus`.
 */
export function useFinishOrderWhenAllProductsDone(): (orderId: string) => Promise<void> {
  const queryClient = useQueryClient()
  const { mutateAsync: setOrderStatus } = useSetOrderStatus()
  return useCallback(
    async (orderId: string) => {
      const order = queryClient.getQueryData<OrderDetailRow | null>(orderKeys.byId(orderId))
      const products = queryClient.getQueryData<LoadedProduct[]>(productKeys.byOrderId(orderId))
      if (!order || !products) return
      if (deriveAutomaticOrderStatus(order, products) !== 'FINISHED') return
      await setOrderStatus({
        id: orderId,
        status: 'FINISHED',
        history: { event_type: 'ORDER_FINISHED', meta: { automatic: true } },
      })
    },
    [queryClient, setOrderStatus],
  )
}

/**
 * The raw product, selected from the cached {@link useProductsByOrderId} list
 * by id. Returns `null` until the list has loaded or if no match. This is the
 * *raw* row (inherited common fields still null) — use it when you need the
 * override/inherit state (e.g. the settings tab's inheritance toggles). For the
 * resolved fields use {@link useEffectiveProduct}.
 */
export function useProductById(orderId: string | null, productId: string | null): LoadedProduct | null {
  const { data: products } = useProductsByOrderId(orderId)
  return products?.find(product => product.id === productId) ?? null
}

/**
 * The product with its inherited common fields resolved against the order (see
 * {@link resolveEffectiveProduct}). Composes {@link useProductById} +
 * `useOrderById` from the cache; returns `null` until both have loaded. Use
 * this wherever completeness/validation needs the *effective* fields rather
 * than the raw (inheriting) columns.
 */
export function useEffectiveProduct(
  orderId: string | null,
  productId: string | null,
): LoadedProduct | null {
  const product = useProductById(orderId, productId)
  const { data: order } = useOrderById(orderId)
  // Memoize so the resolved row keeps a stable reference between renders (it only
  // changes when the product or order data changes) — important for consumers that
  // use it as an effect dependency (the status manager).
  return useMemo(
    () => (product && order ? resolveEffectiveProduct(product, order) : null),
    [product, order],
  )
}

/**
 * Create-or-update a product and reconcile its file links in one unit, then
 * reload the authoritative product + file lists and patch both caches.
 *
 * The file reconcile is an add/remove diff (not the legacy remove-all-then-
 * re-add). `createProduct` only returns the new id, so we can't reconstruct the
 * row from the mutation return — hence the reload before the cache patch. A
 * textile batch's garment lines and designs are part of the product write
 * itself; the service replaces them wholesale.
 */
export function useSaveProduct() {
  const queryClient = useQueryClient()
  return useMutation<
    { productId: string; products: LoadedProduct[]; files: ProductFileAssignment[] },
    Error,
    { input: ProductWriteInput; fileIds: string[]; orderId: string }
  >({
    mutationFn: async ({ input, fileIds, orderId }) => {
      // 1. Product write (create or update).
      const productId = input.id ?? (await productService.createProduct(input))
      if (input.id) await productService.updateProduct(input.id, input)

      // 2. File-link diff against the product's current assignments.
      const existing = input.id ? await productService.getFilesByProductIds([input.id]) : []
      for (const assignment of existing) {
        if (!fileIds.includes(assignment.file_id)) {
          await productService.removeFileFromProduct(assignment.id)
        }
      }
      for (const fileId of fileIds) {
        if (!existing.some(assignment => assignment.file_id === fileId)) {
          await productService.assignFileToProduct(productId, fileId)
        }
      }

      // 3. Reload authoritative state for the cache patch.
      const products = await productService.getLoadedByOrderId(orderId)
      const files = await productService.getFilesByProductIds(products.map(product => product.id))
      return { productId, products, files }
    },
    onSuccess: ({ productId, products, files }, { input, orderId }) => {
      // A released product's spec is locked by the database (MKS-88), so an
      // edit that reaches here was on an open product — nothing to bounce.
      queryClient.setQueryData(productKeys.byOrderId(orderId), products)
      queryClient.setQueryData(productKeys.filesByOrderId(orderId), files)
      invalidateOrderLists(queryClient)
      void queryClient.invalidateQueries({ queryKey: stockAvailabilityKeys.byProductId(productId) })

      const saved = products.find(product => product.id === productId)
      void historyService.tryWriteHistory({
        order_id: orderId,
        product_id: productId,
        event_type: input.id ? 'PRODUCT_UPDATED' : 'PRODUCT_CREATED',
        meta: {
          product_number: saved?.product_number ?? null,
          department: input.department,
          type: input.type,
          quantity: input.quantity,
        },
      })
    },
  })
}

/**
 * Persist a product's own settings fields (deadline / delivery / priority
 * overrides, notes). Optimistic: `onMutate` patches the cached row in place for
 * an instant UI and the snapshot is restored on error. It persists the given
 * fields only — the automatic status is the status manager's business.
 */
export function useUpdateProduct() {
  const queryClient = useQueryClient()
  return useMutation<
    ProductRow,
    Error,
    { id: string; orderId: string; patch: ProductUpdate; history?: HistoryParams },
    { previous?: LoadedProduct[] }
  >({
    mutationFn: async ({ id, orderId, patch, history }) => {
      const row = await productService.update(id, patch)
      if (history) await historyService.tryWriteHistory({ order_id: orderId, product_id: id, ...history })
      return row
    },
    onMutate: async ({ id, orderId, patch }) => {
      await queryClient.cancelQueries({ queryKey: productKeys.byOrderId(orderId) })
      const previous = queryClient.getQueryData<LoadedProduct[]>(productKeys.byOrderId(orderId))
      queryClient.setQueryData<LoadedProduct[]>(
        productKeys.byOrderId(orderId),
        old => old?.map(product => (product.id === id ? mergeParent(product, patch) : product)) ?? old,
      )
      return { previous }
    },
    onError: (_err, { orderId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(productKeys.byOrderId(orderId), context.previous)
      }
    },
    onSuccess: (row, { orderId }) => {
      patchProductInCache(queryClient, orderId, row)
    },
    onSettled: (_data, _err, { orderId }) => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.byId(orderId) })
      void queryClient.invalidateQueries({ queryKey: orderKeys.lists })
    },
  })
}

/** Manual status transition (prepress / production / done). Optionally writes a history entry. */
export function useSetProductStatus() {
  const queryClient = useQueryClient()
  return useMutation<
    ProductRow,
    Error,
    { id: string; orderId: string; status: ProductStatus; history?: HistoryParams }
  >({
    mutationFn: async ({ id, orderId, status, history }) => {
      const row = await productService.setStatus(id, status)
      if (history) await historyService.tryWriteHistory({ order_id: orderId, product_id: id, ...history })
      return row
    },
    onSuccess: (row, { orderId }) => {
      patchProductInCache(queryClient, orderId, row)
      invalidateOrderLists(queryClient)
      // A stage default may have reassigned the product and logged it (DB trigger).
      void queryClient.invalidateQueries({ queryKey: historyKeys.byOrderId(orderId) })
    },
  })
}

/**
 * Release to production: book stock deductions (stamp/textile), set
 * IN_PRODUCTION, write the PRODUCTION_READY_SET history entry. The stock
 * deduction runs before the status write and is all-or-nothing: on insufficient
 * stock it throws InsufficientStockError and the product stays in pre-press.
 */
export function useReleaseToProduction() {
  const queryClient = useQueryClient()
  return useMutation<
    ProductRow,
    Error,
    { product: LoadedProduct; orderId: string; orderNumber: string | null }
  >({
    mutationFn: async ({ product, orderId, orderNumber }) => {
      await productionReleaseService.deductProductionStock(product, orderNumber)
      const row = await productService.setStatus(product.id, 'IN_PRODUCTION')
      await historyService.tryWriteHistory({
        order_id: orderId,
        product_id: product.id,
        event_type: 'PRODUCTION_READY_SET',
      })
      return row
    },
    onSuccess: (row, { orderId }) => {
      patchProductInCache(queryClient, orderId, row)
      invalidateOrderLists(queryClient)
      // Stock changed — other pre-press products' availability may have too.
      void queryClient.invalidateQueries({ queryKey: stockAvailabilityKeys.root })
      // A stage default may have reassigned the product and logged it (DB trigger).
      void queryClient.invalidateQueries({ queryKey: historyKeys.byOrderId(orderId) })
    },
  })
}

/**
 * Emergency force release: bypass the completeness/prepress gate and put the
 * product straight into IN_PRODUCTION. Books the same stock deductions as the
 * regular release and writes an EMERGENCY_TRIGGERED history entry with the
 * reason — history is the sole record of the override. IN_PRODUCTION is outside
 * the automatic status band, so the status manager leaves the product alone.
 * The stock gate is bypassed too: available stock is deducted (floored at 0)
 * and the movements record what was actually taken.
 */
export function useForceReleaseToProduction() {
  const queryClient = useQueryClient()
  return useMutation<
    ProductRow,
    Error,
    { product: LoadedProduct; orderId: string; orderNumber: string | null; reason: string }
  >({
    mutationFn: async ({ product, orderId, orderNumber, reason }) => {
      await productionReleaseService.deductProductionStock(product, orderNumber, { allowShortage: true })
      const row = await productService.setStatus(product.id, 'IN_PRODUCTION')
      await historyService.tryWriteHistory({
        order_id: orderId,
        product_id: product.id,
        event_type: 'EMERGENCY_TRIGGERED',
        reason,
      })
      return row
    },
    onSuccess: (row, { orderId }) => {
      patchProductInCache(queryClient, orderId, row)
      invalidateOrderLists(queryClient)
      // Stock changed — other pre-press products' availability may have too.
      void queryClient.invalidateQueries({ queryKey: stockAvailabilityKeys.root })
      // A stage default may have reassigned the product and logged it (DB trigger).
      void queryClient.invalidateQueries({ queryKey: historyKeys.byOrderId(orderId) })
    },
  })
}

/**
 * Assign / unassign a product's responsible user — any role may do this. Always
 * writes an ASSIGNEE_CHANGED history entry; names are snapshotted into meta so
 * the entry stays readable if a user is later deleted.
 */
export function useSetProductAssignee() {
  const queryClient = useQueryClient()
  return useMutation<
    ProductRow,
    Error,
    {
      id: string
      orderId: string
      assignee: { id: string; name: string } | null
      previousAssignee: { id: string; name: string } | null
    }
  >({
    mutationFn: async ({ id, orderId, assignee, previousAssignee }) => {
      const row = await productService.update(id, { assignee_id: assignee?.id ?? null })
      await historyService.tryWriteHistory({
        order_id: orderId,
        product_id: id,
        event_type: 'ASSIGNEE_CHANGED',
        meta: {
          previous_assignee_id: previousAssignee?.id ?? null,
          previous_assignee_name: previousAssignee?.name ?? null,
          new_assignee_id: assignee?.id ?? null,
          new_assignee_name: assignee?.name ?? null,
        },
      })
      return row
    },
    onSuccess: (row, { orderId }) => {
      patchProductInCache(queryClient, orderId, row)
      void queryClient.invalidateQueries({ queryKey: historyKeys.byOrderId(orderId) })
      void queryClient.invalidateQueries({ queryKey: productKeys.production })
    },
  })
}

/** Customer-approval requirement / grant. Does not change status. */
export function useSetCustomerApproval() {
  const queryClient = useQueryClient()
  return useMutation<
    ProductRow,
    Error,
    {
      id: string
      orderId: string
      patch: Pick<
        ProductUpdate,
        'customer_approval_required' | 'customer_approval_granted' | 'customer_approval_file_id'
      >
      history?: HistoryParams
    }
  >({
    mutationFn: async ({ id, orderId, patch, history }) => {
      const row = await productService.setCustomerApproval(id, patch)
      if (history) await historyService.tryWriteHistory({ order_id: orderId, product_id: id, ...history })
      return row
    },
    onSuccess: (row, { orderId }) => {
      patchProductInCache(queryClient, orderId, row)
    },
  })
}

/** Cancel a product (hidden from the workspace; keeps its data). */
export function useCancelProduct() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, { id: string; orderId: string }>({
    mutationFn: async ({ id, orderId }) => {
      await productService.cancel(id)
      await historyService.tryWriteHistory({
        order_id: orderId,
        product_id: id,
        event_type: 'PRODUCT_CANCELLED',
      })
    },
    onSuccess: (_void, { id, orderId }) => {
      queryClient.setQueryData<LoadedProduct[]>(
        productKeys.byOrderId(orderId),
        old =>
          old?.map(product => (product.id === id ? mergeParent(product, { is_cancelled: true }) : product)) ??
          old,
      )
      invalidateOrderLists(queryClient)
    },
  })
}

/** Permanently delete a product (only while IN_SETUP). */
export function useDeleteProduct() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, { id: string; orderId: string }>({
    mutationFn: async ({ id, orderId }) => {
      // Snapshot before the delete: the history entry can't reference the dead
      // row (product_id stays null), so the product is identified via meta.
      const product = queryClient
        .getQueryData<LoadedProduct[]>(productKeys.byOrderId(orderId))
        ?.find(row => row.id === id)
      await productService.deleteProduct(id)
      await historyService.tryWriteHistory({
        order_id: orderId,
        event_type: 'PRODUCT_DELETED',
        meta: {
          product_number: product?.product_number ?? null,
          department: product?.department ?? null,
          type: product?.type ?? null,
        },
      })
    },
    onSuccess: (_void, { id, orderId }) => {
      queryClient.setQueryData<LoadedProduct[]>(
        productKeys.byOrderId(orderId),
        old => old?.filter(product => product.id !== id) ?? old,
      )
      queryClient.setQueryData<ProductFileAssignment[]>(
        productKeys.filesByOrderId(orderId),
        old => old?.filter(assignment => assignment.product_id !== id) ?? old,
      )
      invalidateOrderLists(queryClient)
      void queryClient.invalidateQueries({ queryKey: stockAvailabilityKeys.byProductId(id) })
    },
  })
}
