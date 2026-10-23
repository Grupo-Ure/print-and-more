import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import {
  approvalRequestService,
  type ApprovalDecision,
  type ApprovalRequest,
  type CreateApprovalRequestInput,
} from '../services/approvalRequestService'
import { emailKeys } from './emailQueries'
import { historyKeys } from './historyQueries'
import { orderKeys } from './orderQueries'
import { productKeys } from './productQueries'
import { stockAvailabilityKeys } from './stockQueries'

export const approvalKeys = {
  all: ['approval-requests'] as const,
  byProductId: (productId: string) => ['approval-requests', 'by-product-id', productId] as const,
}

/** Every round of the product, newest first. */
export function useApprovalRequests(productId: string | null) {
  return useQuery({
    queryKey: productId ? approvalKeys.byProductId(productId) : approvalKeys.byProductId('__none__'),
    queryFn: () => approvalRequestService.listByProduct(productId as string),
    enabled: !!productId,
  })
}

/** The product's newest round — the one the release gate and the next round's preselection look at; null before the first. */
export function useNewestApprovalRequest(productId: string | null): ApprovalRequest | null {
  const { data } = useApprovalRequests(productId)
  return data?.[0] ?? null
}

/**
 * Every write here moves the product in the database (into awaiting approval,
 * out of it into production or back to pre-press) and writes its history and
 * mails there, so the product's rounds, the order's products, its history and
 * mails, the order lists and the production feed are all read again. An
 * approval books stock, so the availability is too.
 */
function invalidateAfterRequestChange(queryClient: QueryClient, orderId: string, productId: string): void {
  void queryClient.invalidateQueries({ queryKey: approvalKeys.byProductId(productId) })
  void queryClient.invalidateQueries({ queryKey: productKeys.byOrderId(orderId) })
  void queryClient.invalidateQueries({ queryKey: productKeys.production })
  void queryClient.invalidateQueries({ queryKey: orderKeys.lists })
  void queryClient.invalidateQueries({ queryKey: historyKeys.byOrderId(orderId) })
  void queryClient.invalidateQueries({ queryKey: emailKeys.queuedByOrderId(orderId) })
  void queryClient.invalidateQueries({ queryKey: stockAvailabilityKeys.root })
}

/** Sends a round: the proofs' copies, the request, the product to awaiting approval, the mail. */
export function useCreateApprovalRequest() {
  const queryClient = useQueryClient()
  return useMutation<string, Error, CreateApprovalRequestInput>({
    mutationFn: input => approvalRequestService.create(input),
    onSuccess: (_requestId, { orderId, productId }) => {
      invalidateAfterRequestChange(queryClient, orderId, productId)
    },
  })
}

/** Records the customer's answer by hand. */
export function useSettleApprovalRequest() {
  const queryClient = useQueryClient()
  return useMutation<
    void,
    Error,
    { requestId: string; orderId: string; productId: string; decision: ApprovalDecision; note: string | null }
  >({
    mutationFn: ({ requestId, decision, note }) => approvalRequestService.settle(requestId, decision, note),
    onSuccess: (_void, { orderId, productId }) => {
      invalidateAfterRequestChange(queryClient, orderId, productId)
    },
  })
}

/** Takes an open round back. */
export function useWithdrawApprovalRequest() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, { requestId: string; orderId: string; productId: string }>({
    mutationFn: ({ requestId }) => approvalRequestService.withdraw(requestId),
    onSuccess: (_void, { orderId, productId }) => {
      invalidateAfterRequestChange(queryClient, orderId, productId)
    },
  })
}
