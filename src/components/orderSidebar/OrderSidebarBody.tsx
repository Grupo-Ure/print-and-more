import { AlertTriangle, ArrowUp, Copy, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateDe } from '../../lib/formatDate'
import { uniqueDepartments } from '../../lib/orderDepartments'
import type { OrderListEntry } from '../../services/orderService'
import { DepartmentPill } from '../DepartmentPill'
import { StatusBadge } from '../StatusBadge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type Props = {
  orders: OrderListEntry[]
  activeOrderId: string | null
  onSelectOrder: (id: string) => void
  isLoading: boolean
  isFetching: boolean
  isEmpty: boolean
  onResetFilters: () => void
  onDuplicate: (orderId: string) => void
  duplicateBusy: boolean
}

const MAX_DEPARTMENT_TAGS = 4

export function OrderSidebarBody({
  orders,
  activeOrderId,
  onSelectOrder,
  isLoading,
  isFetching,
  isEmpty,
  onResetFilters,
  onDuplicate,
  duplicateBusy,
}: Props) {
  return (
    <div
      className={cn(
        'flex-1 min-h-0 overflow-y-auto transition-opacity duration-150',
        isFetching && !isLoading ? 'opacity-50' : 'opacity-100',
      )}
    >
      {isLoading && <div className="p-4 text-neutral-500 text-[13px]">Loading...</div>}
      {isEmpty && (
        <div className="p-4 text-neutral-500 text-[13px]">
          <div className="mb-2">No orders found</div>
          <button
            type="button"
            onClick={onResetFilters}
            className="inline p-0 m-0 border-0 bg-transparent text-blue-600 hover:text-blue-700 text-xs underline underline-offset-2 cursor-pointer"
          >
            Reset filters
          </button>
        </div>
      )}
      {isFetching && !isLoading && (
        <div className="py-1 pl-4 pr-3 text-[11px] text-neutral-400">Refreshing…</div>
      )}
      {!isLoading &&
        orders.map(order => (
          <OrderSidebarItem
            key={order.id}
            order={order}
            isActive={order.id === activeOrderId}
            onSelect={onSelectOrder}
            onDuplicate={onDuplicate}
            duplicateBusy={duplicateBusy}
          />
        ))}
    </div>
  )
}

type OrderSidebarItemProps = {
  order: OrderListEntry
  isActive: boolean
  onSelect: (id: string) => void
  onDuplicate: (orderId: string) => void
  duplicateBusy: boolean
}

function OrderSidebarItem({
  order,
  isActive,
  onSelect,
  onDuplicate,
  duplicateBusy,
}: OrderSidebarItemProps) {
  return (
    <div
      className={cn(
        'group flex box-border p-3 border-l-6 border-neutral-200 cursor-pointer text-left bg-white hover:bg-neutral-100',
        isActive && 'bg-primary/8 border-l-primary',
      )}
      onClick={() => onSelect(order.id)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(order.id)
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center min-w-0 flex-1 gap-1">
            <h2 className="truncate font-semibold!">
              {order.customers?.name ?? '—'}
            </h2>
            {order.is_emergency && (
              <span title='Emergency order'>
                <AlertTriangle
                  size={16}
                  className="text-red-700 shrink-0"
                  aria-label="Emergency"
                  />
                </span>
            )}
            {order.priority === 'HIGH' && (
              <span title='High Priority'>
                <ArrowUp
                  size={16}
                  className="text-blue-600 shrink-0"
                  aria-label="High priority"
                  />
                </span>
            )}
          </div>
          <span className="text-base text-neutral-400 shrink-0 tracking-wide">
            {formatDateDe(order.created_at)}
          </span>
          <OrderSidebarItemMenu
            isActive={isActive}
            duplicateBusy={duplicateBusy}
            onDuplicate={() => onDuplicate(order.id)}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between">
          <StatusBadge status={order.status} />
          <OrderDepartmentPills subOrders={order.sub_orders} />
        </div>
      </div>
    </div>
  )
}

function OrderDepartmentPills({
  subOrders,
}: {
  subOrders: OrderListEntry['sub_orders']
}) {
  const departments = uniqueDepartments(subOrders)
  const visible = departments.slice(0, MAX_DEPARTMENT_TAGS)
  const extraCount = departments.length - MAX_DEPARTMENT_TAGS

  return (
    <div className="flex items-center gap-2">
      {visible.map(department => (
        <DepartmentPill key={department} department={department} />
      ))}
      {extraCount > 0 && (
        <span className="inline-block text-[9px] px-1.25 py-px bg-neutral-100 border border-neutral-200 text-neutral-500 font-semibold">
          +{extraCount}
        </span>
      )}
    </div>
  )
}

type OrderSidebarItemMenuProps = {
  isActive: boolean
  duplicateBusy: boolean
  onDuplicate: () => void
}

function OrderSidebarItemMenu({
  isActive,
  duplicateBusy,
  onDuplicate,
}: OrderSidebarItemMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={e => e.stopPropagation()}
          onKeyDown={e => e.stopPropagation()}
          aria-label="Order actions"
          className={cn(
            'ml-2 self-start shrink-0 rounded p-1 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900 cursor-pointer',
            'opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 focus-visible:opacity-100',
            isActive && 'opacity-100',
          )}
        >
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={e => e.stopPropagation()} className='w-40'>
        <DropdownMenuItem
          disabled={duplicateBusy}
          onSelect={() => onDuplicate()}
          className='text-base hover:text-primary font-medium'
        >
          <Copy />
          Duplicate order
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
