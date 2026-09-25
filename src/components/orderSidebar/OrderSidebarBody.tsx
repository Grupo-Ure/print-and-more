import {
  Copy,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ClosedDate, DueDate } from '../DueDate';
import { isDeadlineMissed, isMissingInfo } from '../../lib/jobShared';
import type { OrderListEntry } from '../../services/orderService';
import type { OrderStatus } from '../../types/database';
import { StatusBadge } from '../StatusBadge';
import { DeadlineMissedFlag, HighPriorityFlag, MissingInfoFlag } from '../Flags';
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
  // Derived, not stored: any job past setup without an assignee, or in
  // production failing the completeness check (typically a force-released
  // one), flags the order.
  const missingInfo = (order.jobs ?? []).some((job) =>
    isMissingInfo(
      job,
      order,
      (job.department_products[0]?.count ?? 0) > 0,
    ),
  );
  // Same for a missed deadline: any open job past its effective deadline.
  const deadlineMissed = (order.jobs ?? []).some((job) => isDeadlineMissed(job, order));

  return (
    <div
      className={cn(
        'group flex box-border px-3 py-2 border-l-6 border-neutral-100 h-32 cursor-pointer text-left bg-white hover:bg-neutral-100 border-t-3',
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
      <div className="flex-1 min-w-0 flex flex-col justify-between gap-0.5">
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center min-w-0 flex-1 gap-1">
            <h2
              data-testid={IDS.rowCustomer}
              className="truncate font-semibold"
              title={order.customers?.name ?? undefined}
            >
              {order.customers?.name ?? '-'}
            </h2>
            {missingInfo && <MissingInfoFlag size={16} />}
            {deadlineMissed && <DeadlineMissedFlag size={16} />}
            {order.priority === 'HIGH' && (
              <HighPriorityFlag size={16} animate />
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
        <JobDepartmentIcons jobs={order.jobs ?? []} className="shrink-0" />
        <div className="flex items-center justify-between gap-1.5">
          {order.status === 'FINISHED' || order.status === 'BILLED' ? (
            <ClosedDate
              label={order.status === 'FINISHED' ? 'Finished' : 'Billed'}
              at={closedAt(order)}
              testId={IDS.rowDeadline}
            />
          ) : (
            <DueDate deadline={order.deadline} testId={IDS.rowDeadline} />
          )}
          <span data-testid={IDS.rowStatus} data-status={order.status}>
            <StatusBadge meta={ORDER_STATUS_META[order.status]} />
          </span>
        </div>
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

/**
 * When a finished or billed order reached that status: its newest matching
 * closing event (the list embeds them newest first). A reopened order keeps
 * its old ORDER_FINISHED, but the next finish writes a newer one.
 */
function closedAt(order: OrderListEntry): string | null {
  const events = order.closing_events ?? [];
  const match =
    order.status === 'FINISHED'
      ? events.find((e) => e.event_type === 'ORDER_FINISHED')
      : events.find((e) => e.event_type === 'ORDER_BILLED' || e.event_type === 'ORDER_CLOSED_CASH');
  return match?.created_at ?? null;
}
