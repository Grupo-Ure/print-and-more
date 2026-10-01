import { useState } from 'react'
import { Ban, Clock, FileDown, Package, Paperclip, SlidersHorizontal, Trash2 } from 'lucide-react'
import {
  useEffectiveProduct,
  useProductById,
  useProductFilesByOrderId,
  useSetProductAssignee,
} from '../queries/productQueries'
import { useProductRemoval } from '../hooks/useProductRemoval'
import { useStockAvailability } from '../queries/stockQueries'
import { useUsers } from '../queries/userQueries'
import { generateAndDownloadProductionSheet } from '../lib/pdf/productionSheet'
import { useOrderById } from '../queries/orderQueries'
import { useOrderSelection } from '../hooks/useOrderSelection'
import { departmentLabel } from '../lib/departmentLabels'
import { customerMeetsPrepressContact } from '../lib/customer'
import { isMissingAssignee } from '../lib/productShared'
import { EmployeeCombobox } from './fields/EmployeeCombobox'
import { ProductSettingsSection } from './productDetail/ProductSettingsSection'
import { ProductTimeLogs, QuickTimeLog } from './ProductTimeLogs'
import { OrderFiles } from './OrderFiles'
import { useToast } from './Toast'
import { ProductBasicInfo } from './products/ProductBasicInfo'
import type { FileRow } from '../services/fileService'
import { StatusBadge } from './StatusBadge'
import { PRODUCT_STATUS_META } from '../lib/statusLabels'
import { ProductReleaseButton } from './ProductReleaseButton'
import { ProductProductionBanner } from './ProductProductionBanner'
import { Button } from './ui/button'
import './WorkArea.css'
import { Separator } from './ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.orders.productDetail

type ProductTab = 'basicInfo' | 'timeLogs' | 'settings' | 'files'

/**
 * The detail view of the selected product — the order's workspace centre and,
 * through the production panel, the production view's too. The header carries
 * the whole workflow (assignee, status, PDF, removal, release); the tabs carry
 * the content: the product's own spec form, its time logs, its setting
 * overrides, and the order's files.
 */
