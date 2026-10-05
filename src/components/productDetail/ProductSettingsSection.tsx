import { useState } from 'react'
import { Check } from 'lucide-react'
import { useUpdateProduct, useSetCustomerApproval } from '../../queries/productQueries'
import { validateProductCommonFields } from '../../lib/productShared'
import { toDateOnly, todayDateOnly } from '../../lib/formatDate'
import {
  type DeliveryChoice,
  type OrderDetailRow,
  type Priority,
  type ProductRow,
  type ProductUpdate,
} from '../../types/database'
import type { LoadedProduct } from '../../types/product'
import type { FileRow } from '../../services/fileService'
import { DeadlinePicker } from '../fields/DeadlinePicker'
import { DeliverySelect } from '../fields/DeliverySelect'
import { PrioritySelect } from '../fields/PrioritySelect'
import { Button } from '../ui/button'
import { Switch } from '../ui/switch'
import { useToast } from '../Toast'
import { GrantApprovalDialog } from './GrantApprovalDialog'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.orders.productDetail.settings

/**
 * The "Product Settings" section: the separate-value switches (deadline,
 * delivery, priority — null column = inherit from the order) and the
 * customer-approval toggle. Owns its own mutations; both patch the product
 * cache themselves, so nothing is bubbled to the workspace.
 */
