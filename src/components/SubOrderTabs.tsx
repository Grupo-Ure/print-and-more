import { useState } from 'react'
import { Plus } from 'lucide-react'
import { subOrderDepartmentLabel } from '../const/departmentAbbreviation'
import { SUB_ORDER_DEPARTMENTS, type Department } from '../types/database'
import { authService } from '../services/authService'
import { toDateOnly } from '../lib/formatDate'
import { useOrderWorkspace } from '../context/order.context'
import { useOrderById } from '../queries/orderQueries'
import { useSubOrdersByOrderId, useCreateSubOrder } from '../queries/subOrderQueries'
import { useToast } from './Toast'
import { Button } from './ui/button'
import { Tabs, TabsList, TabsTrigger } from './ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'

export function SubOrderTabs() {
  const { activeOrderId, activeSubOrderId, setActiveSubOrder } = useOrderWorkspace()
  const subOrdersQuery = useSubOrdersByOrderId(activeOrderId)
  const [dialogOpen, setDialogOpen] = useState(false)

  const visibleSubOrders = (subOrdersQuery.data ?? []).filter(subOrder => !subOrder.is_cancelled)

  return (
    <>
      {visibleSubOrders.length === 0 ? (
        <div className="flex items-center justify-center">
          <Button
            type="button"
            size="lg"
            variant="ghost"
            onClick={() => setDialogOpen(true)}
            aria-label="Add sub-order"
          >
            <p>Add a sub-order</p>
            <Plus />
          </Button>
        </div>
      ) : (
        <nav className="flex items-center justify-between mgb-4">
          <Tabs
            value={activeSubOrderId ?? undefined}
            onValueChange={setActiveSubOrder}
            className="flex-row items-start gap-2 flex-1 min-w-0"
          >
            <TabsList
              aria-label="Sub-orders"
              variant="line"
              className="grid w-full grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-x-1 gap-y-3 group-data-horizontal/tabs:h-auto"
            >
              {visibleSubOrders.map(subOrder => (
                <TabsTrigger key={subOrder.id} value={subOrder.id}>
                  {subOrderDepartmentLabel(subOrder.department)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Button
            title="Add sub-order"
            type="button"
            size="icon-lg"
            variant="ghost"
            onClick={() => setDialogOpen(true)}
            aria-label="Add sub-order"
          >
            <Plus />
          </Button>
        </nav>
      )}

      <AddSubOrderDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}

function todayIso(): string {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

type AddSubOrderDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function AddSubOrderDialog({ open, onOpenChange }: AddSubOrderDialogProps) {
  const { activeOrderId, setActiveSubOrder } = useOrderWorkspace()
  const { showError } = useToast()
  const orderQuery = useOrderById(activeOrderId)
  const createSubOrder = useCreateSubOrder()

  const handleDepartmentSelected = (department: Department) => {
    if (!activeOrderId || createSubOrder.isPending) return
    const order = orderQuery.data
    const deadline = toDateOnly(order?.deadline) ?? todayIso()

    void (async () => {
      const user = await authService.getUser()
      if (!user?.id) {
        showError('Not logged in')
        return
      }
      createSubOrder.mutate(
        {
          order_id: activeOrderId,
          department,
          status: 'INCOMPLETE',
          priority: null,
          detail: {},
          deadline,
          delivery: order?.delivery ?? 'PICKUP',
          assignee_id: user.id,
          is_emergency: false,
          emergency_reason: null,
          is_cancelled: false,
          customer_approval_required: false,
          customer_approval_granted: false,
          customer_approval_file_id: null,
        },
        {
          onSuccess: created => {
            setActiveSubOrder(created.id)
            onOpenChange(false)
          },
          onError: () => showError('Error creating sub-order'),
        },
      )
    })()
  }

  return (
    <Dialog open={open} onOpenChange={next => !createSubOrder.isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Sub-Order</DialogTitle>
          <DialogDescription>Select a department:</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {SUB_ORDER_DEPARTMENTS.map(department => (
            <Button
              key={department}
              type="button"
              variant="outline"
              disabled={createSubOrder.isPending}
              onClick={() => handleDepartmentSelected(department)}
            >
              {subOrderDepartmentLabel(department)}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}