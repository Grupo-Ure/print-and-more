import {
  AlertTriangle,
  ArrowUp,
  Copy,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateDe } from '../../lib/formatDate';
import { isInProductionMissingInfo } from '../../lib/jobShared';
import type { OrderListEntry } from '../../services/orderService';
import type { OrderStatus } from '../../types/database';
import { StatusBadge } from '../StatusBadge';
import { ORDER_STATUS_META } from '../../const/orderStatus';
import { JobDepartmentIcons } from '../JobDepartmentIcons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TEST_IDS } from '@e2e/support/testIds';

const IDS = TEST_IDS.orders.sidebar;

type Props = {
  orders: OrderListEntry[];
  activeOrderId: string | null;
  onSelectOrder: (id: string) => void;
  isLoading: boolean;
  isFetching: boolean;
  isEmpty: boolean;
  onDuplicate: (orderId: string) => void;
  duplicateBusy: boolean;
  onDelete: (orderId: string) => void;
};

export function OrderSidebarBody({
  orders,
  activeOrderId,
  onSelectOrder,
  isLoading,
  isFetching,
  isEmpty,
  onDuplicate,
  duplicateBusy,
  onDelete,
}: Props) {
  return (
    <div
      data-testid={IDS.list}
      className={cn(
        'flex-1 min-h-0 overflow-y-auto transition-opacity duration-150',
        isFetching && !isLoading ? 'opacity-50' : 'opacity-100',
      )}
    >
      {isLoading && (
        <div className="p-4 text-neutral-500 text-[13px]">Loading...</div>
      )}
      {isEmpty && (
        <div
          data-testid={IDS.empty}
          className="flex h-full items-center justify-center p-6 text-center text-sm text-neutral-500"
        >
          There are no orders yet.
        </div>
      )}
      {!isLoading &&
        orders.map((order) => (
          <OrderSidebarItem
            key={order.id}
            order={order}
            isActive={order.id === activeOrderId}
            onSelect={onSelectOrder}
            onDuplicate={onDuplicate}
            duplicateBusy={duplicateBusy}
            onDelete={onDelete}
          />
        ))}
    </div>
  );
}

type OrderSidebarItemProps = {
  order: OrderListEntry;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDuplicate: (orderId: string) => void;
  duplicateBusy: boolean;
  onDelete: (orderId: string) => void;
};

function OrderSidebarItem({
  order,
  isActive,
  onSelect,
  onDuplicate,
  duplicateBusy,
  onDelete,
}: OrderSidebarItemProps) {
  // Derived, not stored: any job in production that fails the completeness
  // check (typically a force-released one) flags the order.
  const missingInfoInProduction = (order.jobs ?? []).some((job) =>
    isInProductionMissingInfo(
      job,
      order,
      (job.department_products[0]?.count ?? 0) > 0,
    ),
  );

  return (
    <div
      className={cn(
        'group flex box-border p-3 border-l-6 border-neutral-200 cursor-pointer text-left bg-white hover:bg-neutral-100',
        isActive && 'bg-primary/8 border-l-primary',
      )}
      onClick={() => onSelect(order.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(order.id);
        }
      }}
      role="button"
      tabIndex={0}
      data-testid={IDS.row}
      data-order-id={order.id}
      data-status={order.status}
      aria-current={isActive ? 'true' : undefined}
    >
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center min-w-0 flex-1 gap-1">
            <h2
              data-testid={IDS.rowNumber}
              className="truncate font-semibold"
              title={order.customers?.name ?? undefined}
            >
              {order.customers?.name ?? '-'}
            </h2>
            {missingInfoInProduction && (
              <span title="In production with missing information">
                <AlertTriangle
                  size={16}
                  className="text-red-700 shrink-0"
                  aria-label="In production with missing information"
                />
              </span>
            )}
            {order.priority === 'HIGH' && (
              <span title="High Priority">
                <ArrowUp
                  size={16}
                  className="text-blue-600 shrink-0"
                  aria-label="High priority"
                />
              </span>
            )}
          </div>
          <OrderSidebarItemMenu
            isActive={isActive}
            duplicateBusy={duplicateBusy}
            onDuplicate={() => onDuplicate(order.id)}
            orderStatus={order.status}
            onDelete={() => onDelete(order.id)}
          />
        </div>
        <div className="flex items-center justify-between gap-1.5">
        <span
          data-testid={IDS.rowCustomer}
          className="truncate min-w-0 text-[13px] text-neutral-500"
          title={order.deadline ? formatDateDe(order.deadline) : undefined}
        >
          {"deadline: "}
          {order.deadline ? formatDateDe(order.deadline) : 'no deadline'}
        </span>
          <span data-testid={IDS.rowStatus} data-status={order.status}>
            <StatusBadge meta={ORDER_STATUS_META[order.status]} />
          </span>
        </div>
          <JobDepartmentIcons jobs={order.jobs ?? []} className="shrink-0" />
      </div>
    </div>
  );
}

type OrderSidebarItemMenuProps = {
  isActive: boolean;
  duplicateBusy: boolean;
  onDuplicate: () => void;
  orderStatus: OrderStatus;
  onDelete: () => void;
};

function OrderSidebarItemMenu({
  isActive,
  duplicateBusy,
  onDuplicate,
  orderStatus,
  onDelete,
}: OrderSidebarItemMenuProps) {
  const canDelete = orderStatus === 'QUOTE';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          aria-label="Order actions"
          data-testid={IDS.rowMenuTrigger}
          className={cn(
            'ml-2 self-start shrink-0 rounded p-1 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900 cursor-pointer',
            'opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 focus-visible:opacity-100',
            isActive && 'opacity-100',
          )}
        >
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onClick={(e) => e.stopPropagation()}
        className="w-40"
      >
        <DropdownMenuItem
          data-testid={IDS.rowMenuDuplicate}
          disabled={duplicateBusy}
          onSelect={() => onDuplicate()}
          className="text-base hover:text-primary font-medium"
        >
          <Copy />
          Duplicate order
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid={IDS.rowMenuDelete}
          disabled={!canDelete}
          onSelect={() => onDelete()}
          className="text-base font-medium text-red-600 focus:text-red-700 focus:bg-red-50"
        >
          <Trash2 />
          Delete order
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