export function ProductSettingsSection({
  order,
  product,
  effectiveProduct,
  orderFiles,
  onOrderFilesChanged,
}: {
  order: OrderDetailRow
  product: LoadedProduct
  effectiveProduct: LoadedProduct
  orderFiles: FileRow[]
  onOrderFilesChanged: () => void | Promise<void>
}) {
  const updateProduct = useUpdateProduct()
  const setCustomerApproval = useSetCustomerApproval()
  const { showError } = useToast()
  const [grantOpen, setGrantOpen] = useState(false)

  const handleGrantApproval = (fileId: string) => {
    setCustomerApproval.mutate(
      {
        id: product.id,
        orderId: product.order_id,
        patch: { customer_approval_granted: true, customer_approval_file_id: fileId },
        history: { event_type: 'CUSTOMER_APPROVAL_GRANTED', meta: { file_id: fileId } },
      },
      {
        onSuccess: () => setGrantOpen(false),
        onError: () => showError('Save failed'),
      },
    )
  }

  // Raw order fields drive the toggle defaults and the equality-collapse compares.
  const orderDeliveryMode = (order.delivery ?? 'PICKUP') as DeliveryChoice
  const orderPriorityMode: Priority = order.priority
  const orderIsQuote = order.status === 'QUOTE'

  // A field is "separate" purely when the product carries its own value (the
  // column is non-null); a null column means the toggle is off and the order's
  // value is inherited. The equality-collapse — a user setting the value equal to the
  // order's clears it back to inherit — lives in each field's onChange, never here, so
  // it can't fire from a toggle or an order change.
  const hasSeparateDelivery = product.delivery != null
  const hasSeparatePriority = product.priority != null
  const hasSeparateDeadline = product.deadline != null

  // Effective (inherited-resolved) values come from useEffectiveProduct.
  const effectiveDelivery = effectiveProduct.delivery as DeliveryChoice
  const effectivePriority = effectiveProduct.priority ?? orderPriorityMode
  const effectiveDeadline = effectiveProduct.deadline
  const deadlineIso = toDateOnly(effectiveDeadline) ?? ''

  const validationErrors = validateProductCommonFields(effectiveProduct, orderIsQuote)
  // In production a subset of fields is locked; once DONE everything is read-only.
  const isDone = product.status === 'DONE'
  const isLocked = product.status === 'IN_PRODUCTION' || isDone

  // Persist a field edit straight to the DB (optimistic via useUpdateProduct —
  // instant UI, rollback on error). No status calculation here: status is driven
  // by the status manager (decoupled — see STATUS_WORKFLOW_SPEC.md).
  const handleUpdateProduct = (patch: ProductUpdate) => {
    // Every patch here is a single override field; null = back to inheriting the order's value.
    const field = Object.keys(patch)[0] as keyof ProductUpdate | undefined
    updateProduct.mutate(
      {
        id: product.id,
        orderId: product.order_id,
        patch,
        history: field
          ? {
              event_type: 'SETTINGS_CHANGED',
              meta: { field, previous: product[field as keyof ProductRow] ?? null, next: patch[field] ?? null },
            }
          : undefined,
      },
      { onError: () => showError('Save failed') },
    )
  }

  return (
    // Three real grid columns — label, switch, field — so every row's switch
    // and field lands on the same tracks; a flex box per row can't guarantee
    // that once labels vary in length. htmlFor/id keeps each label clickable
    // even though it no longer wraps its switch.
    <div data-testid={IDS.root} className="grid w-fit grid-cols-[auto_auto_1fr] items-center gap-x-10 gap-y-3">
      <label htmlFor={IDS.separateDeadline} className="text-sm select-none">
        Separate delivery date
      </label>
      <Switch
        id={IDS.separateDeadline}
        data-testid={IDS.separateDeadline}
        disabled={isLocked}
        checked={hasSeparateDeadline}
        onCheckedChange={checked => {
          if (checked !== true) {
            handleUpdateProduct({ deadline: null })
          } else {
            handleUpdateProduct({ deadline: effectiveDeadline ?? todayDateOnly() })
          }
        }}
      />
      <div className="min-w-0">
        <DeadlinePicker
          testId={IDS.deadline}
          disabled={!hasSeparateDeadline || isLocked}
          value={toDateOnly(product.deadline) ?? deadlineIso}
          onChange={value => {
            if (toDateOnly(value) === toDateOnly(order.deadline)) {
              handleUpdateProduct({ deadline: null })
            } else if ((value ?? '') !== (toDateOnly(product.deadline) ?? '')) {
              handleUpdateProduct({ deadline: value })
            }
          }}
        />
        {/* Shown while inheriting too: an order without a deadline leaves the product without one. */}
        {validationErrors.deadline && <p className="text-destructive text-xs mt-1">{validationErrors.deadline}</p>}
      </div>

      <label htmlFor={IDS.separateDelivery} className="text-sm select-none">
        Separate delivery type
      </label>
      <Switch
        id={IDS.separateDelivery}
        data-testid={IDS.separateDelivery}
        disabled={isDone}
        checked={hasSeparateDelivery}
        onCheckedChange={checked => {
          if (checked !== true) {
            handleUpdateProduct({ delivery: null })
          } else {
            handleUpdateProduct({ delivery: orderDeliveryMode })
          }
        }}
      />
      <div className="min-w-0">
        <DeliverySelect
          testId={IDS.delivery}
          disabled={!hasSeparateDelivery || isDone}
          value={effectiveDelivery}
          onChange={value => {
            if (value === orderDeliveryMode) {
              handleUpdateProduct({ delivery: null })
            } else if (value !== product.delivery) {
              handleUpdateProduct({ delivery: value })
            }
          }}
        />
        {hasSeparateDelivery && validationErrors.delivery && <p className="text-destructive text-xs mt-1">{validationErrors.delivery}</p>}
      </div>

      <label htmlFor={IDS.separatePriority} className="text-sm select-none">
        Separate priority
      </label>
      <Switch
        id={IDS.separatePriority}
        data-testid={IDS.separatePriority}
        disabled={isDone}
        checked={hasSeparatePriority}
        onCheckedChange={checked => {
          if (checked !== true) {
            handleUpdateProduct({ priority: null })
          } else {
            handleUpdateProduct({ priority: orderPriorityMode })
          }
        }}
      />
      <div className="min-w-0">
        <PrioritySelect
          testId={IDS.priority}
          disabled={!hasSeparatePriority || isDone}
          value={effectivePriority}
          onChange={value => {
            if (value === orderPriorityMode) {
              handleUpdateProduct({ priority: null })
            } else if (value !== product.priority) {
              handleUpdateProduct({ priority: value })
            }
          }}
        />
        {hasSeparatePriority && validationErrors.priority && <p className="text-destructive text-xs mt-1">{validationErrors.priority}</p>}
      </div>

      <label htmlFor={IDS.approvalRequired} className="text-sm select-none">
        Customer approval required
      </label>
      <Switch
        id={IDS.approvalRequired}
        data-testid={IDS.approvalRequired}
        disabled={isLocked}
        checked={product.customer_approval_required}
        onCheckedChange={checked => {
          setCustomerApproval.mutate({
            id: product.id,
            orderId: product.order_id,
            patch: checked
              ? { customer_approval_required: true }
              : { customer_approval_required: false, customer_approval_granted: false, customer_approval_file_id: null },
            history: {
              event_type: checked ? 'CUSTOMER_APPROVAL_ACTIVATED' : 'CUSTOMER_APPROVAL_DEACTIVATED',
            },
          })
        }}
      />
      <div className="flex items-center gap-2">
        {product.customer_approval_required && !product.customer_approval_granted && (
          <Button
            type="button"
            variant="outline"
            size="xs"
            data-testid={IDS.grantApproval}
            disabled={isDone}
            onClick={() => setGrantOpen(true)}
          >
            Grant approval…
          </Button>
        )}
        {product.customer_approval_granted && (
          <span data-testid={IDS.approvalGranted} className="flex items-center gap-1 text-xs text-green-600">
            <Check className="size-3.5" aria-hidden />
            Granted
            {(() => {
              const approvedFile = orderFiles.find(file => file.id === product.customer_approval_file_id)
              return approvedFile ? ` — ${approvedFile.display_name}` : ''
            })()}
          </span>
        )}
      </div>

      <GrantApprovalDialog
        orderId={product.order_id}
        files={orderFiles}
        onFilesChanged={onOrderFilesChanged}
        open={grantOpen}
        onOpenChange={setGrantOpen}
        onConfirm={handleGrantApproval}
        pending={setCustomerApproval.isPending}
      />
    </div>
  )
}
