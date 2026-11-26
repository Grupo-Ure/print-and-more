import { CheckCircle2, Hourglass, Lock, MessageSquareWarning, TriangleAlert, UserX } from 'lucide-react'
import { prepressHold } from '../lib/productShared'
import { useNewestApprovalRequest } from '../queries/approvalQueries'
import { useSetProductStatus } from '../queries/productQueries'
import { useOrderById } from '../queries/orderQueries'
import { useStockAvailability } from '../queries/stockQueries'
import type { LoadedProduct } from '../types/product'
import { useToast } from './Toast'
import { Button } from './ui/button'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.orders.productDetail.banner

type Props = {
  product: LoadedProduct
}

/**
 * Why the product cannot move on, phrased for the user: done, waiting for the
 * customer, its newest approval round closed without an approval, short of
 * stock, held in setup, or locked in production.
 *
 * Held in setup names what the database is waiting for before it moves the
 * product into pre-press on its own (`prepressHold`, the client's mirror of
 * `fn_product_ready_for_prepress`): the customer's contact data. A *past*
 * deadline does not hold it; the row shows the deadline-missed flag for that
 * instead.
 */
export function ProductProductionBanner({ product }: Props) {
  const setProductStatus = useSetProductStatus()
  const { showError } = useToast()
  // Only fetches for STAMP/TEXTILE products in pre-press; empty otherwise.
  const { data: shortages = [] } = useStockAvailability(product)
  // Already cached by the detail view; needed to explain a blocked release.
  const { data: order } = useOrderById(product.order_id)
  // Already loaded by the release button; the newest round gates the release.
  const newestRequest = useNewestApprovalRequest(product.id)

  // Done is terminal: a green, button-less banner — no going back once done.
  if (product.status === 'DONE') {
    return (
      <div
        data-testid={IDS.root}
        data-kind="done"
        className="flex items-center justify-center gap-4 border-t-6 border-green-500 px-4 py-2 text-green-500"
      >
        <CheckCircle2 />
        <p className="text-sm font-medium">
          This product is done and can no longer be modified.
        </p>
      </div>
    )
  }

  // Waiting for the customer: the product is locked until the request closes,
  // and nothing — not even a force release — moves it on. Withdrawing the
  // request on the Files tab is the shop's way out.
  if (product.status === 'AWAITING_APPROVAL') {
    return (
      <div
        data-testid={IDS.root}
        data-kind="awaiting-approval"
        className="flex items-center justify-center gap-4 border-t-6 border-teal-500 px-4 py-2 text-teal-600"
      >
        <Hourglass />
        <p className="text-sm font-medium">
          Waiting for the customer's approval — the product is locked until they answer. Withdraw the request on
          the Files tab to change it.
        </p>
      </div>
    )
  }

  // Pre-press whose newest round came back without an approval: the release
  // to production is blocked until a new round is approved, or an admin
  // forces it. An older approval does not count for a reworked proof.
  if (product.status === 'PREPRESS' && newestRequest != null && newestRequest.status !== 'APPROVED') {
    return (
      <div
        data-testid={IDS.root}
        data-kind="approval-blocked"
        data-approval-status={newestRequest.status}
        className="flex items-center justify-center gap-4 border-t-6 border-amber-500 px-4 py-2 text-amber-600"
      >
        <MessageSquareWarning className="shrink-0" />
        <div className="text-sm font-medium">
          <p>
            {newestRequest.status === 'CHANGES_REQUESTED' && `Round ${newestRequest.round}: the customer asked for changes.`}
            {newestRequest.status === 'EXPIRED' && `Round ${newestRequest.round}: the customer did not answer before the link expired.`}
            {newestRequest.status === 'WITHDRAWN' && `Round ${newestRequest.round} was withdrawn.`}
            {' '}Send a new round from the Files tab, or an admin forces the release.
          </p>
          {newestRequest.note && (
            <p data-testid={IDS.approvalNote} className="font-normal whitespace-pre-line">
              “{newestRequest.note}”
            </p>
          )}
        </div>
      </div>
    )
  }

  // Pre-press with insufficient stock: red banner — the release button stays
  // disabled until the shortage is resolved (admins can still force-release).
  if (product.status === 'PREPRESS' && shortages.length > 0) {
    const labels = [...new Set(shortages.map(shortage => shortage.targetLabel))]
    return (
      <div
        data-testid={IDS.root}
        data-kind="shortage"
        className="flex items-center justify-center gap-4 border-t-6 border-red-500 px-4 py-2 text-red-500"
      >
        <TriangleAlert />
        <p className="text-sm font-medium">
          This product cannot be released to production — not enough stock for: {labels.join(', ')}.
        </p>
      </div>
    )
  }

  // Held in setup: red banner naming what pre-press waits for — the product
  // moves on its own once it is there. Mirrors the stock shortage one step
  // later in the workflow; admins can still force-release. Nothing is
  // required while the order is a quote.
  const hold =
    product.status === 'IN_SETUP' && !product.is_cancelled && order != null
      ? prepressHold(order, order.customers)
      : null

  if (hold === 'CUSTOMER_CONTACT') {
    return (
      <div
        data-testid={IDS.root}
        data-kind="blocked"
        data-hold={hold}
        className="flex items-center justify-center gap-4 border-t-6 border-red-500 px-4 py-2 text-red-500"
      >
        <UserX />
        <p className="text-sm font-medium">
          Held in setup: the customer needs a name and an email or phone. The product moves to pre-press once they have
          them.
        </p>
      </div>
    )
  }

  if (product.status !== 'IN_PRODUCTION') return null

  // The database records the return (RETURNED_TO_PREPRESS). The product stays
  // in pre-press whatever it lacks: nothing sends a product back to setup.
  const handleGoBackToPrePress = async () => {
    try {
      await setProductStatus.mutateAsync({ id: product.id, orderId: product.order_id, status: 'PREPRESS' })
    } catch {
      showError('Status could not be updated')
    }
  }

  return (
    <div
      data-testid={IDS.root}
      data-kind="production"
      className="flex items-center justify-center gap-4 border-t-6 border-blue-500 px-4 py-2 text-blue-500"
    >
      <Lock/>
      <p className="text-sm font-medium">
        This product is in production and cannot be modified.
      </p>
      <Button
        type="button"
        variant="default"
        data-testid={IDS.backToPrepress}
        className="shrink-0 rounded-full bg-pink-500 hover:bg-pink-600"
        disabled={setProductStatus.isPending}
        onClick={() => void handleGoBackToPrePress()}
      >
        {setProductStatus.isPending ? '…' : 'Go back to Pre-Press'}
      </Button>
    </div>
  )
}