export function ProductDetail({
  orderFiles,
  onOrderFilesChanged,
}: {
  orderFiles: FileRow[]
  onOrderFilesChanged: () => void | Promise<void>
}) {
  const { activeOrderId, activeProductId } = useOrderSelection()
  const { data: order } = useOrderById(activeOrderId)
  const product = useProductById(activeOrderId, activeProductId) // raw row (override/inherit state)
  const effectiveProduct = useEffectiveProduct(activeOrderId, activeProductId) // inherited fields resolved
  const setProductAssignee = useSetProductAssignee()
  const removal = useProductRemoval(product)
  const { data: users = [] } = useUsers()
  const { data: fileAssignments = [] } = useProductFilesByOrderId(activeOrderId)
  // Only fetched for a STAMP/TEXTILE product in pre-press; empty otherwise.
  const { data: shortages = [] } = useStockAvailability(product)
  const { showError } = useToast()
  // Not reset on a product switch: stepping through the products keeps the same
  // tab open (e.g. checking every product's time logs in turn).
  const [tab, setTab] = useState<ProductTab>('basicInfo')

  if (!order || !product || !effectiveProduct) return null

  const handleDownloadPdf = async () => {
    const ok = await generateAndDownloadProductionSheet(product.id, order.id)
    if (!ok) showError('PDF could not be generated')
  }

  // Any role may reassign a product. Writes the ASSIGNEE_CHANGED history entry
  // alongside the product update.
  const handleAssigneeChange = (assignee: { id: string; name: string } | null) => {
    if ((assignee?.id ?? null) === (product.assignee_id ?? null)) return
    const previousUser = product.assignee_id ? users.find(u => u.id === product.assignee_id) : null
    setProductAssignee.mutate(
      {
        id: product.id,
        orderId: product.order_id,
        assignee,
        previousAssignee: previousUser ? { id: previousUser.id, name: previousUser.name } : null,
      },
      { onError: () => showError('Assignee could not be changed') },
    )
  }

  const customerMeetsPrepressRequirements = customerMeetsPrepressContact(order.customers)
  // Nothing is required while the parent order is still a quote (order-level rule).
  const shouldValidate = order.status !== 'QUOTE'

  // Once DONE the product is read-only.
  const isDone = product.status === 'DONE'

  // Past setup somebody has to own the product; flag the picker while nobody does.
  const needsAssignee = isMissingAssignee(product)

  const fileIds = fileAssignments
    .filter(assignment => assignment.product_id === product.id)
    .map(assignment => assignment.file_id)

  return (
    <div
      data-testid={IDS.root}
      data-product-id={product.id}
      data-status={product.status}
      data-department={product.department}
      // Fills the hosting column so the basic-info tab can pin its quick-log
      // widget to the bottom; taller content still scrolls in the host.
      className="flex flex-1 flex-col gap-4"
    >
      <div aria-label="Product" className="flex flex-col gap-2 pt-2">
        <div className="flex items-center gap-6">
          <h1 data-testid={IDS.title} className="flex items-baseline gap-2">
            {departmentLabel(product.department)}
            <span>-</span>
            {product.product_number}
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-muted-foreground">Assigned to</span>
            <EmployeeCombobox
              // A fresh picker per product, so switching to an assigned product
              // does not play the settle meant for assigning this one.
              key={product.id}
              testId={IDS.assignee}
              value={product.assignee_id}
              onChange={handleAssigneeChange}
              disabled={isDone || setProductAssignee.isPending}
              attention={needsAssignee}
            />
            {needsAssignee && (
              <span
                data-testid={IDS.assigneeHint}
                className="animate-in fade-in zoom-in-75 text-xs font-medium text-destructive"
              >
                Assign this product
              </span>
            )}
          </div>
        </div>
        {/* min-h-10 = the release button's height, so the row keeps its height
            for products that have no button (done, or the order is a quote). */}
        <div className="flex min-h-10 items-center">
          <span data-testid={IDS.status} data-status={product.status} className="contents">
            <StatusBadge meta={PRODUCT_STATUS_META[product.status]} />
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid={IDS.pdfButton}
              onClick={() => void handleDownloadPdf()}
            >
              <FileDown />
              Download PDF
            </Button>

            {removal.canDelete ? (
              <Button
                type="button"
                variant="ghost"
                data-testid={IDS.deleteButton}
                disabled={removal.pending}
                onClick={() => void removal.requestDelete()}
                size="sm"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 />
                Delete product
              </Button>
            ):(
              <Button
                type="button"
                variant="ghost"
                data-testid={IDS.cancelButton}
                disabled={!removal.canCancel || removal.pending}
                onClick={() => void removal.requestCancel()}
                size="sm"
                className="text-destructive hover:text-destructive"
              >
                <Ban />
                Cancel product
              </Button>
            )}
          </div>

          <ProductReleaseButton product={product} orderNumber={order.order_number ?? null} />
        </div>
      </div>
      
      <Separator />

      {shouldValidate && !customerMeetsPrepressRequirements && (
        <p className="text-xs italic text-muted-foreground">For auto-PREPRESS: Customer needs name and email or phone.</p>
      )}
      <Tabs value={tab} onValueChange={value => setTab(value as ProductTab)} className="flex-1 gap-3">
        <TabsList aria-label="Product sections">
          <TabsTrigger value="basicInfo" data-testid={IDS.tabs.basicInfo} className="px-3 text-sm">
            <Package />
            Basic info
          </TabsTrigger>
          <TabsTrigger value="timeLogs" data-testid={IDS.tabs.timeLogs} className="px-3 text-sm">
            <Clock />
            Time logs
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid={IDS.tabs.settings} className="px-3 text-sm">
            <SlidersHorizontal />
            Settings
          </TabsTrigger>
          <TabsTrigger value="files" data-testid={IDS.tabs.files} className="px-3 text-sm">
            <Paperclip />
            Files
          </TabsTrigger>
        </TabsList>


        <TabsContent value="basicInfo" className="flex flex-col gap-4">
          <ProductProductionBanner product={product} />
          <ProductBasicInfo
            order={order}
            product={product}
            orderFiles={orderFiles}
            fileIds={fileIds}
            shortages={shortages}
          />

          {/* Quick time entry without leaving the spec; the full log is one
              click away. Pinned to the bottom of the column (mt-auto). */}
          {!isDone && (
            <QuickTimeLog
              orderId={order.id}
              productId={product.id}
              onShowAll={() => setTab('timeLogs')}
              className="mt-auto"
            />
          )}
        </TabsContent>

        {/* Inactive tabs unmount, so the per-product log query runs only while this tab is open. */}
        <TabsContent value="timeLogs">
          <ProductTimeLogs orderId={order.id} productId={product.id} disabled={isDone} />
        </TabsContent>

        <TabsContent value="settings" className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            These settings override the order's settings for this product only.
          </p>
          <ProductSettingsSection
            order={order}
            product={product}
            effectiveProduct={effectiveProduct}
            orderFiles={orderFiles}
            onOrderFilesChanged={onOrderFilesChanged}
          />
        </TabsContent>

        <TabsContent value="files">
          <OrderFiles orderId={order.id} files={orderFiles} onFileChanged={onOrderFilesChanged} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
