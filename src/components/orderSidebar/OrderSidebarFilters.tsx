import { RotateCcw } from 'lucide-react'
import { DEPARTMENTS, ORDER_STATUS_LIST } from '../../types/database'
import { JOB_DEPARTMENT_LABELS } from '../../const/departmentAbbreviation'
import { ORDER_STATUS_META } from '../../const/orderStatus'
import { cn } from '@/lib/utils'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'
import { PopoverContent } from '../ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { Separator } from '../ui/separator'
import { DateInput } from '../DateInput'
import type { FilterActions, FilterState } from './useOrderSidebarFilter'

const DATE_INPUT_CLASSES =
  'h-8 w-full min-w-0 rounded-md border border-input bg-transparent px-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

function FilterSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-xs font-medium text-muted-foreground mb-1.5">{children}</span>
  )
}

type Props = {
  filter: FilterState
  actions: FilterActions
  /** True when any filter differs from the defaults — enables the reset action. */
  isActive: boolean
  /** Popover on compact devices, inline card below the search bar on desktop. */
  variant: 'popover' | 'inline'
}

export function OrderSidebarFilters({ filter, actions, isActive, variant }: Props) {
  const body = <FilterPanelBody filter={filter} actions={actions} isActive={isActive} />

  if (variant === 'popover') {
    return (
      <PopoverContent align="end" className="w-72 p-3 gap-0 border-gray-200">
        {body}
      </PopoverContent>
    )
  }

  return <div className="mt-2 rounded-lg border border-gray-200 bg-white p-3 shadow-xs">{body}</div>
}

function FilterPanelBody({ filter, actions, isActive }: Omit<Props, 'variant'>) {
  const { statusAll, statusToggles, deadlineFrom, deadlineTo, intakeFrom, intakeTo, department } = filter

  return (
    <>
      <div className="space-y-3.5">
        <div>
          <FilterSectionLabel>Status</FilterSectionLabel>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none pb-1.5">
            <Checkbox
              checked={statusAll}
              onCheckedChange={checked => actions.setStatusAll(checked === true)}
            />
            All statuses
          </label>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
            {ORDER_STATUS_LIST.map(status => (
              <label
                key={status}
                className={cn(
                  'flex items-center gap-2 text-sm cursor-pointer select-none',
                  statusAll && 'opacity-50 cursor-default',
                )}
              >
                <Checkbox
                  checked={statusToggles[status]}
                  disabled={statusAll}
                  onCheckedChange={checked => actions.toggleStatus(status, checked === true)}
                />
                <span className={cn('size-2 shrink-0 rounded-full', ORDER_STATUS_META[status].color)} />
                {ORDER_STATUS_META[status].label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <FilterSectionLabel>Department</FilterSectionLabel>
          <Select
            value={department}
            onValueChange={value => actions.setDepartment(value as FilterState['department'])}
          >
            <SelectTrigger className="h-8 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All departments</SelectItem>
              {DEPARTMENTS.map(dep => (
                <SelectItem key={dep} value={dep}>
                  {JOB_DEPARTMENT_LABELS[dep]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <FilterSectionLabel>Deadline (from / to)</FilterSectionLabel>
          <div className="grid grid-cols-2 gap-2">
            <DateInput
              className={DATE_INPUT_CLASSES}
              aria-label="Deadline from"
              value={deadlineFrom}
              onChange={e => actions.setDeadlineFrom(e.target.value)}
            />
            <DateInput
              className={DATE_INPUT_CLASSES}
              aria-label="Deadline to"
              value={deadlineTo}
              onChange={e => actions.setDeadlineTo(e.target.value)}
            />
          </div>
        </div>

        <div>
          <FilterSectionLabel>Intake (from / to)</FilterSectionLabel>
          <div className="grid grid-cols-2 gap-2">
            <DateInput
              className={DATE_INPUT_CLASSES}
              aria-label="Intake from"
              value={intakeFrom}
              onChange={e => actions.setIntakeFrom(e.target.value)}
            />
            <DateInput
              className={DATE_INPUT_CLASSES}
              aria-label="Intake to"
              value={intakeTo}
              onChange={e => actions.setIntakeTo(e.target.value)}
            />
          </div>
        </div>
      </div>

      <Separator className="my-3" />

      <Button
        variant="ghost"
        size="sm"
        disabled={!isActive}
        onClick={actions.reset}
        className="w-full text-muted-foreground"
      >
        <RotateCcw />
        Reset filters
      </Button>
    </>
  )
}
